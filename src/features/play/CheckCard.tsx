/**
 * The table moment: a proposed check, laid out the way a GM would call it, with
 * the neon d10 the player actually rolls. The engine rolls first and the die
 * animates toward that face — the same contract the Lifepath cards use.
 */
import { useState } from "react";
import type { SkillCheckResult } from "@/engine";
import { DiceRoll } from "@/features/chargen/DiceRoll";
import type { PendingCheck } from "./checkPrompt";

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

export function CheckCard({
  pending,
  roll,
  onSettled,
  busy,
}: {
  pending: PendingCheck;
  roll: () => SkillCheckResult;
  onSettled: (result: SkillCheckResult) => void;
  busy: boolean;
}) {
  const [result, setResult] = useState<SkillCheckResult | null>(null);

  const critDie = result && result.rolls.length > 1 ? result.rolls[1]! : null;

  return (
    <section className="space-y-3 border border-accent/60 bg-accent/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Check called</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          1d10 + STAT + Skill vs DV
        </p>
      </div>

      <h3 className="text-lg font-bold leading-tight">
        {pending.skillName}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({pending.stat.toUpperCase()})
        </span>
      </h3>
      {pending.intent && <p className="text-sm italic text-muted-foreground">{pending.intent}</p>}

      <div className="grid grid-cols-4 gap-2 border-y border-border/60 py-2">
        <Stat label={pending.stat.toUpperCase()} value={String(pending.statValue)} />
        <Stat label="Skill" value={String(pending.skillLevel)} />
        <Stat label="Base" value={`+${pending.base}`} />
        <Stat label={pending.bandName ?? "DV"} value={`DV ${pending.dv}`} />
      </div>

      {pending.modifiers.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {pending.modifiers.map((m) => (
            <span key={m.label} className="font-mono text-[11px] text-muted-foreground">
              {m.label}{" "}
              <span className={m.value < 0 ? "text-destructive" : "text-accent"}>
                {m.value >= 0 ? `+${m.value}` : m.value}
              </span>
            </span>
          ))}
        </div>
      )}

      {result === null ? (
        <div className="flex items-center gap-3">
          <DiceRoll
            sides={10}
            value={null}
            label={`Roll 1d10 for ${pending.skillName}`}
            size={52}
            disabled={busy}
            roll={() => {
              const rolled = roll();
              return {
                face: rolled.rolls[0] ?? 1,
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
              You need a {pending.needed} or better on the die.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <DiceRoll
              sides={10}
              value={result.rolls[0] ?? null}
              roll={() => ({ face: result.rolls[0] ?? 1, commit: () => {} })}
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
                result.success
                  ? "text-lg font-bold text-accent"
                  : "text-lg font-bold text-destructive"
              }
            >
              {result.success ? "Success" : "Failure"} by {Math.abs(result.total - pending.dv)}
            </p>
          </div>
          {result.critical && (
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-neon-pink">
              {result.critical === "success" ? "Critical Success" : "Critical Failure"} — one extra
              d10, no chaining
            </p>
          )}
          <p className="font-mono text-xs text-muted-foreground">{result.formula}</p>
        </div>
      )}
    </section>
  );
}
