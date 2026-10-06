/**
 * The architectural pilot's painted art, placed by code (`architecturePack.ts` says
 * why each is the format it is). Presentation only: nothing here reads or moves a
 * footprint, a wall, an entrance, cover or a route. Each routine draws into the sprite
 * of the building the detail belongs to, so it sorts, fades, tints and leaves with
 * that building's wall or roof; and each takes the art it needs or draws nothing, so
 * a file that failed to load leaves the drawing it replaces.
 */
import type { Point, Rect, SceneEnvironment, SceneStructure } from "@/engine";
import {
  BAY,
  ROOF_UNIT_FRAME,
  SHUTTER,
  SHUTTER_ASSEMBLY,
  type ArchitectureArt,
} from "./architecturePack";
import { framePoint } from "./streetPropPack";

type Project = (p: Point) => Point;
type Edge = "north" | "east";
type Img = CanvasImageSource & { width: number; height: number };

/** The generic face's openings: bay starts and door centres, in metres along the face. */
export function facadeOpenings(
  structure: SceneStructure,
  entrances: SceneEnvironment["entrances"],
  edge: Edge,
) {
  const r = structure.rect;
  const length = edge === "north" ? r.width : r.height;
  const doors = (entrances ?? [])
    .filter(
      (e) =>
        e.structureId === structure.id &&
        (edge === "north" ? e.position.y === r.y - 1 : e.position.x === r.x + r.width + 1),
    )
    .map((e) => (edge === "north" ? e.position.x - r.x : e.position.y - r.y));
  const step = structure.style === "residential" ? 4 : 3;
  const bays: number[] = [];
  for (let start = 0.5; start + BAY.width < length; start += step)
    if (!doors.some((door) => door > start - 1.1 && door < start + 3.3)) bays.push(start);
  return { length, doors, bays };
}

/**
 * The pilot's representative: the generic shop whose saved entrance carries an entry
 * surround (the annex across the street from the storefront, in every intersection).
 * A corner shop without its finished storefront has an awning, not a surround, and
 * keeps its drawing until the rollout is reviewed.
 */
export const isAnnex = (structure: SceneStructure, entrances: SceneEnvironment["entrances"]) =>
  structure.style === "shop" &&
  (entrances ?? []).some((e) => e.structureId === structure.id) &&
  (structure.attachments ?? []).some((a) => a.kind === "entry-surround");

/** The bay's head on a building this tall (`paintBuilding` has always drawn it so). */
const bayHead = (height: number) => Math.min(BAY.head, height - 0.3);

/**
 * Which openings of a face take the painted art. The art is one size: a bay is
 * painted only where it is the 2.2 x 1.7 m opening the window was drawn for, and a
 * door only where the shutter's housing (2.5 m) stands clear under the roof.
 */
export function annexArtFits(structure: SceneStructure) {
  return {
    window: Math.abs(bayHead(structure.height) - BAY.sill - (BAY.head - BAY.sill)) < 0.01,
    shutter: structure.height >= SHUTTER_ASSEMBLY.height + 0.2,
  };
}

/** A point on a face: `s` metres along it, `out` metres in front of it, `z` up. */
function facePoint(structure: SceneStructure, edge: Edge, project: Project, ppm: number) {
  const r = structure.rect;
  return (s: number, out: number, z: number): Point => {
    const p = project(
      edge === "north" ? { x: r.x + s, y: r.y - out } : { x: r.x + r.width + out, y: r.y + s },
    );
    return { x: p.x, y: p.y - z * ppm };
  };
}

const path = (ctx: CanvasRenderingContext2D, points: Point[]) => {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
};
const fill = (ctx: CanvasRenderingContext2D, points: Point[], colour: string) => {
  path(ctx, points);
  ctx.fillStyle = colour;
  ctx.fill();
};

/** Draw an image (or a band of its rows) onto a parallelogram: top-left, top-right, bottom-left. */
function drawOnto(
  ctx: CanvasRenderingContext2D,
  img: Img,
  p0: Point,
  p1: Point,
  p2: Point,
  rows: [number, number] = [0, 1],
) {
  const sy = rows[0] * img.height;
  const sh = (rows[1] - rows[0]) * img.height;
  ctx.save();
  ctx.transform(
    (p1.x - p0.x) / img.width,
    (p1.y - p0.y) / img.width,
    (p2.x - p0.x) / sh,
    (p2.y - p0.y) / sh,
    p0.x,
    p0.y,
  );
  ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, img.width, sh);
  ctx.restore();
}

/** A soft shadow across a parallelogram, darkest along its first edge (p0-p1), gone by p2. */
function shade(ctx: CanvasRenderingContext2D, quad: Point[], alpha: number) {
  const [p0, , , p3] = quad as [Point, Point, Point, Point];
  const g = ctx.createLinearGradient(p0.x, p0.y, p3.x, p3.y);
  g.addColorStop(0, `rgba(6,8,10,${alpha})`);
  g.addColorStop(1, "rgba(6,8,10,0)");
  path(ctx, quad);
  ctx.fillStyle = g;
  ctx.fill();
}

/** The convex hull of some points: the clip of a slice of wall and what stands off it. */
function hull(points: Point[]) {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0)
      upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** How far a detail stands in front of its wall, at most: the shutter's housing, and its sill. */
const STANDS_OFF = SHUTTER.housingDepth + 0.05;

/**
 * The painted window in one bay: the glass set back in its recess, the reveal the
 * recess shows, the head's shadow on the glass, and a projecting sill. `start` is
 * where the bay begins along the face.
 */
function paintBay(
  ctx: CanvasRenderingContext2D,
  at: ReturnType<typeof facePoint>,
  start: number,
  img: Img,
) {
  const s0 = start;
  const s1 = start + BAY.width;
  const lo = BAY.sill;
  const hi = BAY.head;
  const opening = [at(s0, 0, hi), at(s1, 0, hi), at(s1, 0, lo), at(s0, 0, lo)];
  // the recess: the reveal is the wall's own render, turned in and in shadow
  fill(ctx, opening, "#2b2a27");
  ctx.save();
  path(ctx, opening);
  ctx.clip();
  const d = -BAY.depth;
  drawOnto(ctx, img, at(s0, d, hi), at(s1, d, hi), at(s0, d, lo));
  // the head and the near jamb shade the glass; light is the renderer's, so is shadow
  shade(ctx, [at(s0, d, hi), at(s1, d, hi), at(s1, d, hi - 0.28), at(s0, d, hi - 0.28)], 0.5);
  ctx.restore();
  // the sill: a precast slab, proud of the wall
  const ends = [s0 - 0.06, s1 + 0.06] as const;
  fill(
    ctx,
    [at(ends[0], 0, lo), at(ends[1], 0, lo), at(ends[1], 0.06, lo), at(ends[0], 0.06, lo)],
    "#8c8579",
  );
  fill(
    ctx,
    [
      at(ends[0], 0.06, lo),
      at(ends[1], 0.06, lo),
      at(ends[1], 0.06, lo - 0.05),
      at(ends[0], 0.06, lo - 0.05),
    ],
    "#5a564f",
  );
  // its drip shadow on the wall below
  shade(
    ctx,
    [
      at(ends[0], 0, lo - 0.05),
      at(ends[1], 0, lo - 0.05),
      at(ends[1], 0, lo - 0.22),
      at(ends[0], 0, lo - 0.22),
    ],
    0.35,
  );
}

/**
 * The painted roller shutter at a saved entrance, centred on it: the curtain and its
 * rails in the opening, and the housing's front standing off the wall over the head,
 * with the housing's top, its near end and its shadow drawn by code.
 */
function paintShutter(
  ctx: CanvasRenderingContext2D,
  at: ReturnType<typeof facePoint>,
  edge: Edge,
  centre: number,
  img: Img,
) {
  const half = SHUTTER_ASSEMBLY.width / 2;
  const s0 = centre - half;
  const s1 = centre + half;
  const head = SHUTTER.opening.height;
  const top = SHUTTER_ASSEMBLY.height;
  const housing = SHUTTER.housingHeight / SHUTTER_ASSEMBLY.height;
  const depth = SHUTTER.housingDepth;
  // the curtain and the rails, in the wall's plane
  drawOnto(ctx, img, at(s0, 0, head), at(s1, 0, head), at(s0, 0, 0), [housing, 1]);
  // the housing's shadow on the curtain and wall under it
  shade(ctx, [at(s0, 0, head), at(s1, 0, head), at(s1, 0, head - 0.3), at(s0, 0, head - 0.3)], 0.5);
  // the housing: its near end (the camera sees the +x end of a north face, the -y end
  // of an east face), its front, which is the art's top rows, and its top
  const end = edge === "north" ? s1 : s0;
  fill(
    ctx,
    [at(end, 0, head), at(end, depth, head), at(end, depth, top), at(end, 0, top)],
    "#3f4341",
  );
  drawOnto(ctx, img, at(s0, depth, top), at(s1, depth, top), at(s0, depth, head), [0, housing]);
  fill(ctx, [at(s0, 0, top), at(s1, 0, top), at(s1, depth, top), at(s0, depth, top)], "#767a76");
}

/**
 * The painted openings of one face of a generic shop: its bays and its doors at
 * saved entrances. With `clip`, only the slice of the face a cutaway piece is
 * (`s0`-`s1` along it, up to `zMax`), so revealing the street never removes an
 * opening or leaves one floating.
 */
export function paintFacadeArt({
  ctx,
  structure,
  edge,
  project,
  ppm,
  art,
  entrances,
  clip,
}: {
  ctx: CanvasRenderingContext2D;
  structure: SceneStructure;
  edge: Edge;
  project: Project;
  ppm: number;
  art: ArchitectureArt;
  entrances: SceneEnvironment["entrances"];
  clip?: { s0: number; s1: number; zMax: number };
}) {
  const fits = annexArtFits(structure);
  const windowArt = fits.window ? (art.window as Img | undefined) : undefined;
  const shutterArt = fits.shutter ? (art.shutter as Img | undefined) : undefined;
  if (!windowArt && !shutterArt) return;
  const at = facePoint(structure, edge, project, ppm);
  const { bays, doors } = facadeOpenings(structure, entrances, edge);
  ctx.save();
  if (clip) {
    path(
      ctx,
      hull(
        [clip.s0, clip.s1].flatMap((s) =>
          [0, STANDS_OFF].flatMap((out) => [0, clip.zMax].map((z) => at(s, out, z))),
        ),
      ),
    );
    ctx.clip();
  }
  if (windowArt) for (const start of bays) paintBay(ctx, at, start, windowArt);
  if (shutterArt) for (const centre of doors) paintShutter(ctx, at, edge, centre, shutterArt);
  ctx.restore();
}

/** Whether `paintFacadeArt` paints this face's bays and doors (so the drawing must not). */
export function facadeArtCovers(structure: SceneStructure, art: ArchitectureArt | undefined) {
  const fits = annexArtFits(structure);
  return { bays: !!(art?.window && fits.window), doors: !!(art?.shutter && fits.shutter) };
}

/**
 * Frame pixels to scene pixels, for a unit standing at `eq` on a roof `roofH` scene
 * pixels up: the affine map that takes the frame's 2 m footprint onto the saved one.
 */
export function roofUnitTransform(project: Project, eq: Rect, roofH: number) {
  const scene = (x: number, y: number) => {
    const p = project({ x: eq.x + x, y: eq.y + y });
    return { x: p.x, y: p.y - roofH };
  };
  const [fa, fb, fc] = [framePoint(0, 0), framePoint(2, 0), framePoint(0, 2)];
  const [sa, sb, sc] = [scene(0, 0), scene(2, 0), scene(0, 2)];
  // solve M [fb - fa, fc - fa] = [sb - sa, sc - sa]
  const u = { x: fb.x - fa.x, y: fb.y - fa.y };
  const v = { x: fc.x - fa.x, y: fc.y - fa.y };
  const det = u.x * v.y - u.y * v.x;
  const su = { x: sb.x - sa.x, y: sb.y - sa.y };
  const sv = { x: sc.x - sa.x, y: sc.y - sa.y };
  const a = (su.x * v.y - sv.x * u.y) / det;
  const c = (sv.x * u.x - su.x * v.x) / det;
  const b = (su.y * v.y - sv.y * u.y) / det;
  const d = (sv.y * u.x - su.y * v.x) / det;
  const e = sa.x - a * fa.x - c * fa.y;
  const f = sa.y - b * fa.x - d * fa.y;
  return { a, b, c, d, e, f };
}

/**
 * The painted rooftop unit, standing on its saved 2 x 2 m footprint in place of the
 * drawn box, with the contact shade under it drawn by `paintShade`.
 */
export function paintRoofUnitArt(
  ctx: CanvasRenderingContext2D,
  project: Project,
  eq: Rect,
  roofH: number,
  img: CanvasImageSource,
) {
  const m = roofUnitTransform(project, eq, roofH);
  ctx.save();
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(img, 0, ROOF_UNIT_FRAME.top, ROOF_UNIT_FRAME.width, ROOF_UNIT_FRAME.height);
  ctx.restore();
}
