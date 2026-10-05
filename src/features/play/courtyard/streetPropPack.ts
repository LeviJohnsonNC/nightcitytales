/**
 * The street-prop art pack for the seed-7 corner: the sedan beside the shop, the
 * planters, and the steel cabinet at the housing entrance. One source of truth for
 * the numbers: `tools/scenes/street-prop-guides.ts` draws Picasso's guides from it,
 * and the importer will cut and register the returned images by it, so a guide and
 * the art made to it cannot drift.
 *
 * Every number is the renderer's own. A prop is drawn into a 256 × 320 frame per
 * saved 2 m section (`PROP_CANVAS`) through `interiorPropPoint`: the section's 2 m ×
 * 2 m footprint is the diamond across the full frame width with its front corner on
 * the bottom edge, and a metre of height is `PROP_PIXELS_PER_METRE` frame pixels.
 * The board places the frame by the footprint's front corner and width
 * (`propPlacement`), so art drawn to this diamond lands on the saved cover piece.
 * Presentation only: nothing here moves, resizes or re-materials a cover piece.
 */
import type { Point } from "@/engine";
import { interiorPropPoint } from "./interiorPropArt";
import { PROP_CANVAS, PROP_PIXELS_PER_METRE } from "./sceneArtMetrics";

export type Rotation = 0 | 90;
export type PropState = "intact" | "damaged" | "wrecked";

/** The saved props this pack is for: intersection seed 7, nearest the shop corner. */
export const STREET_PROP_BENCHMARK = {
  recipe: "intersection",
  seed: 7,
  sedan: {
    art: ["sedan-engine", "sedan-cabin"],
    cover: ["curb_west_car_engine", "curb_west_car_cabin"],
    rotation: 90,
  },
  /** The one beside the cabinet and the housing lamp, on screen with the corner. */
  planter: { art: "planter", cover: ["housing_entry_south_box"], rotation: 0 },
  cabinet: { art: "mailboxes", cover: ["housing_entry_mailboxes_cabinet"], rotation: 0 },
} as const;

/** Frame pixels per metre of height, and the frame. */
export const FRAME = {
  width: PROP_CANVAS.width,
  height: PROP_CANVAS.height,
  pxPerMetreUp: PROP_PIXELS_PER_METRE,
} as const;

/** A point of a 2 m section at height `z` metres, in frame pixels (rotation applied). */
export const framePoint = (x: number, y: number, z = 0, rotation: Rotation = 0) =>
  interiorPropPoint(x, y, z * PROP_PIXELS_PER_METRE, rotation);

/**
 * The sedan, in the car's own metres: x along the car (engine section 0–2, cabin
 * 2–4, front at x = 0), y across it (0–2), z up. These are the procedural car's
 * numbers (`interiorPropArt.ts`, 1.45 m to 83 units), so returned art keeps the
 * silhouette the board already uses for line of sight and fading. The join between
 * the two attackable sections is the plane x = 2: both halves meet it at the same
 * sill, hood and roof heights, whatever state either is in.
 */
export const SEDAN = {
  length: 4,
  width: 2,
  join: 2,
  body: { x0: 0.12, x1: 3.86, y0: 0.2, y1: 1.8 },
  sill: 0.28,
  hood: 0.8,
  glassBottom: 0.91,
  glassTop: 1.33,
  roof: 1.45,
  /** Glasshouse footprint (cabin box, glass band to roof), from the procedural car. */
  cabin: { x0: 2.05, x1: 3.3, y0: 0.32, y1: 1.68 },
  /** Where the windscreen meets the bonnet: it slopes up from here to the roof's front. */
  windscreenFoot: 1.45,
  wheel: { radius: 0.32, centres: [0.7, 3.38], y: [0.18, 1.82] },
  /** Height the wrecked remains stay under: walkable wreckage is drawn low. */
  wreckedMax: 0.55,
} as const;

/** Where the cabin section's frame sits relative to the engine's, in frame pixels. */
export function cabinFrameOffset(rotation: Rotation): Point {
  // the cabin is the next 2 m along the car: +x for rotation 0, +y for rotation 90
  const rise = 64 / Math.sqrt(3);
  return rotation === 0 ? { x: 128, y: 2 * rise } : { x: 128, y: -2 * rise };
}

/** A car point (car metres, z up) in engine-frame pixels, for either rotation. */
export function sedanPoint(x: number, y: number, z: number, rotation: Rotation): Point {
  if (x <= SEDAN.join) return framePoint(x, y, z, rotation);
  const o = cabinFrameOffset(rotation);
  const p = framePoint(x - SEDAN.join, y, z, rotation);
  return { x: p.x + o.x, y: p.y + o.y };
}

export interface PackGuide {
  id: "sedan-r90" | "sedan-r0" | "planter" | "cabinet";
  /** File name Picasso saves each state as; `{state}` is intact, damaged or wrecked. */
  file: string;
  /** Square, because the image tool offers 1:1, 3:2 and 2:3, and these fit 1:1. */
  canvas: number;
  /** Guide pixels per frame pixel, and where frame pixel (0, 0) of the first
   * section's frame lands on the guide. */
  scale: number;
  origin: Point;
  rotation: Rotation;
  /** Section frames this guide is cut into, with their offsets in frame pixels. */
  sections: { art: string; offset: Point }[];
}

const CANVAS = 1536;
const SMALL = 1024;

/** Fit a set of frame-pixel points into a square canvas with a margin. */
function fit(points: Point[], canvas: number, margin: number) {
  const x0 = Math.min(...points.map((p) => p.x)) - margin;
  const x1 = Math.max(...points.map((p) => p.x)) + margin;
  const y0 = Math.min(...points.map((p) => p.y)) - margin;
  const y1 = Math.max(...points.map((p) => p.y)) + margin;
  const side = Math.max(x1 - x0, y1 - y0);
  const scale = canvas / side;
  // centre the content in the square
  return {
    scale,
    origin: {
      x: (-x0 + (side - (x1 - x0)) / 2) * scale,
      y: (-y0 + (side - (y1 - y0)) / 2) * scale,
    },
  };
}

/** The volume a section may occupy: its 2 m footprint up to `height` metres. */
const sectionBox = (offset: Point, rotation: Rotation, height: number) =>
  [0, height].flatMap((z) =>
    (
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ] as const
    ).map(([x, y]) => {
      const p = framePoint(x, y, z, rotation);
      return { x: p.x + offset.x, y: p.y + offset.y };
    }),
  );

function sedanGuide(rotation: Rotation): PackGuide {
  const cabin = cabinFrameOffset(rotation);
  const pts = [...sectionBox({ x: 0, y: 0 }, rotation, 1.8), ...sectionBox(cabin, rotation, 1.8)];
  const { scale, origin } = fit(pts, CANVAS, 18);
  return {
    id: rotation === 90 ? "sedan-r90" : "sedan-r0",
    file: `street-sedan-r${rotation}-{state}.png`,
    canvas: CANVAS,
    scale,
    origin,
    rotation,
    sections: [
      { art: "sedan-engine", offset: { x: 0, y: 0 } },
      { art: "sedan-cabin", offset: cabin },
    ],
  };
}

function singleGuide(id: "planter" | "cabinet", art: string, rotation: Rotation, top: number) {
  const pts = sectionBox({ x: 0, y: 0 }, rotation, top);
  const { scale, origin } = fit(pts, SMALL, 10);
  return {
    id,
    file: `street-${id}-{state}.png`,
    canvas: SMALL,
    scale,
    origin,
    rotation,
    sections: [{ art, offset: { x: 0, y: 0 } }],
  } satisfies PackGuide;
}

/** The planter is square and symmetric: one image serves both rotations. */
export const PLANTER = {
  body: { x0: 0.12, x1: 1.88, y0: 0.12, y1: 1.88 },
  rim: 0.64,
  soil: 0.7,
  foliageMax: 1.25,
  wreckedMax: 0.35,
} as const;

/** The cabinet: a steel box 1.76 m wide, 0.9 m deep, 1.52 m tall, doors facing -y. */
export const CABINET = {
  body: { x0: 0.12, x1: 1.88, y0: 0.4, y1: 1.3 },
  height: 1.52,
  /** The face with the doors: local y = 0.4, toward the street. */
  front: "y0",
  wreckedMax: 0.5,
} as const;

export const STREET_PROP_PACK: readonly PackGuide[] = [
  sedanGuide(90),
  sedanGuide(0),
  singleGuide("planter", "planter", 0, 1.4),
  singleGuide("cabinet", "mailboxes", 0, 1.8),
];

/** A frame-pixel point of a guide's first section, on the guide canvas. */
export function toGuide(g: PackGuide, p: Point): Point {
  return { x: g.origin.x + p.x * g.scale, y: g.origin.y + p.y * g.scale };
}

/** Convex hull, counter-clockwise. */
function hull(points: Point[]): Point[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, q) <= 0)
        out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half([...p].reverse())];
}

/**
 * How a whole-car image is cut into its two attackable sections, in guide pixels.
 *
 * Each section owns the screen area of its own 2 m volume. Where the two volumes
 * overlap on screen, the pixel shows whichever is nearer the camera (the board sorts
 * that section in front), so the nearer section keeps the overlap and the farther
 * one is cut along the nearer one's silhouette. Rotation 0: the cabin is nearer.
 * Rotation 90: the engine is. Returned as the polygon each section keeps and the
 * polygon (if any) the farther one must exclude.
 */
export function sedanCut(g: PackGuide) {
  const height = 1.8;
  const box = (offset: Point) =>
    hull(sectionBox(offset, g.rotation, height).map((p) => toGuide(g, p)));
  const engine = box(g.sections[0]!.offset);
  const cabin = box(g.sections[1]!.offset);
  const nearer = g.rotation === 0 ? "sedan-cabin" : "sedan-engine";
  return {
    nearer,
    keep: { "sedan-engine": engine, "sedan-cabin": cabin } as Record<string, Point[]>,
    exclude: {
      "sedan-engine": nearer === "sedan-cabin" ? cabin : null,
      "sedan-cabin": nearer === "sedan-engine" ? engine : null,
    } as Record<string, Point[] | null>,
  };
}

/** Where a section's frame sits on the guide: crop this rectangle, scaled, to get it. */
export function sectionFrameOnGuide(g: PackGuide, section: number) {
  const o = g.sections[section]!.offset;
  return {
    x: g.origin.x + o.x * g.scale,
    y: g.origin.y + o.y * g.scale,
    width: FRAME.width * g.scale,
    height: FRAME.height * g.scale,
  };
}

export const PROP_STATES: readonly PropState[] = ["intact", "damaged", "wrecked"];
