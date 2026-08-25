/**
 * The table moment: a proposed check, laid out the way a GM would call it, with
 * the neon d10 the player actually rolls. The engine rolls first and the die
 * animates toward that face — the same contract the Lifepath cards use.
 *
 * A check comes in two shapes. Against the world it is rolled against a printed
 * Difficulty Value. Against a person who is pushing back it is an Opposed Check:
 * both sides roll STAT + Skill + 1d10, and the player rolls both dice — theirs,
 * then the one the NPC answers with. The engine rolls both the moment the first
 * die is clicked; the second click only reveals what it already rolled, so the
 * opposing die can never be re-rolled into a better answer.
 */
import { useState } from "react";
import { DiceRoll } from "@/features/chargen/DiceRoll";
import { LuckStepper } from "./LuckStepper";
import type { CheckRoll, PendingCheck, PendingOpposition } from "./checkPrompt";

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

function SideHeading({ who, detail }: { who: string; detail: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{who}</p>
      <p className="text-sm font-semibold leading-tight">{detail}</p>
    </div>
  );
}

/** The verdict line, in the language the rules use for it. */
function Verdict({ roll }: { roll: Extract<CheckRoll, { kind: "opposed" }> }) {
  const { result } = roll;
  if (result.tie) {
    return (
      <div>
        <p className="text-lg font-bold text-destructive">Failure — tied</p>
        <p className="text-xs text-muted-foreground">
          Both totals came to {result.actor.total}. A tie goes to the one resisting.
        </p>
      </div>
    );
  }
  return (
    <p
      className={
        result.success ? "text-lg font-bold text-accent" : "text-lg font-bold text-destructive"
      }
    >
      {result.success ? "Success" : "Failure"} by {Math.abs(result.margin)}
    </p>
  );
}

/** The wound tax on this roll, stated plainly rather than buried in the total. */
function WoundLine({ penalty }: { penalty: number }) {
  if (penalty === 0) return null;
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-destructive">
      {penalty} to this check — you are {penalty <= -4 ? "mortally" : "seriously"} wounded
    </p>
  );
}

function CritLine({ critical, who }: { critical: "success" | "failure" | null; who: string }) {
  if (!critical) return null;
  return (
    <p className="font-mono text-xs uppercase tracking-[0.18em] text-neon-pink">
      {who} {critical === "success" ? "Critical Success" : "Critical Failure"} — one extra d10, no
      chaining
    </p>
  );
}

/** The opposed layout: your numbers, their numbers, and the two dice between them. */
function OpposedBody({
  pending,
  opposition,
  roll,
  onSettled,
  busy,
  luckRemaining,
}: {
  pending: PendingCheck;
  opposition: PendingOpposition;
  roll: (luckSpend: number) => CheckRoll;
  onSettled: (roll: CheckRoll) => void;
  busy: boolean;
  luckRemaining: number;
}) {
  const [luck, setLuck] = useState(0);
  // Both sides are rolled together on the first click; `revealed` is only how
  // much of that result the player has turned over so far.
  const [rolled, setRolled] = useState<Extract<CheckRoll, { kind: "opposed" }> | null>(null);
  const [opponentRevealed, setOpponentRevealed] = useState(false);

  const actorDie = rolled?.result.actor.rolls[0] ?? null;
  const actorCrit =
    rolled && rolled.result.actor.rolls.length > 1 ? rolled.result.actor.rolls[1]! : null;
  const opponentDie = rolled?.result.opponent.rolls[0] ?? null;
  const opponentCrit =
    rolled && rolled.result.opponent.rolls.length > 1 ? rolled.result.opponent.rolls[1]! : null;

  return (
    <>
      <div className="grid gap-3 border-y border-border/60 py-3 sm:grid-cols-2">
        <div className="space-y-2">
          <SideHeading who="You" detail={`${pending.skillName} (${pending.stat.toUpperCase()})`} />
          <div className="grid grid-cols-3 gap-2">
            <Stat label={pending.stat.toUpperCase()} value={String(pending.statValue)} />
            <Stat label="Skill" value={String(pending.skillLevel)} />
            <Stat label="Base" value={`+${pending.base}`} />
          </div>
        </div>
        <div className="space-y-2 sm:border-l sm:border-border/60 sm:pl-3">
          <SideHeading
            who={opposition.npcName}
            detail={`${opposition.skillName} (${opposition.stat.toUpperCase()})`}
          />
          <div className="grid grid-cols-3 gap-2">
            <Stat label={opposition.stat.toUpperCase()} value={String(opposition.statValue)} />
            <Stat label="Skill" value={String(opposition.skillLevel)} />
            <Stat label="Base" value={`+${opposition.base}`} />
          </div>
        </div>
      </div>

      <WoundLine penalty={pending.woundPenalty} />

      {opposition.remembered && (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Their numbers are what this campaign already knows about them
        </p>
      )}

      <LuckStepper
        value={luck}
        remaining={luckRemaining}
        onChange={setLuck}
        disabled={busy || rolled !== null}
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <DiceRoll
            sides={10}
            value={actorDie}
            label={`Roll your 1d10 for ${pending.skillName}`}
            size={52}
            disabled={busy || rolled !== null}
            roll={() => {
              const next = roll(luck);
              if (next.kind !== "opposed") throw new Error("This check is opposed.");
              return { face: next.result.actor.rolls[0] ?? 1, commit: () => setRolled(next) };
            }}
          />
          {actorCrit !== null && (
            <DiceRoll
              sides={10}
              value={actorCrit}
              roll={() => ({ face: actorCrit, commit: () => {} })}
              size={38}
              disabled
            />
          )}
          <div>
            <p className="text-sm font-semibold">Your roll</p>
            <p className="num text-sm text-muted-foreground">
              {rolled ? rolled.result.actor.total : "—"}
            </p>
          </div>
        </div>

        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">vs</p>

        <div className="flex items-center gap-2">
          <DiceRoll
            sides={10}
            value={opponentRevealed ? opponentDie : null}
            label={`Roll ${opposition.npcName}'s 1d10`}
            size={52}
            disabled={busy || rolled === null || opponentRevealed}
            roll={() => {
              if (!rolled) throw new Error("Roll your own die first.");
              return {
                face: rolled.result.opponent.rolls[0] ?? 1,
                commit: () => {
                  setOpponentRevealed(true);
                  onSettled(rolled);
                },
              };
            }}
          />
          {opponentRevealed && opponentCrit !== null && (
            <DiceRoll
              sides={10}
              value={opponentCrit}
              roll={() => ({ face: opponentCrit, commit: () => {} })}
              size={38}
              disabled
            />
          )}
          <div>
            <p className="text-sm font-semibold">{opposition.npcName}</p>
            <p className="num text-sm text-muted-foreground">
              {opponentRevealed && rolled ? rolled.result.opponent.total : "—"}
            </p>
          </div>
        </div>
      </div>

      {!rolled && (
        <p className="text-xs text-muted-foreground">
          Roll your d10 first, then theirs. You have to beat their total — a tie goes to them.
        </p>
      )}
      {rolled && !opponentRevealed && (
        <p className="text-xs text-muted-foreground">
          You have {rolled.result.actor.total}. Roll {opposition.npcName}&apos;s die to see if it
          holds.
        </p>
      )}

      {rolled && opponentRevealed && (
        <div className="space-y-2">
          <Verdict roll={rolled} />
          <CritLine critical={rolled.result.actor.critical} who="Your" />
          <CritLine critical={rolled.result.opponent.critical} who={`${opposition.npcName}'s`} />
          <p className="font-mono text-xs text-muted-foreground">{rolled.result.actor.formula}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {rolled.result.opponent.formula}
          </p>
        </div>
      )}
    </>
  );
}

/** The classic layout: one die against a Difficulty Value. */
function DvBody({
  pending,
  dv,
  roll,
  onSettled,
  busy,
  luckRemaining,
}: {
  pending: PendingCheck;
  dv: number;
  roll: (luckSpend: number) => CheckRoll;
  onSettled: (roll: CheckRoll) => void;
  busy: boolean;
  luckRemaining: number;
}) {
  const [rolled, setRolled] = useState<Extract<CheckRoll, { kind: "dv" }> | null>(null);
  const [luck, setLuck] = useState(0);
  // Opposed checks carry no target number; on this side of the card there is
  // always a DV, so derive it rather than rendering a null.
  const needed = pending.needed ?? dv - pending.base;
  const result = rolled?.result ?? null;
  const critDie = result && result.rolls.length > 1 ? result.rolls[1]! : null;

  return (
    <>
      <div className="grid grid-cols-4 gap-2 border-y border-border/60 py-2">
        <Stat label={pending.stat.toUpperCase()} value={String(pending.statValue)} />
        <Stat label="Skill" value={String(pending.skillLevel)} />
        <Stat label="Base" value={`+${pending.base}`} />
        <Stat label={pending.bandName ?? "DV"} value={`DV ${dv}`} />
      </div>

      <WoundLine penalty={pending.woundPenalty} />

      {result === null ? (
        <div className="space-y-3">
          <LuckStepper value={luck} remaining={luckRemaining} onChange={setLuck} disabled={busy} />
          <div className="flex items-center gap-3">
            <DiceRoll
              sides={10}
              value={null}
              label={`Roll 1d10 for ${pending.skillName}`}
              size={52}
              disabled={busy}
              roll={() => {
                const next = roll(luck);
                if (next.kind !== "dv") throw new Error("This check is rolled against a DV.");
                return {
                  face: next.result.rolls[0] ?? 1,
                  commit: () => {
                    setRolled(next);
                    onSettled(next);
                  },
                };
              }}
            />
            <div>
              <p className="text-sm font-semibold">Roll 1d10</p>
              <p className="text-xs text-muted-foreground">
                {describeOutlook(pending.base + luck - pending.woundPenalty, dv)}
              </p>
            </div>

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
              {result.success ? "Success" : "Failure"} by {Math.abs(result.total - dv)}
            </p>
          </div>
          <CritLine critical={result.critical} who="" />
          <p className="font-mono text-xs text-muted-foreground">{result.formula}</p>
        </div>
      )}
    </>
  );
}

export function CheckCard({
  pending,
  roll,
  onSettled,
  busy,
  luckRemaining,
}: {
  pending: PendingCheck;
  roll: (luckSpend: number) => CheckRoll;
  onSettled: (roll: CheckRoll) => void;
  busy: boolean;
  /** Luck Points the character has left this session. */
  luckRemaining: number;
}) {
  const opposition = pending.opposition;

  return (
    <section className="space-y-3 border border-accent/60 bg-accent/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          {opposition ? "Opposed check" : "Check called"}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {opposition
            ? "1d10 + STAT + Skill vs their 1d10 + STAT + Skill"
            : "1d10 + STAT + Skill vs DV"}
        </p>
      </div>

      <h3 className="text-lg font-bold leading-tight">
        {pending.skillName}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({pending.stat.toUpperCase()}){opposition ? ` vs ${opposition.npcName}` : ""}
        </span>
      </h3>
      {pending.intent && <p className="text-sm italic text-muted-foreground">{pending.intent}</p>}

      {opposition ? (
        <OpposedBody
          pending={pending}
          opposition={opposition}
          roll={roll}
          onSettled={onSettled}
          busy={busy}
          luckRemaining={luckRemaining}
        />
      ) : (
        <DvBody
          pending={pending}
          dv={pending.dv ?? 0}
          roll={roll}
          onSettled={onSettled}
          busy={busy}
          luckRemaining={luckRemaining}
        />
      )}
    </section>
  );
}
