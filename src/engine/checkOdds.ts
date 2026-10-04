/**
 * The chance a check succeeds, exactly.
 *
 * A player who has never opened the book cannot read "Handgun 6". They can read
 * "hit a moving target across the street: 70%". This is that number, computed
 * from the same rules the dice run on rather than estimated: STAT + Skill +
 * 1d10 against a DV (`meetsDV`), a natural 10 adding one more d10 and a natural
 * 1 subtracting one, never chaining (dv-table.json, p.130).
 *
 * Pure arithmetic over the hundred equally likely (die, critical die) pairs.
 */
import { meetsDV } from "./checkDV";
import { OPPOSED_CHECK_TIE_GOES_TO } from "./rulesData";

/**
 * What `base` + one check die can total, as `[total, odds-out-of-100]` pairs.
 * The die and its critical die are a hundred equally likely pairs; a natural
 * 10 adds the second die, a natural 1 subtracts it, neither chains.
 */
function totalsOf(base: number): Map<number, number> {
  const totals = new Map<number, number>();
  for (let die = 1; die <= 10; die += 1) {
    for (let crit = 1; crit <= 10; crit += 1) {
      const total = die === 10 ? base + 10 + crit : die === 1 ? base + 1 - crit : base + die;
      totals.set(total, (totals.get(total) ?? 0) + 1);
    }
  }
  return totals;
}

/** Probability, 0 to 1, that `base` + the check die meets `dv`. */
export function checkOdds(base: number, dv: number): number {
  let hits = 0;
  for (const [total, weight] of totalsOf(base)) {
    if (meetsDV(total, dv)) hits += weight;
  }
  return hits / 100;
}

/** The same chance as a whole percentage, for display. */
export function checkPercent(base: number, dv: number): number {
  return Math.round(checkOdds(base, dv) * 100);
}

/**
 * The chance the acting side wins an Opposed Check, exactly: both sides roll
 * STAT + Skill + 1d10 with their own criticals, the actor must EXCEED the other
 * total, and a tie goes where the rules data says (`OPPOSED_CHECK_TIE_GOES_TO`,
 * the defender as printed). Ten thousand equally likely outcomes, counted.
 */
export function opposedOdds(actorBase: number, opponentBase: number): number {
  const theirs = totalsOf(opponentBase);
  let wins = 0;
  for (const [mine, mineWeight] of totalsOf(actorBase)) {
    for (const [other, otherWeight] of theirs) {
      const won = mine === other ? OPPOSED_CHECK_TIE_GOES_TO === "actor" : mine > other;
      if (won) wins += mineWeight * otherWeight;
    }
  }
  return wins / 10_000;
}

export function opposedPercent(actorBase: number, opponentBase: number): number {
  return Math.round(opposedOdds(actorBase, opponentBase) * 100);
}
