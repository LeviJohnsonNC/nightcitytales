/**
 * Damage, rolled: the d6s tumble in as a ripple, the total counts up, and when
 * two or more of them land on 6 — the printed rule for a Critical Injury — a
 * line of light links the sixes and the injury burns in.
 *
 * `criticalInjury` is the engine's answer; the sixes are only how it is shown.
 * If the two ever disagreed the engine would win, so the line is drawn only
 * when the engine says the injury happened.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HoloDie } from "./HoloDie";
import { buzz, playCrit } from "./fx";
import "./dice.css";

export function DamageDice({
  rolls,
  total,
  criticalInjury,
  size = 30,
  delay = 0,
  children,
}: {
  rolls: number[];
  total: number;
  criticalInjury: boolean;
  size?: number;
  /** Wait before the dice go, so they follow whatever was rolled before them. */
  delay?: number;
  /** What the damage did, shown once the dice are down. */
  children?: React.ReactNode;
}) {
  const [settled, setSettled] = useState(0);
  const all = settled >= rolls.length;
  const sixes = rolls.map((face, i) => (face === 6 ? i : -1)).filter((i) => i >= 0);
  const injury = all && criticalInjury && sixes.length >= 2;
  const row = useRef<HTMLDivElement>(null);
  const dice = useRef<(HTMLSpanElement | null)[]>([]);
  const [line, setLine] = useState<{ x1: number; x2: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!injury || !row.current) return;
    const box = row.current.getBoundingClientRect();
    const centres = sixes
      .map((i) => dice.current[i]?.getBoundingClientRect())
      .filter((r): r is DOMRect => !!r)
      .map((r) => r.left + r.width / 2 - box.left);
    if (centres.length < 2) return;
    setLine({ x1: Math.min(...centres), x2: Math.max(...centres), y: size / 2 });
    playCrit();
    buzz([40, 30, 90]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injury]);

  return (
    <div className="space-y-1.5">
      <div ref={row} className="relative flex flex-wrap items-center gap-1.5">
        {rolls.map((face, i) => (
          <span
            key={i}
            ref={(el) => {
              dice.current[i] = el;
            }}
          >
            <HoloDie
              sides={6}
              value={face}
              size={size}
              autoRoll="mount"
              delay={delay}
              tone={injury && face === 6 ? "crit" : null}
              onSettled={() => setSettled((n) => n + 1)}
            />
          </span>
        ))}
        {line && (
          <svg
            className="damage-link pointer-events-none absolute left-0 top-0 overflow-visible"
            width="100%"
            height={size}
            aria-hidden
          >
            <line x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
          </svg>
        )}
        <span className={cn("num ml-1 font-mono text-sm", all ? "opacity-100" : "opacity-0")}>
          = <span className="text-lg font-bold">{all ? total : ""}</span> damage
        </span>
      </div>
      {injury && (
        <p className="damage-injury font-mono text-xs font-bold uppercase tracking-[0.3em]">
          Critical injury
        </p>
      )}
      {all && children}
    </div>
  );
}
