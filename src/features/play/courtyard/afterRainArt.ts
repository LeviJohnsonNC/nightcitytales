/** Registered returned paintings. Source anchors measured on the 1024 × 1536 originals. */
import type { Point } from "@/engine";
import type { ArchitectureArt } from "./architecturePack";
import { sourceFor } from "./architectureArt";
import type { TileSource } from "./surfaceMaterials";

export const FIXTURE_REGISTRATION = {
  signal0: {
    anchor: { x: 228, y: 1362 },
    joint: { x: 231, y: 228 },
    end: { x: 899, y: 630 },
    arm: 3.8,
    z: 5.4,
  },
  signal90: {
    anchor: { x: 245, y: 1380 },
    joint: { x: 246, y: 395 },
    end: { x: 810, y: 60 },
    arm: 3.8,
    z: 5.4,
  },
  transit0: {
    anchor: { x: 473, y: 1325 },
    joint: { x: 476, y: 229 },
    end: { x: 665, y: 339 },
    arm: 0.525,
    z: 2.95,
  },
  transit90: {
    anchor: { x: 620, y: 1302 },
    joint: { x: 620, y: 286 },
    end: { x: 778, y: 198 },
    arm: 0.525,
    z: 2.95,
  },
} as const;
export type FixtureArt = keyof typeof FIXTURE_REGISTRATION;
export function fixtureMatrix(key: FixtureArt, ppm: number, flip = false) {
  const r = FIXTURE_REGISTRATION[key],
    sign = key.endsWith("90") ? -1 : 1;
  const d = (r.z * ppm) / (r.anchor.y - r.joint.y);
  const a = (((r.arm * Math.sqrt(3)) / 2) * ppm) / (r.end.x - r.joint.x);
  const b = (sign * r.arm * 0.5 * ppm - d * (r.end.y - r.joint.y)) / (r.end.x - r.joint.x);
  return { a: flip ? -a : a, b, d, x: r.anchor.x, y: r.anchor.y };
}
export function paintFixtureArt(
  ctx: CanvasRenderingContext2D,
  art: ArchitectureArt | undefined,
  key: FixtureArt,
  p: Point,
  ppm: number,
  flip: boolean,
  emission = false,
) {
  const assetKey = emission ? (`${key}Emission` as keyof ArchitectureArt) : key;
  const img = art?.[assetKey] as TileSource | undefined;
  if (!img) return false;
  const m = fixtureMatrix(key, ppm, flip);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.transform(m.a, m.b, 0, m.d, 0, 0);
  ctx.translate(-m.x, -m.y);
  ctx.drawImage(img, 0, 0, 1024, 1536);
  ctx.restore();
  return true;
}
/** Front-on paintings follow the wall's exact affine plane, never a screen-aligned rectangle. */
export function paintFaceAsset(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource | undefined,
  at: (s: number, out: number, z: number) => Point,
  s0: number,
  s1: number,
  z0: number,
  z1: number,
  out = 0.07,
) {
  if (!img) return;
  const o = at(s0, out, z1),
    u = at(s1, out, z1),
    v = at(s0, out, z0);
  const t = ctx.getTransform();
  const size = (p: Point) =>
    Math.hypot(t.a * (p.x - o.x) + t.c * (p.y - o.y), t.b * (p.x - o.x) + t.d * (p.y - o.y));
  const src = sourceFor(img as TileSource, size(u), size(v));
  ctx.save();
  ctx.transform(
    (u.x - o.x) / src.width,
    (u.y - o.y) / src.width,
    (v.x - o.x) / src.height,
    (v.y - o.y) / src.height,
    o.x,
    o.y,
  );
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}

/** Tight opaque bounds, including the source's alpha fringe, transformed with its anchor. */
export function fixtureExtent(key: FixtureArt, p: Point, ppm: number, flip: boolean): Point[] {
  const boxes = {
    signal0: [50, 88, 952, 1395],
    signal90: [69, 35, 863, 1407],
    transit0: [304, 164, 695, 1340],
    transit90: [431, 184, 792, 1318],
  } as const;
  const [x0, y0, x1, y1] = boxes[key],
    m = fixtureMatrix(key, ppm, flip);
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ].map(([x, y]) => ({ x: p.x + m.a * (x! - m.x), y: p.y + m.b * (x! - m.x) + m.d * (y! - m.y) }));
}
