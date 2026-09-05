/**
 * The gunfight moment, in the panel it belongs to.
 *
 * Same contract as CheckCard: the engine resolves the attack first, the neon
 * d10 animates toward the To-Hit it rolled, and the d6s animate toward the
 * damage it rolled. This component renders numbers; it never decides a hit, a
 * damage total, or a Critical Injury.
 *
 * WHY IT IS SMALL. It lives under the cover list inside the board panel now,
 * and the panel already says most of what this used to repeat: the roster row
 * for the target carries the distance, the Range DV, the HP and the wound
 * state, and the weapon chips carry the gun and its magazine. A card that
 * restated all of it was half duplicate — and the duplication was not only
 * wasted height, it could DISAGREE, because the card kept a second weapon
 * picker with its own idea of which gun was raised. So the weapon is now handed
 * in, chosen once on the board, and everything the panel already shows is said
 * once rather than twice.
 *
 * WHAT SURVIVED UNTOUCHED: the manual roll. The player throws the d10 and
 * dedicates Luck before it leaves their hand. That is the whole point of the
 * card and none of it is automated away.
 *
 * The result state is a FLASH, not a record: once commitAttack writes the
 * attack event the prompt resolves and this unmounts. What happened is kept by
 * the ledger and the Rolls panel, which is why it can afford to be three lines.
 */
import { useMemo, useState } from "react";
import { LuckStepper } from "./LuckStepper";
import type { CapabilitySnapshot, PerformAttackResult } from "@/engine";
import { DiceRoll } from "@/features/chargen/DiceRoll";
import type { FullCharacter } from "@/lib/backend";
import { attackOption, type AttackOption, type PendingAttack } from "./attackPrompt";

/**
 * The roll, written out before it is made.
 *
 * This replaces a four-cell grid of STAT / Skill / Wound / Range DV that cost
 * sixty pixels to say what one line says better: the same numbers, in the order
 * the engine adds them, reading as the formula the result will print. Luck is
 * in it because it is live — the stepper changes this line as it moves, which
 * is what makes dedicating a point feel like a decision rather than a setting.
 */
function formulaLine(option: AttackOption, woundPenalty: number, luck: number): string {
  const parts = [
    "1d10",
    `+ ${option.statLabel} ${option.statValue}`,
    `+ ${option.skillLabel} ${option.skillValue}`,
  ];
  if (woundPenalty !== 0) parts.push(`− Wound ${Math.abs(woundPenalty)}`);
  if (luck > 0) parts.push(`+ Luck ${luck}`);
  return `${parts.join(" ")}  vs  DV ${option.dv}`;
}

export function CombatCard({
  pending,
  character,
  roll,
  onSettled,
  busy,
  luckRemaining,
  capability,
  weaponItemId,
  onCancel,
}: {
  pending: PendingAttack;
  character: FullCharacter;
  /** Ask the engine to resolve the attack with the chosen weapon. */
  roll: (option: AttackOption, luckSpend: number) => PerformAttackResult;
  onSettled: (option: AttackOption, result: PerformAttackResult, luckSpent: number) => void;
  busy: boolean;
  /** Luck Points left this session — an attack roll is a Check like any other. */
  luckRemaining: number;
  /** What the character can actually do; refusals become a weapon's gap. */
  capability?: CapabilitySnapshot | null;
  /**
   * The gun already raised on the board.
   *
   * Not a second picker. One selection paints the range bands, calls the shot
   * when a target is clicked, and rolls it here — so the card can never open on
   * a different weapon than the one whose DV the player just read off the map.
   * If that weapon cannot make THIS shot the gate says why below and the dice
   * stay in their hand; it is never quietly swapped for one that can.
   */
  weaponItemId: string | null;
  onCancel?: () => void;
}) {
  const options = useMemo<AttackOption[]>(
    () => pending.weapons.map((w) => attackOption(pending, w, character, capability)),
    [pending, character, capability],
  );
  const [result, setResult] = useState<PerformAttackResult | null>(null);
  const [luck, setLuck] = useState(0);

  // The board's weapon, or the best thing on the sheet when the board has none
  // to offer — every gun empty or broken leaves it with nothing selected.
  const chosen =
    options.find((o) => o.weapon.itemId === weaponItemId) ??
    options.find((o) => o.gap === null) ??
    options[0] ??
    null;
  const blocked = chosen?.gap ?? null;
  // Exactly the rule the picker used: a weapon with no gap can be rolled. NOT
  // "has a printed DV" — melee has none, and the day the opposed roll it
  // actually wants is modelled, this must not be the thing still refusing it.
  const ready = Boolean(chosen) && !blocked;
  const critDie = result && result.attack.rolls.length > 1 ? result.attack.rolls[1]! : null;

  return (
    <section className="space-y-2 border-t border-neon-pink/50 pt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-pink">
          {result ? "The shot" : "Take the shot"}
        </p>
        {chosen && (
          <p className="font-mono text-[10px] text-muted-foreground">
            {chosen.weapon.name}
            {chosen.damageDice ? ` · ${chosen.damageDice}d6` : ""}
          </p>
        )}
      </div>

      {result === null ? (
        <>
          {/* Who, and what is left of them. The distance and the DV are on the
              roster row three lines up; the HP and SP are what the player is
              deciding against right now, so they come along. */}
          <p className="text-sm">
            <span className="text-muted-foreground">→</span>{" "}
            <span className="font-semibold">{pending.target.name}</span>{" "}
            <span className="num font-mono text-xs text-muted-foreground">
              {pending.distance} m · {pending.target.hp}/{pending.target.hpMax} HP · SP{" "}
              {pending.target.spBody}
            </span>
          </p>

          {/* Cover arrived after the shot was called: said once, about the shot.
              A weapon that cannot make it says so in the gate's own words. */}
          {pending.blockedBy && (
            <p className="text-xs text-destructive">
              No shot: {pending.blockedBy} is in the way. Move, or take it apart.
            </p>
          )}
          {blocked && <p className="text-xs text-destructive">{blocked}</p>}
          {options.length === 0 && (
            <p className="text-xs text-destructive">
              No catalog weapon on the sheet to resolve this attack with.
            </p>
          )}

          {/* Only where there is a printed table to read a DV off. Melee is
              resolved as an opposed roll, so there is no "vs DV" to write. */}
          {chosen && chosen.dv !== null && (
            <p className="num font-mono text-[11px] text-muted-foreground">
              {formulaLine(chosen, pending.woundPenalty, luck)}
            </p>
          )}

          {onCancel && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4 disabled:opacity-40"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel shot · no Action spent
            </button>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <DiceRoll
              sides={10}
              value={null}
              label={`Roll 1d10 to hit ${pending.target.name}`}
              size={48}
              disabled={busy || !ready}
              roll={() => {
                const rolled = roll(chosen!, luck);
                return {
                  face: rolled.attack.rolls[0] ?? 1,
                  commit: () => {
                    setResult(rolled);
                    onSettled(chosen!, rolled, luck);
                  },
                };
              }}
            />
            <LuckStepper
              value={luck}
              remaining={luckRemaining}
              onChange={setLuck}
              disabled={busy || !ready}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <DiceRoll
              sides={10}
              value={result.attack.rolls[0] ?? null}
              roll={() => ({ face: result.attack.rolls[0] ?? 1, commit: () => {} })}
              size={40}
              disabled
            />
            {critDie !== null && (
              <DiceRoll
                sides={10}
                value={critDie}
                roll={() => ({ face: critDie, commit: () => {} })}
                size={32}
                disabled
              />
            )}
            <p
              className={`text-sm font-bold ${
                result.attack.hit ? "text-accent" : "text-destructive"
              }`}
            >
              {result.attack.hit ? "HIT" : "MISS"}
            </p>
            <p className="num font-mono text-[11px] text-muted-foreground">
              {result.attack.formula}
            </p>
          </div>

          {result.damage && result.applied && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {result.damage.rolls.map((face, i) => (
                  <DiceRoll
                    key={i}
                    sides={6}
                    value={face}
                    roll={() => ({ face, commit: () => {} })}
                    size={26}
                    disabled
                  />
                ))}
                {/* The three-cell result grid, as one line. Every number that
                    was in it is still here, in the order the rules apply them:
                    rolled, then what the armour let through. */}
                <p className="num font-mono text-[11px]">
                  {result.damage.total} damage ·{" "}
                  <span className="font-bold">{result.applied.damageThroughArmor}</span> through
                  armor
                </p>
              </div>
              <p className="num font-mono text-[11px] text-muted-foreground">
                {pending.target.name} → {result.applied.hpAfter}/{pending.target.hpMax} HP · SP{" "}
                {result.applied.spAfter}
                {result.targetWoundState && result.targetWoundState !== "none" ? (
                  <span className="text-destructive">
                    {" "}
                    · {result.targetWoundState.replace("_", " ")}
                  </span>
                ) : (
                  ""
                )}
              </p>
              {result.applied.criticalInjury && (
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neon-pink">
                  Critical Injury — two or more 6s, +5 straight to HP
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
