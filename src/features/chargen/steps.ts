import { EMPTY_LOADOUT } from "@/engine";
import type { ChargenState } from "./store";

export type ChargenStep =
  | "method"
  | "role"
  | "lifepath"
  | "stats"
  | "skills"
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
  { id: "gear", index: 5, title: "Gear & Armor", blurb: "Fixed package or shopping" },
  { id: "cyberware", index: 6, title: "Cyberware", blurb: "Applies Humanity Loss" },
  { id: "lifestyle", index: 7, title: "Outfit & Lifestyle", blurb: "Fashion, housing, lifestyle" },
  { id: "identity", index: 8, title: "Identity", blurb: "Name, handle, portrait" },
  { id: "review", index: 9, title: "Final Sheet", blurb: "Review every value, then save" },
];

export const STEP_IDS: ChargenStep[] = CHARGEN_STEPS.map((s) => s.id);

/** Legacy drafts may reference removed steps; map them to the nearest live step. */
const LEGACY_STEPS: Record<string, ChargenStep> = { derived: "stats" };

export function normalizeStep(step: string | null | undefined): ChargenStep {
  if (!step) return "method";
  if (STEP_IDS.includes(step as ChargenStep)) return step as ChargenStep;
  return LEGACY_STEPS[step] ?? "method";
}

export function stepDefinition(step: ChargenStep): StepDefinition {
  const def = CHARGEN_STEPS.find((s) => s.id === normalizeStep(step));
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
  role: ["lifepath", "skills", "gear", "cyberware"],
};

/** The parts of the draft wiped when a Role change is confirmed. */
export function clearedByRoleChange(state: ChargenState): Partial<ChargenState> {
  return {
    skills: [],
    loadout: EMPTY_LOADOUT,
    lifepath: { general: state.lifepath.general, roleSpecific: {} },
  };
}
