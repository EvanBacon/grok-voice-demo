/**
 * Voice Settings sheet — pick the agent's voice and personality. Selections are
 * stored in `VoiceSettingsProvider` and applied to the next session.
 */
import { AndroidGrabber } from "@/components/grabber";
import { Icon } from "@/components/icon";
import { useVoiceSettings } from "@/components/voice/voice-settings-context";
import {
  PERSONALITIES,
  type PersonalityOption,
  VOICES,
  type VoiceOption,
} from "@/components/voice/voice-settings";
import { cn } from "@/utils/tailwind";
import { Check } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function VoiceSettingsSheet() {
  const { voiceId, personalityId, setVoiceId, setPersonalityId } =
    useVoiceSettings();

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="android:pb-safe py-3"
    >
      <AndroidGrabber />

      <SectionLabel>Voice</SectionLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 gap-3 py-1"
      >
        {VOICES.map((voice) => (
          <VoiceCard
            key={voice.id}
            voice={voice}
            selected={voice.id === voiceId}
            onPress={() => setVoiceId(voice.id)}
          />
        ))}
      </ScrollView>

      <SectionLabel>Personality</SectionLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 gap-4 py-1"
      >
        {PERSONALITIES.map((personality) => (
          <PersonalityItem
            key={personality.id}
            personality={personality}
            selected={personality.id === personalityId}
            onPress={() => setPersonalityId(personality.id)}
          />
        ))}
      </ScrollView>
    </ScrollView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[15px] font-semibold text-foreground px-5 pt-4 pb-2">
      {children}
    </Text>
  );
}

function VoiceCard({
  voice,
  selected,
  onPress,
}: {
  voice: VoiceOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        "w-40 rounded-2xl px-4 py-3.5 border active:opacity-80",
        selected
          ? "bg-user-bubble border-foreground"
          : "bg-muted border-transparent",
      )}
    >
      <View className="flex-row items-center justify-between mb-0.5">
        <Text className="text-[17px] font-semibold text-foreground">
          {voice.label}
        </Text>
        {selected ? (
          <View className="w-5 h-5 rounded-full bg-foreground items-center justify-center">
            <Icon icon={Check} className="w-3 h-3 text-background" />
          </View>
        ) : null}
      </View>
      <Text className="text-[13px] text-muted-foreground">
        {voice.description}
      </Text>
    </Pressable>
  );
}

function PersonalityItem({
  personality,
  selected,
  onPress,
}: {
  personality: PersonalityOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="items-center gap-2 w-20 active:opacity-80"
    >
      <View
        className={cn(
          "w-16 h-16 rounded-full items-center justify-center border",
          selected
            ? "bg-foreground border-foreground"
            : "bg-muted border-transparent",
        )}
      >
        <Icon
          icon={personality.icon}
          className={cn(
            "w-6 h-6",
            selected ? "text-background" : "text-foreground",
          )}
        />
      </View>
      <Text
        numberOfLines={2}
        className="text-[12px] text-center text-muted-foreground"
      >
        {personality.label}
      </Text>
    </Pressable>
  );
}
