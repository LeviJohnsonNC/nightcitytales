import { cn } from "@/lib/utils";
import { statBand } from "./statBands";

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
