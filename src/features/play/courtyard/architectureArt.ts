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
  ROOF_UNIT,
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
 * The pilot's representative: the generic shop whose saved entrance carries the housing
 * portal (the annex across the street from the storefront, in every intersection).
 * Only it takes the painted shutter. Other shop and studio portals keep their drawn
 * doors, even when they also have an entry surround.
 */
export const isAnnex = (structure: SceneStructure, entrances: SceneEnvironment["entrances"]) =>
  structure.style === "shop" &&
  (entrances ?? []).some((e) => e.structureId === structure.id) &&
  (structure.attachments ?? []).some(
    (a) => a.kind === "entry-surround" && a.id === "housing-portal",
  );

/** What a commercial face takes from the pilot's art. */
export interface ShopFace {
  art: ArchitectureArt;
  /** The faces it is painted on. */
  edges: Edge[];
  /** Its doors are painted shutters (the annex). */
  doors: boolean;
  /** Its wall, roof edge and base are finished to sit with the art. */
  finish: boolean;
}

/**
 * Which commercial faces take the painted window, and what else. Only `shop` masses:
 * residential and industrial openings keep their own drawing. The storefront's own
 * face keeps its lit interior and its neighbours their barred, quiet windows; every
 * other shop face, the storefront's other face included, takes the window (a back
 * office and storeroom: the art was painted as the same building's). The shutter is
 * the annex's alone, and the finished wall is for shops outside the storefront's
 * block (that block has its own, `frontage.ts`).
 */
export function shopFace(
  structure: SceneStructure,
  entrances: SceneEnvironment["entrances"],
  art: ArchitectureArt | undefined,
  storefront: boolean,
  role: "shop" | "neighbour" | undefined,
): ShopFace | undefined {
  if (!art || structure.style !== "shop" || role === "neighbour") return undefined;
  const inBlock = storefront || role !== undefined;
  return {
    art,
    edges: ["north", "east"],
    doors: !inBlock && isAnnex(structure, entrances),
    finish: !inBlock,
  };
}

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

/**
 * The art, filtered down to between one and two times the size it is about to be drawn at.
 *
 * Painted art is drawn into a building's texture at 8-13x reduction (a shutter slat,
 * 41 px in the file, is 3 texture pixels). One `drawImage` that far down samples a
 * few source pixels per output pixel and skips the rest, so the slats' joint lines
 * beat against the texture grid: the shutter's "ripple" and the blind's cross-hatch,
 * baked into the texture and the same at every camera zoom. Halving repeatedly first
 * (each halving averages every source pixel) removes it. The result is cached per
 * image and per number of halvings, so a scene builds each size once.
 */
const prefiltered = new WeakMap<object, Img[]>();
export function sourceFor(img: Img, deviceWidth: number, deviceHeight: number): Img {
  if (typeof document === "undefined") return img;
  const halvings = Math.floor(
    Math.max(0, Math.min(Math.log2(img.width / deviceWidth), Math.log2(img.height / deviceHeight))),
  );
  if (!halvings || !Number.isFinite(halvings)) return img;
  let chain = prefiltered.get(img);
  if (!chain) prefiltered.set(img, (chain = [img]));
  for (let i = chain.length; i <= halvings; i++) {
    const from = chain[i - 1]!;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(from.width / 2));
    canvas.height = Math.max(1, Math.round(from.height / 2));
    const c = canvas.getContext("2d")!;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(from, 0, 0, canvas.width, canvas.height);
    chain.push(canvas);
  }
  return chain[halvings]!;
}

/** How many device pixels a vector in the context's current user space spans. */
function deviceLength(ctx: CanvasRenderingContext2D, dx: number, dy: number) {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : undefined;
  if (!t) return Math.hypot(dx, dy);
  return Math.hypot(t.a * dx + t.c * dy, t.b * dx + t.d * dy);
}

/**
 * Draw an image, or a rectangle of it (`rows` and `cols` as fractions), onto a
 * parallelogram: top-left, top-right, bottom-left.
 */
export function drawOnto(
  ctx: CanvasRenderingContext2D,
  img: Img,
  p0: Point,
  p1: Point,
  p2: Point,
  rows: [number, number] = [0, 1],
  cols: [number, number] = [0, 1],
) {
  const bandH = rows[1] - rows[0];
  const bandW = cols[1] - cols[0];
  img = sourceFor(
    img,
    deviceLength(ctx, p1.x - p0.x, p1.y - p0.y) / bandW,
    deviceLength(ctx, p2.x - p0.x, p2.y - p0.y) / bandH,
  );
  const sx = cols[0] * img.width;
  const sw = bandW * img.width;
  const sy = rows[0] * img.height;
  const sh = bandH * img.height;
  ctx.save();
  ctx.transform(
    (p1.x - p0.x) / sw,
    (p1.y - p0.y) / sw,
    (p2.x - p0.x) / sh,
    (p2.y - p0.y) / sh,
    p0.x,
    p0.y,
  );
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.restore();
}

/** A soft shadow across a parallelogram, darkest along its first edge (p0-p1), gone by p2. */
function shade(ctx: CanvasRenderingContext2D, quad: Point[], alpha: number, rgb = "6,8,10") {
  const [p0, , , p3] = quad as [Point, Point, Point, Point];
  const g = ctx.createLinearGradient(p0.x, p0.y, p3.x, p3.y);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  path(ctx, quad);
  ctx.fillStyle = g;
  ctx.fill();
}

const line = (ctx: CanvasRenderingContext2D, a: Point, b: Point, colour: string, width: number) => {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
};

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
 * The window's panes, as fractions of the imported image (`annex-window.webp`, the
 * 2.2 x 1.7 m opening): the frame and mullion are `BAY`'s, which the importer put
 * the art's own bands on exactly. The painted blind hangs in the left pane down to
 * `blindFoot`, measured on the imported image (rows 45-325 of 791).
 */
export const WINDOW_PANES = (() => {
  const w = BAY.width;
  const h = BAY.head - BAY.sill;
  const frameX = BAY.frame / w;
  const frameY = BAY.frame / h;
  const mid = 0.5;
  const half = BAY.mullion / w / 2;
  return {
    left: { x0: frameX, x1: mid - half },
    right: { x0: mid + half, x1: 1 - frameX },
    y0: frameY,
    y1: 1 - frameY,
    blindTop: 45 / 791,
    blindFoot: 325 / 791,
  };
})();

/**
 * Four ways one window can look, so a row of them does not repeat: as painted; with
 * its panes swapped (each pane is a whole composition, so nothing is mirrored);
 * and each of those with the painted blind's own slats let down part-way over the
 * other pane. A variant is built once per image and cached.
 */
export const WINDOW_VARIANTS = [
  { swap: false, blind: 0 },
  { swap: true, blind: 0 },
  { swap: false, blind: 0.22 },
  { swap: true, blind: 0.34 },
] as const;
const variants = new WeakMap<object, Img[]>();
export function windowVariant(img: Img, index: number): Img {
  const v = WINDOW_VARIANTS[index % WINDOW_VARIANTS.length]!;
  if ((!v.swap && !v.blind) || typeof document === "undefined") return img;
  let cache = variants.get(img);
  if (!cache) variants.set(img, (cache = []));
  if (cache[index]) return cache[index]!;
  const W = img.width;
  const H = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  c.drawImage(img, 0, 0);
  const P = WINDOW_PANES;
  const y0 = P.y0 * H;
  const ph = (P.y1 - P.y0) * H;
  const pane = (side: "left" | "right") => ({
    x: P[side].x0 * W,
    w: (P[side].x1 - P[side].x0) * W,
  });
  const L = pane("left");
  const R = pane("right");
  if (v.swap) {
    c.drawImage(img, R.x, y0, R.w, ph, L.x, y0, L.w, ph);
    c.drawImage(img, L.x, y0, L.w, ph, R.x, y0, R.w, ph);
  }
  if (v.blind) {
    // the blind's lowest slats and its bottom rail, from the left pane of the art,
    // let down from the head of the pane that has no blind
    const into = v.swap ? L : R;
    const drop = Math.min(v.blind, P.blindFoot - P.blindTop) * H;
    c.drawImage(img, L.x, P.blindFoot * H - drop, L.w, drop, into.x, P.blindTop * H, into.w, drop);
  }
  cache[index] = canvas;
  return canvas;
}

/** A small, stable hash: the same bay always gets the same variant. */
export function variantOf(...parts: (string | number)[]) {
  let h = 2166136261;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % WINDOW_VARIANTS.length;
}

/**
 * The painted window in one bay: the glass set back in its recess, the reveal the
 * recess shows (its floor lit, its jamb and head in shade), the head's shadow on the
 * glass, and a precast sill proud of the wall. `start` is where the bay begins along
 * the face.
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
  const d = -BAY.depth;
  const O = [at(s0, 0, hi), at(s1, 0, hi), at(s1, 0, lo), at(s0, 0, lo)];
  const G = [at(s0, d, hi), at(s1, d, hi), at(s1, d, lo), at(s0, d, lo)];
  ctx.save();
  path(ctx, O);
  ctx.clip();
  // the reveal: the wall turned in. Its floor faces the sky; its sides and head do not
  fill(ctx, O, "#1f1e1c");
  fill(ctx, [O[3]!, O[2]!, G[2]!, G[3]!], "#5d574d");
  fill(ctx, [O[0]!, O[3]!, G[3]!, G[0]!], "#2d2b27");
  fill(ctx, [O[1]!, O[2]!, G[2]!, G[1]!], "#2d2b27");
  drawOnto(ctx, img, G[0]!, G[1]!, G[3]!);
  // the head shades the top of the glass; light is the renderer's, so is shadow
  shade(ctx, [G[0]!, G[1]!, at(s1, d, hi - 0.28), at(s0, d, hi - 0.28)], 0.5);
  // a faint sky sheen on the frame's head and near jamb keeps the frame readable at
  // play zoom without an outline
  line(ctx, at(s0 + 0.02, d, hi - 0.03), at(s1 - 0.02, d, hi - 0.03), "rgba(196,182,150,.22)", 0.7);
  ctx.restore();
  // the sill: a precast slab, 8 cm proud and 6 cm thick, its top catching the sky
  const e0 = s0 - 0.07;
  const e1 = s1 + 0.07;
  const out = 0.08;
  fill(ctx, [at(e0, 0, lo), at(e1, 0, lo), at(e1, out, lo), at(e0, out, lo)], "#9a9283");
  fill(
    ctx,
    [at(e0, out, lo), at(e1, out, lo), at(e1, out, lo - 0.06), at(e0, out, lo - 0.06)],
    "#5b564e",
  );
  line(ctx, at(e0, out, lo), at(e1, out, lo), "rgba(214,204,184,.55)", 0.8);
  // its drip shadow on the wall, and the faint streaks from its ends
  shade(
    ctx,
    [at(e0, 0, lo - 0.06), at(e1, 0, lo - 0.06), at(e1, 0, lo - 0.26), at(e0, 0, lo - 0.26)],
    0.38,
  );
  for (const s of [e0 + 0.05, e1 - 0.09])
    shade(
      ctx,
      [
        at(s, 0, lo - 0.06),
        at(s + 0.04, 0, lo - 0.06),
        at(s + 0.04, 0, lo - 0.55),
        at(s, 0, lo - 0.55),
      ],
      0.18,
      "30,24,16",
    );
}

/**
 * The painted roller shutter at a saved entrance, centred on it: the curtain and its
 * rails in the opening, and the housing standing off the wall over the head. Its
 * front is the art's top rows; its top and near end are the same painted steel (the
 * housing front's own texture, laid on those planes), lit as a top and an end are.
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
  // the near end (the camera sees the +x end of a north face, the -y end of an east
  // face): the housing front's end cap, turned onto the end and in shade
  const end = edge === "north" ? s1 : s0;
  const cap = depth / SHUTTER_ASSEMBLY.width;
  const endFace = [at(end, 0, top), at(end, depth, top), at(end, depth, head), at(end, 0, head)];
  drawOnto(
    ctx,
    img,
    endFace[0]!,
    endFace[1]!,
    endFace[3]!,
    [0, housing],
    edge === "north" ? [1 - cap, 1] : [0, cap],
  );
  fill(ctx, endFace, "rgba(8,10,12,.42)");
  // the front
  drawOnto(ctx, img, at(s0, depth, top), at(s1, depth, top), at(s0, depth, head), [0, housing]);
  // the top: the same steel seen from above, a band of the front's own texture, with
  // the sky on it and its front arris catching it
  const topFace = [at(s0, 0, top), at(s1, 0, top), at(s1, depth, top), at(s0, depth, top)];
  drawOnto(ctx, img, topFace[0]!, topFace[1]!, topFace[3]!, [
    0.01,
    0.01 + depth / SHUTTER_ASSEMBLY.height,
  ]);
  fill(ctx, topFace, "rgba(205,212,208,.14)");
  line(ctx, topFace[3]!, topFace[2]!, "rgba(220,224,216,.5)", 0.7);
  // where the housing meets the wall
  line(ctx, topFace[0]!, topFace[1]!, "rgba(6,8,10,.5)", 0.8);
}

/**
 * The wall of a generic shop that takes the painted openings, finished to sit with
 * them: a rendered plinth on its solid stretches, a shallow pier at each end of the
 * face, the coping's drip line of grime under the roof edge, and a little wear at
 * the foot of each pier. Restrained on purpose; light and night are the renderer's.
 */
export function paintShopWall({
  ctx,
  structure,
  edge,
  project,
  ppm,
  entrances,
  doors,
  clip,
}: {
  ctx: CanvasRenderingContext2D;
  structure: SceneStructure;
  edge: Edge;
  project: Project;
  ppm: number;
  entrances: SceneEnvironment["entrances"];
  /** Whether this wall's doors are painted shutters (their width is the assembly's). */
  doors: boolean;
  clip?: { s0: number; s1: number; zMax: number };
}) {
  const at = facePoint(structure, edge, project, ppm);
  const { length, bays, doors: centres } = facadeOpenings(structure, entrances, edge);
  const h = structure.height;
  const openings: [number, number][] = [
    ...bays.map((b): [number, number] => [b - 0.07, b + BAY.width + 0.07]),
    ...centres.map((c): [number, number] =>
      doors ? [c - SHUTTER_ASSEMBLY.width / 2, c + SHUTTER_ASSEMBLY.width / 2] : [c - 0.9, c + 0.9],
    ),
  ];
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
  // grime washed down from the roof edge, under the coping's drip
  shade(
    ctx,
    [at(0, 0, h - 0.06), at(length, 0, h - 0.06), at(length, 0, h - 0.5), at(0, 0, h - 0.5)],
    0.22,
    "24,20,14",
  );
  // the plinth: rendered, 30 cm, 2 cm proud, splash grime above it
  const plinth = 0.3;
  for (const [a, b] of solidStretches(length, openings)) {
    shade(
      ctx,
      [at(a, 0, plinth), at(b, 0, plinth), at(b, 0, plinth + 0.5), at(a, 0, plinth + 0.5)],
      0.24,
      "22,18,12",
    );
    fill(
      ctx,
      [at(a, 0.02, 0), at(b, 0.02, 0), at(b, 0.02, plinth), at(a, 0.02, plinth)],
      "#3a3d3b",
    );
    line(ctx, at(a, 0.02, plinth), at(b, 0.02, plinth), "rgba(150,150,140,.6)", 0.8);
    line(ctx, at(a, 0.02, 0.01), at(b, 0.02, 0.01), "rgba(0,0,0,.6)", 1.4);
  }
  // a shallow pier at each end of the face: its face, its lit arris, its side in shade
  const pier = 0.18;
  for (const [a, b] of [
    [0, pier],
    [length - pier, length],
  ] as const) {
    fill(
      ctx,
      [at(a, 0.03, 0), at(b, 0.03, 0), at(b, 0.03, h - 0.05), at(a, 0.03, h - 0.05)],
      "rgba(150,150,142,.16)",
    );
    line(ctx, at(a, 0.03, plinth), at(a, 0.03, h - 0.05), "rgba(205,200,186,.35)", 0.7);
    line(ctx, at(b, 0.03, plinth), at(b, 0.03, h - 0.05), "rgba(6,8,10,.45)", 0.9);
    shade(
      ctx,
      [
        at(a, 0.03, plinth),
        at(b, 0.03, plinth),
        at(b, 0.03, plinth + 0.35),
        at(a, 0.03, plinth + 0.35),
      ],
      0.2,
      "26,22,16",
    );
  }
  ctx.restore();
}

/** A face's solid stretches between its openings. */
function solidStretches(length: number, openings: [number, number][]): [number, number][] {
  let out: [number, number][] = [[0, length]];
  for (const [p, q] of openings)
    out = out.flatMap(([a, b]): [number, number][] =>
      q <= a || p >= b
        ? [[a, b]]
        : [
            ...(p > a ? [[a, p] as [number, number]] : []),
            ...(q < b ? [[q, b] as [number, number]] : []),
          ],
    );
  return out.filter(([a, b]) => b - a > 0.05);
}

/**
 * The painted openings of one face of a generic shop: its bays, and (`doors`) its
 * shutters at saved entrances. With `clip`, only the slice of the face a cutaway
 * piece is (`s0`-`s1` along it, up to `zMax`), so revealing the street never removes
 * an opening or leaves one floating.
 */
export function paintFacadeArt({
  ctx,
  structure,
  edge,
  project,
  ppm,
  art,
  entrances,
  doors = true,
  clip,
  skip,
}: {
  ctx: CanvasRenderingContext2D;
  structure: SceneStructure;
  edge: Edge;
  project: Project;
  ppm: number;
  art: ArchitectureArt;
  entrances: SceneEnvironment["entrances"];
  doors?: boolean;
  clip?: { s0: number; s1: number; zMax: number };
  /** Bays painted by another routine (the shop's composed return, `streetfront.ts`). */
  skip?: readonly number[];
}) {
  const fits = annexArtFits(structure);
  const windowArt = fits.window ? (art.window as Img | undefined) : undefined;
  const shutterArt = doors && fits.shutter ? (art.shutter as Img | undefined) : undefined;
  if (!windowArt && !shutterArt) return;
  const at = facePoint(structure, edge, project, ppm);
  const { bays, doors: centres } = facadeOpenings(structure, entrances, edge);
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
  if (windowArt)
    for (const start of bays.filter((b) => !skip?.includes(b)))
      paintBay(ctx, at, start, windowVariant(windowArt, variantOf(structure.id, edge, start)));
  if (shutterArt) for (const centre of centres) paintShutter(ctx, at, edge, centre, shutterArt);
  ctx.restore();
}

/** Whether `paintFacadeArt` paints this face's bays and doors (so the drawing must not). */
export function facadeArtCovers(
  structure: SceneStructure,
  art: ArchitectureArt | undefined,
  doors = true,
) {
  const fits = annexArtFits(structure);
  return {
    bays: !!(art?.window && fits.window),
    doors: !!(doors && art?.shutter && fits.shutter),
  };
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
  const W = ROOF_UNIT_FRAME.width;
  const H = ROOF_UNIT_FRAME.height;
  const source = sourceFor(
    img as Img,
    deviceLength(ctx, m.a * W, m.b * W),
    deviceLength(ctx, m.c * H, m.d * H),
  );
  ctx.save();
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, ROOF_UNIT_FRAME.top, W, H);
  ctx.restore();
}

/**
 * Where a roof's service units stand: up to three 2 x 2 m footprints, 3 m apart along
 * the roof, as `paintBuilding` has always placed its boxes. One list for the albedo
 * and the light, so the light can never stand anywhere the unit does not.
 */
export function rooftopUnits(structure: SceneStructure): Rect[] {
  const r = structure.rect;
  return Array.from(
    { length: Math.max(0, Math.min(3, Math.floor((r.width - 1) / 3))) },
    (_, i) => ({
      x: r.x + 0.5 + i * 3,
      y: r.y + Math.min(3, r.height - 2.5),
      width: ROOF_UNIT.footprint,
      height: ROOF_UNIT.footprint,
    }),
  );
}

/**
 * The light that falls on a roof carrying painted units: the pool on the roof, less
 * where a unit stands on it, and the pool on each unit at the unit's own lid height,
 * inside the unit's own silhouette (the painted art, drawn as a mask from the same
 * registration the albedo uses). Added to `ctx` (the light pass composites with
 * "lighter"); the renderer then multiplies it by the albedo, so the light shows the
 * painting's detail, and clips it to the albedo's pixels, so no rectangle of light
 * is left round a unit. Nothing is lit twice and no shadow is drawn here.
 */
export function paintRoofUnitLight(
  ctx: CanvasRenderingContext2D,
  project: Project,
  roof: Point[],
  units: readonly Rect[],
  roofH: number,
  img: CanvasImageSource,
  pool: (c: CanvasRenderingContext2D, lift: number) => void,
) {
  if (typeof document === "undefined" || !ctx.canvas) return;
  const transform = ctx.getTransform();
  const layer = (paint: (c: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement("canvas");
    canvas.width = ctx.canvas.width;
    canvas.height = ctx.canvas.height;
    const c = canvas.getContext("2d")!;
    c.setTransform(transform);
    paint(c);
    return canvas;
  };
  const silhouettes = (c: CanvasRenderingContext2D) => {
    for (const eq of units) paintRoofUnitArt(c, project, eq, roofH, img);
  };
  const lit = layer((c) => {
    c.save();
    path(c, roof);
    c.clip();
    pool(c, roofH);
    c.restore();
    c.globalCompositeOperation = "destination-out";
    silhouettes(c);
  });
  // every unit's silhouette in one mask, applied once (masking unit by unit with
  // destination-in would keep only where all the units overlap: nowhere)
  const mask = layer(silhouettes);
  const onUnits = layer((c) => {
    pool(c, roofH + ROOF_UNIT.heightPx);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "destination-in";
    c.drawImage(mask, 0, 0);
    c.restore();
  });
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lit, 0, 0);
  ctx.drawImage(onUnits, 0, 0);
  ctx.restore();
}
