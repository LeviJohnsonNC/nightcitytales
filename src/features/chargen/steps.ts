import { EMPTY_LOADOUT, type CreationMethod } from "@/engine";
import type { ChargenState } from "./store";

export type ChargenStep =
  | "fixer"
  | "method"
  | "role"
  | "lifepath"
  | "stats"
  | "skills"
  | "package"
  | "gear"
  | "cyberware"
  | "lifestyle"
  | "identity"
  | "review";

export type StepDefinition = {
  id: ChargenStep;
  index: number;
  title: string;
  /** Short line shown under the title in the rail. */
  blurb: string;
  /** Read-only steps have no player input; they display engine output. */
  readOnly?: boolean;
};

/**
 * The sequence, told as a meet with a fixer.
 *
 * Every step is a question somebody in Night City is asking, which is why the
 * titles are in the second person and none of them is the name of a rules
 * table. The rules order within it is untouched — Role, then Lifepath, then
 * STATs and Skills, then gear — with two changes, both on purpose:
 *
 *  - THE MEET COMES FIRST. Picking which fixer you are here to see is a choice
 *    made inside the fiction before anything is asked of you, and that fixer
 *    is carried into the campaign as your fixer.
 *  - METHOD FOLLOWS ROLE. The printed book never says which comes first, and
 *    "how much of this do you want to do by hand" is a worse opening question
 *    than "what do you do". Method decides only how STATs, Skills and gear are
 *    made, so choosing it second costs nothing and changing it later clears
 *    only those.
 */
export const CHARGEN_STEPS: StepDefinition[] = [
  { id: "fixer", index: 0, title: "The Meet", blurb: "Pick who you are here to see" },
  { id: "role", index: 1, title: "What You Do", blurb: "Your Role and what it gives you" },
  { id: "method", index: 2, title: "The Terms", blurb: "Fast, rolled, or built by hand" },
  { id: "lifepath", index: 3, title: "Your Story", blurb: "Where you come from, who is out there" },
  { id: "stats", index: 4, title: "What You've Got", blurb: "Your ten STATs" },
  { id: "skills", index: 5, title: "What You Can Do", blurb: "Your Skills" },
  {
    id: "package",
    index: 6,
    title: "Your Kit",
    blurb: "The gear and chrome your Role is issued",
  },
  { id: "gear", index: 7, title: "Night Market", blurb: "Spend your eurobucks" },
  { id: "cyberware", index: 8, title: "Chrome", blurb: "Install cyberware, pay Humanity" },
  { id: "lifestyle", index: 9, title: "Where You Sleep", blurb: "Home, lifestyle, fashion" },
  { id: "identity", index: 10, title: "What They Call You", blurb: "Name, handle, face" },
  { id: "review", index: 11, title: "The File", blurb: "Look it over, then walk in" },
];

export const STEP_IDS: ChargenStep[] = CHARGEN_STEPS.map((s) => s.id);

/** Only Streetrat and Edgerunner characters are issued a fixed starting package. */
export function hasStartingPackage(method: CreationMethod | null | undefined): boolean {
  return method === "streetrat" || method === "edgerunner";
}

/**
 * The steps this character actually walks, renumbered so the displayed
 * sequence is always contiguous. Complete Package skips Starting Gear.
 */
export function stepsFor(method: CreationMethod | null | undefined): StepDefinition[] {
  return CHARGEN_STEPS.filter((s) => {
    // Streetrat/Edgerunner get a fixed Starting Gear package (which now
    // includes their cyberware) and skip the à-la-carte Cyberware step.
    // Complete Package skips Starting Gear and shops for cyberware instead.
    if (s.id === "package") return hasStartingPackage(method);
    if (s.id === "cyberware") return !hasStartingPackage(method);
    return true;
  }).map((s, index) => ({ ...s, index }));
}

export function stepIdsFor(method: CreationMethod | null | undefined): ChargenStep[] {
  return stepsFor(method).map((s) => s.id);
}

/** Legacy drafts may reference removed steps; map them to the nearest live step. */
const LEGACY_STEPS: Record<string, ChargenStep> = { derived: "stats" };

export function normalizeStep(step: string | null | undefined): ChargenStep {
  if (!step) return "fixer";
  if (STEP_IDS.includes(step as ChargenStep)) return step as ChargenStep;
  return LEGACY_STEPS[step] ?? "fixer";
}

/** A hidden step can never be the current step: resolve it forward. */
export function resolveStepForMethod(
  step: ChargenStep,
  method: CreationMethod | null | undefined,
): ChargenStep {
  if (step === "package" && !hasStartingPackage(method)) return "gear";
  if (step === "cyberware" && hasStartingPackage(method)) return "lifestyle";
  return step;
}

export function stepDefinition(step: ChargenStep, method?: CreationMethod | null): StepDefinition {
  const id = normalizeStep(step);
  const def = (method === undefined ? CHARGEN_STEPS : stepsFor(method)).find((s) => s.id === id);
  if (!def) throw new Error(`Unknown chargen step "${step}"`);
  return def;
}

export function stepIndex(step: ChargenStep): number {
  return stepDefinition(step).index;
}

/**
 * Which later steps a change to an earlier step invalidates.
 */
export const DEPENDENTS: Record<string, ChargenStep[]> = {
  role: ["lifepath", "skills", "package", "gear", "cyberware"],
  method: ["stats", "skills", "package", "gear", "cyberware"],
};

/**
 * The parts of the draft a change of method clears: only what the method
 * decides how to make. Who the character is — Role, Lifepath, name, face, home
 * and the people they met — survives it.
 */
export function clearedByMethodChange(): Partial<ChargenState> {
  return {
    stats: {},
    statRolls: { row: null, rows: {} },
    skills: [],
    loadout: EMPTY_LOADOUT,
  };
}

/** True when a change of method would throw away work. */
export function methodChangeLosesWork(state: ChargenState): boolean {
  return (
    Object.keys(state.stats).length > 0 ||
    state.skills.length > 0 ||
    state.loadout.lines.length > 0 ||
    Object.keys(state.loadout.packageChoices).length > 0
  );
}

/** The parts of the draft wiped when a Role change is confirmed. */
export function clearedByRoleChange(state: ChargenState): Partial<ChargenState> {
  return {
    skills: [],
    loadout: EMPTY_LOADOUT,
    lifepath: { general: state.lifepath.general, roleSpecific: {} },
  };
}
