/**
 * Holds the user's voice-agent settings (selected voice + personality) so the
 * settings sheet and the voice screens share one source of truth. Provided once
 * near the app root; read by `voice.tsx` / `voice.web.tsx` and the sheet.
 *
 * In-memory for the demo (mirrors `model-context`); swap in persistence later.
 */
import React, { createContext, use, useMemo, useState } from "react";
import {
  DEFAULT_PERSONALITY_ID,
  DEFAULT_VOICE_ID,
  resolveVoiceConfig,
} from "./voice-settings";

interface VoiceSettingsValue {
  voiceId: string;
  personalityId: string;
  setVoiceId: (id: string) => void;
  setPersonalityId: (id: string) => void;
  /** The resolved `{ voice, instructions }` the realtime session consumes. */
  sessionConfig: { voice: string; instructions: string };
}

const VoiceSettingsContext = createContext<VoiceSettingsValue | null>(null);

export function VoiceSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [personalityId, setPersonalityId] = useState(DEFAULT_PERSONALITY_ID);

  const sessionConfig = useMemo(
    () => resolveVoiceConfig(voiceId, personalityId),
    [voiceId, personalityId],
  );

  const value = useMemo(
    () => ({ voiceId, personalityId, setVoiceId, setPersonalityId, sessionConfig }),
    [voiceId, personalityId, sessionConfig],
  );

  return (
    <VoiceSettingsContext value={value}>{children}</VoiceSettingsContext>
  );
}

export function useVoiceSettings() {
  const context = use(VoiceSettingsContext);
  if (!context) {
    throw new Error(
      "useVoiceSettings must be used within a VoiceSettingsProvider",
    );
  }
  return context;
}
