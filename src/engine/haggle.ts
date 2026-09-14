/**
 * Talking the price down.
 *
 * The shop had no negotiation in it at all, which meant the Fixer's Role
 * Ability was half unreachable: Operator's whole printed content is Reach (what
 * you can always source) and Haggle (striking the deal), and the only Trading
 * check anywhere in the game was the two asks on a job offer. A Fixer could
 * haggle over a fee and not over a rifle.
 *
 * So a purchase can be argued about. Two things separate the Fixer from
 * everybody else, and both come off the printed page:
 *
 *  - The ROLL. Haggle is "COOL + Trading + your Operator Rank + 1d10 against
 *    the other party's COOL + Trading + 1d10", so a Fixer's Rank rides on the
 *    die. That is applied by roleCheckModifiers through operatorHaggleBonus,
 *    the same as every other Role bonus on a check.
 *  - The BAND. What winning is worth: ±10% of market price from Rank 1, ±20%
 *    from Rank 9, both parsed out of the Fixer's own rules text below.
 *
 * Everyone else may still argue, and wins a smaller band for it. That part is a
 * house rule and is flagged as one — the printed rules give a non-Fixer no
 * shop-haggling rule at all, and "only one Role may speak to a shopkeeper"
 * would be a worse game than the small invention.
 *
 * Pure arithmetic and one opposed check. Nothing here reads a campaign.
 */
import rolesData from "@/data/rules/roles.json";

type RawRole = { roleAbility?: { mechanicalText?: string } };
const FIXER_TEXT =
  (rolesData as unknown as { roles: Record<string, RawRole> }).roles["fixer"]?.roleAbility
    ?.mechanicalText ?? "";

/**
 * The Haggle percentage bands, parsed from the Fixer's rules text.
 *
 * The tiers read "Ranks 1-2: ... Haggle: ±10% of market price." and "Rank 9:
 * ... Haggle: ±20% of market price." — the tiers between them grant other
 * Haggle benefits instead, and Role Rank benefits accumulate, so the band a
 * Rank holds is the best one at or below it.
 */
const BANDS: { rank: number; percent: number }[] = (() => {
  const out: { rank: number; percent: number }[] = [];
  for (const segment of FIXER_TEXT.split(/(?=Ranks?\s+\d+(?:[–—-]\d+)?:)/)) {
    const rank = /^Ranks?\s+(\d+)/.exec(segment.trim());
    const percent = /Haggle:[^.\n]*?±\s*(\d+)\s*%/.exec(segment);
    if (!rank || !percent) continue;
    out.push({ rank: Number(rank[1]), percent: Number(percent[1]) });
  }
  return out.sort((a, b) => a.rank - b.rank);
})();

/** Every band the rules text states, cheapest Rank first. Exported for tests. */
export const HAGGLE_BANDS: readonly { rank: number; percent: number }[] = BANDS;

/**
 * What a won argument is worth to somebody who is not a Fixer.
 *
 * OURS, not the book's. Deliberately below the Fixer's own first band so that
 * having the Role is always the better answer, and small enough that arguing
 * over ammunition is not worth the minutes it costs.
 */
export const BASE_HAGGLE_PERCENT = 5;

/** House rule, flagged: the non-Fixer band above is this app's own. */
export const BASE_HAGGLE_IS_HOUSE_RULE = true;

/**
 * The percentage off a won haggle buys this character.
 *
 * A Fixer gets their Rank's printed band; everybody else gets the house-rule
 * base. A Fixer at a Rank below the first printed band still gets the base,
 * which is what keeps Rank 0 from being worse than not being a Fixer at all.
 */
export function hagglePercent(input: { isFixer: boolean; operatorRank: number }): number {
  if (!input.isFixer) return BASE_HAGGLE_PERCENT;
  const rank = Math.max(0, Math.trunc(input.operatorRank));
  let percent = BASE_HAGGLE_PERCENT;
  for (const band of BANDS) if (rank >= band.rank) percent = Math.max(percent, band.percent);
  return percent;
}

/** The price after a won haggle, never below zero and never a fraction. */
export function haggledPrice(price: number, percent: number): number {
  const off = Math.max(0, Math.min(100, percent));
  return Math.max(0, Math.round(Math.max(0, price) * (1 - off / 100)));
}
