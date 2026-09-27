/**
 * When a check may roll itself.
 *
 * Every check used to be a button: the narrator proposed it, the turn stopped,
 * the player pressed roll, and a second narration told them what happened.
 * That is right for the roll that matters — the lock on the door, the lie to
 * the fixer — and it is three steps of ceremony for "ask the bartender what is
 * good", which the player noticed before anyone measured it.
 *
 * So a check can be rolled by the engine, in the same turn, when BOTH sides
 * agree it is small:
 *
 *  - the narrator marked it low-stakes (it read the fiction), and
 *  - the engine agrees: it is against a DV no harder than Everyday, it is not
 *    a contest with a person, and nobody is fighting.
 *
 * The narrator can only ever make a check LESS automatic by leaving the mark
 * off; it cannot make a hard or contested one roll itself by adding it. The
 * roll is still the engine's roll, logged in full and shown to the player, and
 * it spends no Luck — Luck is a decision, and an automatic roll has nobody
 * there to make it.
 *
 * A HOUSE RULE. RED has no automatic checks; it has a GM who does not ask for
 * dice when failing would not matter, which is what this is standing in for.
 * The ceiling is the printed Everyday rung, read from the DV table.
 */
import { getDV } from "./checkDV";

/** The hardest DV a check may be and still roll itself. The printed "Everyday". */
export const AUTO_ROLL_MAX_DV: number = getDV("Everyday");

export type AutoRollQuestion = {
  /** The narrator marked this check as small. */
  lowStakes: boolean;
  /** The check's DV, or null when it is against a person's roll. */
  dv: number | null;
  /** Somebody is resisting with their own dice. */
  opposed: boolean;
  /** A fight is running. Every roll in a fight is somebody's Turn. */
  inCombat: boolean;
};

/** Whether the engine may roll this check without waiting for the player. */
export function mayRollItself(q: AutoRollQuestion): boolean {
  if (!q.lowStakes || q.opposed || q.inCombat) return false;
  return q.dv !== null && q.dv <= AUTO_ROLL_MAX_DV;
}
