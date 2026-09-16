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
