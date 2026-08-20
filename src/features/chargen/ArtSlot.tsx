import { cn } from "@/lib/utils";
import type { ResolvedArt } from "./art";

/**
 * Placeholder-first image slot. With no artwork the slot renders a deliberate
 * terminal panel showing the label and the missing asset id — never a grey box,
 * a broken image, or a spinner. Artwork drops in with no layout change.
 */
export function ArtSlot({
  art,
  label,
  className,
  focalOverride,
}: {
  art: ResolvedArt;
  label: string;
  className?: string;
  /** Presentation-only crop override, [x, y] in 0-1. */
  focalOverride?: [number, number];
}) {
  const focal = focalOverride ?? art.focalPoint;
  if (art.src) {
    return (
      <img
        src={art.src}
        alt={art.alt}
        loading="lazy"
        style={{ objectPosition: `${focal[0] * 100}% ${focal[1] * 100}%` }}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${art.alt} — artwork pending`}
      className={cn(
        "relative flex h-full w-full flex-col justify-between overflow-hidden bg-[repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_oklab,var(--color-accent)_10%,transparent)_10px_11px)] p-3",
        "border border-accent/30",
        className,
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
        Art pending
      </span>
      <span className="font-mono text-sm font-bold uppercase leading-tight tracking-wider text-foreground">
        {label}
      </span>
      <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
        {art.assetId}
      </span>
    </div>
  );
}
