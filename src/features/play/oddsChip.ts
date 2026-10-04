/**
 * What the odds chip says: a word before a number.
 *
 * The chance itself is the engine's (`checkOdds`, `opposedOdds`, assembled by
 * `previewPendingCheck` from the modifiers the roll will use). This only decides
 * how to put it to a player who has never opened the book — "Long shot" reads
 * faster than 23% — and what a point of Luck is worth right now, which is the
 * decision the card exists to make visible.
 *
 * Pure: numbers in, words out. No React.
 */
import type { CheckPreview } from "./rollCheck";

export type OddsBand = "out" | "long" | "against" | "even" | "favoured" | "near" | "locked";
export type OddsTone = "bad" | "mid" | "good";

export type OddsBandInfo = { band: OddsBand; label: string; tone: OddsTone };

/** The band a whole-percent chance falls in. */
export function oddsBand(percent: number): OddsBandInfo {
  if (percent <= 0) return { band: "out", label: "No chance", tone: "bad" };
  if (percent >= 100) return { band: "locked", label: "Locked in", tone: "good" };
  if (percent < 25) return { band: "long", label: "Long shot", tone: "bad" };
  if (percent < 45) return { band: "against", label: "Against you", tone: "bad" };
  if (percent < 65) return { band: "even", label: "Even", tone: "mid" };
  if (percent < 90) return { band: "favoured", label: "Favoured", tone: "good" };
  return { band: "near", label: "Near-certain", tone: "good" };
}

export type OddsReadout = OddsBandInfo & {
  percent: number;
  /** What the chance is held against: "DV 15", or the person's name. */
  versus: string;
  /**
   * What one more point of Luck would do, when there is one to give and it
   * would change anything. Null when the pool is spent or the point is wasted.
   */
  luckHint: { percent: number; gain: number } | null;
  /** What the Luck already dedicated has done, so the chip can say so. */
  luckGain: number | null;
  /** Labelled modifiers behind the number, for the "how this is worked out" line. */
  modifiers: { label: string; value: number }[];
};

export function oddsReadout(input: {
  now: CheckPreview;
  /** The same check with one more point of Luck, if one is available. */
  withOneMore: CheckPreview | null;
  /** The same check with no Luck dedicated. */
  withoutLuck: CheckPreview;
  luckSpent: number;
  versus: string;
}): OddsReadout {
  const { now, withOneMore, withoutLuck, luckSpent, versus } = input;
  const gain = withOneMore ? withOneMore.percent - now.percent : 0;
  const spentGain = luckSpent > 0 ? now.percent - withoutLuck.percent : 0;
  return {
    ...oddsBand(now.percent),
    percent: now.percent,
    versus,
    luckHint: withOneMore && gain > 0 ? { percent: withOneMore.percent, gain } : null,
    luckGain: luckSpent > 0 && spentGain > 0 ? spentGain : null,
    modifiers: now.modifiers,
  };
}
