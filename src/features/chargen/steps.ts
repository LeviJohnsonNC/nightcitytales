import { EMPTY_LOADOUT, type CreationMethod } from "@/engine";
import type { ChargenState } from "./store";

export type ChargenStep =
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
 * The official Cyberpunk RED creation sequence. Lifepath precedes STATs.
 * This order is a rules value: do not reorder it.
 */
export const CHARGEN_STEPS: StepDefinition[] = [
  { id: "method", index: 0, title: "Method", blurb: "Streetrat / Edgerunner / Complete Package" },
  { id: "role", index: 1, title: "Role", blurb: "Pick your Role and its Role Ability" },
  { id: "lifepath", index: 2, title: "Lifepath", blurb: "General, then Role-specific" },
  { id: "stats", index: 3, title: "STATs", blurb: "Branches by creation method" },
  { id: "skills", index: 4, title: "Skills", blurb: "Branches by creation method" },
  {
    id: "package",
    index: 5,
    title: "Starting Gear",
    blurb: "The kit and cyberware your Role is issued",
  },
  { id: "gear", index: 6, title: "Gear & Armor", blurb: "Spend your eurobucks" },
  { id: "cyberware", index: 7, title: "Cyberware", blurb: "Install chrome, pay Humanity" },
  { id: "lifestyle", index: 8, title: "Outfit & Lifestyle", blurb: "Fashion, housing, lifestyle" },
  { id: "identity", index: 9, title: "Identity", blurb: "Name, handle, portrait" },
  { id: "review", index: 10, title: "Final Sheet", blurb: "Review every value, then save" },
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
  if (!step) return "method";
  if (STEP_IDS.includes(step as ChargenStep)) return step as ChargenStep;
  return LEGACY_STEPS[step] ?? "method";
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
 * Changing method restarts the character entirely (handled separately).
 */
export const DEPENDENTS: Record<string, ChargenStep[]> = {
  role: ["lifepath", "skills", "package", "gear", "cyberware"],
};

/** The parts of the draft wiped when a Role change is confirmed. */
export function clearedByRoleChange(state: ChargenState): Partial<ChargenState> {
  return {
    skills: [],
    loadout: EMPTY_LOADOUT,
    lifepath: { general: state.lifepath.general, roleSpecific: {} },
  };
}
