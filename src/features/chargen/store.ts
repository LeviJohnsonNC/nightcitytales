import { create } from "zustand";
import type { CreationMethod, StatBlock } from "@/engine";
import { STEP_IDS, clearedByRoleChange, type ChargenStep } from "./steps";

export type { ChargenStep };
export { CHARGEN_STEPS, STEP_IDS } from "./steps";

export type ChargenState = {
  draftId: string | null;
  step: ChargenStep;
  method: CreationMethod | null;
  roleId: string | null;
  name: string;
  handle: string;
  portrait: string | null;
  stats: Partial<StatBlock>;
  skills: Record<string, number>;
  lifepath: { general: Record<string, unknown>; roleSpecific: Record<string, unknown> };
  gear: string[];
  cyberware: string[];
  lifestyle: Record<string, unknown>;
  /** Steps the player has opened at least once. Drives "in progress" vs "locked". */
  visited: ChargenStep[];
};

export type ChargenActions = {
  setStep: (step: ChargenStep) => void;
  next: () => void;
  back: () => void;
  patch: (partial: Partial<ChargenState>) => void;
  /** Changing method restarts the character; keeps the draft id so autosave overwrites. */
  selectMethod: (method: CreationMethod) => void;
  /** Changing Role wipes skills, gear, cyberware and Role-specific Lifepath. */
  selectRole: (roleId: string) => void;
  hydrate: (state: Partial<ChargenState>) => void;
  reset: () => void;
};

const initialState: ChargenState = {
  draftId: null,
  step: "method",
  method: null,
  roleId: null,
  name: "",
  handle: "",
  portrait: null,
  stats: {},
  skills: {},
  lifepath: { general: {}, roleSpecific: {} },
  gear: [],
  cyberware: [],
  lifestyle: {},
  visited: ["method"],
};

function withVisit(state: ChargenState, step: ChargenStep): ChargenStep[] {
  return state.visited.includes(step) ? state.visited : [...state.visited, step];
}

export const useChargenStore = create<ChargenState & ChargenActions>((set, get) => ({
  ...initialState,
  setStep: (step) => set((s) => ({ step, visited: withVisit(s, step) })),
  next: () => {
    const i = STEP_IDS.indexOf(get().step);
    get().setStep(STEP_IDS[Math.min(i + 1, STEP_IDS.length - 1)]!);
  },
  back: () => {
    const i = STEP_IDS.indexOf(get().step);
    get().setStep(STEP_IDS[Math.max(i - 1, 0)]!);
  },
  patch: (partial) => set(partial),
  selectMethod: (method) =>
    set((s) =>
      s.method === method
        ? { method }
        : { ...initialState, draftId: s.draftId, method, step: s.step, visited: s.visited },
    ),
  selectRole: (roleId) =>
    set((s) => (s.roleId === roleId ? { roleId } : { ...clearedByRoleChange(s), roleId })),
  hydrate: (state) => set((s) => ({ ...s, ...state })),
  reset: () => set({ ...initialState }),
}));

/** The exact object persisted to chargen_drafts. */
export function draftPayload(state: ChargenState) {
  const { draftId: _draftId, ...rest } = state;
  return rest;
}