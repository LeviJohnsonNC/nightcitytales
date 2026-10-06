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
  /** How far the radio aerial may stand above the roof, at the rear. */
  aerial: 0.7,
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
  id: "sedan-r90" | "sedan-r0" | "planter" | "cabinet" | "cabinet-r90" | "kiosk-r0" | "kiosk-r90";
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

function singleGuide(
  id: "planter" | "cabinet" | "cabinet-r90" | "kiosk-r0" | "kiosk-r90",
  art: string,
  rotation: Rotation,
  top: number,
) {
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

/**
 * The shop's merchandise stand (`shop-display`): two stepped tiers of goods under a
 * striped sunshade on two rear posts, open on its browsing side. Every number is the
 * procedural stand's (`interiorPropArt.ts`, 73.9 frame px a metre of height), so the
 * painted stand keeps the silhouette the board fades and sorts by. Local y = 0.1 is
 * the open side: toward -y (north) at rotation 0, toward +x (east) at rotation 90,
 * which are both faces the camera sees.
 */
export const KIOSK = {
  body: { x0: 0.12, x1: 1.88, y0: 0.1, y1: 1.9 },
  tiers: [
    { y0: 0.25, y1: 0.85, top: 0.34, goods: 0.51 },
    { y0: 0.95, y1: 1.55, top: 0.65, goods: 0.83 },
  ],
  posts: { xs: [0.12, 1.8], y0: 1.65, y1: 1.77, width: 0.08, top: 1.27 },
  canopy: { x0: 0, x1: 2, y0: 0.1, y1: 1.9, z0: 1.245, z1: 1.31 },
  height: 1.31,
  front: "y0",
  wreckedMax: 0.45,
} as const;

/**
 * Round two (`docs/street-props-pack/round-2.md`): the bindings the intersection
 * variants still draw procedurally. The cabinet at rotation 90 (seed 0 puts it so; its
 * art exists for rotation 0 only, and art is never mirrored), and the merchandise
 * stand in both rotations (no art at all). Guides only, until the images return; the
 * importer takes them then.
 */
export const STREET_PROP_PACK_2: readonly PackGuide[] = [
  singleGuide("cabinet-r90", "mailboxes", 90, 1.8),
  singleGuide("kiosk-r0", "shop-display", 0, 1.45),
  singleGuide("kiosk-r90", "shop-display", 90, 1.45),
];

/** Where each round-two guide is seen in the saved variants, for its placement proof. */
export const STREET_PROP_PACK_2_PLACEMENT = [
  { guide: "cabinet-r90", seed: 0, cover: "housing_entry_mailboxes_cabinet" },
  { guide: "kiosk-r90", seed: 0, cover: "utility_waiting_display_cabinet" },
  { guide: "kiosk-r0", seed: 7, cover: "utility_waiting_display_cabinet" },
] as const;

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
 * The board draws the section nearer the camera in front (rotation 0: the cabin;
 * rotation 90: the engine). So the nearer section keeps exactly the pixels of its own
 * half of the CAR, padded a little for bumpers and mirrors, and the farther section
 * keeps everything else in its frame. The halves split the body at the x = 2 join,
 * but the glasshouse (windscreen and roof) goes whole to the cabin: it reads as one
 * piece, and split it would leave a roof stub over a wrecked rear. Together they rebuild the whole car with no pixel in
 * both. Cutting by the car, not by the 2 m boxes, matters: a box's hull would hand
 * the front section the windscreen and roof behind it, which shows the moment one
 * section is wrecked and the other is not.
 */
export function sedanCut(g: PackGuide) {
  const nearer = g.rotation === 0 ? "sedan-cabin" : "sedan-engine";
  const farther = nearer === "sedan-cabin" ? "sedan-engine" : "sedan-cabin";
  const pad = 0.12;
  const y0 = SEDAN.body.y0 - pad;
  const y1 = SEDAN.body.y1 + pad;
  // The halves: the engine is the bonnet and front body, to the join; the cabin is
  // the rear body from the join and the whole glasshouse, windscreen included, from
  // where it meets the bonnet. The windscreen and roof read as one piece, so they
  // never split between a wrecked half and an intact one.
  const body = (xa: number, xb: number) =>
    [xa, xb].flatMap((x) =>
      [y0, y1].flatMap((y) => [
        [x, y, 0],
        [x, y, SEDAN.hood + 0.05],
      ]),
    );
  const glass = [
    ...[SEDAN.cabin.y0 - 0.05, SEDAN.cabin.y1 + 0.05].flatMap((y) => [
      [SEDAN.windscreenFoot, y, SEDAN.hood],
      [SEDAN.cabin.x0, y, SEDAN.roof + 0.08],
      [SEDAN.cabin.x1 + 0.05, y, SEDAN.roof + 0.08],
      [SEDAN.cabin.x1 + 0.05, y, SEDAN.hood],
    ]),
    // the radio aerial stands up off the rear wing, behind the roof: it is the cabin's
    ...[y0, y1].flatMap((y) => [
      [SEDAN.cabin.x1 + 0.05, y, SEDAN.roof + SEDAN.aerial],
      [SEDAN.body.x1 + pad, y, SEDAN.roof + SEDAN.aerial],
    ]),
  ];
  const half =
    nearer === "sedan-engine"
      ? body(SEDAN.body.x0 - pad, SEDAN.join)
      : [...body(SEDAN.join, SEDAN.body.x1 + pad), ...glass];
  // The nearer section can only keep what lies inside its own art; anything of its
  // half beyond that stays with the farther section, or the car would show a hole.
  // The art is padded past the 2 m frame (`SEDAN_ART_PAD`) so that, in practice,
  // nothing of either half is beyond it.
  const own = sectionArtOnGuide(
    g,
    g.sections.findIndex((s) => s.art === nearer),
  );
  const onGuide = (pts: number[][]) =>
    clipToRect(hull(pts.map(([x, y, z]) => toGuide(g, sedanPoint(x!, y!, z!, g.rotation)))), own);
  const shape = onGuide(half);
  // Seen from the camera, the engine's box overlaps the foot of the windscreen when
  // the engine is the nearer section (rotation 90). The glass is the cabin's, so it is
  // cut out of the engine's shape: a wrecked cabin must not leave a windscreen standing.
  const hole = nearer === "sedan-engine" ? onGuide(glass) : null;
  return {
    nearer,
    farther,
    /** The nearer section keeps exactly this, less `nearerHole`; the farther keeps the rest. */
    nearerShape: shape,
    nearerHole: hole,
    keep: { [nearer]: shape, [farther]: null } as Record<string, Point[] | null>,
    exclude: { [nearer]: null, [farther]: shape } as Record<string, Point[] | null>,
  };
}

/** A convex polygon clipped to a rectangle (Sutherland-Hodgman). */
function clipToRect(
  poly: Point[],
  r: { x: number; y: number; width: number; height: number },
): Point[] {
  const edges: [(p: Point) => number, (a: Point, b: Point) => Point][] = [
    [(p) => p.x - r.x, (a, b) => lerpAt(a, b, (r.x - a.x) / (b.x - a.x))],
    [(p) => r.x + r.width - p.x, (a, b) => lerpAt(a, b, (r.x + r.width - a.x) / (b.x - a.x))],
    [(p) => p.y - r.y, (a, b) => lerpAt(a, b, (r.y - a.y) / (b.y - a.y))],
    [(p) => r.y + r.height - p.y, (a, b) => lerpAt(a, b, (r.y + r.height - a.y) / (b.y - a.y))],
  ];
  let out = poly;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    input.forEach((b, i) => {
      const a = input[(i + input.length - 1) % input.length]!;
      if (inside(b) >= 0) {
        if (inside(a) < 0) out.push(cross(a, b));
        out.push(b);
      } else if (inside(a) >= 0) out.push(cross(a, b));
    });
  }
  return out;
}
const lerpAt = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

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

/**
 * How far a section's ART reaches past its 2 m frame, in frame pixels. A car is not cut
 * by its 2 m boxes: at rotation 0 the cabin's windscreen reaches 18 px left of the
 * cabin's frame, and its aerial stands above it, so a cabin drawn inside its frame
 * alone left that piece behind on the engine, where a wrecked engine showed an intact
 * windscreen fragment and an intact engine kept the cabin's aerial. Padding is
 * presentation only: the board still places, sorts and damages the section by its
 * own 2 m footprint, and reads where the frame sits in the art from `propArtRegistration`.
 */
export const SEDAN_ART_PAD = { side: 32, top: 32 } as const;

/** The art's padding for a section kind (frame pixels): sedans only. */
export function artPad(art: string) {
  return art.startsWith("sedan-") ? SEDAN_ART_PAD : { side: 0, top: 0 };
}

/** Where a section's ART sits on the guide: its frame plus `artPad`. */
export function sectionArtOnGuide(g: PackGuide, section: number) {
  const f = sectionFrameOnGuide(g, section);
  const pad = artPad(g.sections[section]!.art);
  return {
    x: f.x - pad.side * g.scale,
    y: f.y - pad.top * g.scale,
    width: f.width + 2 * pad.side * g.scale,
    height: f.height + pad.top * g.scale,
  };
}

/**
 * How the board registers padded art: the 2 m frame's front corner is still the
 * origin, and the frame's width is still the footprint's projected width.
 */
export function propArtRegistration(art: string) {
  const pad = artPad(art);
  const width = FRAME.width + 2 * pad.side;
  return {
    originX: (pad.side + FRAME.width / 2) / width,
    originY: 1,
    groundWidth: FRAME.width / width,
  };
}

/** Loose debris (glass, panels, rubble) may lie anywhere on a wreck's 2 m ground, this low. */
export const WRECK_DEBRIS = 0.12;

/**
 * How far flat debris may lie past a wreck's own ground before the import fails. It is
 * drawn under every person and clipped at its frame, so a panel lying a little past the
 * footprint hides nothing; what the gate exists for is height.
 */
export const WRECK_APRON = 0.5;

/**
 * The volume a WRECKED image must stay inside, in guide pixels: the object's body,
 * splayed a little, up to its state's limit (`wreckedMax`), plus a thin layer of debris
 * over its 2 m ground. Wrecked remains are walkable and drawn under every person
 * (`propPlacement`), so anything taller reads as cover that is not there and is drawn
 * under the person standing behind it. Each entry is a block: its outline seen from
 * the camera (`hull`, a convex polygon) and its ceiling (`top`); the volume is their union.
 */
export function wreckVolume(
  g: PackGuide,
  /** How far flat debris may lie past the prop's own ground, in metres. */
  apron = 0,
): { hull: Point[]; top: Point[] }[] {
  const box = (
    at: (x: number, y: number, z: number) => Point,
    b: { x0: number; x1: number; y0: number; y1: number },
    z: number,
  ) => ({
    hull: hull(
      [b.x0, b.x1].flatMap((x) => [b.y0, b.y1].flatMap((y) => [at(x, y, 0), at(x, y, z)])),
    ),
    top: [at(b.x0, b.y0, z), at(b.x1, b.y0, z), at(b.x1, b.y1, z), at(b.x0, b.y1, z)],
  });
  const ground = { x0: 0.05 - apron, x1: 1.95 + apron, y0: 0.05 - apron, y1: 1.95 + apron };
  if (g.id.startsWith("sedan")) {
    const at = (x: number, y: number, z: number) => toGuide(g, sedanPoint(x, y, z, g.rotation));
    const splay = 0.08;
    const body = {
      x0: SEDAN.body.x0 - splay,
      x1: SEDAN.body.x1 + splay,
      y0: SEDAN.body.y0 - splay,
      y1: SEDAN.body.y1 + splay,
    };
    return [
      box(at, body, SEDAN.wreckedMax),
      box(at, ground, WRECK_DEBRIS),
      box(at, { ...ground, x0: 2.05 - apron, x1: 3.95 + apron }, WRECK_DEBRIS),
    ];
  }
  const at = (x: number, y: number, z: number) => toGuide(g, framePoint(x, y, z, g.rotation));
  const b =
    g.id === "planter" ? PLANTER.body : g.id.startsWith("kiosk") ? KIOSK.body : CABINET.body;
  const max =
    g.id === "planter"
      ? PLANTER.wreckedMax
      : g.id.startsWith("kiosk")
        ? KIOSK.wreckedMax
        : CABINET.wreckedMax;
  return [box(at, b, max), box(at, ground, WRECK_DEBRIS)];
}

export const PROP_STATES: readonly PropState[] = ["intact", "damaged", "wrecked"];
