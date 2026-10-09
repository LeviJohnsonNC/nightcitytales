/**
 * Tiling surface materials for composed scenes: presentation only.
 *
 * A material is a photographed-looking tile that covers a stated number of
 * metres. It is laid onto a surface the scene already paints (a road zone, a
 * facade, a roof, a shutter) through the SAME affine projection that places
 * everything else, so a tile is a physical size and a surface shows exactly as
 * much of it as its footprint is wide. Nothing here knows about collision,
 * cover, HP or targeting, and a surface with no material is painted exactly as
 * it always was.
 *
 * The sources are in `src/assets/creator/`; `tools/art/materials.mjs` turns
 * them into `public/images/materials/*.webp`. `mean` below is the figure that
 * script prints for each derivative.
 */
import { paintSurfaceCharacter } from "./surfaceCharacter";
import type { Point } from "@/engine";

export const MATERIAL_KEYS = [
  "asphalt",
  "sidewalk",
  "facade-concrete",
  "roof-membrane",
  "shutter",
  "painted-metal",
  "roof-ballast",
  "painted-render",
  "home-masonry",
] as const;
export type MaterialKey = (typeof MATERIAL_KEYS)[number];

type Rgb = readonly [number, number, number];

/**
 * `metres` is how much ground, wall or roof ONE tile covers, which fixes the
 * physical scale of the grain. `gain` scales a tile's deviation from its own
 * mean once it has been reduced to the size it is drawn at: the grain of
 * concrete and sheet metal is about 4% of its brightness at that size, which is
 * invisible, so it is lifted to roughly 10-15%, no further. It is applied to the
 * pixels at load, never to the asset.
 *   sidewalk  4 m: four 1 m slabs a side, so a joint falls on every metre line
 *             and on the edge of every sidewalk zone, which are whole metres.
 *   shutter   3.6 m: eighteen slats, at the 0.2 m pitch the old drawn lines used.
 *   metal     2 m: the size of the rooftop units it covers.
 *   ballast   2 m: stones of 20-40 mm, which read as grain at play zoom only this
 *             big; already contrasty, so no lift.
 *   render    4 m: trowel marks 0.2-0.5 m; lifted like the concrete it sits beside.
 *   the rest  4 m: grain that is only ever read as tone at play zoom.
 */
export const SURFACE_MATERIALS: Record<MaterialKey, { metres: number; mean: Rgb; gain: number }> = {
  asphalt: { metres: 4, mean: [64, 64, 62], gain: 1.7 },
  sidewalk: { metres: 4, mean: [121, 117, 110], gain: 0.75 },
  "facade-concrete": { metres: 4, mean: [156, 154, 150], gain: 2.4 },
  "roof-membrane": { metres: 4, mean: [63, 63, 61], gain: 1.6 },
  shutter: { metres: 3.6, mean: [91, 90, 88], gain: 1 },
  "painted-metal": { metres: 2, mean: [84, 94, 101], gain: 3 },
  "roof-ballast": { metres: 2, mean: [104, 100, 93], gain: 1 },
  "painted-render": { metres: 4, mean: [134, 124, 111], gain: 2 },
  "home-masonry": { metres: 2, mean: [86, 72, 62], gain: 1 },
};

export const materialUrl = (key: MaterialKey) => `/images/materials/${key}.webp`;
export const materialAssetKey = (key: MaterialKey) => `material-${key}`;

export type TileSource = { width: number; height: number } & CanvasImageSource;
/** A material ready to paint with: a tile no larger than the density needs. */
export type MaterialSet = Partial<Record<MaterialKey, TileSource>>;

/**
 * A pattern fill does not mip-map: a 512px tile minified to sixty screen pixels
 * aliases, and the slab joints and slats are the first things to shimmer. Halve
 * the tile (smoothed) until it is just above the density the scene is drawn at.
 */
export function prepareMaterials(
  images: Partial<Record<MaterialKey, TileSource>>,
  pixelsPerMetre: number,
  makeCanvas: () => HTMLCanvasElement = () => document.createElement("canvas"),
): MaterialSet {
  const set: MaterialSet = {};
  for (const key of MATERIAL_KEYS) {
    const image = images[key];
    if (!image) continue;
    let size = image.width;
    const wanted = SURFACE_MATERIALS[key].metres * pixelsPerMetre;
    let current: TileSource = image;
    while (size / 2 >= wanted && size > 32) {
      size /= 2;
      const canvas = makeCanvas();
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(current, 0, 0, size, size);
      current = canvas;
    }
    set[key] = lift(key, current, makeCanvas);
  }
  return set;
}

/** Scale each channel's deviation from the material's mean by its `gain`. */
function lift(key: MaterialKey, tile: TileSource, makeCanvas: () => HTMLCanvasElement) {
  const { gain, mean } = SURFACE_MATERIALS[key];
  if (gain === 1) return tile;
  const canvas = makeCanvas();
  canvas.width = tile.width;
  canvas.height = tile.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(tile, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4)
    for (let c = 0; c < 3; c++) data[i + c] = mean[c]! + (data[i + c]! - mean[c]!) * gain;
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/** Screen vectors for one metre along each texture axis, and the screen point
 * where the texture's own (0, 0) falls. `v` runs DOWN the tile. */
export type Basis = { origin: Point; u: Point; v: Point };

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

/** A horizontal surface, `lift` screen pixels above the ground (a roof). The
 * pattern is anchored to world metre (0, 0), so adjacent surfaces agree. */
export function groundBasis(project: (p: Point) => Point, lift = 0): Basis {
  const o = project({ x: 0, y: 0 });
  return {
    origin: { x: o.x, y: o.y - lift },
    u: sub(project({ x: 1, y: 0 }), o),
    v: sub(project({ x: 0, y: 1 }), o),
  };
}

/**
 * A vertical wall running along world `axis` at the fixed coordinate `at`. The
 * tile's bottom edge sits on the ground line and its height is `pixelsPerMetre`
 * per metre, so a facade shows the same grain as the road beside it. Anchored
 * to world metres: the whole building and any cutaway piece of its wall show
 * the same part of the tile at the same point.
 */
export function wallBasis(
  project: (p: Point) => Point,
  axis: "x" | "y",
  at: number,
  metres: number,
  pixelsPerMetre: number,
  /** Screen pixels the wall's foot stands above the ground: a rooftop unit. */
  lift = 0,
): Basis {
  const o = axis === "x" ? project({ x: 0, y: at }) : project({ x: at, y: 0 });
  const u = sub(axis === "x" ? project({ x: 1, y: at }) : project({ x: at, y: 1 }), o);
  return {
    origin: { x: o.x, y: o.y - lift - metres * pixelsPerMetre },
    u,
    v: { x: 0, y: pixelsPerMetre },
  };
}

/** The matrix that carries tile pixels onto the screen. */
export function patternMatrix(basis: Basis, metres: number, tilePixels: number) {
  const s = metres / tilePixels;
  return {
    a: basis.u.x * s,
    b: basis.u.y * s,
    c: basis.v.x * s,
    d: basis.v.y * s,
    e: basis.origin.x,
    f: basis.origin.y,
  };
}

const hex = (c: string): Rgb => {
  const n = Number.parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * The colour a material is multiplied onto, chosen so the finished surface has
 * the average colour `target` had as a flat fill. Night grading therefore stays
 * where the palette put it, and the material only adds structure around it.
 */
export function gradeFor(key: MaterialKey, target: string, strength: number): string {
  const [r, g, b] = hex(target);
  const mean = SURFACE_MATERIALS[key].mean;
  const grade = [r, g, b].map((v, i) => {
    const albedo = mean[i]! / 255;
    return Math.min(255, Math.round(v / (1 - strength + strength * albedo)));
  });
  return `rgb(${grade.join(",")})`;
}

export interface MaterialFill {
  key: MaterialKey;
  basis: Basis;
  /** The flat colour this surface used to be; its average survives. */
  target: string;
  /** 0..1: how much of the material's own contrast is let through. */
  strength?: number;
}

/**
 * Fill `polygon` with a material. Returns false, having drawn nothing, when the
 * material is unavailable, so a caller paints its old flat fill instead. Later
 * strokes, markings and details are the caller's and go on top, untouched.
 */
export function fillMaterial(
  ctx: CanvasRenderingContext2D,
  materials: MaterialSet | undefined,
  polygon: readonly Point[],
  { key, basis, target, strength = 0.8 }: MaterialFill,
): boolean {
  const tile = materials?.[key];
  if (!tile) return false;
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return false;
  pattern.setTransform(patternMatrix(basis, SURFACE_MATERIALS[key].metres, tile.width));
  ctx.save();
  ctx.beginPath();
  polygon.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = gradeFor(key, target, strength);
  ctx.fill();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = strength;
  ctx.fillStyle = pattern;
  ctx.fill();
  ctx.globalAlpha = 1;
  paintSurfaceCharacter(ctx, polygon, basis, key, SURFACE_MATERIALS[key].metres);
  ctx.restore();
  return true;
}
