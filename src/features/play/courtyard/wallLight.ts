import { CITY_FIXTURES, fixtureLamp } from "./cityFixtures";
/**
 * Light on walls: the same lights that pool on the pavement, reaching the facades
 * they stand in front of.
 *
 * Presentation only, at night on the intersection. The ground pools come from
 * `nightLighting.ts`; until now only the storefront's own face caught any light, and
 * that as a screen-space radial, so a lamp lit the pavement and left the wall beside
 * it dark. Here each light is a point at its fixture's height, and a wall plane
 * receives the pool's own falloff over true 3D distance:
 *
 *   amount(p) = intensity · poolFalloff(|p − light| / radius)
 *
 * which on a plane at perpendicular distance d from the light is a radial gradient
 * around the light's foot on the plane, scaled by poolFalloff(d / radius).
 *
 * A face is lit only by a light in front of it (its outward side), within reach,
 * and with no other building standing between them on the ground. A roof is never
 * lit here. Painted into a surface's light pass, so it is multiplied by the
 * surface's own colour: light shows the material, never covers it.
 */
import type { Point, SceneEnvironment, SceneStructure } from "@/engine";
import type { NightLighting, Rgb } from "./nightLighting";
import { blocksLight, lightColor, poolFalloff } from "./nightLighting";
import type { Edge } from "./frontage";
import { streetLamp, type Storefront } from "./storefront";
import { STOREFRONT_LEVELS, STOREFRONT_FACE } from "./storefrontPack";

type Project = (p: Point) => Point;

/** A light at a height: a lamp head, a downlight, a sign. */
export interface PointLight {
  at: Point;
  z: number;
  radius: number;
  color: Rgb;
  intensity: number;
}

/**
 * How a wall takes a light, against the ground under it. A wall faces a lamp beside it
 * where the pavement sees it at a slant, and its render is darker than the paving, so
 * by the ground's own numbers a lit facade barely reads. A modest reach and restrained gain keep upper-storey washes subordinate to
 * occupied shop openings. The pavement retains the source's full pool.
 */
export const WALL = { reach: 1.15, gain: 0.92 } as const;

/** Heights of the scene's fixtures, in metres: presentation, not geometry. */
export const FIXTURE_HEIGHT = { streetLamp: 4.4, sign: 2.6 } as const;

/** Every light that can reach a wall, from the same sources as the ground's pools. */
export function pointLights(
  env: SceneEnvironment,
  storefronts: readonly Storefront[],
  night: NightLighting,
): PointLight[] {
  const out: PointLight[] = [];
  const skip = new Set<string>();
  for (const sf of storefronts) {
    const lamp = streetLamp(sf, night);
    if (lamp) {
      out.push({ at: lamp.head, z: lamp.headZ, ...night.lamp });
      skip.add("shop_lamp_detail_0");
    }
  }
  for (const d of env.dressing) {
    if (skip.has(d.id) || (d.kind !== "lamp" && d.kind !== "sign")) continue;
    const light =
      d.kind === "lamp"
        ? night.streetLamp
        : { color: CITY_FIXTURES.cyan, intensity: 0.62, radius: 3.7 };
    out.push({
      ...(d.kind === "lamp" ? fixtureLamp(env, d.position) : { at: d.position, z: 1.95 }),
      ...light,
    });
  }
  return out;
}

/** A camera-facing face: its ground line, outward normal and length. */
function faceFrame(r: SceneStructure["rect"], edge: Edge) {
  return edge === "north"
    ? { origin: { x: r.x, y: r.y }, along: { x: 1, y: 0 }, out: { x: 0, y: -1 }, length: r.width }
    : {
        origin: { x: r.x + r.width, y: r.y },
        along: { x: 0, y: 1 },
        out: { x: 1, y: 0 },
        length: r.height,
      };
}

/** Does segment ab pass through the interior of rect r (Liang–Barsky)? */
function crosses(a: Point, b: Point, r: SceneStructure["rect"]) {
  let t0 = 0,
    t1 = 1;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const clip = (p: number, q: number) => {
    if (p === 0) return q > 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  const e = 0.02;
  return (
    clip(-dx, a.x - (r.x + e)) &&
    clip(dx, r.x + r.width - e - a.x) &&
    clip(-dy, a.y - (r.y + e)) &&
    clip(dy, r.y + r.height - e - a.y) &&
    t1 - t0 > 1e-6
  );
}

/**
 * Where a light falls on a face, or nothing: its foot on the wall plane (metres
 * along the face, and height), the radius of the lit disc on the plane, and the
 * strength at its centre.
 */
export function lightOnFace(
  structure: SceneStructure,
  edge: Edge,
  light: PointLight,
  structures: readonly SceneStructure[],
) {
  const f = faceFrame(structure.rect, edge);
  const dx = light.at.x - f.origin.x,
    dy = light.at.y - f.origin.y;
  const d = dx * f.out.x + dy * f.out.y; // in front of the wall: d > 0
  const radius = light.radius * WALL.reach;
  if (d <= 0.05 || d >= radius) return undefined;
  const s = dx * f.along.x + dy * f.along.y;
  // the nearest stretch of the face the light can see: past either end, its corner
  const sNear = Math.max(0, Math.min(f.length, s));
  const disc = Math.sqrt(radius ** 2 - d ** 2);
  if (Math.abs(s - sNear) >= disc) return undefined;
  // nothing standing between the light and the wall, on the ground
  const foot = {
    x: f.origin.x + f.along.x * sNear + f.out.x * 0.05,
    y: f.origin.y + f.along.y * sNear + f.out.y * 0.05,
  };
  if (structures.some((o) => o !== structure && blocksLight(o) && crosses(light.at, foot, o.rect)))
    return undefined;
  return { s, z: light.z, disc, peak: light.intensity * WALL.gain * poolFalloff(d / radius) };
}

/**
 * Paint every light's wash on a building's camera-facing faces, into a light pass.
 * `clip` limits it to a stretch of a face and a height (a cutaway piece), and `skip`
 * leaves out a face that is painted by its own routine.
 */
export function paintWallLights(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  project: Project,
  ppm: number,
  lights: readonly PointLight[],
  structures: readonly SceneStructure[],
  clip?: { edge: Edge; s0: number; s1: number; zMax: number },
) {
  if (!blocksLight(structure)) return;
  const STOPS = 8;
  for (const edge of ["north", "east"] as const) {
    if (clip && clip.edge !== edge) continue;
    const f = faceFrame(structure.rect, edge);
    const s0 = clip?.s0 ?? 0,
      s1 = clip?.s1 ?? f.length,
      zMax = clip?.zMax ?? structure.height;
    // the face as a drawing plane: (s, z) metres -> screen
    const at = (s: number, z: number) => {
      const p = project({ x: f.origin.x + f.along.x * s, y: f.origin.y + f.along.y * s });
      return { x: p.x, y: p.y - z * ppm };
    };
    for (const light of lights) {
      const hit = lightOnFace(structure, edge, light, structures);
      if (!hit) continue;
      ctx.save();
      const o = at(0, 0),
        es = at(1, 0),
        ez = at(0, 1);
      ctx.beginPath();
      [at(s0, 0), at(s1, 0), at(s1, zMax), at(s0, zMax)].forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.clip();
      // (s, z) plane -> screen, so the disc is drawn in metres
      ctx.transform(es.x - o.x, es.y - o.y, ez.x - o.x, ez.y - o.y, o.x, o.y);
      const g = ctx.createRadialGradient(hit.s, hit.z, 0, hit.s, hit.z, hit.disc);
      for (let i = 0; i <= STOPS; i++) {
        const t = i / STOPS;
        g.addColorStop(t, lightColor(light.color, hit.peak * (1 - t * t) ** 2));
      }
      ctx.fillStyle = g;
      ctx.fillRect(hit.s - hit.disc, hit.z - hit.disc, hit.disc * 2, hit.disc * 2);
      ctx.restore();
    }
  }
}

/**
 * The light around a lit window: its sill, reveal and the wall immediately round the
 * opening catch the room's light, fading within half a metre. A light pass.
 */
export function paintWindowSurround(
  ctx: CanvasRenderingContext2D,
  at: (s: number, out: number, z: number) => Point,
  win: { s0: number; s1: number; z0: number; z1: number },
  color: Rgb,
  strength: number,
) {
  const margin = 0.5;
  const c = at((win.s0 + win.s1) / 2, 0, (win.z0 + win.z1) / 2);
  const corner = at(win.s1 + margin, 0, win.z1 + margin);
  const r = Math.hypot(corner.x - c.x, corner.y - c.y);
  ctx.save();
  const g = ctx.createRadialGradient(c.x, c.y, r * 0.35, c.x, c.y, r);
  g.addColorStop(0, lightColor(color, strength));
  g.addColorStop(1, lightColor(color, 0));
  ctx.beginPath();
  [
    at(win.s0 - margin, 0, win.z0 - margin),
    at(win.s1 + margin, 0, win.z0 - margin),
    at(win.s1 + margin, 0, win.z1 + margin),
    at(win.s0 - margin, 0, win.z1 + margin),
  ].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  // the sill catches the most: a lit strip along its top
  ctx.beginPath();
  [
    at(win.s0 - 0.06, 0.07, win.z0),
    at(win.s1 + 0.06, 0.07, win.z0),
    at(win.s1 + 0.06, 0, win.z0),
    at(win.s0 - 0.06, 0, win.z0),
  ].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = lightColor(color, Math.min(1, strength * 2.2));
  ctx.fill();
  ctx.restore();
}

/** The storefront's lit bays, as windows for `paintWindowSurround`. */
export const storefrontWindows = (sf: Storefront) =>
  sf.litBays.map((s0) => ({
    s0,
    s1: s0 + STOREFRONT_FACE.bayWidth,
    z0: STOREFRONT_LEVELS.riser,
    z1: STOREFRONT_LEVELS.glazingTop,
  }));
