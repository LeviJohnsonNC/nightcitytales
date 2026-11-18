import { useRef, useState, type ReactNode } from "react";
import { HoloDie, type DieTone } from "@/features/dice/HoloDie";
import { lifeCheckVerdict } from "./lifeCheckView";
import { LuckStepper } from "@/features/play/LuckStepper";
import type { CheckRoll, PendingCheck } from "@/features/play/checkPrompt";
import type { CheckPreview } from "@/features/play/rollCheck";

const signed = (value: number) => (value < 0 ? `−${Math.abs(value)}` : `+${value}`);
type Face = { rolls: number[]; critical: "success" | "failure" | null };

function Die({
  side,
  animate,
  onLanded,
}: {
  side: Face;
  animate?: boolean;
  onLanded?: () => void;
}) {
  const tone: DieTone =
    side.critical === "success" ? "crit" : side.critical === "failure" ? "fumble" : null;
  return (
    <div className="life-check-dice">
      <div className="life-check-faces" inert aria-hidden="true">
        <HoloDie
          key={animate ? "rolling" : "landed"}
          sides={10}
          value={side.rolls[0] ?? null}
          size={66}
          tone={tone}
          {...(animate ? { autoRoll: "mount" as const, delay: 0 } : {})}
          {...(onLanded ? { onSettled: onLanded } : {})}
        />
        {!animate && side.rolls[1] !== undefined && (
          <HoloDie sides={10} value={side.rolls[1]} size={38} tone={tone} />
        )}
      </div>
      {!animate && side.rolls[1] !== undefined && (
        <span className="life-check-critical">
          {side.critical === "success" ? "Critical" : "Fumble"}{" "}
          {signed(side.critical === "success" ? side.rolls[1] : -side.rolls[1])}
        </span>
      )}
    </div>
  );
}

type Term = { label: string; value: number; raw?: boolean };

function Terms({ entries, name }: { entries: Term[]; name?: string | undefined }) {
  return (
    <dl className="life-check-terms" aria-label={name}>
      {entries.map(({ label, value, raw }, index) => (
        <div key={`${label}-${index}`}>
          <dt>{label}</dt>
          <dd>{raw ? value : signed(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Details({ children }: { children: ReactNode }) {
  return (
    <details className="life-check-details">
      <summary>Roll details</summary>
      {children}
    </details>
  );
}

type Reveal =
  | { stage: "actor"; roll: CheckRoll }
  | { stage: "opponent-ready" | "opponent"; roll: Extract<CheckRoll, { kind: "opposed" }> };

export function LifeCheckCard({
  pending,
  busy,
  luckRemaining,
  odds,
  roll,
  onLanded,
}: {
  pending: PendingCheck;
  busy: boolean;
  luckRemaining: number;
  odds: (luck: number) => CheckPreview | null;
  roll: (luck: number) => CheckRoll;
  onLanded: (roll: CheckRoll, restoreFocus: boolean) => void;
}) {
  const [dedicated, setDedicated] = useState(0);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const locked = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const luck = Math.min(dedicated, luckRemaining);
  const preview = odds(luck);
  const extra = !reveal && luck < luckRemaining ? odds(luck + 1) : null;
  const opposition = pending.opposition;
  const rolling = reveal?.stage === "actor" || reveal?.stage === "opponent";
  const opponentReady = reveal?.stage === "opponent-ready";

  const start = () => {
    if (busy || rolling || locked.current) return;
    locked.current = true;
    if (opponentReady) setReveal({ ...reveal, stage: "opponent" });
    else if (!reveal) setReveal({ stage: "actor", roll: roll(luck) });
  };
  const land = () => {
    if (!reveal || !rolling) return;
    if (reveal.stage === "actor" && reveal.roll.kind === "opposed") {
      locked.current = false;
      setReveal({ stage: "opponent-ready", roll: reveal.roll });
    } else {
      onLanded(reveal.roll, document.activeElement === button.current);
    }
  };

  const actor = reveal?.roll.kind === "opposed" ? reveal.roll.result.actor : reveal?.roll.result;
  return (
    <section className="life-check" aria-label="Required check">
      <header className="life-check-heading">
        <h2>{pending.skillName} check</h2>
        {pending.intent && <p className="life-check-intent">{pending.intent}</p>}
        <p className="life-check-spec">
          {signed(preview?.base ?? pending.base)} ·{" "}
          {opposition
            ? `${opposition.npcName} ${signed(preview?.against ?? opposition.base)}`
            : `DV ${pending.dv}`}
        </p>
        {pending.woundPenalty !== 0 && (
          <p className="life-check-caution">Wounds {signed(pending.woundPenalty)} on this check.</p>
        )}
        {pending.reads && (
          <p>
            {pending.reads.label}. {pending.reads.blurb}{" "}
            {pending.reads.costsTrust && "They will be more guarded, win or lose."}
          </p>
        )}
        {opposition && (
          <p className="life-check-note">Roll yours first, then theirs. Ties go to the defender.</p>
        )}
      </header>
      <div className="life-check-controls">
        <div className="life-check-choice">
          <LuckStepper
            value={luck}
            remaining={luckRemaining}
            onChange={setDedicated}
            disabled={busy || !!reveal}
          />
          {preview && (
            <p className="life-check-odds">
              {preview.percent}% chance
              {extra && extra.percent > preview.percent && (
                <small> With 1 more Luck: {extra.percent}%</small>
              )}
            </p>
          )}
        </div>
        <div className="life-check-throw">
          <div className="life-check-reveal">
            {actor && (
              <Die
                side={actor}
                animate={reveal?.stage === "actor"}
                {...(reveal?.stage === "actor" ? { onLanded: land } : {})}
              />
            )}
            {actor && reveal?.stage !== "actor" && (
              <p className="life-check-spec">
                You rolled <strong>{actor.total}</strong>
              </p>
            )}
            {reveal?.stage === "opponent" && (
              <Die side={reveal.roll.result.opponent} animate onLanded={land} />
            )}
          </div>
          <button
            type="button"
            className="life-check-button"
            ref={button}
            aria-disabled={busy || rolling}
            onClick={start}
          >
            {rolling
              ? "Rolling…"
              : opponentReady
                ? `Roll ${opposition?.npcName}’s d10`
                : "Roll d10"}
          </button>
          <span role="status" className="sr-only">
            {rolling
              ? "Rolling."
              : opponentReady && actor
                ? `Your total is ${actor.total}. Roll the opposing die.`
                : ""}
          </span>
        </div>
      </div>
      <Details>
        <Terms
          name={opposition ? "Your modifiers" : undefined}
          entries={[
            { label: pending.stat.toUpperCase(), value: pending.statValue },
            { label: pending.skillName, value: pending.skillLevel },
            ...(preview?.modifiers ?? []),
          ]}
        />
        {opposition && (
          <Terms
            name={`${opposition.npcName}’s modifiers`}
            entries={[
              { label: opposition.stat.toUpperCase(), value: opposition.statValue },
              { label: opposition.skillName, value: opposition.skillLevel },
            ]}
          />
        )}
        <p className="life-check-note">
          {opposition ? "Beat the opposing total." : "Meet or beat the DV."} A natural 10 adds a
          second die. A natural 1 subtracts it.
        </p>
      </Details>
    </section>
  );
}

export function LifeCheckResult({
  roll,
  skillName,
  outcome,
  status,
  recovery,
  summaryRef,
}: {
  roll: CheckRoll;
  skillName: string;
  outcome: ReactNode;
  status: string | null;
  recovery: ReactNode;
  summaryRef: React.Ref<HTMLDivElement>;
}) {
  const actor = roll.kind === "opposed" ? roll.result.actor : roll.result;
  const rival = roll.kind === "opposed" ? roll.result.opponent : null;
  const opponentName = roll.kind === "opposed" ? roll.result.opponentSide.name : null;
  const target = rival ? rival.total : actor.dv;
  return (
    <section className="life-check life-check-result" aria-label={`${skillName} check result`}>
      <div className="life-check-impact" tabIndex={-1} ref={summaryRef}>
        <div className="life-check-totals">
          <Die side={actor} />
          <div>
            {rival && <span className="life-check-side">You</span>}
            <strong>{actor.total}</strong>
          </div>
          <span className="life-check-target">vs {rival ? opponentName : `DV ${target}`}</span>
          {rival && (
            <>
              <strong className="life-check-opponent-total">{rival.total}</strong>
              <Die side={rival} />
            </>
          )}
        </div>
        <span className="life-check-stamp" data-success={roll.result.success}>
          {lifeCheckVerdict(roll)}
        </span>
      </div>
      {!!status && <p className="life-check-status">{status}</p>}
      {outcome}
      {recovery}
      <Details>
        {rival && <h3>You</h3>}
        <Terms
          entries={[{ label: "d10", value: actor.rolls[0] ?? 0, raw: true }, ...actor.modifiers]}
        />
        {rival && (
          <>
            <h3>{opponentName}</h3>
            <Terms
              entries={[
                { label: "d10", value: rival.rolls[0] ?? 0, raw: true },
                ...rival.modifiers,
              ]}
            />
          </>
        )}
      </Details>
    </section>
  );
}
