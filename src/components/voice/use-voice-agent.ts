/**
 * Native voice-agent hook. Drives the custom `GrokVoiceSession` engine (Metro
 * resolves `@/utils/grok-voice` to `grok-voice.native.ts`) and exposes the
 * shared `VoiceAgent` shape the chat screen consumes.
 *
 * Web uses `use-voice-agent.web.ts` (the Vercel AI SDK realtime hook); both
 * return the same interface.
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
