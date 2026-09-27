/**
 * Rolls that count.
 *
 * Rolled STATs are the one place in creation where the dice decide who you are,
 * and they only mean something if they stick. The printed rule is that they
 * always stick; the creator used to let a player reroll forever, which made
 * the dice a slot machine with no cost. The house rule in between: the first
 * roll stands, and each character carries a small number of rerolls to spend
 * (`chargen-house-rules.json`). Spending one is a decision, which is the point.
 *
 * Pure. The count of rerolls spent lives on the draft.
 */
import data from "@/data/rules/chargen-house-rules.json";

type HouseRules = { houseRule: boolean; statRerolls: number };
const RULES = data as unknown as HouseRules;

export const CHARGEN_HOUSE_RULES_ARE_HOUSE_RULE: boolean = RULES.houseRule;

/** Rerolls each character gets for rolled STATs. */
export const STAT_REROLLS: number = Math.max(0, Math.floor(RULES.statRerolls));

/** Rerolls still in hand after spending `used`. */
export function statRerollsLeft(used: number): number {
  return Math.max(0, STAT_REROLLS - Math.max(0, Math.floor(used)));
}

/**
 * Whether a roll is allowed, and whether it spends a reroll. A first roll is
 * always allowed and free; rolling something already rolled is a reroll.
 */
export function statRollCost(input: { alreadyRolled: boolean; used: number }): {
  allowed: boolean;
  spends: boolean;
} {
  if (!input.alreadyRolled) return { allowed: true, spends: false };
  return { allowed: statRerollsLeft(input.used) > 0, spends: true };
}
