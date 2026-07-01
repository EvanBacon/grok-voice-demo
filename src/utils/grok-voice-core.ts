/**
 * Platform-agnostic core for the Grok realtime Voice Agent.
 *
 * Owns everything that's identical on web and native: fetching the ephemeral
 * token, the WebSocket lifecycle, and the realtime event protocol. Audio I/O
 * (mic capture, playback, and how the socket authenticates) is delegated to an
 * `AudioBackend`, which each platform implements with its own audio stack.
 *
 * Docs: https://docs.x.ai/developers/model-capabilities/audio/voice
 */

export const MODEL = "grok-voice-latest";
export const REALTIME_URL = `wss://api.x.ai/v1/realtime?model=${MODEL}`;
export const SAMPLE_RATE = 24_000;

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "error";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface GrokVoiceHandlers {
  onStatus?: (status: VoiceStatus) => void;
  onTranscript?: (entry: TranscriptEntry) => void;
  onError?: (message: string) => void;
  /** Normalized 0..1 audio level (mic while listening, playback while speaking). */
  onLevel?: (level: number) => void;
}

/** Client-side overrides for the session (from Voice Settings). */
export interface GrokVoiceConfig {
  voice?: string;
  instructions?: string;
}

export interface VoiceSession {
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * The platform-specific audio + transport layer the core drives.
 */
export interface AudioBackend {
  /** Open the realtime socket with platform-appropriate authentication. */
  openSocket: (clientSecret: string) => WebSocket;
  /**
   * Begin mic capture. `onChunk` receives base64 PCM16 @ 24kHz mono to send
   * upstream; `onLevel` receives the mic's normalized 0..1 level per frame.
   */
  startCapture: (
    onChunk: (base64Pcm16: string) => void,
    onLevel: (level: number) => void,
  ) => Promise<void>;
  /** Play a base64 PCM16 @ 24kHz mono chunk from the assistant. */
  playChunk: (base64Pcm16: string) => void;
  /** Release the mic, playback graph, and any audio session. */
  teardown: () => void;
}

/** Root-mean-square of a frame, boosted into a display-friendly 0..1 level. */
export function levelFromFloat(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  // Speech RMS is ~0.02–0.2; scale so normal talking fills the meter.
  return Math.max(0, Math.min(1, rms * 6));
}

/** Linear-resample mono Float32 audio from `inRate` to `outRate`. */
export function resampleLinear(
  input: Float32Array,
  inRate: number,
  outRate: number,
): Float32Array {
  if (inRate === outRate || input.length === 0) return input;
  const ratio = inRate / outRate;
  const outLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx];
    const b = idx + 1 < input.length ? input[idx + 1] : a;
    output[i] = a + (b - a) * frac;
  }
  return output;
}

// --- PCM16 <-> base64 helpers (pure JS, no atob/btoa so they run on Hermes) ---

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64.indexOf(clean[i]);
    const c1 = B64.indexOf(clean[i + 1]);
    const c2 = B64.indexOf(clean[i + 2]);
    const c3 = B64.indexOf(clean[i + 3]);
    if (p < len) bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (p < len && c2 >= 0) bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (p < len && c3 >= 0) bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes;
}

/** Float32 samples (-1..1) -> base64-encoded little-endian PCM16. */
export function encodePCM16Base64(float32: Float32Array): string {
  const bytes = new Uint8Array(float32.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytesToBase64(bytes);
}

/** base64-encoded little-endian PCM16 -> Float32 samples (-1..1). */
export function decodePCM16Base64(base64: string): Float32Array {
  const bytes = base64ToBytes(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const float32 = new Float32Array(Math.floor(bytes.length / 2));
  for (let i = 0; i < float32.length; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 / (int16 < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

export class GrokVoiceCore implements VoiceSession {
  private ws: WebSocket | null = null;
  private assistantBuffer = "";
  private assistantId: string | null = null;
  private turn = 0;
  private voice = "eve";
  private instructions = "";

  constructor(
    private handlers: GrokVoiceHandlers,
    private backend: AudioBackend,
    private config: GrokVoiceConfig = {},
  ) {}

  async start() {
    this.setStatus("connecting");
    try {
      const res = await fetch("/api/voice-session");
      const data = await res.json();
      if (!res.ok || !data.clientSecret) {
        throw new Error(data.error ?? "Could not create voice session.");
      }
      // Client settings (Voice Settings) win over the server defaults.
      this.voice = this.config.voice ?? data.voice ?? this.voice;
      this.instructions =
        this.config.instructions ?? data.instructions ?? this.instructions;

      const ws = this.backend.openSocket(data.clientSecret);
      this.ws = ws;

      ws.onopen = async () => {
        this.send({
          type: "session.update",
          session: {
            voice: this.voice,
            instructions: this.instructions,
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            turn_detection: { type: "server_vad" },
            input_audio_transcription: { enabled: true },
            // Server-side filter: drop transcribed input that matches what the
            // agent just said, so it doesn't reply to its own echoed voice.
            enable_echo_detection_filtering: true,
          },
        });
        try {
          await this.backend.startCapture(
            (base64) =>
              this.send({ type: "input_audio_buffer.append", audio: base64 }),
            (level) => this.handlers.onLevel?.(level),
          );
          this.setStatus("listening");
        } catch (error) {
          this.fail(error instanceof Error ? error.message : String(error));
        }
      };
      ws.onmessage = (event) => this.handleMessage(event);
      ws.onerror = () => this.fail("WebSocket connection failed.");
      ws.onclose = () => {
        if (this.ws === ws) this.stop();
      };
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  private handleMessage(event: MessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(typeof event.data === "string" ? event.data : "");
    } catch {
      return;
    }

    switch (msg.type) {
      case "response.output_audio.delta":
      case "response.audio.delta":
        if (msg.delta) {
          this.setStatus("speaking");
          this.backend.playChunk(msg.delta);
        }
        break;
      case "response.output_audio.done":
      case "response.audio.done":
        this.setStatus("listening");
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (msg.transcript) {
          this.emitTranscript("user", msg.transcript, msg.item_id);
        }
        break;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        // Stream the assistant line in as it's spoken, updating one message.
        if (!this.assistantId) {
          this.assistantId =
            msg.response_id ?? msg.item_id ?? `assistant-${this.turn++}`;
        }
        this.assistantBuffer += msg.delta ?? "";
        if (this.assistantBuffer) {
          this.emitTranscript(
            "assistant",
            this.assistantBuffer,
            this.assistantId ?? undefined,
          );
        }
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const text = msg.transcript ?? this.assistantBuffer;
        const id = this.assistantId ?? msg.response_id ?? undefined;
        if (text) this.emitTranscript("assistant", text, id);
        this.assistantBuffer = "";
        this.assistantId = null;
        break;
      }
      case "error":
        this.fail(msg.error?.message ?? "Realtime API error.");
        break;
    }
  }

  private emitTranscript(
    role: "user" | "assistant",
    text: string,
    id?: string,
  ) {
    this.handlers.onTranscript?.({
      id: id ?? `${role}-${text.slice(0, 12)}`,
      role,
      text,
    });
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === 1 /* OPEN */) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private setStatus(status: VoiceStatus) {
    this.handlers.onStatus?.(status);
  }

  private fail(message: string) {
    this.setStatus("error");
    this.handlers.onError?.(message);
    this.stop();
  }

  stop() {
    this.backend.teardown();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
