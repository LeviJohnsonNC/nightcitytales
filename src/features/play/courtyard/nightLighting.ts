/**
 * Night at the intersection: one ambient colour every surface is multiplied by, and a
 * few local lights that add to it.
 *
 * Presentation only. The ambient is a tint on the scene's own sprites (ground,
 * buildings, props, people), never a dark layer over the finished frame, so the
 * movement squares, shot lines and labels keep their colour. A local light is drawn
 * twice from the same numbers: into a companion sprite for each surface it falls on
 * (`composedEnvironment.ts`), and as a tint for whatever stands in it (`lightAt`),
 * so a person under the streetlight is lit by the same pool the pavement is.
 *
 * Every light is placed from saved geometry: the shop's bays and entrance, the saved
 * streetlight. Nothing here moves a wall, a door, a cover piece or a shot line.
 */
import type { Point, Rect, SceneEnvironment, SceneStructure } from "@/engine";

export type Rgb = readonly [number, number, number];

/**
 * The numbers. `ambient` multiplies every lit surface (1 is the art as painted);
 * a light's `intensity` is what it adds at its brightest, in the same units, so a
 * surface under the lamp's centre shows `ambient + intensity` of its painted colour.
 */
export const INTERSECTION_NIGHT = {
  ambient: [0.5, 0.56, 0.74] as Rgb,
  /**
   * How far past the art's own colour a lit surface may go. A canvas stores light up
   * to 1, and painted asphalt is dark: at 1 a streetlight barely shows. The light
   * sprites are multiplied by this; the tint on people and props is capped at the art.
   */
  gain: 2.6,
  /** The saved streetlight beside the shop. Heights are presentation, not geometry. */
  lamp: {
    poleHeight: 5.6,
    /** Arm length, out from the facade over the pavement. */
    arm: 1.5,
    color: [1, 0.8, 0.56] as Rgb,
    intensity: 0.9,
    radius: 5,
  },
  /** Spill from each lit shop window onto the pavement in front of it. */
  window: { color: [1, 0.66, 0.36] as Rgb, intensity: 0.85, reach: 3.4, spread: 1 },
  /** The downlight under the shutter housing. */
  entrance: { color: [1, 0.74, 0.46] as Rgb, intensity: 0.75, radius: 2.4, out: 0.9 },
  /** The scene's other saved lamps and signs, which keep their small drawings. */
  streetLamp: { color: [1, 0.78, 0.5] as Rgb, intensity: 0.5, radius: 3.4 },
  sign: { color: [0.32, 0.8, 0.78] as Rgb, intensity: 0.28, radius: 2.6 },
} as const;
export type NightLighting = typeof INTERSECTION_NIGHT;

/** Night applies to the composed intersection only; every other scene is unchanged. */
export function nightFor(env: Pick<SceneEnvironment, "recipe" | "interior"> | undefined) {
  return env && env.recipe === "intersection" && !env.interior ? INTERSECTION_NIGHT : undefined;
}

/** A round pool on the ground: a light overhead. */
export interface PoolLight {
  kind: "pool";
  centre: Point;
  radius: number;
  color: Rgb;
  intensity: number;
}

/** A fan thrown out of an opening in a wall onto the ground in front of it. */
export interface SpillLight {
  kind: "spill";
  /** The wall's ground line: `origin` + s*`along`, and `out` points away from the wall. */
  origin: Point;
  along: Point;
  out: Point;
  s0: number;
  s1: number;
  reach: number;
  spread: number;
  color: Rgb;
  intensity: number;
}

export type GroundLight = PoolLight | SpillLight;

/** Pool falloff: full at the centre, smooth to nothing at the radius. */
export const poolFalloff = (t: number) => (t >= 1 ? 0 : (1 - t * t) ** 2);
/** Spill falloff with distance from the wall, as a fraction of its reach. */
export const spillFalloff = (t: number) => (t >= 1 || t < 0 ? 0 : (1 - t) ** 1.6);

/** How much of a light reaches a ground point, before colour. */
export function lightAmount(light: GroundLight, p: Point): number {
  if (light.kind === "pool")
    return (
      light.intensity *
      poolFalloff(Math.hypot(p.x - light.centre.x, p.y - light.centre.y) / light.radius)
    );
  const dx = p.x - light.origin.x;
  const dy = p.y - light.origin.y;
  const s = dx * light.along.x + dy * light.along.y;
  const out = dx * light.out.x + dy * light.out.y;
  if (out < 0 || out > light.reach) return 0;
  const widen = (light.spread * out) / light.reach;
  if (s < light.s0 - widen || s > light.s1 + widen) return 0;
  return light.intensity * spillFalloff(out / light.reach);
}

const inside = (p: Point, r: Rect) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

/** True for the masses light cannot pass into: buildings, not fences or partitions. */
export const blocksLight = (s: SceneStructure) =>
  s.style !== "mesh-fence" && s.style !== "interior-wall";

/**
 * The light reaching a point on the ground, added over the ambient. Inside a
 * building's footprint it is nothing: the pavement's light does not pass through
 * walls, and the cutaway floor is lit by nothing but the night.
 */
export function lightAt(
  lights: readonly GroundLight[],
  structures: readonly SceneStructure[],
  p: Point,
): [number, number, number] {
  const sum: [number, number, number] = [0, 0, 0];
  if (structures.some((s) => blocksLight(s) && inside(p, s.rect))) return sum;
  for (const light of lights) {
    const k = lightAmount(light, p);
    if (k <= 0) continue;
    for (let c = 0; c < 3; c++) sum[c] = sum[c]! + light.color[c]! * k;
  }
  return sum;
}

/** A Phaser tint: the ambient plus any light, each channel capped at the art's own colour. */
export function tintFor(ambient: Rgb, light: readonly number[] = [0, 0, 0], under = 0xffffff) {
  const u = [(under >> 16) & 255, (under >> 8) & 255, under & 255];
  const channel = (c: number) =>
    Math.round(Math.min(1, ambient[c]! + (light[c] ?? 0)) * u[c]!) & 255;
  return (channel(0) << 16) | (channel(1) << 8) | channel(2);
}

const css = (color: Rgb, alpha: number) =>
  `rgba(${color.map((v) => Math.round(v * 255)).join(",")},${Math.max(0, Math.min(1, alpha)).toFixed(4)})`;

/**
 * Paint a light's ground footprint, for a canvas that is about to be multiplied by
 * the surface it falls on. It is the same falloff `lightAt` reads, sampled into
 * gradient stops, drawn through the scene's own projection so a circle on the
 * ground is the right ellipse on screen. Additive: set `lighter` before calling.
 */
export function paintGroundLight(
  ctx: CanvasRenderingContext2D,
  project: (p: Point) => Point,
  light: GroundLight,
  /** Screen pixels the plane is raised: a roof. */
  lift = 0,
) {
  const STOPS = 8;
  const o = project({ x: 0, y: 0 });
  const ex = project({ x: 1, y: 0 });
  const ey = project({ x: 0, y: 1 });
  ctx.save();
  // world metres -> screen, the same affine map everything else is drawn with
  ctx.transform(ex.x - o.x, ex.y - o.y, ey.x - o.x, ey.y - o.y, o.x, o.y - lift);
  if (light.kind === "pool") {
    const { x, y } = light.centre;
    const g = ctx.createRadialGradient(x, y, 0, x, y, light.radius);
    for (let i = 0; i <= STOPS; i++) {
      const t = i / STOPS;
      g.addColorStop(t, css(light.color, light.intensity * poolFalloff(t)));
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, light.radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const at = (s: number, out: number) => ({
      x: light.origin.x + light.along.x * s + light.out.x * out,
      y: light.origin.y + light.along.y * s + light.out.y * out,
    });
    const mid = (light.s0 + light.s1) / 2;
    const a = at(mid, 0);
    const b = at(mid, light.reach);
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    for (let i = 0; i <= STOPS; i++) {
      const t = i / STOPS;
      g.addColorStop(t, css(light.color, light.intensity * spillFalloff(t)));
    }
    const fan = [
      at(light.s0, 0),
      at(light.s1, 0),
      at(light.s1 + light.spread, light.reach),
      at(light.s0 - light.spread, light.reach),
    ];
    ctx.beginPath();
    fan.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

/** A light colour as a CSS colour at a given strength, for painters that add a glow. */
export const lightColor = css;
