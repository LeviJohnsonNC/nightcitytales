/**
 * The holo-die: a real d10 or d6, projected as a hologram, that tumbles to the
 * number the engine already rolled.
 *
 * The engine decides first; the die only ever animates toward that face
 * (`restingOrientation`), so no frame of it is a decision. Each frame the solid
 * is rotated, projected with a little perspective, back faces are dropped (a
 * convex solid's front faces never overlap, so nothing needs sorting) and each
 * face is shaded — iridescent, cyan to magenta as it turns — straight into the
 * SVG, without React re-rendering sixty times a second.
 *
 * The roll: it flickers in from wireframe, hops and tumbles with a touch of
 * motion blur and colour split, and settles with a small wobble onto its face.
 * Hold to charge a harder throw; tap for an ordinary one; click while anything
 * is rolling to finish every die at once. `tone` adds what the result means —
 * a crit flares, a fumble glitches red, the loser of a clash shatters.
 *
 * Reduced motion gets the result immediately, with a glow and nothing moving.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { onSkip, skipAll, staggerDelay } from "./cascade";
import { buzz, playCrit, playFumble, playRattle, playSettle, playShatter, playTumble } from "./fx";
import {
  axisAngle,
  frontFace,
  meshFor,
  multiply,
  normalize,
  restingOrientation,
  rotate,
  type Mesh,
  type Quat,
  type Vec3,
} from "./geometry";
import "./dice.css";

/** What the result means, for how the die lands. */
/**
 * "top" and "mid" grade a number rather than a check: the best a STAT can be
 * (green, celebrated like a crit) and anything short of best or worst (the
 * crit's pink, landing quietly).
 */
export type DieTone = "crit" | "fumble" | "win" | "lose" | "top" | "mid" | null;

/** What a click produces: the face to land on, and how to commit the result. */
export type DiceRollOutcome = { face: number; commit: () => void; tone?: DieTone };

type Props = {
  sides: number;
  /** The settled face to show at rest; null for a die not rolled yet. */
  value: number | null;
  /** Rolls in the engine and returns what to land on. Without it the die only shows. */
  roll?: () => DiceRollOutcome;
  size?: number;
  disabled?: boolean;
  label?: string;
  /**
   * Tumble to `value` without a click: "mount" when it appears (a crit die, the
   * damage dice), "change" only when `value` changes after it appeared (the
   * Lifepath filling in).
   */
  autoRoll?: "mount" | "change";
  /** Extra wait before an automatic roll, on top of the batch stagger. */
  delay?: number;
  tone?: DieTone;
  /**
   * Replay the landing as this die appears. For a result die that takes the
   * place of the one that rolled, so a crit's flare is not cut off by the swap.
   */
  flashOnMount?: boolean;
  /** After the die has come to rest from any roll. */
  onSettled?: () => void;
  /** Extra attributes spread onto the underlying button (e.g. data-* hooks). */
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, string>;
};

const LIGHT = normalize([-0.45, 0.65, 1]);
const PERSPECTIVE = 0.16;
const BASE_MS = 720;
const WOBBLE_MS = 300;
/** Held this long, a press is a charged throw rather than a tap. */
const TAP_MS = 140;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4);

function randomAxis(): Vec3 {
  // Mostly end over end, which is how a thrown die moves.
  return normalize([Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.6, Math.random() * 0.5]);
}

/** How a face is lit, by tone: [hue shift base, saturation, lightness boost]. */
const PALETTE: Record<
  Exclude<DieTone, null> | "base",
  { hue: number; spread: number; sat: number; lift: number; edge: string }
> = {
  base: { hue: 255, spread: 130, sat: 88, lift: 0, edge: "#5cf2ff" },
  crit: { hue: 300, spread: 60, sat: 95, lift: 14, edge: "#ffd6f1" },
  fumble: { hue: 352, spread: 18, sat: 90, lift: 2, edge: "#ff4d6a" },
  win: { hue: 180, spread: 60, sat: 95, lift: 8, edge: "#9ffcff" },
  lose: { hue: 250, spread: 30, sat: 30, lift: -4, edge: "#7b72a8" },
  top: { hue: 135, spread: 40, sat: 90, lift: 10, edge: "#c8ffd8" },
  mid: { hue: 300, spread: 60, sat: 95, lift: 14, edge: "#ffd6f1" },
};

export function HoloDie({
  sides,
  value,
  roll,
  size = 44,
  disabled,
  label,
  autoRoll,
  delay = 0,
  tone = null,
  flashOnMount = false,
  onSettled,
  buttonProps,
}: Props) {
  const mesh = meshFor(sides);
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const facesRef = useRef<(SVGPolygonElement | null)[]>([]);
  const numbersRef = useRef<(SVGTextElement | null)[]>([]);
  const frame = useRef<number | null>(null);
  const current = useRef<Quat>(idleOrientation(mesh, value));
  const settledValue = useRef<number | null>(value);
  const charge = useRef<{ at: number; lastRattle: number } | null>(null);
  const skipRef = useRef<(() => void) | null>(null);
  const [rolling, setRolling] = useState(false);
  const [landed, setLanded] = useState<DieTone | "plain" | null>(null);
  const [announce, setAnnounce] = useState("");
  const [shownTone, setShownTone] = useState<DieTone>(tone);

  // ── drawing ──────────────────────────────────────────────────────────

  const draw = useCallback(
    (
      q: Quat,
      opts: { fill?: number; numbers?: number; toneNow?: DieTone; highlight?: number | null } = {},
    ) => {
      const svg = svgRef.current;
      if (!svg) return;
      const fillAlpha = opts.fill ?? 1;
      const numberAlpha = opts.numbers ?? 1;
      const pal = PALETTE[opts.toneNow ?? "base"];
      const projected = mesh.vertices.map((v) => {
        const r = rotate(q, v);
        const p = 1 / (1 - r[2] * PERSPECTIVE);
        return [r[0] * p, -r[1] * p] as const;
      });
      const front = frontFace(mesh, q);
      mesh.faces.forEach((f, i) => {
        const poly = facesRef.current[i];
        const text = numbersRef.current[i];
        if (!poly || !text) return;
        const n = rotate(q, f.normal);
        if (n[2] <= 0.001) {
          poly.setAttribute("visibility", "hidden");
          text.setAttribute("visibility", "hidden");
          return;
        }
        poly.setAttribute("visibility", "visible");
        poly.setAttribute(
          "points",
          f.corners
            .map((c) => `${projected[c]![0].toFixed(3)},${projected[c]![1].toFixed(3)}`)
            .join(" "),
        );
        const lambert = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        const hue = pal.hue + pal.spread * (0.5 + 0.5 * n[0]) - pal.spread / 2;
        const light = 8 + lambert * 36 + pal.lift;
        poly.setAttribute(
          "fill",
          `hsla(${hue.toFixed(0)}, ${pal.sat}%, ${light.toFixed(1)}%, ${(0.8 * fillAlpha).toFixed(2)})`,
        );
        poly.setAttribute("stroke", pal.edge);
        // The number sits at the face's centre, faded as the face turns away.
        const c = rotate(q, f.centroid);
        const p = 1 / (1 - c[2] * PERSPECTIVE);
        const isFront = f === front;
        const facing = n[2];
        // At rest the rolled number is the one that reads; its neighbours step back.
        const resting = opts.highlight != null;
        const emphasis = resting ? (isFront ? 1.3 : 0.85) : 1;
        const scale = (mesh.sides === 6 ? 0.9 : 0.62) * Math.sqrt(facing) * emphasis;
        text.setAttribute("visibility", facing > 0.3 ? "visible" : "hidden");
        text.setAttribute("x", (c[0] * p).toFixed(3));
        text.setAttribute("y", (-c[1] * p + scale * 0.36).toFixed(3));
        text.setAttribute("font-size", scale.toFixed(3));
        text.setAttribute(
          "opacity",
          (Math.pow(facing, 2) * numberAlpha * (resting && !isFront ? 0.4 : 1)).toFixed(2),
        );
        text.setAttribute("class", cn("holo-num", isFront && opts.highlight != null && "is-front"));
      });
    },
    [mesh],
  );

  // Show the right face whenever nothing is animating.
  useEffect(() => {
    if (rolling) return;
    // An automatic roll owns a value it has not shown yet.
    if (autoRoll && value !== null && value !== settledValue.current) return;
    if (autoRoll === "mount" && value !== null && seen.current === undefined) return;
    const q = value === null ? idleOrientation(mesh, null) : restingOrientation(mesh, value);
    current.current = q;
    draw(q, { numbers: value === null ? 0.25 : 1, toneNow: shownTone, highlight: value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mesh, draw, shownTone, rolling]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      skipRef.current?.();
    },
    [],
  );

  // ── rolling ──────────────────────────────────────────────────────────

  /** Tumble to `target`; `energy` 1 is a tap, up to ~2.2 a full charge. */
  const animateTo = useCallback(
    (target: number, energy: number, finalTone: DieTone, done: () => void) => {
      const qEnd = restingOrientation(mesh, target);
      const settle = () => {
        current.current = qEnd;
        settledValue.current = target;
        setShownTone(finalTone);
        draw(qEnd, { toneNow: finalTone, highlight: target });
        setRolling(false);
        setLanded(finalTone ?? "plain");
        window.setTimeout(() => setLanded(null), 900);
        if (finalTone === "crit" || finalTone === "top") {
          playCrit();
          buzz([20, 40, 70]);
        } else if (finalTone === "fumble") {
          playFumble();
          buzz([60, 40, 60]);
        } else {
          playSettle(target, mesh.sides);
          buzz(12);
        }
        done();
        onSettled?.();
      };

      if (prefersReducedMotion()) {
        settle();
        return;
      }

      setRolling(true);
      setLanded(null);
      const duration = BASE_MS + (energy - 1) * 260;
      const axis = randomAxis();
      const turns = (2.3 + energy * 1.1) * Math.PI * 2;
      const drift = (Math.random() < 0.5 ? -1 : 1) * 0.22 * size * Math.min(1.6, energy);
      const hop = 0.34 * size * Math.min(1.5, energy);
      const body = bodyRef.current;
      const svg = svgRef.current;
      playTumble(duration / 1000, energy);
      const start = performance.now();
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = null;
        unskip();
        if (body) body.style.transform = "";
        if (svg) svg.style.filter = "";
        settle();
      };
      const unskip = onSkip(finish);
      skipRef.current = unskip;

      const step = (now: number) => {
        const t = now - start;
        if (t >= duration + WOBBLE_MS) return finish();
        let q: Quat;
        if (t < duration) {
          const p = t / duration;
          const e = easeOutQuart(p);
          q = multiply(axisAngle(axis, turns * (1 - e)), qEnd);
          const bounce = Math.abs(Math.sin(Math.PI * 2.5 * p)) * Math.pow(1 - p, 1.6) * hop;
          if (body) {
            body.style.transform = `translate(${(drift * (1 - e)).toFixed(2)}px, ${(-bounce).toFixed(2)}px) scale(${(1 + Math.sin(Math.PI * p) * 0.07).toFixed(3)})`;
          }
          if (svg) {
            const blur = Math.pow(1 - p, 2) * 1.1 * (size / 52);
            const split = (1 - p) * 1.6 * (size / 52);
            svg.style.filter = `blur(${blur.toFixed(2)}px) drop-shadow(${split.toFixed(2)}px 0 rgba(255,45,150,.7)) drop-shadow(${(-split).toFixed(2)}px 0 rgba(40,225,255,.7))`;
          }
          // It flickers in from wireframe over the first tenth of a second.
          const fill = t < 110 ? (Math.random() < 0.5 ? 0 : t / 110) : 1;
          draw(q, { fill, numbers: t < 110 ? 0 : 1 });
        } else {
          const w = (t - duration) / WOBBLE_MS;
          q = multiply(axisAngle([1, 0, 0], 0.11 * Math.sin(w * 16) * Math.exp(-w * 5)), qEnd);
          if (body) body.style.transform = "";
          if (svg) svg.style.filter = "";
          draw(q, { toneNow: finalTone, highlight: target });
        }
        current.current = q;
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [mesh, size, draw, onSettled],
  );

  // An automatic roll: when this die appears with a value, or its value changes.
  // `seen` is the value this effect last acted on. If React cancels the effect
  // before its roll starts (Strict Mode mounts twice in development), the
  // cleanup puts `seen` back, so the next run schedules the roll again.
  const seen = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const previous = seen.current;
    seen.current = value;
    if (!autoRoll || value === null) return;
    const initial = previous === undefined;
    const changed = !initial && previous !== value && value !== settledValue.current;
    if (!(initial ? autoRoll === "mount" : changed)) {
      if (initial) settledValue.current = value;
      return;
    }
    let started = false;
    const wait = staggerDelay(performance.now()) + delay;
    // Hidden until its turn, so a waiting die does not show its answer early.
    draw(idleOrientation(mesh, null), { fill: 0.15, numbers: 0 });
    const t = window.setTimeout(() => {
      started = true;
      animateTo(value, 1, tone, () => setAnnounce(`Rolled ${value}`));
    }, wait);
    return () => {
      window.clearTimeout(t);
      if (!started) seen.current = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, autoRoll]);

  useEffect(() => {
    if (!flashOnMount || value === null) return;
    setLanded(tone ?? "plain");
    const t = window.setTimeout(() => setLanded(null), 900);
    return () => window.clearTimeout(t);
    // Only as it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A tone arriving after the die has settled (the clash is decided later).
  useEffect(() => {
    if (rolling || tone === shownTone) return;
    setShownTone(tone);
    if (tone === "lose") {
      playShatter();
      buzz(30);
    }
    setLanded(tone ?? null);
    const t = window.setTimeout(() => setLanded(null), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone]);

  function throwIt(energy: number) {
    if (!roll || disabled || rolling) return;
    const outcome = roll();
    const target = outcome.face || 1;
    animateTo(target, energy, outcome.tone ?? null, () => {
      outcome.commit();
      setAnnounce(`Rolled ${target}`);
    });
  }

  // ── charging a throw ────────────────────────────────────────────────

  function charging(now: number) {
    const c = charge.current;
    if (!c) return;
    const held = Math.min(1, (now - c.at) / 700);
    const jitter = held * 0.16;
    const base = current.current;
    const q = multiply(axisAngle(randomAxis(), (Math.random() - 0.5) * jitter), base);
    draw(q, { numbers: value === null ? 0.25 : 1 });
    if (bodyRef.current) {
      bodyRef.current.style.transform = `translate(${((Math.random() - 0.5) * held * 3).toFixed(2)}px, ${((Math.random() - 0.5) * held * 3).toFixed(2)}px) scale(${(1 + held * 0.08).toFixed(3)})`;
      bodyRef.current.style.setProperty("--charge", held.toFixed(2));
    }
    if (now - c.lastRattle > 170 - held * 120) {
      playRattle(held);
      c.lastRattle = now;
    }
    frame.current = requestAnimationFrame(charging);
  }

  function endCharge(): number {
    const c = charge.current;
    charge.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (bodyRef.current) {
      bodyRef.current.style.transform = "";
      bodyRef.current.style.setProperty("--charge", "0");
    }
    return c ? performance.now() - c.at : 0;
  }

  const interactive = Boolean(roll) && !disabled;
  const aria = label ?? (value != null ? `Reroll d${sides}` : `Roll d${sides}`);

  return (
    <button
      {...buttonProps}
      type="button"
      aria-label={rolling ? "Skip the roll" : aria}
      title={rolling ? "Click to skip" : aria}
      aria-disabled={!interactive && !rolling}
      disabled={!interactive && !rolling}
      style={{ width: size, height: size }}
      className={cn(
        "holo-die relative shrink-0 select-none outline-none touch-none",
        "focus-visible:ring-2 focus-visible:ring-cool/70",
        interactive || rolling ? "cursor-pointer" : "cursor-default",
        value === null && !rolling && interactive && "is-ready",
        rolling && "is-rolling",
        landed && `is-landed is-${landed}`,
        shownTone && `tone-${shownTone}`,
      )}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (rolling) {
          skipAll();
          return;
        }
        if (!interactive) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        charge.current = { at: performance.now(), lastRattle: 0 };
        frame.current = requestAnimationFrame(charging);
      }}
      onPointerUp={() => {
        if (!charge.current) return;
        const held = endCharge();
        throwIt(held < TAP_MS ? 1 : 1 + Math.min(1.2, held / 600));
      }}
      onPointerCancel={() => endCharge()}
      onClick={(e) => {
        // Keyboard and programmatic clicks (detail 0); pointers are handled above.
        if (e.detail !== 0) return;
        if (rolling) skipAll();
        else throwIt(1);
      }}
    >
      <div ref={bodyRef} className="holo-body absolute inset-0 will-change-transform">
        <svg
          ref={svgRef}
          viewBox="-1.3 -1.3 2.6 2.6"
          className="holo-svg h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <radialGradient id={`glow-${uid}`}>
              <stop offset="0" stopColor="var(--holo-glow, #5cf2ff)" stopOpacity="0.35" />
              <stop offset="1" stopColor="var(--holo-glow, #5cf2ff)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle r="1.3" fill={`url(#glow-${uid})`} className="holo-halo" />
          <g strokeWidth={mesh.sides === 6 ? 0.05 : 0.045} strokeLinejoin="round">
            {mesh.faces.map((_, i) => (
              <polygon
                key={i}
                ref={(el) => {
                  facesRef.current[i] = el;
                }}
              />
            ))}
          </g>
          <g textAnchor="middle" className="holo-numbers">
            {mesh.faces.map((f, i) => (
              <text
                key={i}
                ref={(el) => {
                  numbersRef.current[i] = el;
                }}
              >
                {f.value}
              </text>
            ))}
          </g>
          <g className="holo-flare" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <g key={i} transform={`rotate(${i * 45})`}>
                <line x1="0" y1="-0.35" x2="0" y2="-1.25" />
              </g>
            ))}
          </g>
        </svg>
        <span aria-hidden className="holo-scan" />
        <span aria-hidden className="holo-shards">
          {Array.from({ length: 10 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  // Rounded: the server and the browser disagree in the last digit.
                  "--dx": (Math.cos((i / 10) * Math.PI * 2) * (0.6 + (i % 3) * 0.2)).toFixed(3),
                  "--dy": (Math.sin((i / 10) * Math.PI * 2) * (0.6 + (i % 2) * 0.3)).toFixed(3),
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </button>
  );
}

/** A three-quarter view with no particular face forward: a die waiting to be rolled. */
function idleOrientation(mesh: Mesh, value: number | null): Quat {
  const base = restingOrientation(mesh, value ?? (mesh.sides === 6 ? 1 : 10));
  if (value !== null) return base;
  return multiply(axisAngle([0, 1, 0], 0.5), multiply(axisAngle([1, 0, 0], -0.25), base));
}

/** The same component under the name every existing roll site already uses. */
export const DiceRoll = HoloDie;
