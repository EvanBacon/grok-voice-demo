/**
 * Voice-agent hook for every platform. Drives the custom `GrokVoiceSession`
 * engine and exposes the shared `VoiceAgent` shape the chat screen consumes.
 *
 * Metro resolves `@/utils/grok-voice` per platform: `grok-voice.native.ts` on
 * native, `grok-voice.ts` (WebAudioBackend) on web. Both mint an ephemeral xAI
 * token from `/api/voice-session` using `XAI_API_KEY` and open the realtime
 * WebSocket with the `xai-client-secret.<token>` subprotocol — no AI Gateway.
 */
import { useVoiceSettings } from "@/components/voice/voice-settings-context";
import {
  GrokVoiceSession,
  type TranscriptEntry,
  type VoiceStatus,
} from "@/utils/grok-voice";
import { useCallback, useEffect, useRef, useState } from "react";
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

export function useVoiceAgent(): VoiceAgent {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const sessionRef = useRef<GrokVoiceSession | null>(null);
  const level = useSharedValue(0);
  const { sessionConfig } = useVoiceSettings();

  const isActive = status !== "idle" && status !== "error";

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setStatus("idle");
  }, []);

  // Flatten the waveform once the session is no longer active.
  useEffect(() => {
    if (!isActive) level.value = 0;
  }, [isActive, level]);

  const start = useCallback(() => {
    setError(null);
    setTranscript([]);
    const session = new GrokVoiceSession(
      {
        onStatus: setStatus,
        onError: (message) => setError(message),
        onLevel: (value) => {
          level.value = value;
        },
        onTranscript: (entry) =>
          setTranscript((prev) => {
            const next = [...prev];
            const existing = next.findIndex((e) => e.id === entry.id);
            if (existing >= 0) next[existing] = entry;
            else next.push(entry);
            return next;
          }),
      },
      sessionConfig,
    );
    sessionRef.current = session;
    session.start();
  }, [sessionConfig, level]);

  const toggle = useCallback(() => {
    if (isActive) stop();
    else start();
  }, [isActive, start, stop]);

  useEffect(() => () => sessionRef.current?.stop(), []);

  return { status, error, transcript, isActive, level, start, stop, toggle };
}
