/**
 * Voice-agent settings catalog — the voices and personalities the settings
 * sheet offers and the session config each one produces.
 *
 * Both map directly to fields the Grok realtime API accepts on `session.update`:
 *   - `voice`        -> the built-in voice id (validated live: eve/ara/rex/sal/leo)
 *   - `instructions` -> the system prompt that shapes the agent's personality
 *
 * (The reference UI also shows Speed, but the realtime API silently drops a
 * `speed` field, so we don't expose a control that wouldn't do anything.)
 */
import type { LucideIcon } from "lucide-react-native";
import { BookOpen, Puzzle, Smile, Sparkles, Stethoscope } from "lucide-react-native";

export interface VoiceOption {
  id: string;
  label: string;
  description: string;
  /** Accent color used for the tile's vibrant fill / tint. */
  color: string;
}

// Built-in xAI voices. Descriptions follow the Grok app's phrasing.
export const VOICES: VoiceOption[] = [
  { id: "ara", label: "Ara", description: "Upbeat Female", color: "#EC4899" },
  { id: "eve", label: "Eve", description: "Soothing Female", color: "#8B5CF6" },
  { id: "leo", label: "Leo", description: "British Male", color: "#3B82F6" },
  { id: "rex", label: "Rex", description: "Confident Male", color: "#F59E0B" },
  { id: "sal", label: "Sal", description: "Balanced Neutral", color: "#10B981" },
];

// Appended to every personality so replies stay speech-friendly.
const SPOKEN_STYLE =
  " Keep replies short and conversational since they will be spoken aloud.";

export interface PersonalityOption {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Accent color used for the tile's vibrant fill / tint. */
  color: string;
  instructions: string;
}

export const PERSONALITIES: PersonalityOption[] = [
  {
    id: "assistant",
    label: "Assistant",
    icon: Smile,
    color: "#6366F1",
    instructions:
      "You are a friendly, helpful voice assistant." + SPOKEN_STYLE,
  },
  {
    id: "therapist",
    label: "Therapist",
    icon: Stethoscope,
    color: "#10B981",
    instructions:
      "You are a warm, empathetic listener. Ask gentle, open-ended questions, " +
      "reflect back what you hear, and never give medical advice." + SPOKEN_STYLE,
  },
  {
    id: "storyteller",
    label: "Storyteller",
    icon: BookOpen,
    color: "#F59E0B",
    instructions:
      "You are an imaginative storyteller. Spin vivid, engaging short stories " +
      "and invite the listener to shape where they go next." + SPOKEN_STYLE,
  },
  {
    id: "kids-story",
    label: "Kids Story Time",
    icon: Sparkles,
    color: "#EC4899",
    instructions:
      "You are a gentle storyteller for young children. Use simple words, a " +
      "playful tone, and keep everything wholesome and age-appropriate." +
      SPOKEN_STYLE,
  },
  {
    id: "kids-trivia",
    label: "Kids Trivia",
    icon: Puzzle,
    color: "#F97316",
    instructions:
      "You are an enthusiastic trivia host for kids. Ask fun, easy questions, " +
      "cheer them on, and gently help when they're stuck." + SPOKEN_STYLE,
  },
];

export const DEFAULT_VOICE_ID = VOICES[0].id;
export const DEFAULT_PERSONALITY_ID = PERSONALITIES[0].id;

/** Resolve selected ids into the session config the engines consume. */
export function resolveVoiceConfig(voiceId: string, personalityId: string) {
  const voice = VOICES.find((v) => v.id === voiceId) ?? VOICES[0];
  const personality =
    PERSONALITIES.find((p) => p.id === personalityId) ?? PERSONALITIES[0];
  return { voice: voice.id, instructions: personality.instructions };
}
