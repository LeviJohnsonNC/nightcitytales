/**
 * The worst moment at the table: Mortally Wounded, one d10 between you and the
 * end. The engine rolls (beginTurn → rollDeathSave); the die animates toward
 * that face. Nothing here decides whether the character lives.
 */
import { useState } from "react";
import type { BeginTurnResult } from "@/engine";
import { DiceRoll } from "@/features/chargen/DiceRoll";
import type { PendingDeathSave } from "./deathSavePrompt";

export function DeathSaveCard({
  pending,
  roll,
  onSettled,
  busy,
}: {
  pending: PendingDeathSave;
  roll: () => BeginTurnResult;
  onSettled: (result: BeginTurnResult) => void;
  busy: boolean;
}) {
  const [result, setResult] = useState<BeginTurnResult | null>(null);
  const save = result?.deathSave ?? null;

  return (
    <section className="space-y-3 border border-destructive/60 bg-destructive/10 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-destructive">
          Death Save
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          1d10 + penalty, roll UNDER BODY
        </p>
      </div>

      <h3 className="text-lg font-bold leading-tight">
        {pending.combatant.name} is Mortally Wounded
      </h3>
      <p className="text-sm text-muted-foreground">
        BODY {pending.body}, Death Save Penalty +{pending.penalty}. A natural 10 always fails, and
        one failed save is death.
      </p>

      {save === null ? (
        <div className="flex items-center gap-3">
          <DiceRoll
            sides={10}
            value={null}
            label="Roll your Death Save"
            size={52}
            disabled={busy}
            roll={() => {
              const rolled = roll();
              return {
                face: rolled.deathSave?.roll ?? 1,
                commit: () => {
                  setResult(rolled);
                  onSettled(rolled);
                },
              };
            }}
          />
          <div>
            <p className="text-sm font-semibold">Roll 1d10</p>
            <p className="text-xs text-muted-foreground">
              You need under {pending.body} after the +{pending.penalty} penalty.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <DiceRoll
              sides={10}
              value={save.roll}
              roll={() => ({ face: save.roll, commit: () => {} })}
              size={52}
              disabled
            />
            <p
              className={
                save.survived
                  ? "text-lg font-bold text-accent"
                  : "text-lg font-bold text-destructive"
              }
            >
              {save.survived ? "Still breathing" : "Dead"}
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            d10({save.roll}) + {save.penalty} = {save.effective} vs BODY {pending.body}
            {save.autoFail ? " — natural 10, automatic failure" : ""}. Next save at +
            {save.penaltyAfter}.
          </p>
        </div>
      )}
    </section>
  );
}
