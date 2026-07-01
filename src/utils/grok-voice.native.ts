/**
 * Native (iOS/Android) implementation of the Grok Voice Agent.
 *
 * Uses react-native-audio-api (Software Mansion's Web Audio implementation):
 *   - `AudioRecorder.onAudioReady` streams raw mic PCM frames.
 *   - `AudioBufferQueueSourceNode.enqueueBuffer` plays back streamed chunks.
 *   - `decodePCMInBase64` turns Grok's base64 PCM16 deltas into AudioBuffers.
 *
 * The realtime WebSocket authenticates with the ephemeral token in an
 * `Authorization` header (RN's WebSocket accepts a third `{ headers }` arg).
 * We avoid the subprotocol path because Android historically drops the
 * `Sec-WebSocket-Protocol` header (facebook/react-native#5810).
 *
 * Echo cancellation: on iOS the `voiceChat` audio-session mode engages the
 * hardware VoiceProcessingIO unit (AEC), so the mic doesn't pick up the
 * speaker and the agent stops talking to itself.
 */
import {
  AudioBufferQueueSourceNode,
  AudioContext,
  AudioManager,
  AudioRecorder,
  decodePCMInBase64,
} from "react-native-audio-api";

import {
  type AudioBackend,
  decodePCM16Base64,
  encodePCM16Base64,
  type GrokVoiceConfig,
  type GrokVoiceHandlers,
  GrokVoiceCore,
  levelFromFloat,
  REALTIME_URL,
  resampleLinear,
  SAMPLE_RATE,
} from "./grok-voice-core";

export {
  type GrokVoiceHandlers,
  type TranscriptEntry,
  type VoiceStatus,
} from "./grok-voice-core";

// ~40ms of audio per callback at 24kHz — a low-latency but efficient chunk.
const CAPTURE_BUFFER_LENGTH = 960;

// Keep the mic muted for a short tail after playback ends so room reverb of the
// agent's own voice doesn't leak back in.
const PLAYBACK_TAIL_MS = 250;

class NativeAudioBackend implements AudioBackend {
  private recorder: AudioRecorder | null = null;
  private playCtx: AudioContext | null = null;
  private queueNode: AudioBufferQueueSourceNode | null = null;
  // Serialize async decodes so buffers enqueue in arrival order.
  private decodeChain: Promise<void> = Promise.resolve();
  private onLevel: ((level: number) => void) | null = null;
  private loggedRate = false;
  // Wall-clock (ms) until which the agent's audio is still playing out.
  private playingUntil = 0;

  openSocket(clientSecret: string): WebSocket {
    // RN's WebSocket takes a third options arg with headers (not in DOM types).
    return new (WebSocket as any)(REALTIME_URL, undefined, {
      headers: { Authorization: `Bearer ${clientSecret}` },
    });
  }

  async startCapture(
    onChunk: (base64: string) => void,
    onLevel: (level: number) => void,
  ) {
    this.onLevel = onLevel;
    // Route audio through the voice-chat session so iOS applies hardware echo
    // cancellation while we simultaneously record and play.
    AudioManager.setAudioSessionOptions({
      iosCategory: "playAndRecord",
      iosMode: "voiceChat",
      iosOptions: ["defaultToSpeaker", "allowBluetoothHFP"],
    });
    await AudioManager.setAudioSessionActivity(true);

    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== "Granted") {
      throw new Error("Microphone permission was denied.");
    }

    // Playback graph: a single queue node we keep feeding decoded chunks into.
    this.playCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.queueNode = new AudioBufferQueueSourceNode(this.playCtx);
    this.queueNode.connect(this.playCtx.destination);
    // Pass offset explicitly: start()'s default offset is -1, which its own
    // guard rejects ("offset must be a finite non-negative number: -1").
    this.queueNode.start(0, 0);

    // Capture: deliver mono frames and forward them as base64 PCM16. The
    // device may ignore our requested sample rate (iOS mics are usually
    // 48kHz), so we resample each frame to a true 24kHz before sending —
    // otherwise the server hears wrong-speed audio and VAD never triggers.
    const recorder = new AudioRecorder();
    this.recorder = recorder;
    recorder.onAudioReady(
      {
        sampleRate: SAMPLE_RATE,
        bufferLength: CAPTURE_BUFFER_LENGTH,
        channelCount: 1,
      },
      (event) => {
        // Half-duplex: while the agent is speaking (plus a short tail), drop
        // mic frames so it doesn't hear — and respond to — its own voice.
        if (Date.now() < this.playingUntil + PLAYBACK_TAIL_MS) return;

        const input = event.buffer.getChannelData(0);
        const inRate = event.buffer.sampleRate || SAMPLE_RATE;
        if (__DEV__ && !this.loggedRate) {
          this.loggedRate = true;
          console.log(
            `[grok-voice] mic delivering ${inRate}Hz, resampling to ${SAMPLE_RATE}Hz`,
          );
        }
        const pcm = resampleLinear(input, inRate, SAMPLE_RATE);
        onLevel(levelFromFloat(pcm));
        onChunk(encodePCM16Base64(pcm));
      },
    );
    await recorder.start();
  }

  playChunk(base64: string) {
    const node = this.queueNode;
    if (!node) return;
    const float = decodePCM16Base64(base64);
    // Drive the waveform from the assistant's audio while it speaks.
    this.onLevel?.(levelFromFloat(float));
    // Extend the window during which the mic stays muted (half-duplex).
    const durationMs = (float.length / SAMPLE_RATE) * 1000;
    this.playingUntil = Math.max(Date.now(), this.playingUntil) + durationMs;
    this.decodeChain = this.decodeChain.then(async () => {
      try {
        const buffer = await decodePCMInBase64(base64, SAMPLE_RATE, 1);
        node.enqueueBuffer(buffer);
      } catch {
        // Drop a bad chunk rather than break the queue.
      }
    });
  }

  teardown() {
    try {
      this.recorder?.stop();
    } catch {}
    this.recorder = null;
    try {
      this.queueNode?.stop();
    } catch {}
    this.queueNode = null;
    this.playCtx?.close().catch(() => {});
    this.playCtx = null;
    this.onLevel = null;
    this.playingUntil = 0;
    AudioManager.setAudioSessionActivity(false).catch(() => {});
  }
}

export class GrokVoiceSession extends GrokVoiceCore {
  constructor(handlers: GrokVoiceHandlers = {}, config: GrokVoiceConfig = {}) {
    super(handlers, new NativeAudioBackend(), config);
  }
}
