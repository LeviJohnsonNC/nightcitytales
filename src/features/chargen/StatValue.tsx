import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    description: "Normal human capability. 5 is a good mental anchor for an ordinary competent adult.",
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

export function StatValue({
  value,
  className,
  showLabel = false,
}: {
  value: number | null | undefined;
  className?: string;
  showLabel?: boolean;
}) {
  if (value === null || value === undefined) {
    return <span className={cn("num text-text-dim", className)}>—</span>;
  }

  const band = statBand(value);
  const Icon = band.Icon;
  return (
    <span
      className={cn("inline-flex items-center justify-center gap-1", band.textClass, className)}
      title={`${band.label}: ${band.description}`}
      aria-label={`${value}, ${band.label}`}
    >
      <span className="num tabular-nums">{value}</span>
      <Icon aria-hidden="true" className="size-[0.72em] shrink-0" strokeWidth={2.5} />
      {showLabel && (
        <span className="font-mono text-[9px] font-semibold uppercase text-current">
          {band.shortLabel}
        </span>
      )}
    </span>
  );
}

export function StatBandIndicator({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined) return null;
  const band = statBand(value);
  const Icon = band.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase",
        band.textClass,
        className,
      )}
      title={`${band.label}: ${band.description}`}
      aria-label={band.label}
    >
      <Icon aria-hidden="true" className="size-3" strokeWidth={2.5} />
      {band.shortLabel}
    </span>
  );
}

export function StatLegend({ className }: { className?: string }) {
  const entries = [
    { value: 2, range: "2" },
    { value: 3, range: "3" },
    { value: 4, range: "4–5" },
    { value: 6, range: "6" },
    { value: 7, range: "7–8" },
  ];

  return (
    <div
      className={cn("flex flex-wrap gap-x-3 gap-y-1", className)}
      aria-label="STAT strength legend"
    >
      {entries.map(({ value, range }) => {
        const band = statBand(value);
        const Icon = band.Icon;
        return (
          <span
            key={range}
            className={cn(
              "inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase",
              band.textClass,
            )}
            title={band.description}
          >
            <Icon aria-hidden="true" className="size-3" strokeWidth={2.5} />
            <span>{range}</span>
            <span className="text-text-dim">{band.shortLabel}</span>
          </span>
        );
      })}
    </div>
  );
}