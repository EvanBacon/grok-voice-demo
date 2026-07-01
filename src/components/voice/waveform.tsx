/**
 * Live audio waveform for the voice composer. Driven by the agent's real 0..1
 * audio `level` (mic while listening, playback while speaking): each new sample
 * scrolls in from the right, so the bars trace what's actually being heard.
 */
import { View } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const BAR_COUNT = 28;
const BAR_HEIGHT = 22;
const MIN_SCALE = 0.1;

function Bar({
  index,
  history,
}: {
  index: number;
  history: SharedValue<number[]>;
}) {
  const style = useAnimatedStyle(() => {
    const value = history.value[index] ?? 0;
    return {
      transform: [{ scaleY: withTiming(MIN_SCALE + value * (1 - MIN_SCALE), { duration: 90 }) }],
    };
  });

  return (
    <Animated.View
      style={[{ width: 3, height: BAR_HEIGHT, borderRadius: 1.5 }, style]}
      className="bg-foreground"
    />
  );
}

export function Waveform({ level }: { level: SharedValue<number> }) {
  // Rolling window of recent levels, newest at the right edge.
  const history = useSharedValue<number[]>(new Array(BAR_COUNT).fill(0));

  useAnimatedReaction(
    () => level.value,
    (current) => {
      "worklet";
      const next = history.value.slice(1);
      next.push(current);
      history.value = next;
    },
  );

  return (
    <View
      className="flex-1 flex-row items-center justify-center"
      style={{ height: BAR_HEIGHT, gap: 4 }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <Bar key={i} index={i} history={history} />
      ))}
    </View>
  );
}
