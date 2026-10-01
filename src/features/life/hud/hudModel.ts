/**
 * What the life HUD draws, as numbers: how full a bar is, what colour danger is,
 * which luck pips are spent. Presentation only — the values come from the
 * campaign's vitals and nothing here is a rule, so a band is a look, not a ruling.
 */

export type BarTone = "ok" | "warn" | "danger";

/** How full a resource is, 0 to 1. A max of nothing is an empty bar, never NaN. */
export function fillFraction(current: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.min(1, Math.max(0, current / max));
}

/** Healthy above 60%, hurting above 30%, in trouble below. */
export function barTone(fraction: number): BarTone {
  if (fraction > 0.6) return "ok";
  if (fraction > 0.3) return "warn";
  return "danger";
}

/** The most luck pips drawn; a bigger pool is shown as a number instead. */
export const MAX_PIPS = 10;

/** One entry per point of Luck: true while it is still in hand. Null when there are too many to draw. */
export function luckPips(left: number, max: number): boolean[] | null {
  if (max <= 0 || max > MAX_PIPS) return null;
  return Array.from({ length: max }, (_, i) => i < left);
}

const WOUND_LABEL: Record<string, { label: string; tone: BarTone }> = {
  light: { label: "Wounded", tone: "warn" },
  serious: { label: "Seriously wounded", tone: "danger" },
  mortal: { label: "Mortally wounded", tone: "danger" },
};

/** A wound worth a badge, or null when the character is fine. */
export function woundBadge(
  state: string | null | undefined,
): { label: string; tone: BarTone } | null {
  return WOUND_LABEL[(state ?? "").trim().toLowerCase()] ?? null;
}

// ── people ───────────────────────────────────────────────────────────────

export type PersonTone = "hostile" | "cold" | "neutral" | "warm";

/** Where someone stands with the character, in a word and a colour. Wording as the old People list had it. */
export function dispositionBand(disposition: number): { label: string; tone: PersonTone } {
  if (disposition <= -3) return { label: "hostile", tone: "hostile" };
  if (disposition === -2) return { label: "hates you", tone: "hostile" };
  if (disposition === -1) return { label: "cold", tone: "cold" };
  if (disposition === 0) return { label: "neutral", tone: "neutral" };
  if (disposition === 1) return { label: "warm", tone: "warm" };
  if (disposition === 2) return { label: "close", tone: "warm" };
  return { label: "devoted", tone: "warm" };
}

/** How many people the rail shows before "all". */
export const PEOPLE_SHOWN = 5;

type Ranked = { disposition: number; lastSeenDay?: number | undefined };

/**
 * The few worth a tile right now: whoever was seen most recently, then
 * whoever feels strongest about you either way. Stable for ties, so the strip
 * does not reshuffle between turns when nothing has changed.
 */
export function relevantPeople<T extends Ranked>(people: readonly T[], shown = PEOPLE_SHOWN): T[] {
  return people
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        (b.p.lastSeenDay ?? -Infinity) - (a.p.lastSeenDay ?? -Infinity) ||
        Math.abs(b.p.disposition) - Math.abs(a.p.disposition) ||
        a.i - b.i,
    )
    .slice(0, shown)
    .map(({ p }) => p);
}

// ── change ───────────────────────────────────────────────────────────────

/** A value part-way from one number to another, `t` from 0 to 1, easing out. */
export function tween(from: number, to: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return from + (to - from) * (1 - (1 - k) ** 3);
}

/** Which way a value just moved, if it did. */
export function changeDirection(prev: number | undefined, next: number): "up" | "down" | null {
  if (prev === undefined || prev === next) return null;
  return next > prev ? "up" : "down";
}
