import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { playRollSound, playSettleSound } from "./diceSound";

/** What a click produces: the face to land on, and how to commit the result. */
export type DiceRollOutcome = { face: number; commit: () => void };

const DURATION = 880; // ms of tumble
const SPINS = 3; // full rotations before it settles

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A neon "gem" die that tumbles to a stop. The engine decides the result; this
 * only animates toward it. Click (or Enter/Space) to roll. `value` is the
 * settled face to show at rest; `roll()` returns the engine's outcome.
 */
export function DiceRoll({
  sides,
  value,
  roll,
  size = 44,
  disabled,
  label,
}: {
  sides: number;
  value: number | null;
  roll: () => DiceRollOutcome;
  size?: number;
  disabled?: boolean;
  label?: string;
}) {
  const gradientId = useId();
  const bounceRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const running = useRef(false);

  const [face, setFace] = useState<number | null>(null); // shown while rolling
  const [rolling, setRolling] = useState(false);
  const [settling, setSettling] = useState(false);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function settlePop() {
    setSettling(true);
    window.setTimeout(() => setSettling(false), 340);
  }

  function start() {
    if (running.current || disabled) return;
    const outcome = roll();
    const target = outcome.face || 1;

    if (prefersReducedMotion()) {
      setFace(target);
      playSettleSound();
      settlePop();
      outcome.commit();
      return;
    }

    running.current = true;
    setRolling(true);
    playRollSound();

    const startT = performance.now();
    let lastSwap = 0;
    let swapEvery = 45;

    const step = (now: number) => {
      const t = now - startT;
      const p = Math.min(t / DURATION, 1);
      const e = easeOutCubic(p);

      const angle = SPINS * 360 * e;
      const bounce = Math.sin(p * Math.PI * 3) * (1 - e) * -0.22 * size;
      const scale = 1 + Math.sin(p * Math.PI) * 0.07;

      if (spinRef.current) spinRef.current.style.transform = `rotate(${angle}deg)`;
      if (bounceRef.current)
        bounceRef.current.style.transform = `translateY(${bounce}px) scale(${scale})`;

      if (now - lastSwap > swapEvery) {
        setFace(1 + Math.floor(Math.random() * sides));
        lastSwap = now;
        swapEvery = 45 + p * 170; // slow the flicker as it settles
      }

      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        if (spinRef.current) spinRef.current.style.transform = "rotate(0deg)";
        if (bounceRef.current) bounceRef.current.style.transform = "translateY(0) scale(1)";
        setFace(target);
        setRolling(false);
        running.current = false;
        playSettleSound();
        settlePop();
        outcome.commit();
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }

  const shown = rolling ? face : (value ?? "–");
  const aria = label ?? (value != null ? `Reroll d${sides}` : `Roll d${sides}`);

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || rolling}
      aria-label={aria}
      title={aria}
      style={{ width: size, height: size }}
      className={cn(
        "relative shrink-0 select-none rounded-[3px] outline-none",
        "focus-visible:ring-2 focus-visible:ring-cool/70",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <div
        ref={bounceRef}
        className={cn("absolute inset-0 will-change-transform", settling && "dice-settle")}
        style={{ transition: rolling ? "none" : "transform 200ms ease-out" }}
      >
        <div
          ref={spinRef}
          className="absolute inset-0 will-change-transform"
          style={{
            filter: settling
              ? "drop-shadow(0 0 10px rgba(255,61,154,.9)) drop-shadow(0 0 4px rgba(52,213,230,.6))"
              : rolling
                ? "drop-shadow(0 0 7px rgba(52,213,230,.6))"
                : "drop-shadow(0 0 4px rgba(52,213,230,.35))",
            transition: "filter 180ms ease-out",
          }}
        >
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2b2656" />
                <stop offset="0.55" stopColor="#191536" />
                <stop offset="1" stopColor="#0d0a22" />
              </linearGradient>
            </defs>
            {/* Faceted gem body */}
            <polygon
              points="50,3 86,28 79,62 50,97 21,62 14,28"
              fill={`url(#${gradientId})`}
              stroke="#34d5e6"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Facet lines */}
            <g stroke="#34d5e6" strokeOpacity="0.35" strokeWidth="1.4" fill="none">
              <path d="M14,28 L50,44 L86,28" />
              <path d="M50,3 L50,44" />
              <path d="M50,44 L21,62 M50,44 L79,62 M50,44 L50,97" />
            </g>
          </svg>
        </div>
      </div>
      {/* Upright number overlay */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center font-display font-bold leading-none num",
          settling ? "text-neon-pink" : rolling ? "text-cool" : "text-text",
        )}
        style={{
          fontSize: size * 0.42,
          textShadow: settling
            ? "0 0 8px rgba(255,61,154,.9)"
            : "0 0 6px rgba(52,213,230,.5)",
          paddingBottom: size * 0.04,
        }}
      >
        {shown}
      </span>
    </button>
  );
}
