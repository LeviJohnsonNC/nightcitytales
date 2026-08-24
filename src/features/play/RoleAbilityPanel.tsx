/**
 * Your Role, at the table.
 *
 * A Solo divides their Combat Awareness pool here — the one decision that makes
 * a Solo play like a Solo rather than like a character sheet with a gun. Every
 * other Role gets its ability named with what it is currently doing for them,
 * so the panel never pretends a Role has nothing.
 *
 * The numbers and the option list come from the rules data through the engine;
 * this file lays them out and posts the division back.
 */
import { useEffect, useState } from "react";
import {
  CHARISMATIC_AUDIENCES,
  COMBAT_AWARENESS_OPTIONS,
  charismaticFavor,
  combatAwarenessEffects,
  combatAwarenessValue,
  type CharismaticImpactResult,
  type CombatAwarenessOption,
} from "@/engine";
import { Button } from "@/components/ui/button";
import { DiceRoll } from "@/features/chargen/DiceRoll";
import type { usePlay } from "./usePlay";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

/** The cost of the next step up in a stepped option, or one point for a scaling one. */
function nextCost(option: CombatAwarenessOption, points: number): number | null {
  if (option.perPoint) return points + 1;
  const steps = option.steps ?? [];
  const next = steps.find((step) => step.cost > points);
  return next ? next.cost : null;
}

/** The cost of dropping back a step, or null when it is already empty. */
function prevCost(option: CombatAwarenessOption, points: number): number | null {
  if (points <= 0) return null;
  if (option.perPoint) return points - 1;
  const steps = option.steps ?? [];
  const below = [...steps].reverse().find((step) => step.cost < points);
  return below ? below.cost : 0;
}

function OptionRow({
  option,
  points,
  remaining,
  disabled,
  onChange,
}: {
  option: CombatAwarenessOption;
  points: number;
  remaining: number;
  disabled: boolean;
  onChange: (points: number) => void;
}) {
  const value = combatAwarenessValue(option.id, points);
  const up = nextCost(option, points);
  const down = prevCost(option, points);
  const canRaise = up !== null && up - points <= remaining;

  return (
    <li className="space-y-1 border-b border-border/40 pb-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{option.name}</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 p-0"
            disabled={disabled || down === null}
            aria-label={`Take points off ${option.name}`}
            onClick={() => down !== null && onChange(down)}
          >
            −
          </Button>
          <span className="num w-10 text-center text-xs">{points}p</span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 p-0"
            disabled={disabled || !canRaise}
            aria-label={`Put points into ${option.name}`}
            onClick={() => up !== null && onChange(up)}
          >
            +
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {option.effect}
        {value > 0 && (
          <span className="ml-1 font-semibold text-accent">
            Active: {option.id === "fumble_recovery" ? "yes" : `+${value}`}
          </span>
        )}
      </p>
    </li>
  );
}

function CombatAwarenessSection({ play }: { play: ReturnType<typeof usePlay> }) {
  const rank = play.roleAbility?.rank ?? 0;
  const saved = play.combatAwarenessAllocation;
  const [draft, setDraft] = useState<Record<string, number>>(saved);

  // The saved division is the truth; adopt it whenever it changes underneath.
  useEffect(() => setDraft(saved), [saved]);

  const effects = combatAwarenessEffects(draft, rank);
  const remaining = effects.pool - effects.spent;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Combat Awareness</Label>
        <p className="num text-xs text-muted-foreground">
          {remaining} of {effects.pool} points free
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Divide the pool before the shooting starts. The division holds until you change it.
      </p>

      <ul className="space-y-2">
        {COMBAT_AWARENESS_OPTIONS.map((option) => (
          <OptionRow
            key={option.id}
            option={option}
            points={draft[option.id] ?? 0}
            remaining={remaining}
            disabled={play.combatAwarenessBusy || play.busy}
            onChange={(points) => setDraft({ ...draft, [option.id]: points })}
          />
        ))}
      </ul>

      {dirty && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={play.combatAwarenessBusy}
            onClick={() => play.setCombatAwareness(draft)}
          >
            {play.combatAwarenessBusy ? "…" : "Set the division"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDraft(saved)}>
            Revert
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * A Rockerboy working a room. The audience sets the DV, the Rank is the whole
 * of the roll, and the die is thrown by hand like every other roll in the app.
 */
function CharismaticImpactSection({ play }: { play: ReturnType<typeof usePlay> }) {
  const rank = play.roleAbility?.rank ?? 0;
  const [audienceId, setAudienceId] = useState<string>(CHARISMATIC_AUDIENCES[0]?.id ?? "single");
  const [result, setResult] = useState<CharismaticImpactResult | null>(null);

  const audience = CHARISMATIC_AUDIENCES.find((a) => a.id === audienceId);
  const favor = charismaticFavor(rank, audienceId);
  const busy = play.charismaBusy || play.busy;

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Charismatic Impact</Label>
        <p className="num text-xs text-muted-foreground">Rank {rank}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Win a room over. Rank + 1d10 against the DV their numbers set.
      </p>

      <div className="flex flex-wrap gap-1">
        {CHARISMATIC_AUDIENCES.map((a) => (
          <Button
            key={a.id}
            size="sm"
            variant={a.id === audienceId ? "default" : "outline"}
            disabled={busy || result !== null}
            onClick={() => setAudienceId(a.id)}
          >
            {a.name} · DV{a.dv}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {favor ? `At Rank ${rank} they will: ${favor}.` : "No following of that size yet."}
      </p>

      {result === null ? (
        <div className="flex items-center gap-3">
          <DiceRoll
            sides={10}
            value={null}
            size={44}
            disabled={busy}
            label={`Roll Charismatic Impact against ${audience?.name ?? "them"}`}
            roll={() => {
              const rolled = play.rollCharismaticImpact(audienceId);
              return {
                face: rolled.rolls[0] ?? 1,
                commit: () => {
                  setResult(rolled);
                  play.commitCharismaticImpact(rolled);
                },
              };
            }}
          />
          <p className="text-xs text-muted-foreground">
            You need {Math.max(1, (audience?.dv ?? 0) - rank)} or better on the die.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p
            className={
              result.success
                ? "text-sm font-bold text-accent"
                : "text-sm font-bold text-destructive"
            }
          >
            {result.success ? "They are yours" : "The room does not buy it"}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{result.formula}</p>
          {!result.success && (
            <p className="text-xs text-muted-foreground">Not this crowd, not for a week.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** Every other Role: name the ability and what it is doing for them right now. */
function AbilitySection({ play }: { play: ReturnType<typeof usePlay> }) {
  const ability = play.roleAbility;
  if (!ability) return null;

  const lines: string[] = [];
  if (ability.info.abilityId === "operator") {
    lines.push(`+${ability.rank} on a Trading deal — your Operator Rank is part of the Haggle.`);
  }

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{ability.info.abilityName}</Label>
        <p className="num text-xs text-muted-foreground">Rank {ability.rank}</p>
      </div>
      {lines.length > 0 ? (
        lines.map((line) => (
          <p key={line} className="text-xs text-muted-foreground">
            {line}
          </p>
        ))
      ) : (
        <p className="text-xs text-muted-foreground">
          Your Role Ability is not modelled at the table yet — the GM plays it in the fiction.
        </p>
      )}
    </section>
  );
}

export function RoleAbilityPanel({ play }: { play: ReturnType<typeof usePlay> }) {
  const ability = play.roleAbility;
  if (!ability) return null;
  if (ability.info.abilityId === "combat_awareness") {
    return <CombatAwarenessSection play={play} />;
  }
  if (ability.info.abilityId === "charismatic_impact") {
    return <CharismaticImpactSection play={play} />;
  }
  return <AbilitySection play={play} />;
}
