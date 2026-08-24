/**
 * Dedicating Luck to a roll — the one decision the player makes before the dice
 * leave their hand.
 *
 * Luck is committed BEFORE the roll and each point adds +1. That timing is the
 * whole reason it is a decision, so this control locks the moment the dice go:
 * `disabled` is set by the card as soon as a roll exists, and there is no path
 * that raises a spend after seeing a result.
 *
 * The pool it shows is the campaign's live pool, not a per-card allowance, so a
 * player who burned four points on the last check sees four fewer here.
 */
import { Button } from "@/components/ui/button";

export function LuckStepper({
  value,
  remaining,
  onChange,
  disabled,
}: {
  /** Points currently dedicated to this roll. */
  value: number;
  /** Points left in the pool right now. */
  remaining: number;
  onChange: (next: number) => void;
  disabled: boolean;
}) {
  // A character with LUCK 0, or a pool already burned dry, gets no control at
  // all rather than a dead one to poke at.
  if (remaining <= 0 && value <= 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Luck pool empty
      </p>
    );
  }

  const canAdd = !disabled && value < remaining;
  const canRemove = !disabled && value > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Luck</p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          disabled={!canRemove}
          aria-label="Dedicate one less Luck Point"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </Button>
        <span className="num min-w-[3.5rem] text-center text-sm font-bold">
          {value > 0 ? `+${value}` : "—"}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          disabled={!canAdd}
          aria-label="Dedicate one more Luck Point"
          onClick={() => onChange(Math.min(remaining, value + 1))}
        >
          +
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {remaining - value} of {remaining} left
        {disabled ? "" : " · spend before you roll"}
      </p>
    </div>
  );
}
