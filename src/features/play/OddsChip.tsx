/**
 * The chance, before the die: one chip a player reads at a glance.
 *
 * A word first ("Long shot"), the percentage beside it, and a gauge — then, when
 * a point of Luck would move it, what that point is worth. That last line is
 * what turns Luck from a number in a pool into a bet the player can price. The
 * working-out stays one tap away rather than on the card: the default is fewer
 * numbers, and the trace is there for whoever wants it.
 *
 * Presentation only. The percentage is the engine's, made from the modifiers
 * the roll will use; nothing here can change what the die does.
 */
import type { OddsReadout, OddsTone } from "./oddsPresentation";

const TONE: Record<OddsTone, { text: string; bar: string }> = {
  bad: { text: "text-destructive", bar: "bg-destructive" },
  mid: { text: "text-foreground", bar: "bg-neon-pink" },
  good: { text: "text-neon-cyan", bar: "bg-neon-cyan" },
};

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function OddsChip({ readout, explain }: { readout: OddsReadout; explain: string }) {
  const tone = TONE[readout.tone];
  return (
    <div
      className="space-y-1.5 rounded-sm border border-border/70 bg-background/40 px-3 py-2"
      data-testid="odds-chip"
      data-band={readout.band}
    >
      <div className="flex items-baseline justify-between gap-3" aria-live="polite">
        <p className={`flex items-baseline gap-2 ${tone.text}`}>
          <span className="num text-2xl font-bold leading-none">{readout.percent}%</span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">
            {readout.label}
          </span>
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {readout.versus}
        </p>
      </div>

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-border/50"
        role="img"
        aria-label={`${readout.percent} percent chance`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${tone.bar}`}
          style={{ width: `${readout.percent}%` }}
        />
      </div>

      {(readout.luckGain !== null || readout.luckHint !== null) && (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {readout.luckGain !== null && (
            <span className="text-neon-cyan">Luck has added {readout.luckGain} points</span>
          )}
          {readout.luckGain !== null && readout.luckHint !== null && " · "}
          {readout.luckHint !== null && (
            <span>
              one more Luck → {readout.luckHint.percent}% ({signed(readout.luckHint.gain)})
            </span>
          )}
        </p>
      )}

      <details className="group text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-[0.16em] hover:text-foreground">
          How this is worked out
        </summary>
        <div className="space-y-1 pt-1">
          <p>{explain}</p>
          {readout.modifiers.length > 0 && (
            <p className="num">
              {readout.modifiers.map((m) => `${m.label} ${signed(m.value)}`).join(" · ")}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
