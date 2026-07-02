"use client";
import type { CSSProperties, FC } from "react";
import type { PersonaState, PersonaVariant } from "./sources";
export type { PersonaState, PersonaVariant };
interface PersonaProps { state?: PersonaState; variant?: PersonaVariant; size?: number; style?: CSSProperties; }
export const Persona: FC<PersonaProps> = ({ size = 64, style }) => (
  <div style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #555, #111)", ...style }} />
);
Persona.displayName = "Persona";
