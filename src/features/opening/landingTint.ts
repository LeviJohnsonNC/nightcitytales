/**
 * What colour the night is, from the hour the engine says it is.
 *
 * The window the descent lands on is the same window in every campaign; the
 * hour is what makes it THIS night's. Words, not minutes — `hourWords` is what
 * the narrator is given, so what the player sees and what is written about it
 * cannot disagree. Pure.
 */
export type Tint = { gradient: string; label: string };

const TINTS: Record<string, Tint> = {
  "the small hours": {
    label: "small hours",
    gradient: "linear-gradient(to top, rgba(30,20,90,0.5), rgba(8,6,30,0.15) 60%, transparent)",
  },
  "just before dawn": {
    label: "before dawn",
    gradient:
      "linear-gradient(to top, rgba(255,110,150,0.28), rgba(60,40,120,0.18) 55%, transparent)",
  },
  morning: {
    label: "morning",
    gradient:
      "linear-gradient(to top, rgba(255,205,150,0.2), rgba(120,170,230,0.1) 60%, transparent)",
  },
  "the middle of the day": {
    label: "midday",
    gradient: "linear-gradient(to top, rgba(210,235,255,0.16), transparent 70%)",
  },
  afternoon: {
    label: "afternoon",
    gradient: "linear-gradient(to top, rgba(255,190,110,0.2), transparent 70%)",
  },
  evening: {
    label: "evening",
    gradient:
      "linear-gradient(to top, rgba(255,100,60,0.28), rgba(150,50,120,0.14) 55%, transparent)",
  },
  "late evening": {
    label: "late evening",
    gradient:
      "linear-gradient(to top, rgba(130,60,210,0.3), rgba(40,20,100,0.16) 55%, transparent)",
  },
};

const DEFAULT: Tint = TINTS["late evening"]!;

export function tintFor(hour: string | null | undefined): Tint {
  return (hour && TINTS[hour]) || DEFAULT;
}

export const KNOWN_HOURS = Object.keys(TINTS);
