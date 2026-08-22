import { create } from "zustand";
import rolesData from "@/data/rules/roles.json";
import {
  EMPTY_LIFESTYLE,
  EMPTY_LOADOUT,
  type CreationMethod,
  type LifestyleChoice,
  type Loadout,
  type RollResult,
  type SkillEntry,
  type StatBlock,
  type StatKey,
} from "@/engine";
import {
  STEP_IDS,
  clearedByRoleChange,
  normalizeStep,
  resolveStepForMethod,
  stepIdsFor,
  type ChargenStep,
} from "./steps";

export type { ChargenStep };
export { CHARGEN_STEPS, STEP_IDS } from "./steps";

/** One audited roll. Newest first. Persisted with the draft: it is the trust artifact. */
export type LoggedRoll = { id: string; label: string; result: RollResult };

export type ChargenState = {
  draftId: string | null;
  step: ChargenStep;
  method: CreationMethod | null;
  roleId: string | null;
  /** Set by selectRole from roles.json. Rank is the rules starting rank. */
  roleAbility: { id: string; name: string; rank: number } | null;
  name: string;
  handle: string;
  pronouns: string;
  selfDescription: string;
  portrait: string | null;
  stats: Partial<StatBlock>;
  /**
   * Which template row each STAT came from. `row` is the single Streetrat row;
   * `rows` is the per-STAT row for Edgerunner. Empty for Complete Package.
   */
  statRolls: { row: number | null; rows: Partial<Record<StatKey, number>> };
  /** Sheet skill lines. Specialized skills may appear more than once. */
  skills: SkillEntry[];
  lifepath: { general: Record<string, unknown>; roleSpecific: Record<string, unknown> };
  /** Purchases, worn armor and cyberware installs. Engine-owned shape. */
  loadout: Loadout;
  /** Housing location pick. Housing, rent and Lifestyle themselves are fixed by the rules. */
  lifestyle: LifestyleChoice;
  /** Steps the player has opened at least once. Drives "in progress" vs "locked". */
  visited: ChargenStep[];
  /** Every die this app rolled for this character, in reverse order. */
  rollLog: LoggedRoll[];
  /** AI-woven, hand-editable character background prose from the Lifepath. */
  background: string;
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
  roleAbility: null,
  name: "",
  handle: "",
  pronouns: "",
  selfDescription: "",
  portrait: null,
  stats: {},
  statRolls: { row: null, rows: {} },
  skills: [],
  lifepath: { general: {}, roleSpecific: {} },
  loadout: EMPTY_LOADOUT,
  lifestyle: EMPTY_LIFESTYLE,
  visited: ["method"],
  rollLog: [],
  background: "",
};

function withVisit(state: ChargenState, step: ChargenStep): ChargenStep[] {
  return state.visited.includes(step) ? state.visited : [...state.visited, step];
}

type RoleRecord = {
  id: string;
  name: string;
  roleAbility: { id: string; name: string; startingRank: number };
};

const ROLE_RECORDS = rolesData.roles as unknown as Record<string, RoleRecord>;

/** The Role Ability entry written on Role confirm, read straight from roles.json. */
export function roleAbilityForRole(roleId: string): ChargenState["roleAbility"] {
  const role = ROLE_RECORDS[roleId];
  if (!role) throw new Error(`Unknown role "${roleId}" (src/data/rules/roles.json)`);
  const rank = role.roleAbility.startingRank;
  if (typeof rank !== "number") {
    throw new Error(`Role "${roleId}" has no roleAbility.startingRank (src/data/rules/roles.json)`);
  }
  return { id: role.roleAbility.id, name: role.roleAbility.name, rank };
}

export const useChargenStore = create<ChargenState & ChargenActions>((set, get) => ({
  ...initialState,
  setStep: (step) => set((s) => ({ step, visited: withVisit(s, step) })),
  next: () => {
    const ids = stepIdsFor(get().method);
    const i = ids.indexOf(get().step);
    get().setStep(ids[Math.min(i + 1, ids.length - 1)]!);
  },
  back: () => {
    const ids = stepIdsFor(get().method);
    const i = ids.indexOf(get().step);
    get().setStep(ids[Math.max(i - 1, 0)]!);
  },
  patch: (partial) => set(partial),
  selectMethod: (method) =>
    set((s) =>
      s.method === method
        ? { method }
        : {
            ...initialState,
            draftId: s.draftId,
            method,
            step: resolveStepForMethod(s.step, method),
            visited: s.visited,
          },
    ),
  selectRole: (roleId) =>
    set((s) =>
      s.roleId === roleId
        ? { roleId, roleAbility: roleAbilityForRole(roleId) }
        : { ...clearedByRoleChange(s), roleId, roleAbility: roleAbilityForRole(roleId) },
    ),
  hydrate: (state) =>
    set((s) => {
      const next = { ...s, ...state };
      const step = resolveStepForMethod(normalizeStep(next.step), next.method);
      return {
        ...next,
        step,
        visited: (next.visited ?? []).map(normalizeStep).filter((v, i, a) => a.indexOf(v) === i),
      };
    }),
  reset: () => set({ ...initialState }),
}));

/** The exact object persisted to chargen_drafts. */
export function draftPayload(state: ChargenState) {
  const { draftId: _draftId, ...rest } = state;
  return rest;
}
