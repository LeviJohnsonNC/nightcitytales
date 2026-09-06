/**
 * Putting atlas coordinates on the map image.
 *
 * Every position in this app is a percentage of the R. Talsorian atlas map:
 * 24 districts, 172 locations, 9 landmarks, 37 street marks, and the 2,135
 * traced runs that make up the district polygons. That is the coordinate
 * system, and `cityGrid` does all its work — adjacency, routing, which district
 * a point is in — inside it without ever touching a picture.
 *
 * The picture is therefore only a backdrop, and swapping it changes nothing
 * except where a pin has to be DRAWN. The neon map is the same city drawn
 * again rather than the same image rescaled, so those two things are no longer
 * the same: fitting one scale-and-offset to the whole picture leaves a mean
 * error of 1.2% and a worst of 7%, because its north and its south disagree
 * about where the geography sits by 7% of the map's height.
 *
 * So a mesh does it instead. `map-warp.json` holds a grid of control points
 * saying where each part of the atlas map ended up on the neon one, fitted
 * against the yellow highway network by tools/atlas/fit_map_warp.mjs, and this
 * bilinearly interpolates between them. Mean error after warping is 0.40% —
 * about four pixels.
 *
 * NOTHING STORED CHANGES. Every percentage in the atlas is exactly what it was.
 * This is applied at the last possible moment, when a pin becomes a `left` and
 * a `top`, and it is the only place in the codebase that knows the map image is
 * not the map.
 */
import warpData from "@/data/atlas/map-warp.json";

type WarpFile = {
  houseRule: boolean;
  note: string;
  image: { src: string; width: number; height: number; note: string };
  grid: { cols: number; rows: number };
  affine: { scaleX: number; scaleY: number; offsetX: number; offsetY: number };
  /** Row-major, rows x cols. Each entry is a fraction of the map image. */
  points: [number, number][];
};

const WARP = warpData as unknown as WarpFile;

/** True when the warp is what it claims to be: a fitted, tunable house rule. */
export const MAP_WARP_IS_HOUSE_RULE: boolean = WARP.houseRule;

export const MAP_WARP_GRID = WARP.grid;

/**
 * The picture the map is drawn on.
 *
 * Not `MAP_IMAGE` from geography.ts, which still describes the printed atlas —
 * that is the coordinate reference every percentage in the app is measured
 * against, and it has to keep saying what it says for the warp to mean anything.
 */
export const MAP_PICTURE = WARP.image;

/** A position on the map image, as percentages, ready for `left` and `top`. */
export type MapPlacement = { left: number; top: number };

function node(row: number, col: number): [number, number] {
  const { cols, rows } = WARP.grid;
  const r = Math.min(rows - 1, Math.max(0, row));
  const c = Math.min(cols - 1, Math.max(0, col));
  return WARP.points[r * cols + c] ?? [0, 0];
}

/**
 * Where an atlas coordinate lands on the map image.
 *
 * `x` and `y` are percentages of the atlas map, exactly as every atlas record
 * stores them. The result is percentages of the image, for CSS.
 *
 * Outside the mesh the edge cell's gradient carries on rather than clamping, so
 * a coordinate slightly off the printed map — the Badlands run off its edges —
 * keeps going in the right direction instead of piling up on the border.
 */
export function placeOnMap(x: number, y: number): MapPlacement {
  const { cols, rows } = WARP.grid;
  const fx = x / 100;
  const fy = y / 100;

  const gx = fx * (cols - 1);
  const gy = fy * (rows - 1);
  const cx = Math.min(cols - 2, Math.max(0, Math.floor(gx)));
  const cy = Math.min(rows - 2, Math.max(0, Math.floor(gy)));
  const tx = gx - cx;
  const ty = gy - cy;

  const a = node(cy, cx);
  const b = node(cy, cx + 1);
  const c = node(cy + 1, cx);
  const d = node(cy + 1, cx + 1);

  const top0 = [a[0] + (b[0] - a[0]) * tx, a[1] + (b[1] - a[1]) * tx];
  const bot0 = [c[0] + (d[0] - c[0]) * tx, c[1] + (d[1] - c[1]) * tx];

  return {
    left: (top0[0]! + (bot0[0]! - top0[0]!) * ty) * 100,
    top: (top0[1]! + (bot0[1]! - top0[1]!) * ty) * 100,
  };
}

/** The same, as a CSS-ready pair of percentage strings. */
export function placeOnMapStyle(x: number, y: number): { left: string; top: string } {
  const p = placeOnMap(x, y);
  return { left: `${p.left}%`, top: `${p.top}%` };
}
