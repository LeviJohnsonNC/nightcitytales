/**
 * The gunfight moment. Same contract as CheckCard: the engine resolves the
 * attack first, the neon d10 animates toward the To-Hit it rolled, and the d6s
 * animate toward the damage it rolled. This component renders numbers; it never
 * decides a hit, a damage total, or a Critical Injury.
 */
import { useMemo, useState } from "react";
import { LuckStepper } from "./LuckStepper";
import type { CapabilitySnapshot, PerformAttackResult } from "@/engine";
import { DiceRoll } from "@/features/chargen/DiceRoll";
import type { FullCharacter } from "@/lib/backend";
import { attackOption, type AttackOption, type PendingAttack } from "./attackPrompt";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="num text-base font-bold">{value}</p>
    </div>
  );
}

export function CombatCard({
  pending,
  character,
  roll,
  onSettled,
  busy,
  luckRemaining,
  capability,
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
}) {
  const options = useMemo<AttackOption[]>(
    () => pending.weapons.map((w) => attackOption(pending, w, character, capability)),
    [pending, character, capability],
  );
  const usable = options.filter((o) => o.gap === null);
  const [chosenId, setChosenId] = useState<string | null>(usable[0]?.weapon.itemId ?? null);
  const [result, setResult] = useState<PerformAttackResult | null>(null);
  const [luck, setLuck] = useState(0);

  const chosen = options.find((o) => o.weapon.itemId === chosenId) ?? null;
  const critDie = result && result.attack.rolls.length > 1 ? result.attack.rolls[1]! : null;

  return (
    <section className="space-y-3 border border-neon-pink/60 bg-neon-pink/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-pink">
          Attack called
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          1d10 + STAT + Skill vs Range DV
        </p>
      </div>

      <h3 className="text-lg font-bold leading-tight">
        {pending.attacker.name} <span className="text-muted-foreground">&rarr;</span>{" "}
        {pending.target.name}{" "}
        <span className="text-sm font-normal text-muted-foreground">at {pending.distance}m</span>
      </h3>
      {pending.intent && <p className="text-sm italic text-muted-foreground">{pending.intent}</p>}

      {/*
        Cover arrived after the shot was called. Said once, about the shot,
        rather than repeated as a gap on every weapon in the kit — the reason
        is the same whichever gun is raised.
      */}
      {pending.blockedBy && (
        <p className="text-sm text-destructive">
          No shot: {pending.blockedBy} is in the way. Move, or take it apart.
        </p>
      )}

      {options.length === 0 && (
        <p className="text-sm text-destructive">
          No catalog weapon on the sheet to resolve this attack with.
        </p>
      )}

      {result === null && options.length > 0 && (
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          {options.map((o) => {
            const active = o.weapon.itemId === chosenId;
            return (
              <button
                key={o.weapon.itemId}
                type="button"
                disabled={o.gap !== null || busy}
                onClick={() => setChosenId(o.weapon.itemId)}
                title={o.gap ?? `${o.damageDice ?? "?"}d6 · DV ${o.dv ?? "?"}`}
                className={`border px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-40 ${
                  active
                    ? "border-neon-pink text-neon-pink"
                    : "border-border/60 hover:border-accent"
                }`}
              >
                <span className="block font-semibold">{o.weapon.name}</span>
                <span className="block font-mono text-[10px] text-muted-foreground">
                  {o.gap ?? `${o.damageDice ?? "?"}d6 · DV ${o.dv ?? "?"}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {chosen && chosen.dv !== null && (
        <div className="grid grid-cols-2 gap-2 border-y sm:grid-cols-4 border-border/60 py-2">
          <Stat label={chosen.statLabel} value={String(chosen.statValue)} />
          <Stat label={chosen.skillLabel} value={String(chosen.skillValue)} />
          <Stat
            label="Wound"
            value={pending.woundPenalty === 0 ? "—" : String(pending.woundPenalty)}
          />
          <Stat label="Range DV" value={`DV ${chosen.dv}`} />
        </div>
      )}

      {result === null ? (
        <div className="space-y-3">
          <LuckStepper
            value={luck}
            remaining={luckRemaining}
            onChange={setLuck}
            disabled={busy || !chosen || chosen.gap !== null}
          />
          <div className="flex items-center gap-3">
            <DiceRoll
              sides={10}
              value={null}
              label={`Roll 1d10 to hit ${pending.target.name}`}
              size={52}
              disabled={busy || !chosen || chosen.gap !== null}
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
            <div>
              <p className="text-sm font-semibold">Roll To-Hit</p>
              <p className="text-xs text-muted-foreground">
                {pending.target.name}: {pending.target.hp}/{pending.target.hpMax} HP, SP{" "}
                {pending.target.spBody}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <DiceRoll
              sides={10}
              value={result.attack.rolls[0] ?? null}
              roll={() => ({ face: result.attack.rolls[0] ?? 1, commit: () => {} })}
              size={52}
              disabled
            />
            {critDie !== null && (
              <DiceRoll
                sides={10}
                value={critDie}
                roll={() => ({ face: critDie, commit: () => {} })}
                size={40}
                disabled
              />
            )}
            <p
              className={
                result.attack.hit
                  ? "text-lg font-bold text-accent"
                  : "text-lg font-bold text-destructive"
              }
            >
              {result.attack.hit ? "Hit" : "Miss"}
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{result.attack.formula}</p>

          {result.damage && result.applied && (
            <div className="space-y-2 border-t border-border/60 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                {result.damage.rolls.map((face, i) => (
                  <DiceRoll
                    key={i}
                    sides={6}
                    value={face}
                    roll={() => ({ face, commit: () => {} })}
                    size={34}
                    disabled
                  />
                ))}
                <p className="num text-base font-bold">{result.damage.total} damage rolled</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Through armor" value={String(result.applied.damageThroughArmor)} />
                <Stat
                  label="HP after"
                  value={`${result.applied.hpAfter}/${pending.target.hpMax}`}
                />
                <Stat label="SP after" value={String(result.applied.spAfter)} />
              </div>
              {result.applied.criticalInjury && (
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-neon-pink">
                  Critical Injury — two or more 6s, +5 damage straight to HP
                </p>
              )}
              {result.targetWoundState && result.targetWoundState !== "none" && (
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-destructive">
                  {pending.target.name} is {result.targetWoundState.replace("_", " ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
