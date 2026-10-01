/**
 * Rain, as numbers: how hard it falls, which way it leans, where the lightning
 * is, and what the water on the glass does.
 *
 * Pure and seeded, so the shape of a storm can be tested without a canvas.
 * `rain.ts` draws it. There are two rains and they are different things: the
 * streaks falling outside, in layers that move at different speeds so the eye
 * reads depth, and the beads on the glass in front of you, which sit, gather
 * and run — and each of which, being a lens, shows the city upside down.
 */
import { glassAmount } from "./descentSoundPlan";
import { BLACK_END_MS, CITY_END_MS, DIVE_END_MS, SEARCH_END_MS, ease } from "./descentTimeline";

/** A seeded random, as the engine's is: a function of nothing, returning [0, 1). */
export type Rand = () => number;

// ── the storm ────────────────────────────────────────────────────────────

/** How far the rain leans from straight down, in degrees, before a gust. */
export const WIND_DEGREES = 11;

/** How hard it is raining, 0 to 1: a drizzle in the dark, a downpour by the glass. */
export function rainIntensity(ms: number): number {
  if (ms < BLACK_END_MS) return 0.16 + 0.2 * ease(ms / BLACK_END_MS);
  if (ms < CITY_END_MS)
    return 0.36 + 0.06 * ease((ms - BLACK_END_MS) / (CITY_END_MS - BLACK_END_MS));
  if (ms < SEARCH_END_MS)
    return 0.42 + 0.16 * ease((ms - CITY_END_MS) / (SEARCH_END_MS - CITY_END_MS));
  if (ms < DIVE_END_MS)
    return 0.58 + 0.34 * ease((ms - SEARCH_END_MS) / (DIVE_END_MS - SEARCH_END_MS));
  return 0.92;
}

/** The wind: a slow swell and a quicker one beating against it, 0 to 1. Never still. */
export function gust(ms: number): number {
  const t = ms / 1000;
  return 0.5 + 0.5 * Math.sin(t * 0.7 + 0.4) * Math.sin(t * 0.23 + 1.3);
}

/** The lean of the rain at a moment, in degrees from vertical. */
export function leanDegrees(ms: number): number {
  return WIND_DEGREES + 7 * (gust(ms) - 0.5);
}

/** A bolt: when it strikes, how long the flash takes to fade, how bright it is. */
const BOLTS = [
  { at: 4300, fade: 260, power: 0.22 }, // far off, over the city, before anything is wrong
  { at: 7600, fade: 150, power: 1 }, // the one overhead: thunder follows 150ms behind, in the score
  { at: 7710, fade: 320, power: 0.55 },
];

/** How lit the sky is by lightning at a moment, 0 to 1. */
export function lightningAt(ms: number): number {
  let lit = 0;
  for (const bolt of BOLTS) {
    const into = ms - bolt.at;
    if (into >= 0 && into < bolt.fade)
      lit = Math.max(lit, bolt.power * (1 - into / bolt.fade) ** 2);
  }
  return lit;
}

/** How much of the glass has water on it: nothing until the fall nears the window. */
export function glassWetness(ms: number): number {
  return glassAmount(ms);
}

// ── streaks falling outside ──────────────────────────────────────────────

export type Layer = {
  /** Streaks per million square pixels at full rain. */
  density: number;
  /** Pixels a second. */
  speed: number;
  /** Pixels, before the speed's own smear. */
  length: number;
  width: number;
  alpha: number;
};

/** Far, middle, near: thin and slow and many, to long and fast and few. */
export const LAYERS: Layer[] = [
  { density: 1100, speed: 880, length: 16, width: 0.7, alpha: 0.24 },
  { density: 560, speed: 1450, length: 30, width: 1.0, alpha: 0.34 },
  { density: 210, speed: 2400, length: 62, width: 1.5, alpha: 0.46 },
  // The few that fall right past your face: long, fast, bright.
  { density: 34, speed: 3300, length: 110, width: 2.2, alpha: 0.55 },
];

/** 0 cool white, 1 neon magenta, 2 neon cyan: the city's signs on the water. */
export type Tint = 0 | 1 | 2;
export const TINT_RGB: Record<Tint, [number, number, number]> = {
  0: [190, 214, 255],
  1: [255, 120, 200],
  2: [110, 232, 255],
};

export type Streak = { x: number; y: number; pace: number; tint: Tint };

/** How many streaks a layer has across an area, at full rain. */
export function streakCount(layer: Layer, width: number, height: number, weak: boolean): number {
  const full = (layer.density * (width * height)) / 1_000_000;
  return Math.max(6, Math.round(full * (weak ? 0.45 : 1)));
}

export function makeStreaks(count: number, width: number, height: number, rand: Rand): Streak[] {
  return Array.from({ length: count }, () => {
    const r = rand();
    return {
      // Wider than the screen, so a leaning rain still reaches the far corner.
      x: -height * 0.3 + rand() * (width + height * 0.6),
      y: rand() * height,
      pace: 0.85 + rand() * 0.3,
      tint: (r < 0.72 ? 0 : r < 0.86 ? 1 : 2) as Tint,
    };
  });
}

/** Move a streak along the lean; one that has left the bottom starts again at the top. */
export function stepStreak(
  s: Streak,
  layer: Layer,
  dt: number,
  degrees: number,
  width: number,
  height: number,
  rand: Rand,
  gustPush = 0,
): void {
  const rad = (degrees * Math.PI) / 180;
  const speed = layer.speed * s.pace * (1 + 0.22 * gustPush) * dt;
  s.x -= Math.sin(rad) * speed;
  s.y += Math.cos(rad) * speed;
  if (s.y > height + layer.length * 2) {
    s.y = -layer.length * 2;
    s.x = -height * 0.3 + rand() * (width + height * 0.6);
  }
  if (s.x < -height * 0.4) s.x += width + height * 0.7;
}

// ── beads on the glass ───────────────────────────────────────────────────

export type TrailPoint = { x: number; y: number; r: number; age: number };

export type Drop = {
  x: number;
  y: number;
  r: number;
  /** Whether this one ever runs. Most beads just sit. */
  runs: boolean;
  moving: boolean;
  /** Seconds until it starts or stops moving. */
  timer: number;
  /** Pixels a second while moving. */
  speed: number;
  wobble: number;
  trail: TrailPoint[];
};

/** How many beads sit on a window of this size. */
export function dropCount(width: number, height: number, weak: boolean): number {
  return Math.max(16, Math.round(((width * height) / 3000) * (weak ? 0.5 : 1)));
}

/** A new bead somewhere on the glass: mostly small, a few fat enough to run. */
export function makeDrop(width: number, height: number, rand: Rand, fromTop = false): Drop {
  const big = rand() < 0.15;
  const r = big ? 7 + rand() * 7 : 1.7 + 4.6 * rand() ** 1.25;
  const runs = big ? rand() < 0.9 : r > 3.2 && rand() < 0.3;
  return {
    x: rand() * width,
    y: fromTop ? -r * 2 - rand() * 40 : rand() * height,
    r,
    runs,
    moving: false,
    timer: rand() * 2.5,
    speed: 0,
    wobble: rand() * Math.PI * 2,
    trail: [],
  };
}

/** How long a wet line stays on the glass behind a running drop, in seconds. */
export const TRAIL_SECONDS = 9;
const TRAIL_STEP_PX = 5;
const MAX_TRAIL = 80;

/**
 * Let a bead live a little: a running one waits, then goes in a lurch, gathers
 * speed down the pane and shrinks as it leaves water behind it. Returns true
 * when it is gone off the bottom or worn away and should be replaced.
 */
export function stepDrop(d: Drop, dt: number, rand: Rand, height: number): boolean {
  for (const p of d.trail) p.age += dt;
  while (d.trail.length > 0 && d.trail[0]!.age > TRAIL_SECONDS) d.trail.shift();
  if (!d.runs) return false;

  d.timer -= dt;
  if (!d.moving) {
    if (d.timer <= 0) {
      d.moving = true;
      d.timer = 0.25 + rand() * 0.6;
      d.speed = (55 + rand() * 130) * (0.6 + d.r / 12);
    }
    return false;
  }
  if (d.timer <= 0) {
    d.moving = false;
    d.timer = 0.4 + rand() * 2.2;
    return d.r < 1.2;
  }
  const step = d.speed * dt;
  d.y += step;
  d.x += Math.sin(d.y * 0.045 + d.wobble) * 0.18;
  // Water left behind is water lost.
  d.r = Math.max(0.9, d.r * (1 - 0.0011 * step));
  const last = d.trail[d.trail.length - 1];
  if (!last || Math.hypot(d.x - last.x, d.y - last.y) >= TRAIL_STEP_PX) {
    d.trail.push({ x: d.x, y: d.y, r: d.r, age: 0 });
    if (d.trail.length > MAX_TRAIL) d.trail.shift();
  }
  return d.y > height + d.r * 2 || d.r < 1.05;
}

/** How many tiny specks of mist stipple a window of this size: the fine water between the beads. */
export function mistCount(width: number, height: number, weak: boolean): number {
  return Math.round(((width * height) / 800) * (weak ? 0.4 : 1));
}
