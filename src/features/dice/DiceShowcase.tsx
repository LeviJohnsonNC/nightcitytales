/**
 * Every die and every moment, on one page, for the style guide.
 *
 * Each demo rolls through the real engine (`statSkillCheck`, `rollDice`) —
 * the showcase only chooses what to ask for, so a crit here is a crit the
 * engine built, forced by a rigged die rather than faked by the page.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { rollDice, statSkillCheck, type CheckResult } from "@/engine";
import { cn } from "@/lib/utils";
import { DamageDice } from "./DamageDice";
import { DeathMonitor, type MonitorState } from "./DeathMonitor";
import { HoloDie, type DieTone } from "./HoloDie";
import { RollMath } from "./RollMath";

/** A die that lands on these faces in order, then falls back to random. */
function rigged(faces: number[]): () => number {
  const queue = [...faces];
  return () => {
    const next = queue.shift();
    return next === undefined ? Math.random() : (next - 1) / 10 + 0.001;
  };
}

function Demo({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 border border-hairline bg-surface p-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">{title}</p>
        <p className="text-xs text-text-muted">{note}</p>
      </div>
      {children}
    </div>
  );
}

const CHECK = [
  { label: "REF", value: 6 },
  { label: "Handgun", value: 5 },
];

function toneOf(r: CheckResult): DieTone {
  return r.critical === "success" ? "crit" : r.critical === "failure" ? "fumble" : null;
}

/** A DV check, rolled for real, with the maths landing underneath. */
function CheckDemo({ force }: { force?: number }) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [key, setKey] = useState(0);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <HoloDie
          key={key}
          sides={10}
          value={result?.rolls[0] ?? null}
          size={56}
          label="Roll the check"
          roll={() => {
            const r = statSkillCheck(CHECK, force ? rigged([force]) : Math.random, { dv: 15 });
            return { face: r.base, tone: toneOf(r), commit: () => setResult(r) };
          }}
        />
        {result?.criticalDie != null && (
          <HoloDie sides={10} value={result.criticalDie} size={40} autoRoll="mount" delay={150} />
        )}
        {result && (
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim hover:text-text"
            onClick={() => {
              setResult(null);
              setKey((k) => k + 1);
            }}
          >
            Again
          </button>
        )}
      </div>
      {result && (
        <RollMath
          key={result.timestamp}
          rolls={result.rolls}
          modifiers={result.modifiers}
          total={result.total}
          target={{ kind: "dv", dv: 15 }}
          success={result.success}
          margin={result.total - 15}
          delay={result.criticalDie != null ? 900 : 100}
        />
      )}
    </div>
  );
}

function ClashDemo() {
  const [you, setYou] = useState<CheckResult | null>(null);
  const [them, setThem] = useState<CheckResult | null>(null);
  const [clash, setClash] = useState(false);
  const [decided, setDecided] = useState(false);
  const won = you && them ? you.total > them.total : null;

  function reset() {
    setYou(null);
    setThem(null);
    setClash(false);
    setDecided(false);
  }

  return (
    <div className="space-y-3">
      <div className={cn("flex items-center gap-4", clash && "dice-clash")}>
        <span className="clash-left inline-block">
          <HoloDie
            key={you ? "y" : "y0"}
            sides={10}
            value={you?.base ?? null}
            size={52}
            label="Roll yours"
            disabled={you !== null}
            tone={decided ? (won ? "win" : "lose") : null}
            roll={() => {
              const r = statSkillCheck(CHECK, Math.random);
              return { face: r.base, commit: () => setYou(r) };
            }}
          />
        </span>
        <span className="clash-vs inline-block font-mono text-xs uppercase tracking-[0.2em] text-text-dim">
          vs
        </span>
        <span className="clash-right inline-block">
          <HoloDie
            key={them ? "t" : "t0"}
            sides={10}
            value={them?.base ?? null}
            size={52}
            label="Roll theirs"
            disabled={you === null || them !== null}
            tone={decided ? (won ? "lose" : "win") : null}
            roll={() => {
              const r = statSkillCheck(
                [
                  { label: "DEX", value: 6 },
                  { label: "Evasion", value: 5 },
                ],
                Math.random,
              );
              return {
                face: r.base,
                commit: () => {
                  setThem(r);
                  setClash(true);
                  window.setTimeout(() => setDecided(true), 300);
                },
              };
            }}
          />
        </span>
        {decided && (
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim hover:text-text"
            onClick={reset}
          >
            Again
          </button>
        )}
      </div>
      {you && them && decided && (
        <p
          className={cn("font-display text-lg font-bold", won ? "text-accent" : "text-destructive")}
        >
          {you.total} vs {them.total} · {won ? "You take it" : "They hold"}
        </p>
      )}
    </div>
  );
}

function DamageDemo() {
  const [rolls, setRolls] = useState<number[] | null>(null);
  const [n, setN] = useState(0);
  function go(forceSixes: boolean) {
    const r = rollDice(4, 6);
    if (forceSixes) {
      r[0] = 6;
      r[2] = 6;
    }
    setRolls(r);
    setN((x) => x + 1);
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => go(false)}>
          Roll 4d6
        </Button>
        <Button size="sm" variant="outline" onClick={() => go(true)}>
          Roll with two sixes
        </Button>
      </div>
      {rolls && (
        <DamageDice
          key={n}
          rolls={rolls}
          total={rolls.reduce((a, b) => a + b, 0)}
          criticalInjury={rolls.filter((f) => f === 6).length >= 2}
        />
      )}
    </div>
  );
}

function DeathDemo() {
  const [state, setState] = useState<MonitorState>("waiting");
  const [face, setFace] = useState<number | null>(null);
  const [n, setN] = useState(0);
  return (
    <div className="space-y-3">
      <DeathMonitor state={state}>
        <HoloDie
          key={n}
          sides={10}
          value={face}
          size={52}
          label="Roll the death save"
          disabled={state !== "waiting"}
          roll={() => {
            const f = 1 + Math.floor(Math.random() * 10);
            return {
              face: f,
              commit: () => {
                setFace(f);
                setState(f + 2 < 7 ? "survived" : "dead");
              },
            };
          }}
        />
        <p className="text-sm text-text-muted">
          {state === "waiting"
            ? "BODY 7, penalty +2. Roll under."
            : state === "survived"
              ? "Still breathing."
              : "Flatline."}
        </p>
      </DeathMonitor>
      {state !== "waiting" && (
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim hover:text-text"
          onClick={() => {
            setState("waiting");
            setFace(null);
            setN((x) => x + 1);
          }}
        >
          Again
        </button>
      )}
    </div>
  );
}

function CascadeDemo() {
  const row = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<(number | null)[]>(Array(10).fill(null));
  const [n, setN] = useState(0);
  function rollAll() {
    const buttons = Array.from(row.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    buttons.forEach((b, i) => window.setTimeout(() => b.click(), i * 110));
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={rollAll}>
          Roll all ten
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setValues(Array(10).fill(null));
            setN((x) => x + 1);
          }}
        >
          Reset
        </Button>
      </div>
      <div ref={row} className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <HoloDie
            key={`${n}-${i}`}
            sides={10}
            value={v}
            size={40}
            roll={() => {
              const f = 1 + Math.floor(Math.random() * 10);
              return {
                face: f,
                commit: () => setValues((vs) => vs.map((x, j) => (j === i ? f : x))),
              };
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function DiceShowcase() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Demo
        title="The die"
        note="Tap to roll. Hold to charge a harder throw. Click a rolling die to skip."
      >
        <div className="flex flex-wrap items-end gap-5">
          <HoloDie
            sides={10}
            value={null}
            size={64}
            roll={() => ({ face: 1 + Math.floor(Math.random() * 10), commit: () => {} })}
          />
          <HoloDie
            sides={6}
            value={null}
            size={48}
            roll={() => ({ face: 1 + Math.floor(Math.random() * 6), commit: () => {} })}
          />
          <HoloDie sides={10} value={7} size={44} />
          <HoloDie sides={6} value={4} size={32} />
        </div>
      </Demo>
      <Demo
        title="A check"
        note="REF 6 + Handgun 5 + 1d10 vs DV 15. The maths lands, then the verdict."
      >
        <CheckDemo />
      </Demo>
      <Demo
        title="Critical success"
        note="A natural 10 overloads, and the bonus die bursts out of it."
      >
        <CheckDemo force={10} />
      </Demo>
      <Demo title="Critical failure" note="A natural 1 glitches, and the penalty die drops in.">
        <CheckDemo force={1} />
      </Demo>
      <Demo title="Opposed" note="Roll yours, then theirs. They meet; the loser shatters.">
        <ClashDemo />
      </Demo>
      <Demo title="Damage" note="Two or more sixes: a Critical Injury.">
        <DamageDemo />
      </Demo>
      <Demo title="Death save" note="The worst roll in the game.">
        <DeathDemo />
      </Demo>
      <Demo
        title="Cascade"
        note="Many dice at once go off as a ripple. Click any rolling die to finish them all."
      >
        <CascadeDemo />
      </Demo>
    </div>
  );
}
