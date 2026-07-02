import { useEffect, useRef } from "react";
import { Animated, Pressable } from "react-native";

const TRACK_W = 44;
const TRACK_H = 26;
const THUMB = 20;
const PAD = 3;
const TRAVEL = TRACK_W - THUMB - PAD * 2;

/**
 * On-brand toggle. React Native's built-in <Switch> renders an off-theme
 * (teal/system-green) control on web; this monochrome version tracks the
 * design tokens instead — foreground track when on, muted when off.
 */
export function Switch({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      className={value ? "bg-foreground" : "bg-muted"}
      style={{
        width: TRACK_W,
        height: TRACK_H,
        borderRadius: TRACK_H / 2,
        padding: PAD,
        justifyContent: "center",
      }}
    >
      <Animated.View
        className={value ? "bg-background" : "bg-muted-foreground"}
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          transform: [{ translateX }],
        }}
      />
    </Pressable>
  );
}
