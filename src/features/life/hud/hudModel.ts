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
