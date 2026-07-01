/**
 * Web implementation of the Grok Voice Agent.
 *
 * Uses the browser Web Audio API: `getUserMedia` (with built-in echo
 * cancellation) + an AudioWorklet for mic capture, and AudioContext scheduling
 * for playback. The WebSocket authenticates via a subprotocol because browsers
 * can't set request headers on a WebSocket.
 */
import {
  type AudioBackend,
  decodePCM16Base64,
  encodePCM16Base64,
  type GrokVoiceConfig,
  type GrokVoiceHandlers,
  GrokVoiceCore,
  levelFromFloat,
  REALTIME_URL,
  SAMPLE_RATE,
} from "./grok-voice-core";

export {
  type GrokVoiceHandlers,
  type TranscriptEntry,
  type VoiceStatus,
} from "./grok-voice-core";

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

class WebAudioBackend implements AudioBackend {
  private micStream: MediaStream | null = null;
  private captureCtx: AudioContext | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackCtx: AudioContext | null = null;
  private playCursor = 0;
  private onLevel: ((level: number) => void) | null = null;

  openSocket(clientSecret: string): WebSocket {
    // Browsers can't set Authorization headers on a WebSocket, so the ephemeral
    // token is passed via the subprotocol with xAI's prefix.
    return new WebSocket(REALTIME_URL, [`xai-client-secret.${clientSecret}`]);
  }

  async startCapture(
    onChunk: (base64: string) => void,
    onLevel: (level: number) => void,
  ) {
    this.onLevel = onLevel;
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
      const frame = event.data as Float32Array;
      onLevel(levelFromFloat(frame));
      onChunk(encodePCM16Base64(frame));
    };
    source.connect(node);
    // Keep the node processing without routing mic to speakers.
    node.connect(ctx.destination);
  }

  playChunk(base64: string) {
    if (!this.playbackCtx) {
      this.playbackCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    const ctx = this.playbackCtx;
    const float32 = decodePCM16Base64(base64);
    if (float32.length === 0) return;
    this.onLevel?.(levelFromFloat(float32));

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

  teardown() {
    this.captureNode?.disconnect();
    this.captureNode = null;
    this.captureCtx?.close().catch(() => {});
    this.captureCtx = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.playbackCtx?.close().catch(() => {});
    this.playbackCtx = null;
    this.playCursor = 0;
  }
}

export class GrokVoiceSession extends GrokVoiceCore {
  constructor(handlers: GrokVoiceHandlers = {}, config: GrokVoiceConfig = {}) {
    super(handlers, new WebAudioBackend(), config);
  }
}
