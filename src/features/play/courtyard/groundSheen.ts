/**
 * A damp sheen: the experiment `checkpoint-atmosphere.md` §4 asked for after the
 * puddles failed. A rough, wet surface does not mirror a light; it smears it into a
 * broad, soft highlight around where the mirror image would be. In this orthographic
 * view a light at height z mirrors z metres straight down-screen from its foot, so the
 * shop lamp's highlight lies on the pavement beyond its pole and a lit window's lies on
 * the paving in front of the wall.
 *
 * Presentation only, at night on the intersection, and only where the ground is damp:
 * irregular patches from a low-frequency noise over world position, so large dry areas
 * stay dry, and the same street is always damp in the same places. Asphalt takes it more
 * than paving (a smoother, darker surface when wet). The highlight is added on top of
 * the ground's light, after its albedo, and scaled by the surface's own brightness, so
 * markings and texture stay readable and nothing is a flat glaze.
 *
 * It reflects only lights the scene already has. No mirrored sprite, no new source.
 */
import type { Arena, Point } from "@/engine";
import type { GroundLight, Rgb } from "./nightLighting";
import { blocksLight } from "./nightLighting";
import { hash } from "./frontage";

export const GROUND_SHEEN = {
  /** The experiment's switch. */
  enabled: true,
  /** Scale of the damp patches, in metres: a noise cell. */
  patch: 3.2,
  /** Where noise becomes damp, 0-1 (the rest stays dry). */
  dampFrom: 0.5,
  dampFull: 0.72,
  /** How much each surface takes the sheen. */
  material: { asphalt: 1, paving: 0.45 },
  /** The highlight's spread on screen, in metres: across, and along the view. */
  spread: { x: 1.1, y: 3.2 },
  /** Its strength at its brightest, against the light's own intensity. */
  strength: 0.55,
  /** How a surface's own brightness scales it: dark asphalt still shows it, a white
   * marking does not glare (`base + slope·luminance`, capped at 1). */
  albedo: { base: 1, slope: 0 },
  /** A window's bay, for its mirror image: sill and head heights. */
  window: { z0: 0.65, z1: 2.35 },
} as const;

/** A source as the sheen sees it: a point, or a window's bay as a vertical span. */
export interface SheenSource {
  /** Foot on the ground, world metres; for a window, the two ends of its bay. */
  a: Point;
  b: Point;
  z0: number;
  z1: number;
  color: Rgb;
  intensity: number;
}

/** Smooth value noise over world metres, 0-1. */
export function dampNoise(p: Point, cell: number = GROUND_SHEEN.patch): number {
  let sum = 0;
  let weight = 0;
  // two octaves, the second at a third of the cell, offset so their grids do not align
  for (const [scale, w, off] of [
    [1, 0.7, 0],
    [1 / 3, 0.3, 17.3],
  ] as const) {
    const c = cell * scale;
    const x = p.x / c + off;
    const y = p.y / c + off;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const s = (t: number) => t * t * (3 - 2 * t);
    const v = (i: number, j: number) => hash(i, j, c);
    const top = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * s(fx);
    const bottom = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * s(fx);
    sum += w * (top + (bottom - top) * s(fy));
    weight += w;
  }
  return sum / weight;
}

/** How damp a point is, 0-1, before its material. */
export function dampness(p: Point): number {
  const n = dampNoise(p);
  const t = (n - GROUND_SHEEN.dampFrom) / (GROUND_SHEEN.dampFull - GROUND_SHEEN.dampFrom);
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/** What a point's surface is, for the sheen: asphalt, paving, or nothing that takes it. */
export function sheenSurface(arena: Arena, p: Point): "asphalt" | "paving" | null {
  const env = arena.environment!;
  const inside = (r: { x: number; y: number; width: number; height: number }) =>
    p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
  if (env.structures.some((s) => blocksLight(s) && inside(s.rect))) return null;
  let surface: "asphalt" | "paving" | null = null;
  for (const z of env.zones) {
    if (!inside(z.rect)) continue;
    if (
      z.kind === "road" ||
      z.kind === "intersection" ||
      z.kind === "crosswalk" ||
      z.kind === "parking"
    )
      surface = "asphalt";
    else if (z.kind === "sidewalk") surface = "paving";
  }
  return surface;
}

/**
 * The sheen's sources, from the ground's own lights and their fixture heights: a pool
 * is a point light overhead (`zOf`), a window's spill is its bay. A pool without a
 * fixture higher than a metre (the entrance's downlight under the shutter housing
 * reaches the ground as a pool, but its lamp is hidden) is still a source.
 */
export function sheenSources(
  lights: readonly GroundLight[],
  zOf: (light: GroundLight) => number,
): SheenSource[] {
  return lights.map((light) => {
    if (light.kind === "pool") {
      const z = zOf(light);
      return {
        a: light.centre,
        b: light.centre,
        z0: z,
        z1: z,
        color: light.color,
        intensity: light.intensity,
      };
    }
    const at = (s: number) => ({
      x: light.origin.x + light.along.x * s,
      y: light.origin.y + light.along.y * s,
    });
    return {
      a: at(light.s0),
      b: at(light.s1),
      z0: GROUND_SHEEN.window.z0,
      z1: GROUND_SHEEN.window.z1,
      color: light.color,
      intensity: light.intensity,
    };
  });
}

type Project = (p: Point) => Point;

/**
 * Paint the sheen into `out`, an RGBA buffer `width` x `height` covering scene pixels
 * from (`x0`, `y0`) at `step` scene pixels a sample. `albedo` is the ground's own
 * luminance at the same samples (0-1). Additive light, 0-255 per channel.
 */
export function paintSheen(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  frame: { x0: number; y0: number; step: number },
  albedo: Float32Array,
  arena: Arena,
  project: Project,
  sources: readonly SheenSource[],
) {
  const o = project({ x: 0, y: 0 });
  const ex = project({ x: 1, y: 0 });
  const ey = project({ x: 0, y: 1 });
  const metre = Math.hypot(ex.x - o.x, ex.y - o.y);
  // scene pixels to world metres: the inverse of the projection's affine map
  const a = ex.x - o.x,
    b = ey.x - o.x,
    c = ex.y - o.y,
    d = ey.y - o.y;
  const det = a * d - b * c;
  const toWorld = (sx: number, sy: number) => {
    const u = sx - o.x;
    const v = sy - o.y;
    return { x: (d * u - b * v) / det, y: (-c * u + a * v) / det };
  };
  const sx = GROUND_SHEEN.spread.x * metre;
  const sy = GROUND_SHEEN.spread.y * metre;
  // each source's mirror image on screen: a point, or a window's bay as a quad
  const images = sources.map((s) => {
    const pa = project(s.a);
    const pb = project(s.b);
    return {
      ax: pa.x,
      bx: pb.x,
      ay: pa.y,
      by: pb.y,
      // the mirror of height z lies z metres down-screen from the foot
      z0: s.z0 * metre,
      z1: s.z1 * metre,
      s,
    };
  });
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++) {
      const px = frame.x0 + (i + 0.5) * frame.step;
      const py = frame.y0 + (j + 0.5) * frame.step;
      const w = toWorld(px, py);
      const surface = sheenSurface(arena, w);
      if (!surface) continue;
      const damp = dampness(w) * GROUND_SHEEN.material[surface];
      if (damp <= 0) continue;
      let r = 0,
        g = 0,
        bl = 0;
      for (const im of images) {
        // nearest point of the image: along the bay (screen x, then its y on the
        // foot line), and down-screen within the mirrored span
        const t = im.bx === im.ax ? 0 : Math.max(0, Math.min(1, (px - im.ax) / (im.bx - im.ax)));
        const fx = im.ax + (im.bx - im.ax) * t;
        const fy = im.ay + (im.by - im.ay) * t;
        const dx = px - fx;
        const below = py - fy;
        const dy = below < im.z0 ? below - im.z0 : below > im.z1 ? below - im.z1 : 0;
        const k = Math.exp(-0.5 * ((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy)));
        if (k < 0.01) continue;
        const e = k * im.s.intensity;
        r += im.s.color[0] * e;
        g += im.s.color[1] * e;
        bl += im.s.color[2] * e;
      }
      if (r + g + bl <= 0) continue;
      const lum = albedo[j * width + i]!;
      const scale =
        255 *
        GROUND_SHEEN.strength *
        damp *
        Math.min(1, GROUND_SHEEN.albedo.base + GROUND_SHEEN.albedo.slope * lum);
      const q = (j * width + i) * 4;
      out[q] = Math.min(255, r * scale);
      out[q + 1] = Math.min(255, g * scale);
      out[q + 2] = Math.min(255, bl * scale);
      out[q + 3] = 255;
    }
}
