/**
 * The arithmetic of a roll, landing: the die, each thing added to it, the total
 * counting up, and the verdict stamped down.
 *
 * This game's promise is that the engine owns the numbers and shows its work.
 * A formula string in grey monospace shows the work to nobody; this does. It
 * takes the engine's own result — die, modifiers, total — and only animates
 * it: nothing here adds, compares or decides. A near miss gets its own sting,
 * because "failed by one" is the most memorable result a table has.
 *
 * Reduced motion shows the finished line at once.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buzz, playVerdict } from "./fx";
import "./dice.css";

export type RollMathTarget =
  { kind: "dv"; dv: number } | { kind: "vs"; total: number; name: string };

type Props = {
  /** The raw faces; the first is the die the check is built on. */
  rolls: number[];
  modifiers: { label: string; value: number }[];
  total: number;
  target: RollMathTarget | null;
  /** The engine's verdict. Null when there is nothing to beat. */
  success: boolean | null;
  /** The engine's margin (total − target); shown, never computed here. */
  margin?: number | null;
  /** The totals matched and the other side took it. */
  tie?: boolean;
  /** Words for the verdict, when "Success"/"Failed" is not how the table says it. */
  words?: { success: string; failure: string };
  /** Wait before starting, so the die has landed first. */
  delay?: number;
  className?: string;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** "Critical Success 1d10" reads as CRIT on the chip; everything else keeps its name. */
function chipLabel(label: string): { text: string; kind: "crit" | "fumble" | "plain" } {
  if (/^critical success/i.test(label)) return { text: "Crit", kind: "crit" };
  if (/^critical failure/i.test(label)) return { text: "Fumble", kind: "fumble" };
  return { text: label, kind: "plain" };
}

export function RollMath({
  rolls,
  modifiers,
  total,
  target,
  success,
  margin = null,
  tie = false,
  words = { success: "Success", failure: "Failed" },
  delay = 0,
  className,
}: Props) {
  const die = rolls[0] ?? 0;
  const reduced = prefersReducedMotion();
  const [shown, setShown] = useState(reduced ? total : die);
  const [stamped, setStamped] = useState(reduced);
  const frame = useRef<number | null>(null);
  const near = margin !== null && Math.abs(margin) <= 1 && !tie;

  useEffect(() => {
    if (reduced) return;
    const chipsDone = delay + 140 + modifiers.length * 90;
    const countMs = 520;
    const t = window.setTimeout(() => {
      const start = performance.now();
      const from = die;
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / countMs);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(Math.round(from + (total - from) * eased));
        if (p < 1) frame.current = requestAnimationFrame(step);
        else {
          setStamped(true);
          if (success !== null) {
            playVerdict(success, near);
            buzz(success ? 18 : [30, 30, 30]);
          }
        }
      };
      frame.current = requestAnimationFrame(step);
    }, chipsDone);
    return () => {
      window.clearTimeout(t);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
    // Plays once, for the result it was mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verdict =
    success === null
      ? null
      : tie
        ? "Tied · they hold"
        : `${success ? words.success : words.failure}${margin !== null ? ` by ${Math.abs(margin)}` : ""}`;
  const done = `${die}${modifiers.map((m) => ` ${m.value < 0 ? "minus" : "plus"} ${Math.abs(m.value)}`).join("")}, total ${total}${verdict ? `, ${verdict}` : ""}`;

  return (
    <div className={cn("roll-math", className)}>
      <p className="sr-only" aria-live="polite">
        {stamped ? done : ""}
      </p>
      <div className="flex flex-wrap items-center gap-1.5" aria-hidden>
        <Chip label="d10" value={die} kind="die" index={0} delay={delay} />
        {modifiers.map((m, i) => {
          const { text, kind } = chipLabel(m.label);
          return (
            <Chip
              key={`${m.label}-${i}`}
              label={text}
              value={m.value}
              signed
              kind={kind}
              index={i + 1}
              delay={delay}
            />
          );
        })}
        <span className="roll-math-eq">=</span>
        <span
          className={cn(
            "roll-math-total num",
            stamped && success === true && "is-good",
            stamped && success === false && "is-bad",
          )}
        >
          {shown}
        </span>
        {target && (
          <span className="roll-math-target num">
            vs {target.kind === "dv" ? `DV ${target.dv}` : `${target.name} ${target.total}`}
          </span>
        )}
      </div>
      {verdict && (
        <p
          className={cn(
            "roll-math-stamp",
            stamped && "is-stamped",
            success ? "is-good" : "is-bad",
            near && "is-near",
          )}
        >
          {verdict}
          {near && stamped && (
            <span className="roll-math-near">{success ? "by a hair" : "so close"}</span>
          )}
        </p>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  signed,
  kind,
  index,
  delay,
}: {
  label: string;
  value: number;
  signed?: boolean;
  kind: "die" | "crit" | "fumble" | "plain";
  index: number;
  delay: number;
}) {
  return (
    <span
      className={cn("roll-math-chip num", `is-${kind}`)}
      style={{ animationDelay: `${delay + index * 90}ms` }}
    >
      <span className="roll-math-chip-label">{label}</span>
      <span className="roll-math-chip-value">
        {signed ? (value < 0 ? `−${Math.abs(value)}` : `+${value}`) : value}
      </span>
    </span>
  );
}
