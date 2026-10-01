/**
 * The character, as a game shows them: a portrait, a name, and bars that
 * change colour as they empty. Presentation only — every number arrives from
 * the campaign's vitals, and the bands are a look (`hudModel.ts`), not a rule.
 */
import { ArtSlot } from "@/features/chargen/ArtSlot";
import { portraitArt, portraitById } from "@/features/chargen/art";
import { usePortraitUrl } from "@/features/chargen/usePortraitUrl";
import { cn } from "@/lib/utils";
import { barTone, fillFraction, luckPips, woundBadge, type BarTone } from "./hudModel";

const FILL: Record<BarTone, string> = {
  ok: "bg-success",
  warn: "bg-amber-500",
  danger: "bg-destructive",
};

const TEXT: Record<BarTone, string> = {
  ok: "text-foreground",
  warn: "text-amber-500",
  danger: "text-destructive",
};

/** A bar with its figure: HP, Humanity. Pulses once it is in the red. */
export function VitalBar({
  label,
  current,
  max,
  tone,
}: {
  label: string;
  current: number;
  max: number;
  /** Force a colour; otherwise it follows how full the bar is. */
  tone?: BarTone;
}) {
  const fraction = fillFraction(current, max);
  const t = tone ?? barTone(fraction);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
          {label}
        </span>
        <span className={cn("num font-mono text-sm font-bold", TEXT[t])}>
          {current}
          <span className="text-text-dim">/{max}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        className="mt-1 h-2 overflow-hidden bg-hairline/70"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
            FILL[t],
            t === "danger" && "animate-pulse motion-reduce:animate-none",
          )}
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
    </div>
  );
}

function LuckPips({ left, max }: { left: number; max: number }) {
  const pips = luckPips(left, max);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">Luck</span>
      {pips ? (
        <span className="flex gap-1" role="img" aria-label={`Luck ${left} of ${max}`}>
          {pips.map((filled, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "size-2.5 rounded-full border",
                filled
                  ? "border-neon-cyan bg-neon-cyan shadow-[0_0_6px_var(--color-neon-cyan)]"
                  : "border-hairline",
              )}
            />
          ))}
        </span>
      ) : (
        <span className="num font-mono text-sm font-bold">
          {left}/{max}
        </span>
      )}
    </div>
  );
}

export function CharacterCard({
  name,
  handle,
  role,
  portraitPath,
  portraitId,
  hp,
  humanity,
  luck,
  wound,
}: {
  name: string;
  handle?: string | null;
  role: string;
  portraitPath?: string | null;
  portraitId?: string | null;
  hp: { current: number; max: number };
  humanity: { current: number; max: number };
  luck: { left: number; max: number };
  wound: string | null | undefined;
}) {
  const generated = usePortraitUrl(portraitPath ?? null);
  const preset = portraitId ? portraitById(portraitId) : undefined;
  const badge = woundBadge(wound);
  return (
    <section className="neon-frame-cyan relative overflow-hidden bg-card">
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-[4.5rem] shrink-0 overflow-hidden border border-hairline bg-ground">
          {generated ? (
            <img
              src={generated}
              alt={`${name} portrait`}
              className="h-full w-full object-cover object-top"
            />
          ) : preset ? (
            <ArtSlot art={portraitArt(preset)} label={name} />
          ) : (
            <span
              aria-hidden
              className="flex h-full items-center justify-center bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklab,var(--color-neon-purple)_24%,transparent),transparent_70%)] text-3xl font-bold text-text-dim"
            >
              {name.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 shadow-[inset_0_0_14px_rgba(0,0,0,0.6)]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold leading-tight">{name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {handle ? `"${handle}" · ` : ""}
            <span className="capitalize">{role}</span>
          </p>
          {badge && (
            <span
              className={cn(
                "mt-1.5 inline-block border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                badge.tone === "danger"
                  ? "border-destructive text-destructive"
                  : "border-amber-500 text-amber-500",
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-2.5 border-t border-hairline px-3 py-3">
        <VitalBar label="HP" current={hp.current} max={hp.max} />
        <VitalBar label="Humanity" current={humanity.current} max={humanity.max} />
        {luck.max > 0 && <LuckPips left={luck.left} max={luck.max} />}
      </div>
    </section>
  );
}
