/**
 * STAT generation for the three creation methods.
 * Every value comes from src/data/rules/stat-templates.json and
 * src/data/rules/creation-rules.json.
 */
import { d10 } from "./dice";
import { buildRollResult, type RollResult } from "./rollLog";
import { CREATION_METHODS, STAT_ORDER, getStatTemplateRow } from "./rulesData";
import type { RNG, StatBlock, StatKey } from "./types";

const COMPLETE_PACKAGE = CREATION_METHODS.completePackage;

export type StreetratResult = {
  /** The template row taken, unmodified. Values may not be rearranged. */
  stats: StatBlock;
  row: number;
  roll: RollResult;
};

/** Roll 1d10 once and take that entire template row as written. */
export function rollStreetratStats(roleId: string, rng: RNG): StreetratResult {
  const row = d10(rng);
  const roll = buildRollResult({
    dice: "1d10",
    rolls: [row],
    modifiers: [{ label: `Streetrat template row (${roleId})`, value: 0 }],
  });
  return { stats: getStatTemplateRow(roleId, row), row, roll };
}

export type EdgerunnerResult = {
  stats: StatBlock;
  /** The row rolled for each STAT. */
  rows: Record<StatKey, number>;
  rolls: Record<StatKey, RollResult>;
};

export type EdgerunnerStatResult = { stat: StatKey; value: number; row: number; roll: RollResult };

/** Roll a single STAT against its own column of the Role's template table. */
export function rollEdgerunnerStat(roleId: string, stat: StatKey, rng: RNG): EdgerunnerStatResult {
  const row = d10(rng);
  const value = getStatTemplateRow(roleId, row)[stat];
  const roll = buildRollResult({
    dice: "1d10",
    rolls: [row],
    modifiers: [{ label: `${stat.toUpperCase()} column → ${value}`, value: 0 }],
  });
  return { stat, value, row, roll };
}

/** Roll 1d10 per STAT, each read against that STAT's own column of the same table. */
export function rollEdgerunnerStats(roleId: string, rng: RNG): EdgerunnerResult {
  const stats = {} as StatBlock;
  const rows = {} as Record<StatKey, number>;
  const rolls = {} as Record<StatKey, RollResult>;

  for (const stat of STAT_ORDER) {
    const result = rollEdgerunnerStat(roleId, stat, rng);
    stats[stat] = result.value;
    rows[stat] = result.row;
    rolls[stat] = result.roll;
  }

  return { stats, rows, rolls };
}

/**
 * Every STAT at the Complete Package floor: where the point-buy starts, so a
 * "+" always adds one to a real number and the pool is what is left over.
 */
export function startingCompletePackageStats(): StatBlock {
  const stats = {} as StatBlock;
  for (const stat of STAT_ORDER) stats[stat] = COMPLETE_PACKAGE.statMin;
  return stats;
}

/**
 * A saved allocation made safe to edit with the point-buy controls: every STAT
 * present and whole, inside the minimum and maximum, and no more points spent
 * than the budget holds. Drafts written before the controls stopped allowing
 * typed numbers can carry a 10, a 0, or a total over budget, and a stepper that
 * refuses to leave the rules would leave that STAT stuck. Over budget is trimmed
 * from the highest STAT first, so the shape of the build survives.
 */
export function normalizeCompletePackageStats(stats: Partial<StatBlock>): StatBlock {
  const min = COMPLETE_PACKAGE.statMin;
  const max = COMPLETE_PACKAGE.statMax;
  const out = {} as StatBlock;
  for (const stat of STAT_ORDER) {
    const raw = stats[stat];
    out[stat] =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.min(max, Math.max(min, Math.round(raw)))
        : min;
  }
  let spent = STAT_ORDER.reduce((sum, stat) => sum + out[stat], 0);
  while (spent > COMPLETE_PACKAGE.statPoints) {
    const highest = STAT_ORDER.reduce((a, b) => (out[b] > out[a] ? b : a));
    out[highest] -= 1;
    spent -= 1;
  }
  return out;
}

/**
 * Move one STAT by `delta` without leaving the rules: never below the minimum,
 * never above the maximum, and never spending more points than the budget has.
 * A move that would break any of them changes nothing and returns the same
 * object, so a caller can tell a refusal from a change by identity. A STAT not
 * yet set counts as the minimum, which is what it costs.
 */
export function adjustCompletePackageStat(
  stats: Partial<StatBlock>,
  stat: StatKey,
  delta: number,
): Partial<StatBlock> {
  const min = COMPLETE_PACKAGE.statMin;
  const max = COMPLETE_PACKAGE.statMax;
  const current = stats[stat] ?? min;
  const next = current + delta;
  if (next < min || next > max) return stats;
  const spent = STAT_ORDER.reduce((sum, key) => sum + (stats[key] ?? min), 0);
  if (spent + delta > COMPLETE_PACKAGE.statPoints) return stats;
  return { ...stats, [stat]: next };
}

export type StatValidation = {
  valid: boolean;
  pointsSpent: number;
  pointsRemaining: number;
  violations: string[];
};

/** Complete Package: a fixed point budget, with per-STAT minimum and maximum. */
export function validateCompletePackageStats(allocation: Partial<StatBlock>): StatValidation {
  const budget = COMPLETE_PACKAGE.statPoints;
  const min = COMPLETE_PACKAGE.statMin;
  const max = COMPLETE_PACKAGE.statMax;
  const violations: string[] = [];
  let pointsSpent = 0;

  for (const stat of STAT_ORDER) {
    const value = allocation[stat];
    if (value === undefined) {
      violations.push(`${stat.toUpperCase()} has no value assigned`);
      continue;
    }
    if (!Number.isInteger(value)) {
      violations.push(`${stat.toUpperCase()} must be a whole number`);
      continue;
    }
    pointsSpent += value;
    if (value > max) violations.push(`${stat.toUpperCase()} is ${value}; the maximum is ${max}`);
    if (value < min) violations.push(`${stat.toUpperCase()} is ${value}; the minimum is ${min}`);
  }

  const pointsRemaining = budget - pointsSpent;
  if (pointsRemaining !== 0) {
    violations.push(
      pointsRemaining > 0
        ? `${pointsRemaining} of ${budget} STAT Points unspent`
        : `${-pointsRemaining} STAT Points over the ${budget} point budget`,
    );
  }

  return { valid: violations.length === 0, pointsSpent, pointsRemaining, violations };
}
