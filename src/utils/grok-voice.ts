/**
 * Browser-only realtime client for the Grok Voice Agent API.
 *
 * Flow:
 *   1. Fetch an ephemeral token from our `/api/voice-session` route.
 *   2. Open a WebSocket to `wss://api.x.ai/v1/realtime`.
 *   3. Capture mic audio as 24kHz PCM16 and stream it up as
 *      `input_audio_buffer.append` events.
 *   4. Play back `response.output_audio.delta` chunks (base64 PCM16).
 *
 * Server-side Voice Activity Detection (VAD) handles turn-taking, so we just
 * stream audio continuously while the session is live.
 *
 * Docs: https://docs.x.ai/developers/model-capabilities/audio/voice
 */

const MODEL = "grok-voice-latest";
const REALTIME_URL = `wss://api.x.ai/v1/realtime?model=${MODEL}`;
const SAMPLE_RATE = 24_000;

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
}

// AudioWorklet that forwards raw mic frames to the main thread. Inlined as a
// Blob so there's no separate static asset to serve.
const CAPTURE_WORKLET = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      this.port.postMessage(input[0].slice(0));
    }
    return true;
  }
}
registerProcessor('grok-capture', CaptureProcessor);
`;

function floatToPCM16(float32: Float32Array): ArrayBuffer {
  const pcm = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm.buffer;
}

function pcm16ToFloat(buffer: ArrayBuffer): Float32Array {
  const pcm = new Int16Array(buffer);
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    float32[i] = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export class GrokVoiceSession {
  private ws: WebSocket | null = null;
  private micStream: MediaStream | null = null;
  private captureCtx: AudioContext | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackCtx: AudioContext | null = null;
  private playCursor = 0;
  private handlers: GrokVoiceHandlers;
  private assistantBuffer = "";

  constructor(handlers: GrokVoiceHandlers = {}) {
    this.handlers = handlers;
  }

  async start() {
    this.setStatus("connecting");
    try {
      const res = await fetch("/api/voice-session");
      const data = await res.json();
      if (!res.ok || !data.clientSecret) {
        throw new Error(data.error ?? "Could not create voice session.");
      }
      await this.openSocket(data.clientSecret);
      await this.startMic();
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  private openSocket(clientSecret: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Browsers can't set Authorization headers on a WebSocket, so the
      // ephemeral token is passed via the subprotocol list.
      const ws = new WebSocket(REALTIME_URL, [
        "realtime",
        `xai-insecure-api-key.${clientSecret}`,
      ]);
      this.ws = ws;

      ws.onopen = () => {
        this.send({
          type: "session.update",
          session: {
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            turn_detection: { type: "server_vad" },
            input_audio_transcription: { enabled: true },
          },
        });
        this.setStatus("listening");
        resolve();
      };
      ws.onmessage = (event) => this.handleMessage(event);
      ws.onerror = () => reject(new Error("WebSocket connection failed."));
      ws.onclose = () => {
        if (this.ws === ws) this.stop();
      };
    });
  }

  private async startMic() {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.captureCtx = ctx;
    const blobUrl = URL.createObjectURL(
      new Blob([CAPTURE_WORKLET], { type: "application/javascript" }),
    );
    await ctx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);

    const source = ctx.createMediaStreamSource(this.micStream);
    const node = new AudioWorkletNode(ctx, "grok-capture");
    this.captureNode = node;
    node.port.onmessage = (event) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const pcm = floatToPCM16(event.data as Float32Array);
      this.send({
        type: "input_audio_buffer.append",
        audio: arrayBufferToBase64(pcm),
      });
    };
    source.connect(node);
    // Keep the node processing without routing mic to speakers.
    node.connect(ctx.destination);
  }

  private handleMessage(event: MessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "response.output_audio.delta":
      case "response.audio.delta": {
        if (msg.delta) {
          this.setStatus("speaking");
          this.enqueueAudio(base64ToArrayBuffer(msg.delta));
        }
        break;
      }
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
        this.assistantBuffer += msg.delta ?? "";
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const text = msg.transcript ?? this.assistantBuffer;
        if (text) this.emitTranscript("assistant", text, msg.response_id);
        this.assistantBuffer = "";
        break;
      }
      case "error":
        this.fail(msg.error?.message ?? "Realtime API error.");
        break;
    }
  }

  private enqueueAudio(buffer: ArrayBuffer) {
    if (!this.playbackCtx) {
      this.playbackCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    const ctx = this.playbackCtx;
    const float32 = pcm16ToFloat(buffer);
    if (float32.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (this.playCursor < now) this.playCursor = now;
    source.start(this.playCursor);
    this.playCursor += audioBuffer.duration;
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
    if (this.ws?.readyState === WebSocket.OPEN) {
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
    this.captureNode?.disconnect();
    this.captureNode = null;
    this.captureCtx?.close().catch(() => {});
    this.captureCtx = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.playbackCtx?.close().catch(() => {});
    this.playbackCtx = null;
    this.playCursor = 0;
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
