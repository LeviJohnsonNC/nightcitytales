/**
 * One STAT, as a card.
 *
 * Three things at once, in the order the eye takes them: the number says
 * exactly how strong, the lit left edge says roughly how strong against every
 * other STAT on screen, and the icon says which STAT it is — large, in the
 * space to the right the label and the number leave empty, so a card is
 * recognisable across a room before a single character is read.
 *
 * The edge is the ramp from `statBands.ts`, neon red at 2 through to neon
 * green at 8, and it is a meter as well as a colour: the lit part grows with
 * the value, because a red-green ramp on its own says nothing to a red-green
 * colour-blind reader. Between them they do the job the five-band legend used
 * to do underneath, without a key to learn first.
 *
 * Shared, because the sheet and the STATs step of creation are looking at the
 * same ten numbers and a player should not have to re-learn them in between.
 * `children` is what a caller adds under the number — the die for the STAT it
 * is rolling, the row it came from.
 */
import { StatValue } from "./StatValue";
import { statColor, statFraction } from "./statBands";
import { STAT_ICONS } from "./statIcons";

export function StatCard({
  stat,
  value,
  children,
}: {
  stat: string;
  value: number | null | undefined;
  children?: React.ReactNode;
}) {
  const Icon = STAT_ICONS[stat as keyof typeof STAT_ICONS];
  const lit = typeof value === "number";
  const color = lit ? statColor(value) : null;
  return (
    <div
      className="relative overflow-hidden border border-hairline bg-surface-raised py-2 pl-4 pr-3 transition-colors hover:border-primary/60 hover:bg-surface/80 hover:shadow-[0_0_10px_color-mix(in_oklab,var(--color-primary)_20%,transparent)] active:bg-surface/60"
      style={
        color
          ? ({
              borderLeftColor: color,
              // The faintest wash of the same colour across the card, so a
              // strong STAT reads warm rather than merely outlined.
              backgroundImage: `linear-gradient(90deg, color-mix(in oklab, ${color} 14%, transparent), transparent 60%)`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {color && lit && (
        <>
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-hairline/60" />
          <span
            aria-hidden
            className="absolute bottom-0 left-0 w-1"
            style={{
              height: `${18 + statFraction(value) * 82}%`,
              background: color,
              boxShadow: `0 0 10px -2px ${color}`,
            }}
          />
        </>
      )}

      {/* The badge. Held well back so it reads as the card's face rather than
          as something competing with the number in front of it. */}
      {Icon && (
        <Icon
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 size-12 -translate-y-1/2 opacity-40"
          strokeWidth={1.5}
          style={color ? { color } : undefined}
        />
      )}

      <p className="relative font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
        {stat.toUpperCase()}
      </p>
      <div className="relative num text-2xl font-bold leading-tight text-text">
        <StatValue value={value} showIcon={false} className="text-text" />
      </div>
      {children && <div className="relative mt-2">{children}</div>}
    </div>
  );
}
