/**
 * The death save's monitor: a heartbeat trace running behind the die.
 *
 * Waiting, it beats steadily. The save made, it jumps and beats on, and you
 * hear it. The save failed, the trace runs flat and the tone holds. The
 * verdict is the engine's (`survived`); this only draws what it means.
 */
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { buzz, playFlatline, playHeartbeat } from "./fx";
import "./dice.css";

/** One beat of a trace, 100 wide: flat, a blip, the spike, the recovery. */
const BEAT =
  "L 30 20 L 34 16 L 38 20 L 44 20 L 47 26 L 51 2 L 55 34 L 59 20 L 68 20 L 73 14 L 80 20 L 100 20";

function trace(beats: number): string {
  let d = "M 0 20";
  for (let i = 0; i < beats; i += 1) {
    d += " " + BEAT.replace(/L (\d+) /g, (_, x) => `L ${Number(x) + i * 100} `);
  }
  return d;
}

export type MonitorState = "waiting" | "survived" | "dead";

export function DeathMonitor({
  state,
  children,
}: {
  state: MonitorState;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    if (state === "survived") {
      playHeartbeat();
      const t = window.setTimeout(playHeartbeat, 520);
      buzz([30, 120, 30]);
      return () => window.clearTimeout(t);
    }
    if (state === "dead") {
      playFlatline();
      buzz(700);
    }
    return undefined;
  }, [state]);

  return (
    <div className={cn("death-monitor", `is-${state}`)}>
      <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="death-trace" aria-hidden>
        <g className="death-grid">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={i * 50} x2={i * 50} y1="0" y2="40" />
          ))}
        </g>
        {state === "dead" ? (
          <path className="death-line" d="M 0 20 L 400 20" />
        ) : (
          <g className="death-scroll">
            <path className="death-line" d={trace(8)} />
          </g>
        )}
      </svg>
      <div className="death-monitor-content">{children}</div>
    </div>
  );
}
