import { create } from "zustand";
import type { CreationMethod, StatBlock } from "@/engine";

export type ChargenStep =
  | "method"
  | "role"
  | "lifepath"
  | "stats"
  | "skills"
  | "gear"
  | "review";

export const CHARGEN_STEPS: ChargenStep[] = [
  "method",
  "role",
  "lifepath",
  "stats",
  "skills",
  "gear",
  "review",
];

export type ChargenState = {
  draftId: string | null;
  step: ChargenStep;
  method: CreationMethod | null;
  roleId: string | null;
  name: string;
  handle: string;
  stats: Partial<StatBlock>;
  skills: Record<string, number>;
  lifepath: { general: Record<string, unknown>; roleSpecific: Record<string, unknown> };
  gear: string[];
};

export type ChargenActions = {
  setStep: (step: ChargenStep) => void;
  next: () => void;
  back: () => void;
  patch: (partial: Partial<ChargenState>) => void;
  hydrate: (state: ChargenState) => void;
  reset: () => void;
};

const initialState: ChargenState = {
  draftId: null,
  step: "method",
  method: null,
  roleId: null,
  name: "",
  handle: "",
  stats: {},
  skills: {},
  lifepath: { general: {}, roleSpecific: {} },
  gear: [],
};

export const useChargenStore = create<ChargenState & ChargenActions>((set, get) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  next: () => {
    const i = CHARGEN_STEPS.indexOf(get().step);
    set({ step: CHARGEN_STEPS[Math.min(i + 1, CHARGEN_STEPS.length - 1)]! });
  },
  back: () => {
    const i = CHARGEN_STEPS.indexOf(get().step);
    set({ step: CHARGEN_STEPS[Math.max(i - 1, 0)]! });
  },
  patch: (partial) => set(partial),
  hydrate: (state) => set(state),
  reset: () => set(initialState),
}));