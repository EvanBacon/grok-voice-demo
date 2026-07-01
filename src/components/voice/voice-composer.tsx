/**
 * Inline voice composer — replaces the text composer while a voice session is
 * live. Shows the persona orb + status caption above a bar with a stop button,
 * an animated waveform, and a settings shortcut.
 *
 * Positions itself at the bottom of the `<Conversation />` exactly like
 * `PromptInput`, using the shared conversation context so the message list
 * insets adjust to its height.
 */
import { Icon } from "@/components/icon";
import { PersonaBubble } from "@/components/persona";
import { useConversationContext } from "@/components/chat";
import type { VoiceStatus } from "@/utils/grok-voice";
import { Link } from "expo-router";
import { SlidersHorizontal, X } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  type SharedValue,
} from "react-native-reanimated";

import { Waveform } from "./waveform";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Tap to start talking",
  connecting: "Connecting…",
  listening: "Listening — go ahead",
  speaking: "Grok is speaking…",
  error: "Something went wrong",
};

export function VoiceComposer({
  status,
  error,
  speech,
  level,
  onStop,
}: {
  status: VoiceStatus;
  error: string | null;
  speech?: string;
  level: SharedValue<number>;
  onStop: () => void;
}) {
  const { promptInputStyle, onPromptInputLayout } = useConversationContext();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      onLayout={onPromptInputLayout}
      style={[{ position: "absolute", left: 0, right: 0 }, promptInputStyle]}
    >
      <View className="items-center pb-3">
        <PersonaBubble
          status={status}
          caption={error ?? STATUS_LABEL[status]}
          speech={speech}
          size={72}
        />
      </View>

      <View className="mx-3 mb-2 flex-row items-center gap-3 rounded-3xl bg-muted px-3 py-3">
        <Pressable
          onPress={onStop}
          accessibilityRole="button"
          accessibilityLabel="End voice session"
          hitSlop={8}
          className="w-9 h-9 rounded-full bg-background items-center justify-center active:opacity-70"
        >
          <Icon icon={X} className="w-5 h-5 text-foreground" />
        </Pressable>

        <Waveform level={level} />

        <Link href="/voice-settings" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voice settings"
            hitSlop={8}
            className="w-9 h-9 rounded-full bg-background items-center justify-center active:opacity-70"
          >
            <Icon icon={SlidersHorizontal} className="w-5 h-5 text-foreground" />
          </Pressable>
        </Link>
      </View>
    </Animated.View>
  );
}
