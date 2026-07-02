"use client";

/**
 * Web Persona — lightweight CSS orb.
 *
 * The Rive runtimes (`@rive-app/react-webgl2` and `@rive-app/react-canvas`)
 * both crash the browser tab (renderer OOM) within ~3s of a sustained mount in
 * this app, across every `.riv` variant — so on web we render a self-contained
 * animated orb instead. Native keeps the real Rive persona
 * (`@rive-app/react-native`), which works there.
 *
 * The colored aura around the orb is drawn by the `Glow` in `persona-bubble`;
 * this component only renders the breathing core sphere, whose motion reacts to
 * the voice `state`.
 */

import type { CSSProperties, FC } from "react";
import { useMemo } from "react";

import type { PersonaState, PersonaVariant } from "./sources";

export type { PersonaState, PersonaVariant };

interface PersonaProps {
  state: PersonaState;
  variant?: PersonaVariant;
  /** Rendered size in px (square). Defaults to 64. */
  size?: number;
  style?: CSSProperties;
}

// Per-state motion: breathing duration, peak scale, and core opacity. Faster
// and larger for active states; slow and dim at rest.
const MOTION: Record<
  PersonaState,
  { duration: number; scale: number; opacity: number }
> = {
  idle: { duration: 4.5, scale: 1.02, opacity: 0.55 },
  asleep: { duration: 4.5, scale: 1.02, opacity: 0.5 },
  thinking: { duration: 1.4, scale: 1.06, opacity: 0.9 },
  listening: { duration: 2.4, scale: 1.05, opacity: 0.95 },
  speaking: { duration: 0.9, scale: 1.09, opacity: 1 },
};

const KEYFRAMES_ID = "persona-orb-keyframes";
const KEYFRAMES = `@keyframes persona-orb-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(var(--persona-orb-scale, 1.05)); }
}`;

/** Inject the shared keyframes once. */
function useOrbKeyframes() {
  useMemo(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(KEYFRAMES_ID)) return;
    const el = document.createElement("style");
    el.id = KEYFRAMES_ID;
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
  }, []);
}

export const Persona: FC<PersonaProps> = ({
  state = "idle",
  size = 64,
  style,
}) => {
  useOrbKeyframes();
  const motion = MOTION[state] ?? MOTION.idle;

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        // Glassy obsidian sphere: soft top-left highlight into a dark core.
        background:
          "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35), rgba(120,120,130,0.25) 26%, rgba(20,20,24,0.95) 70%)",
        boxShadow:
          "inset 0 1px 2px rgba(255,255,255,0.25), inset 0 -6px 12px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.35)",
        opacity: motion.opacity,
        animation: `persona-orb-breathe ${motion.duration}s ease-in-out infinite`,
        // Read by the keyframes above.
        ["--persona-orb-scale" as string]: String(motion.scale),
        willChange: "transform",
        ...style,
      }}
    />
  );
};
Persona.displayName = "Persona";
