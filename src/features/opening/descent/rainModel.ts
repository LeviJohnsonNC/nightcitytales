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
  /** Pixels a second, at the descent's pace. */
  speed: number;
  /** Pixels: the size of the drop itself, before the shutter smears it. */
  length: number;
  width: number;
  alpha: number;
  /** Pixels of defocus: the near rain is too close to the lens to be sharp. */
  blur: number;
};

/** Far, middle, near: thin and slow and many, to long and fast and few. */
export const LAYERS: Layer[] = [
  { density: 1100, speed: 880, length: 16, width: 0.7, alpha: 0.26, blur: 0 },
  { density: 560, speed: 1450, length: 30, width: 1.0, alpha: 0.36, blur: 0 },
  { density: 210, speed: 2400, length: 62, width: 1.4, alpha: 0.42, blur: 0.9 },
  // The few that fall right past your face: soft, wide, out of focus.
  { density: 34, speed: 3300, length: 110, width: 2.4, alpha: 0.3, blur: 3.2 },
];

/**
 * The exposure the rain is seen through, in seconds. A streak is the distance a
 * drop covers while the shutter is open, so a slower rain is a shorter streak —
 * slowing the fall without shortening it leaves sticks hanging in the air.
 */
export const SHUTTER_S = 1 / 40;

/** How long a layer's streak is, in pixels, at a multiple of the descent's pace. */
export function streakLength(layer: Layer, speed = 1): number {
  return layer.length * 0.35 + layer.speed * speed * SHUTTER_S;
}

/**
 * Curtains of heavier rain sweeping across with the wind, as a multiple of the
 * rain's density at a point `u` pixels across the wind. Two swells beating, so
 * it never repeats in a way the eye catches. Between about 0.4 and 1.24.
 */
export function sheetAt(u: number, ms: number): number {
  const t = ms / 1000;
  return 0.82 + 0.28 * Math.sin(u * 0.0042 + t * 0.9) + 0.14 * Math.sin(u * 0.0109 + t * 1.7 + 1.9);
}

/** How long the rain takes to go when the scene is left, in ms. Quicker than the scene's own exit. */
export const RAIN_EXIT_MS = 450;

/** How much of the rain is left `ms` after the scene began to go: 1, falling fast to 0. */
export function exitFade(ms: number, duration = RAIN_EXIT_MS): number {
  if (ms <= 0) return 1;
  const t = Math.min(1, ms / duration);
  return (1 - t) ** 2;
}

// ── the city lighting the rain ───────────────────────────────────────────

/**
 * Rain is only seen where something is lit behind it. This is the picture
 * behind the rain shrunk to a coarse grid: how bright each cell is, and the
 * colour of its light with the brightness taken out.
 */
export type LightGrid = {
  cols: number;
  rows: number;
  /** 0 to 1 per cell. */
  lum: Float32Array;
  /** Three bytes per cell: the light's colour at full brightness. */
  hue: Uint8Array;
};

/** A grid from RGBA pixels, one pixel a cell, softened so a light glows across its neighbours. */
export function lightGridFrom(data: ArrayLike<number>, cols: number, rows: number): LightGrid {
  const n = cols * rows;
  const raw = new Float32Array(n);
  const hue = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    raw[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const top = Math.max(r, g, b, 1);
    hue[i * 3] = Math.round((r / top) * 255);
    hue[i * 3 + 1] = Math.round((g / top) * 255);
    hue[i * 3 + 2] = Math.round((b / top) * 255);
  }
  const lum = new Float32Array(n);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      let weight = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          const w = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
          sum += raw[yy * cols + xx]! * w;
          weight += w;
        }
      }
      lum[y * cols + x] = sum / weight;
    }
  }
  return { cols, rows, lum, hue };
}

/** The faint glow every streak keeps against a black sky, so the dark is not empty. */
const AMBIENT = 0.16;
/** How much a lit cell brightens the rain in front of it. */
const LIGHT_GAIN = 3.2;
const COOL: [number, number, number] = [196, 218, 255];

/** How a streak in front of a cell is lit: a brightness and a colour, quantised to share sprites. */
export function cellLight(
  grid: LightGrid,
  cell: number,
): { bright: number; rgb: [number, number, number] } {
  const lum = grid.lum[cell] ?? 0;
  const bright = Math.min(1.7, AMBIENT + LIGHT_GAIN * lum);
  // A dim cell lights the rain cool white; a bright sign lends it its colour.
  const chroma = Math.min(0.85, lum * 2.4);
  const q = (v: number) => Math.round(v / 51) * 51;
  const rgb = [0, 1, 2].map((k) => q(COOL[k]! + (grid.hue[cell * 3 + k]! - COOL[k]!) * chroma)) as [
    number,
    number,
    number,
  ];
  return { bright, rgb };
}

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
  /** Seconds since it struck the glass: a new bead swells into place. */
  age: number;
  /** Seconds left while it evaporates, or null for a bead that is staying. */
  dying: number | null;
};

/** A speck of water a running drop left behind it, drying. */
export type Residue = { x: number; y: number; r: number; age: number; life: number };

/** How long a newly landed bead takes to swell to its size, in seconds. */
export const LAND_SECONDS = 0.12;
/** How long a bead takes to evaporate when the glass is full, in seconds. */
export const DRY_SECONDS = 0.6;
/** Beads larger than this run once they have gathered enough water. */
const RUN_RADIUS = 5;
const MAX_RADIUS = 16;

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
    age: 1,
    dying: null,
  };
}

/** How many drops strike a window of this size each second, as hard as it is raining. */
export function impactRate(
  width: number,
  height: number,
  intensity: number,
  weak: boolean,
): number {
  return dropCount(width, height, weak) * 0.05 * Math.max(0, intensity);
}

/** A bead just struck: small, mostly. Most of the water arrives as specks that later gather. */
export function landingDrop(width: number, height: number, rand: Rand): Drop {
  const d = makeDrop(width, height, rand);
  d.r = 1.4 + 3.4 * rand() ** 1.6;
  d.runs = false;
  d.age = 0;
  return d;
}

/** One bead takes in another: the water adds up, and a bead heavy enough starts to run. */
export function absorb(into: Drop, other: Drop): void {
  into.r = Math.min(MAX_RADIUS, Math.hypot(into.r, other.r));
  if (into.r > RUN_RADIUS && !into.runs) {
    into.runs = true;
    into.timer = Math.min(into.timer, 0.2);
  }
  if (into.moving) into.speed *= 1.12;
}

function touching(a: Drop, b: Drop): boolean {
  const reach = a.r + b.r * 0.7;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.abs(dx) < reach && Math.abs(dy) < reach && dx * dx + dy * dy < reach * reach;
}

/**
 * Put a struck bead on the glass. One that lands on a bead already there joins
 * it rather than sitting on top of it. A full window lets its smallest still
 * bead start to dry instead. Returns whether the glass took it.
 */
export function landDrop(drops: Drop[], d: Drop, cap: number, rand: Rand): boolean {
  for (const o of drops) {
    if (o.dying === null && touching(o, d)) {
      absorb(o, d);
      return true;
    }
  }
  if (drops.length >= cap) {
    const victim = drops[Math.floor(rand() * drops.length)]!;
    if (!victim.moving && victim.r < 4 && victim.dying === null) victim.dying = DRY_SECONDS;
    return false;
  }
  drops.push(d);
  return true;
}

/**
 * Running drops gather what they reach: a bead in the path joins the drop, which
 * gets heavier and quicker. This is most of what makes water on glass read as
 * water. Removes the beads taken in; returns how many.
 */
export function mergeDrops(drops: Drop[]): number {
  const gone = new Set<Drop>();
  for (const a of drops) {
    if (!a.moving || a.dying !== null || gone.has(a)) continue;
    for (const b of drops) {
      if (b === a || gone.has(b) || b.dying !== null || !touching(a, b)) continue;
      // The larger one keeps going; the smaller is gone into it.
      if (b.r > a.r) continue;
      absorb(a, b);
      gone.add(b);
    }
  }
  if (gone.size === 0) return 0;
  let kept = 0;
  for (const d of drops) if (!gone.has(d)) drops[kept++] = d;
  drops.length = kept;
  return gone.size;
}

/** How long a wet line stays on the glass behind a running drop, in seconds. */
export const TRAIL_SECONDS = 9;
/** How many specks of residue the glass holds before the oldest dry early. */
export const MAX_RESIDUE = 600;
const TRAIL_STEP_PX = 5;
const MAX_TRAIL = 80;

/**
 * Let a bead live a little: a running one waits, then goes in a lurch, gathers
 * speed down the pane and shrinks as it leaves water behind it. Returns true
 * when it is gone off the bottom or worn away and should be replaced.
 */
export function stepDrop(
  d: Drop,
  dt: number,
  rand: Rand,
  height: number,
  leave?: (speck: Residue) => void,
): boolean {
  d.age += dt;
  for (const p of d.trail) p.age += dt;
  while (d.trail.length > 0 && d.trail[0]!.age > TRAIL_SECONDS) d.trail.shift();
  if (d.dying !== null) {
    d.dying -= dt;
    return d.dying <= 0;
  }
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
  d.x += Math.sin(d.y * 0.045 + d.wobble) * 0.18 + Math.sin(d.y * 0.013 + d.wobble * 2) * 0.22;
  // Water left behind is water lost.
  d.r = Math.max(0.9, d.r * (1 - 0.0011 * step));
  const last = d.trail[d.trail.length - 1];
  if (!last || Math.hypot(d.x - last.x, d.y - last.y) >= TRAIL_STEP_PX) {
    d.trail.push({ x: d.x, y: d.y, r: d.r, age: 0 });
    if (d.trail.length > MAX_TRAIL) d.trail.shift();
    // A running drop breaks up behind itself into a line of specks that dry.
    if (leave && d.r > 2 && rand() < 0.22) {
      leave({
        x: d.x + (rand() - 0.5) * d.r * 0.6,
        y: d.y - d.r * 0.8,
        r: Math.min(1.7, 0.55 + rand() * 0.22 * d.r),
        age: 0,
        life: 4 + rand() * 7,
      });
    }
  }
  return d.y > height + d.r * 2 || d.r < 1.05;
}

/** How many tiny specks of mist stipple a window of this size: the fine water between the beads. */
export function mistCount(width: number, height: number, weak: boolean): number {
  return Math.round(((width * height) / 800) * (weak ? 0.4 : 1));
}

/** Dry the residue a little; the oldest go first when there is too much. */
export function stepResidue(specks: Residue[], dt: number): void {
  for (const s of specks) s.age += dt;
  let kept = 0;
  for (const s of specks) if (s.age < s.life) specks[kept++] = s;
  specks.length = kept;
  if (specks.length > MAX_RESIDUE) specks.splice(0, specks.length - MAX_RESIDUE);
}
