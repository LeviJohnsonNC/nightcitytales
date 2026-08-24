/**
 * Luck — the one resource the player spends to lean on the dice.
 *
 * A character's Luck Pool holds points equal to their LUCK STAT and refills at
 * the start of each session. Before a Check is rolled, any number of remaining
 * points may be dedicated to it, each adding +1 to the roll. Two things make it
 * the decision it is at the table, and both are enforced here rather than left
 * to the UI:
 *
 * - It is committed BEFORE the dice are rolled. Spending after seeing the result
 *   is a different (and much weaker) game.
 * - Spent points are gone until the pool refills. You cannot dedicate more than
 *   the pool holds, and a Check cannot quietly overdraw it.
 *
 * Luck applies to Checks — STAT + Skill + 1d10 against a DV or against another
 * character's roll, an attack roll included. It does NOT apply to a Death Save,
 * which is 1d10 rolled UNDER BODY: there a +1 would make death likelier, not
 * less likely. See the luck entry in dv-table.json for the rules text and for
 * what in it is transcribed versus inferred.
 */
import type { RollModifier } from "./rollLog";
import { LUCK_RULES } from "./rulesData";
import type { StatBlock } from "./types";

/** How a spend is labelled in the roll log, so the trace shows what it cost. */
export const LUCK_MODIFIER_LABEL = "Luck";

export { LUCK_RULES };

/** The full pool for a character: their LUCK STAT, or nothing if unset. */
export function luckPoolMax(stats: Partial<StatBlock> | null | undefined): number {
  const luck = stats?.luck;
  return typeof luck === "number" && Number.isFinite(luck) ? Math.max(0, Math.trunc(luck)) : 0;
}

/**
 * How many points a stored pool actually has left.
 *
 * A pool that has never been recorded reads as full rather than as empty: a
 * campaign that predates Luck should start its next Check with the points the
 * character's sheet says they have, not with nothing.
 */
export function luckRemaining(
  stored: number | null | undefined,
  stats: Partial<StatBlock> | null | undefined,
): number {
  const max = luckPoolMax(stats);
  if (typeof stored !== "number" || !Number.isFinite(stored)) return max;
  return Math.min(max, Math.max(0, Math.trunc(stored)));
}

/** A spend, clamped to whole points the pool can actually cover. */
export function clampLuckSpend(requested: number, remaining: number): number {
  if (!Number.isFinite(requested)) return 0;
  return Math.min(Math.max(0, Math.trunc(requested)), Math.max(0, Math.trunc(remaining)));
}

/** The roll modifier for a spend, or null when no Luck was dedicated. */
export function luckModifier(points: number): RollModifier | null {
  const spend = Math.max(0, Math.trunc(points));
  return spend > 0 ? { label: LUCK_MODIFIER_LABEL, value: spend } : null;
}

/** The pool after a spend. Never negative. */
export function luckAfterSpend(remaining: number, spend: number): number {
  return Math.max(0, Math.trunc(remaining) - clampLuckSpend(spend, remaining));
}
