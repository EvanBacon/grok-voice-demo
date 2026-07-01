// Metro resolves `./persona` to persona.web.tsx on web and persona.tsx on
// native, so consumers get the right Rive runtime automatically.
export { Persona } from "./persona";
export type { PersonaState, PersonaVariant } from "./sources";
export { PersonaBubble, statusToPersonaState } from "./persona-bubble";
