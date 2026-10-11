import { cn } from "@/lib/utils";
import { statBand } from "./statBands";

export function StatValue({
  value,
  className,
  showLabel = false,
  showIcon = true,
}: {
  value: number | null | undefined;
  className?: string;
  showLabel?: boolean;
  /**
   * The band chevron beside the number. Off on the sheet's STAT cards, which
   * carry the STAT's own icon and a colour ramp on the edge — a second arrow
   * there says the same thing twice and neither of them says which STAT it is.
   */
  showIcon?: boolean;
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
      {showIcon && <Icon aria-hidden="true" className="size-[0.72em] shrink-0" strokeWidth={2.5} />}
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
