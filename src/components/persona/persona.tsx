/**
 * Native Persona — Nitro Rive runtime (@rive-app/react-native).
 *
 * Loads the same Vercel-hosted `.riv` files as the web build and drives the
 * `default` state machine's boolean inputs from a single `state` prop.
 *
 * NOTE: The Grok voice agent itself is web-only, so on native this is a purely
 * decorative visual. It also requires a native rebuild (Nitro modules) —
 * `@rive-app/react-native` cannot run in Expo Go or on web.
 */

import { Fit, RiveView, useRive, useRiveFile } from "@rive-app/react-native";
import { type FC, useEffect } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";

import {
  PERSONA_INPUTS,
  type PersonaState,
  type PersonaVariant,
  sources,
  STATE_MACHINE,
} from "./sources";

export type { PersonaState, PersonaVariant };

interface PersonaProps {
  state: PersonaState;
  variant?: PersonaVariant;
  /** Rendered size in px (square). Defaults to 64. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Maps a single `state` to the set of boolean inputs; "idle" leaves all off.
const activeInput: Record<PersonaState, string | null> = {
  idle: null,
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
  asleep: "asleep",
};

export const Persona: FC<PersonaProps> = ({
  variant = "obsidian",
  state = "idle",
  size = 64,
  style,
}) => {
  const source = sources[variant];
  if (!source) {
    throw new Error(`Invalid variant: ${variant}`);
  }

  const { riveViewRef, setHybridRef } = useRive();
  const { riveFile } = useRiveFile({ uri: source.source });

  useEffect(() => {
    const ref = riveViewRef;
    if (!ref) return;

    let cancelled = false;
    ref.awaitViewReady().then(() => {
      if (cancelled) return;
      const on = activeInput[state];
      for (const input of PERSONA_INPUTS) {
        ref.setBooleanInputValue(input, input === on);
      }
      // Low-overhead nudge so the graphic reflects the new input values.
      ref.playIfNeeded();
    });

    return () => {
      cancelled = true;
    };
  }, [riveViewRef, state]);

  return (
    <View style={[{ width: size, height: size }, style]}>
      {riveFile ? (
        <RiveView
          hybridRef={setHybridRef}
          file={riveFile}
          stateMachineName={STATE_MACHINE}
          autoPlay
          // Contain (not the default Cover) so the full artboard — glow and
          // all — fits inside the container instead of being cropped.
          fit={Fit.Contain}
          style={{ flex: 1 }}
        />
      ) : null}
    </View>
  );
};
