import { Icon } from "@/components/icon";
import {
  GrokVoiceSession,
  type TranscriptEntry,
  type VoiceStatus,
} from "@/utils/grok-voice";
import { Stack } from "expo-router";
import { Mic, MicOff } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Tap to start talking",
  connecting: "Connecting…",
  listening: "Listening — go ahead",
  speaking: "Grok is speaking…",
  error: "Something went wrong",
};

export default function VoiceScreen() {
  if (Platform.OS !== "web") {
    return <NativeUnsupported />;
  }
  return <WebVoiceAgent />;
}

function WebVoiceAgent() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const sessionRef = useRef<GrokVoiceSession | null>(null);

  const isActive = status !== "idle" && status !== "error";

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(() => {
    setError(null);
    setTranscript([]);
    const session = new GrokVoiceSession({
      onStatus: setStatus,
      onError: (message) => setError(message),
      onTranscript: (entry) =>
        setTranscript((prev) => {
          const next = [...prev];
          const existing = next.findIndex((e) => e.id === entry.id);
          if (existing >= 0) next[existing] = entry;
          else next.push(entry);
          return next;
        }),
    });
    sessionRef.current = session;
    session.start();
  }, []);

  const toggle = useCallback(() => {
    if (isActive) stop();
    else start();
  }, [isActive, start, stop]);

  useEffect(() => () => sessionRef.current?.stop(), []);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: "Voice" }} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6 gap-3"
        contentInsetAdjustmentBehavior="automatic"
      >
        {transcript.length === 0 ? (
          <View className="items-center justify-center pt-20 gap-2">
            <Text className="text-[17px] text-muted-foreground text-center">
              Start a conversation with Grok. Your speech and its replies show
              up here.
            </Text>
          </View>
        ) : (
          transcript.map((entry) => (
            <TranscriptBubble key={entry.id} entry={entry} />
          ))
        )}
      </ScrollView>

      <View className="items-center gap-3 pb-10 pt-4 border-t border-border">
        {error ? (
          <Text className="text-[13px] text-red-500 px-8 text-center">
            {error}
          </Text>
        ) : (
          <Text className="text-[15px] text-muted-foreground">
            {STATUS_LABEL[status]}
          </Text>
        )}

        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={isActive ? "Stop voice agent" : "Start voice agent"}
          className={`w-20 h-20 rounded-full items-center justify-center active:opacity-80 ${
            isActive ? "bg-red-500" : "bg-foreground"
          }`}
        >
          <Icon
            icon={isActive ? MicOff : Mic}
            className={`w-8 h-8 ${isActive ? "text-white" : "text-background"}`}
          />
        </Pressable>
      </View>
    </View>
  );
}

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === "user";
  return (
    <View
      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
        isUser ? "self-end bg-user-bubble" : "self-start bg-muted"
      }`}
    >
      <Text className="text-[11px] font-medium text-muted-foreground mb-0.5">
        {isUser ? "You" : "Grok"}
      </Text>
      <Text className="text-[16px] text-foreground">{entry.text}</Text>
    </View>
  );
}

function NativeUnsupported() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-8 gap-3">
      <Stack.Screen options={{ title: "Voice" }} />
      <Icon icon={MicOff} className="w-12 h-12 text-muted-foreground" />
      <Text className="text-[17px] text-foreground text-center font-medium">
        Voice agent runs on the web
      </Text>
      <Text className="text-[15px] text-muted-foreground text-center">
        This demo uses the browser Web Audio API for realtime mic capture and
        playback. Open the app on the web to talk to Grok.
      </Text>
    </View>
  );
}
