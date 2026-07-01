/**
 * Web voice-agent hook. Wraps the Vercel AI SDK's `experimental_useRealtime`
 * (gateway WebSocket + mic capture + playback) and exposes the shared
 * `VoiceAgent` shape the chat screen consumes. A short-lived token is minted by
 * `app/api/realtime-token+api.ts`, so no provider key reaches the client.
 *
 * Native uses `use-voice-agent.ts` (the custom engine); both return the same
 * interface.
 *
 * Docs: https://vercel.com/blog/realtime-voice-agents-on-ai-gateway
 */
import { useVoiceSettings } from "@/components/voice/voice-settings-context";
import type { TranscriptEntry, VoiceStatus } from "@/utils/grok-voice";
import { gateway } from "@ai-sdk/gateway";
import {
  experimental_useRealtime as useRealtime,
  type UIMessage,
} from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type SharedValue, useSharedValue } from "react-native-reanimated";

export interface VoiceAgent {
  status: VoiceStatus;
  error: string | null;
  transcript: TranscriptEntry[];
  isActive: boolean;
  /** Live 0..1 audio level for the waveform (UI-thread shared value). */
  level: SharedValue<number>;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

// Realtime speech-to-speech model, served through the Vercel AI Gateway. Must
// match the model that /api/realtime-token mints tokens for.
const REALTIME_MODEL = "xai/grok-voice-think-fast-1.0";

/** Concatenate the text parts of a realtime UIMessage. */
function textFromMessage(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

export function useVoiceAgent(): VoiceAgent {
  const [error, setError] = useState<string | null>(null);
  const { sessionConfig: settings } = useVoiceSettings();
  const level = useSharedValue(0);
  const meterRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);

  const stopMeter = useCallback(() => {
    if (meterRef.current) {
      cancelAnimationFrame(meterRef.current.raf);
      meterRef.current.ctx.close().catch(() => {});
      meterRef.current = null;
    }
  }, []);

  // Tap the mic stream with an AnalyserNode to feed the waveform a real level.
  const startMeter = useCallback(
    (stream: MediaStream) => {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        level.value = Math.max(0, Math.min(1, Math.sqrt(sum / data.length) * 6));
        const raf = requestAnimationFrame(tick);
        if (meterRef.current) meterRef.current.raf = raf;
      };
      meterRef.current = { ctx, raf: requestAnimationFrame(tick) };
    },
    [level],
  );

  const model = useMemo(
    () => gateway.experimental_realtime(REALTIME_MODEL),
    [],
  );
  const sessionConfig = useMemo(
    () => ({
      voice: settings.voice,
      instructions: settings.instructions,
      turnDetection: { type: "server-vad" as const },
      inputAudioTranscription: {},
    }),
    [settings.voice, settings.instructions],
  );

  const {
    status,
    messages,
    isPlaying,
    connect,
    disconnect,
    startAudioCapture,
    stopAudioCapture,
  } = useRealtime({
    model,
    api: { token: "/api/realtime-token" },
    sessionConfig,
    onError: (e) => setError(e.message),
  });

  const isActive = status === "connecting" || status === "connected";

  // Flatten the waveform once the session is no longer active.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- reanimated shared-value writes are safe; the compiler rule doesn't model them
    if (!isActive) level.value = 0;
  }, [isActive, level]);

  const stop = useCallback(() => {
    stopMeter();
    stopAudioCapture();
    disconnect();
  }, [disconnect, stopAudioCapture, stopMeter]);

  const start = useCallback(async () => {
    setError(null);
    try {
      await connect();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      startAudioCapture(stream);
      startMeter(stream);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      stop();
    }
  }, [connect, startAudioCapture, startMeter, stop]);

  const toggle = useCallback(() => {
    if (isActive) stop();
    else start();
  }, [isActive, start, stop]);

  const voiceStatus: VoiceStatus =
    status === "connecting"
      ? "connecting"
      : status === "error"
        ? "error"
        : status === "connected"
          ? isPlaying
            ? "speaking"
            : "listening"
          : "idle";

  const transcript: TranscriptEntry[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      text: textFromMessage(m),
    }))
    .filter((entry) => entry.text.length > 0);

  return {
    status: voiceStatus,
    error,
    transcript,
    isActive,
    level,
    start,
    stop,
    toggle,
  };
}
