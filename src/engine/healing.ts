/**
 * Getting Hit Points back. The counterpart to combat.ts, which only ever takes
 * them away.
 *
 * Two printed routes, and they do different jobs:
 *
 * - Stabilization (First Aid / Paramedic) stops a patient getting worse. Only
 *   at Mortally Wounded does it restore anything — back to 1 HP, per the note
 *   on the wound-state ladder. At lighter wounds it restores nothing.
 * - Rest returns BODY Hit Points per full day.
 *
 * Every number comes from creation-rules.json (the wound-state ladder and its
 * stabilization DVs) and healing.json (the rest rate). Nothing is invented here,
 * and in particular no HP is granted for a stabilization the rules do not grant
 * it for.
 */
import healingData from "@/data/rules/healing.json";
import { woundStateFor, type WoundStateCode } from "./campaign";
import { WOUND_STATES } from "./rulesData";
import type { StatKey } from "./types";

const HEALING = healingData as unknown as {
  _rules: { rest: string; stabilization: string; cap: string };
  restHpPerDayStat: string;
  healingSkills: string[];
};

/** The Skills that can stabilize a patient, from healing.json. */
export const HEALING_SKILL_IDS: readonly string[] = HEALING.healingSkills;

/** The STAT that sets the rest rate (BODY). */
export const REST_RATE_STAT = HEALING.restHpPerDayStat as StatKey;

export function isHealingSkill(skillId: string): boolean {
  return HEALING_SKILL_IDS.includes(skillId);
}

/** The printed wound-state row for a code, or undefined for an unwounded one. */
function woundRow(state: WoundStateCode) {
  const byCode: Record<WoundStateCode, string | null> = {
    none: null,
    light: "Lightly Wounded",
    serious: "Seriously Wounded",
    mortal: "Mortally Wounded",
  };
  const name = byCode[state];
  return name ? WOUND_STATES.find((w) => w.state === name) : undefined;
}

/**
 * The DV to stabilize a patient in this wound state, or null when there is
 * nothing to stabilize. Read from the printed ladder — never set by the GM,
 * which is the same fairness rule the DV table gets.
 */
export function stabilizationDvFor(state: WoundStateCode): number | null {
  const row = woundRow(state);
  const dv = row?.stabilizationDV;
  return typeof dv === "number" ? dv : null;
}

export type StabilizationOutcome = {
  /** True when the check met the DV. */
  stabilized: boolean;
  /** HP after the attempt. Unchanged unless a Mortally Wounded patient was saved. */
  hp: number;
  /** HP actually restored (0 at every wound state but Mortally Wounded). */
  restored: number;
  /** True when the patient is Unconscious for a minute afterwards. */
  unconscious: boolean;
  woundState: WoundStateCode;
};

/**
 * Apply a resolved First Aid / Paramedic check.
 *
 * Success on a Mortally Wounded patient brings them to 1 HP and leaves them
 * Unconscious for a minute. Success at any lighter wound state stabilizes and
 * nothing more — the Hit Points come back with rest. Failure changes nothing;
 * it never makes the patient worse, because the printed rule does not say it
 * does.
 */
export function applyStabilization(input: {
  hp: number;
  hpMax: number;
  seriouslyWoundedThreshold: number;
  success: boolean;
}): StabilizationOutcome {
  const before = woundStateFor(input.hp, input.hpMax, input.seriouslyWoundedThreshold);
  if (!input.success || before === "none") {
    return {
      stabilized: false,
      hp: input.hp,
      restored: 0,
      unconscious: false,
      woundState: before,
    };
  }

  if (before === "mortal") {
    const hp = 1;
    return {
      stabilized: true,
      hp,
      restored: hp - input.hp,
      unconscious: true,
      woundState: woundStateFor(hp, input.hpMax, input.seriouslyWoundedThreshold),
    };
  }

  return { stabilized: true, hp: input.hp, restored: 0, unconscious: false, woundState: before };
}

/** Hit Points recovered by resting whole days: BODY per full day. */
export function restHealing(bodyStat: number, days: number): number {
  if (!Number.isFinite(bodyStat) || bodyStat < 0) {
    throw new Error(`A BODY of ${bodyStat} cannot set a healing rate.`);
  }
  const wholeDays = Math.max(0, Math.floor(days));
  return bodyStat * wholeDays;
}

export type RestOutcome = {
  hp: number;
  /** HP actually recovered, after the cap at maximum. */
  restored: number;
  days: number;
  woundState: WoundStateCode;
};

/**
 * Rest for whole days. Healing never carries a Character above their maximum,
 * so the amount restored is what the cap allowed, not what the rate offered.
 * A Mortally Wounded Character is not healed by rest alone — they need
 * stabilizing first, or they are making Death Saves, not sleeping.
 */
export function rest(input: {
  hp: number;
  hpMax: number;
  seriouslyWoundedThreshold: number;
  bodyStat: number;
  days: number;
}): RestOutcome {
  const days = Math.max(0, Math.floor(input.days));
  const state = woundStateFor(input.hp, input.hpMax, input.seriouslyWoundedThreshold);
  if (state === "mortal") {
    return { hp: input.hp, restored: 0, days, woundState: state };
  }
  const offered = restHealing(input.bodyStat, days);
  const hp = Math.min(input.hpMax, input.hp + offered);
  return {
    hp,
    restored: hp - input.hp,
    days,
    woundState: woundStateFor(hp, input.hpMax, input.seriouslyWoundedThreshold),
  };
}
