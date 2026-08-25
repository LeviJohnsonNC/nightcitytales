/**
 * Difficulty Values, read from src/data/rules/dv-table.json.
 */
import { DV_TABLE_DATA } from "./rulesData";

export type DifficultyValue = { name: string; dv: number; description: string };

export const DIFFICULTY_VALUES: DifficultyValue[] =
  DV_TABLE_DATA.difficultyValues as DifficultyValue[];

export const DV_RULES = DV_TABLE_DATA._rules;

/** Look up a DV by its published name ("Simple", "Everyday", ...). */
export function getDV(name: string): number {
  const entry = DIFFICULTY_VALUES.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (!entry) {
    throw new Error(`Unknown Difficulty Value "${name}" (src/data/rules/dv-table.json)`);
  }
  return entry.dv;
}

export function getDifficulty(name: string): DifficultyValue {
  const entry = DIFFICULTY_VALUES.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (!entry) {
    throw new Error(`Unknown Difficulty Value "${name}" (src/data/rules/dv-table.json)`);
  }
  return entry;
}

/** The published difficulty band a numeric DV corresponds to, if any. */
export function describeDV(dv: number): DifficultyValue | null {
  return DIFFICULTY_VALUES.find((d) => d.dv === dv) ?? null;
}

export function meetsDV(total: number, dv: number): boolean {
  return total >= dv;
}

/** Positive when the check beats the DV, negative when it misses. */
export function dvMargin(total: number, dv: number): number {
  return total - dv;
}

/**
 * What the player actually needs on the d10, accounting for the Critical
 * Success / Critical Failure rules (dv-table.json _rules): a natural 10 adds a
 * second d10, a natural 1 subtracts one, and neither chains. Success is
 * total >= DV (meetsDV).
 *
 * `base` is STAT + Skill + every situational modifier already applied.
 */
export type CheckOutlook = {
  /** Plain d10 face that reaches the DV, ignoring criticals. */
  needed: number;
  /** Lowest possible result: natural 1 then a 10 on the Critical Failure die. */
  worstCase: number;
  /** Highest possible result: natural 10 then a 10 on the Critical Success die. */
  bestCase: number;
  /** True when even the worst Critical Failure still meets the DV. */
  cannotFail: boolean;
  /** True when even the best Critical Success cannot reach the DV. */
  cannotSucceed: boolean;
  /**
   * When only a natural 1 can spoil the check: the highest Critical Failure die
   * that still meets the DV. Null when the check can fail on a plain roll.
   */
  critFailSafeUpTo: number | null;
  /**
   * When only a natural 10 can save the check: the Critical Success die needed.
   * Null when a plain roll can already succeed.
   */
  critSuccessNeeded: number | null;
};

export function checkOutlook(base: number, dv: number): CheckOutlook {
  const needed = dv - base;
  const worstCase = base + 1 - 10;
  const bestCase = base + 10 + 10;
  const cannotFail = meetsDV(worstCase, dv);
  const cannotSucceed = !meetsDV(bestCase, dv);
  // Every non-1 face from `needed` upward clears the DV, so the only exposure
  // left is the natural 1 implosion.
  const onlyCritFailRisk = needed <= 1 && !cannotFail;
  const onlyCritSuccessHope = needed > 10 && !cannotSucceed;
  return {
    needed,
    worstCase,
    bestCase,
    cannotFail,
    cannotSucceed,
    critFailSafeUpTo: onlyCritFailRisk ? base + 1 - dv : null,
    critSuccessNeeded: onlyCritSuccessHope ? dv - base - 10 : null,
  };
}
