import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Minus,
  type LucideIcon,
} from "lucide-react";

export type StatBand = {
  label: "Very Bad" | "Bad" | "Neutral / Average" | "Good" | "Very Good";
  shortLabel: "Very Bad" | "Bad" | "Average" | "Good" | "Very Good";
  description: string;
  Icon: LucideIcon;
  textClass: string;
  borderClass: string;
  backgroundClass: string;
};

const BANDS: Record<"veryBad" | "bad" | "average" | "good" | "veryGood", StatBand> = {
  veryBad: {
    label: "Very Bad",
    shortLabel: "Very Bad",
    description: "Noticeably deficient. This is a real weakness that regularly causes problems.",
    Icon: ChevronsDown,
    textClass: "text-danger",
    borderClass: "border-danger/60",
    backgroundClass: "bg-danger/10",
  },
  bad: {
    label: "Bad",
    shortLabel: "Bad",
    description: "Below average. Functional, but you’d rather not rely on it.",
    Icon: ChevronDown,
    textClass: "text-amber",
    borderClass: "border-amber/60",
    backgroundClass: "bg-amber/10",
  },
  average: {
    label: "Neutral / Average",
    shortLabel: "Average",
    description:
      "Normal human capability. 5 is a good mental anchor for an ordinary competent adult.",
    Icon: Minus,
    textClass: "text-text-muted",
    borderClass: "border-hairline",
    backgroundClass: "bg-surface-raised",
  },
  good: {
    label: "Good",
    shortLabel: "Good",
    description: "Clearly above average. Something people would notice you’re good at.",
    Icon: ChevronUp,
    textClass: "text-cool",
    borderClass: "border-cool/60",
    backgroundClass: "bg-cool/10",
  },
  veryGood: {
    label: "Very Good",
    shortLabel: "Very Good",
    description: "Exceptional. 8 is essentially peak normal-human capability.",
    Icon: ChevronsUp,
    textClass: "text-success",
    borderClass: "border-success/60",
    backgroundClass: "bg-success/10",
  },
};

export function statBand(value: number): StatBand {
  if (value <= 2) return BANDS.veryBad;
  if (value === 3) return BANDS.bad;
  if (value <= 5) return BANDS.average;
  if (value === 6) return BANDS.good;
  return BANDS.veryGood;
}

// ---------------------------------------------------------------------------
// The ramp — a STAT's strength as one colour rather than five bands.
// ---------------------------------------------------------------------------

/**
 * The scale every STAT is read against: 2 is the floor a Role template will
 * hand out and 8 is peak normal-human. Fixing it is the point — a bar drawn
 * against each STAT's own template band made a 4 look full on one card and
 * empty on the next, which is the opposite of what a row of cards is for.
 */
export const STAT_SCALE = { min: 2, max: 8 } as const;

/** Where a value sits on that scale, 0 at the floor and 1 at the ceiling. */
export function statFraction(value: number): number {
  const span = STAT_SCALE.max - STAT_SCALE.min;
  return Math.max(0, Math.min(1, (value - STAT_SCALE.min) / span));
}

/**
 * The colour for a STAT: neon red at 2, running through amber, to neon green
 * at 8.
 *
 * A hue sweep rather than five stops, because the five bands were already
 * being read as a gradient by everyone who looked at them — and a 5 and a 6
 * sitting side by side should differ by a shade, not by a category. Kept in
 * HSL at a fixed saturation and lightness so every value on the ramp is the
 * same brightness against the surface behind it; interpolating the hex ends
 * instead would dip through a muddy brown in the middle.
 */
export function statColor(value: number): string {
  const f = statFraction(value);
  // 0deg is red and 150deg is the green the success token sits at. Lightness
  // climbs with it as well, because three hues at the green end of a sweep are
  // far harder to tell apart than three at the red end — a 6, a 7 and an 8 have
  // to differ by something the eye can actually catch.
  const hue = Math.round(f * 150);
  const lightness = Math.round(58 + f * 8);
  return `hsl(${hue} 90% ${lightness}%)`;
}
