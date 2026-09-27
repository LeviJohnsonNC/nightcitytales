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

/** Probability, 0 to 1, that `base` + the check die meets `dv`. */
export function checkOdds(base: number, dv: number): number {
  let hits = 0;
  for (let die = 1; die <= 10; die += 1) {
    for (let crit = 1; crit <= 10; crit += 1) {
      const total = die === 10 ? base + 10 + crit : die === 1 ? base + 1 - crit : base + die;
      if (meetsDV(total, dv)) hits += 1;
    }
  }
  return hits / 100;
}

/** The same chance as a whole percentage, for display. */
export function checkPercent(base: number, dv: number): number {
  return Math.round(checkOdds(base, dv) * 100);
}
