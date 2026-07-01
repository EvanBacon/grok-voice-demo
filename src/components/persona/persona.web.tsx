"use client";

/**
 * Web Persona — WebGL2 Rive runtime.
 *
 * Adapted from the Vercel AI Elements `persona` component
 * (`npx ai-elements@latest add persona`). Drives the `default` state machine's
 * boolean inputs from a single `state` prop and, for artboards with a bindable
 * `color`, tints the visual to match the active light/dark theme.
 */

import type { RiveParameters } from "@rive-app/react-webgl2";
import {
  useRive,
  useStateMachineInput,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceColor,
} from "@rive-app/react-webgl2";
import type { CSSProperties, FC, ReactNode } from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import {
  type PersonaSource,
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
  style?: CSSProperties;
  onLoad?: RiveParameters["onLoad"];
  onLoadError?: RiveParameters["onLoadError"];
  onReady?: () => void;
  onPause?: RiveParameters["onPause"];
  onPlay?: RiveParameters["onPlay"];
  onStop?: RiveParameters["onStop"];
}

// Delays Rive initialization by one frame so that React Strict Mode's immediate
// unmount cycle never creates a WebGL2 context. Only the second (real) mount
// initialises, avoiding context exhaustion.
const useStrictModeSafeInit = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => {
      cancelAnimationFrame(id);
      setReady(false);
    };
  }, []);

  return ready;
};

const getCurrentTheme = (): "light" | "dark" => {
  if (typeof window !== "undefined") {
    if (document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  }
  return "light";
};

const useTheme = (enabled: boolean) => {
  const [theme, setTheme] = useState<"light" | "dark">(getCurrentTheme);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const observer = new MutationObserver(() => setTheme(getCurrentTheme()));
    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    let mql: MediaQueryList | null = null;
    const handleMediaChange = () => setTheme(getCurrentTheme());
    if (window.matchMedia) {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      mql.addEventListener("change", handleMediaChange);
    }

    return () => {
      observer.disconnect();
      mql?.removeEventListener("change", handleMediaChange);
    };
  }, [enabled]);

  return theme;
};

interface PersonaWithModelProps {
  rive: ReturnType<typeof useRive>["rive"];
  source: PersonaSource;
  children: ReactNode;
}

const PersonaWithModel = memo(
  ({ rive, source, children }: PersonaWithModelProps) => {
    const theme = useTheme(source.dynamicColor);
    const viewModel = useViewModel(rive, { useDefault: true });
    const viewModelInstance = useViewModelInstance(viewModel, {
      rive,
      useDefault: true,
    });
    const viewModelInstanceColor = useViewModelInstanceColor(
      "color",
      viewModelInstance,
    );

    useEffect(() => {
      if (!(viewModelInstanceColor && source.dynamicColor)) {
        return;
      }
      const [r, g, b] = theme === "dark" ? [255, 255, 255] : [0, 0, 0];
      viewModelInstanceColor.setRgb(r, g, b);
    }, [viewModelInstanceColor, theme, source.dynamicColor]);

    return children;
  },
);
PersonaWithModel.displayName = "PersonaWithModel";

const PersonaWithoutModel = memo(({ children }: { children: ReactNode }) => children);
PersonaWithoutModel.displayName = "PersonaWithoutModel";

export const Persona: FC<PersonaProps> = memo(
  ({
    variant = "obsidian",
    state = "idle",
    size = 64,
    style,
    onLoad,
    onLoadError,
    onReady,
    onPause,
    onPlay,
    onStop,
  }) => {
    const source = sources[variant];
    if (!source) {
      throw new Error(`Invalid variant: ${variant}`);
    }

    // Stabilize callbacks to prevent useRive from reinitializing.
    const callbacksRef = useRef({
      onLoad,
      onLoadError,
      onPause,
      onPlay,
      onReady,
      onStop,
    });
    useEffect(() => {
      callbacksRef.current = {
        onLoad,
        onLoadError,
        onPause,
        onPlay,
        onReady,
        onStop,
      };
    }, [onLoad, onLoadError, onPause, onPlay, onReady, onStop]);

    const stableCallbacks = useMemo(
      () => ({
        onLoad: ((r) => callbacksRef.current.onLoad?.(r)) as RiveParameters["onLoad"],
        onLoadError: ((e) =>
          callbacksRef.current.onLoadError?.(e)) as RiveParameters["onLoadError"],
        onPause: ((e) => callbacksRef.current.onPause?.(e)) as RiveParameters["onPause"],
        onPlay: ((e) => callbacksRef.current.onPlay?.(e)) as RiveParameters["onPlay"],
        onReady: () => callbacksRef.current.onReady?.(),
        onStop: ((e) => callbacksRef.current.onStop?.(e)) as RiveParameters["onStop"],
      }),
      [],
    );

    const ready = useStrictModeSafeInit();

    const { rive, RiveComponent } = useRive(
      ready
        ? {
            autoplay: true,
            onLoad: stableCallbacks.onLoad,
            onLoadError: stableCallbacks.onLoadError,
            onPause: stableCallbacks.onPause,
            onPlay: stableCallbacks.onPlay,
            onRiveReady: stableCallbacks.onReady,
            onStop: stableCallbacks.onStop,
            src: source.source,
            stateMachines: STATE_MACHINE,
          }
        : null,
    );

    const listeningInput = useStateMachineInput(rive, STATE_MACHINE, "listening");
    const thinkingInput = useStateMachineInput(rive, STATE_MACHINE, "thinking");
    const speakingInput = useStateMachineInput(rive, STATE_MACHINE, "speaking");
    const asleepInput = useStateMachineInput(rive, STATE_MACHINE, "asleep");

    // Rive state machine inputs are mutable objects set via direct property
    // assignment — this is the intended Rive API, not a React anti-pattern.
    useEffect(() => {
      if (listeningInput) listeningInput.value = state === "listening";
      if (thinkingInput) thinkingInput.value = state === "thinking";
      if (speakingInput) speakingInput.value = state === "speaking";
      if (asleepInput) asleepInput.value = state === "asleep";
    }, [state, listeningInput, thinkingInput, speakingInput, asleepInput]);

    const Wrapper = source.hasModel ? PersonaWithModel : PersonaWithoutModel;

    return (
      <Wrapper rive={rive} source={source}>
        <RiveComponent
          style={{ width: size, height: size, flexShrink: 0, ...style }}
        />
      </Wrapper>
    );
  },
);
Persona.displayName = "Persona";
