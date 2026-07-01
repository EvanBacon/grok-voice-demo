/**
 * PersonaBubble — an animated Rive Persona wrapped in a state-reactive glow,
 * paired with a caption / speech bubble that reflects the voice-agent state.
 *
 * `status` is the GrokVoiceSession `VoiceStatus`; it is mapped to a
 * `PersonaState` that drives both the Rive animation and the glow.
 */

import type { VoiceStatus } from "@/utils/grok-voice";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Persona } from "./persona";
import type { PersonaState, PersonaVariant } from "./sources";

export function statusToPersonaState(status: VoiceStatus): PersonaState {
  switch (status) {
    case "connecting":
      return "thinking";
    case "listening":
      return "listening";
    case "speaking":
      return "speaking";
    case "idle":
    case "error":
    default:
      // Resting visual when nothing is happening or after an error.
      return "asleep";
  }
}

// Glow tint per state. `null` = no active glow (resting).
const GLOW_COLOR: Record<PersonaState, string | null> = {
  idle: null,
  asleep: null,
  listening: "rgba(56,189,248,0.45)", // sky-400
  thinking: "rgba(251,191,36,0.45)", // amber-400
  speaking: "rgba(52,211,153,0.5)", // emerald-400
};

function Glow({ state, size }: { state: PersonaState; size: number }) {
  const color = GLOW_COLOR[state];
  const active = color !== null;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 400 });
    }
    return () => cancelAnimation(progress);
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.35 }],
    opacity: 0.2 + progress.value * 0.6,
  }));

  if (!color) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

interface PersonaBubbleProps {
  status: VoiceStatus;
  /** Caption shown below the persona (e.g. the status label). */
  caption: string;
  /** Latest assistant line to surface in the speech bubble, if any. */
  speech?: string;
  variant?: PersonaVariant;
  size?: number;
}

export function PersonaBubble({
  status,
  caption,
  speech,
  variant = "obsidian",
  size = 128,
}: PersonaBubbleProps) {
  const state = statusToPersonaState(status);
  const showSpeech =
    Boolean(speech) && (status === "speaking" || status === "listening");

  // Reserve room around the orb so neither it nor its pulsing glow clip.
  const stageSize = Math.round(size * 1.6);

  return (
    <View className="items-center gap-4">
      <View
        className="items-center justify-center"
        style={{ width: stageSize, height: stageSize }}
      >
        <Glow state={state} size={size} />
        <Persona state={state} variant={variant} size={size} />
      </View>

      {showSpeech ? (
        <View className="max-w-[85%] rounded-3xl bg-muted px-4 py-3">
          <Text
            className="text-[15px] text-foreground text-center"
            numberOfLines={3}
          >
            {speech}
          </Text>
        </View>
      ) : (
        <Text className="text-[15px] font-medium text-muted-foreground text-center">
          {caption}
        </Text>
      )}
    </View>
  );
}
