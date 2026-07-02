/**
 * Shared config for the animated Persona visual.
 *
 * The `.riv` files are the same ones the Vercel AI Elements `persona` component
 * ships (`npx ai-elements@latest add persona`), hosted on Vercel Blob storage.
 * They expose a `default` state machine with boolean inputs — `listening`,
 * `thinking`, `speaking`, `asleep`. "idle" is simply all inputs off.
 *
 * The native Persona (@rive-app/react-native) reads the `.riv` sources here.
 * The web Persona renders a CSS orb instead (the Rive web runtimes crash the
 * tab), so on web only the `PersonaState`/`PersonaVariant` types are used.
 */

export type PersonaState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "asleep";

// The state machine name is always 'default' for AI Elements visuals.
export const STATE_MACHINE = "default";

// Boolean state-machine inputs. Setting one true drives that animation;
// "idle" leaves them all false.
export const PERSONA_INPUTS = [
  "listening",
  "thinking",
  "speaking",
  "asleep",
] as const;

export interface PersonaSource {
  /** Whether the artboard exposes a bindable `color` view-model property. */
  dynamicColor: boolean;
  /** Whether the artboard has a data-binding view model at all. */
  hasModel: boolean;
  source: string;
}

const BLOB = "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com";

export const sources = {
  command: { dynamicColor: true, hasModel: true, source: `${BLOB}/command-2.0.riv` },
  glint: { dynamicColor: true, hasModel: true, source: `${BLOB}/glint-2.0.riv` },
  halo: { dynamicColor: true, hasModel: true, source: `${BLOB}/halo-2.0.riv` },
  mana: { dynamicColor: false, hasModel: true, source: `${BLOB}/mana-2.0.riv` },
  obsidian: { dynamicColor: true, hasModel: true, source: `${BLOB}/obsidian-2.0.riv` },
  opal: { dynamicColor: false, hasModel: false, source: `${BLOB}/orb-1.2.riv` },
} satisfies Record<string, PersonaSource>;

export type PersonaVariant = keyof typeof sources;
