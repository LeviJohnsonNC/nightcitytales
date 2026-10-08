/**
 * The shop's other elevations: the faces of the storefront's own building that the
 * camera sees and that are not its shopfront. Where the shopfront faces away (seed 0
 * puts the awning on a face the camera never sees) this is the only face of the shop
 * the player sees, and it used to be a row of identical storeroom windows that said
 * nothing about the night market behind it.
 *
 * Composed from the saved bays, nothing added to the plan:
 *
 *   - **Two storeys of material.** A concrete ground storey under a precast string
 *     course, and a rendered fascia band above it to the coping.
 *   - **The shop turns the corner.** The bays nearest the corner the shopfront is on
 *     are display windows: the shop's lit interior behind the glass, a stall riser
 *     under it, an aluminium frame, and the shop's name over them on the fascia.
 *   - **Back of house.** The other bays keep the storeroom window. One of them, far
 *     from the corner, has its roller grille down. The kitchen's extract duct runs up
 *     the pier beside the display, over the coping.
 *
 * Every opening is the saved bay at its saved size and place (0.65-2.35 m, 2.2 m
 * wide). Presentation only: no collision, door, entrance or route is added.
 */
import type { Point, SceneEnvironment, SceneStructure } from "@/engine";
import { paintShopFinish, paintShopCornice, paintRetailFrames } from "./shopFinish";
import { BAY } from "./architecturePack";
import { facadeOpenings, sourceFor } from "./architectureArt";
import { edgeFrame, exposedSpans, type Edge } from "./frontage";
import { lightColor, type GroundLight, type NightLighting } from "./nightLighting";
import { STOREFRONT_SIGN } from "./storefrontPack";
import { fillMaterial, SURFACE_MATERIALS, wallBasis, type MaterialSet } from "./surfaceMaterials";
import type { TileSource } from "./surfaceMaterials";
import { paintWindowSurround } from "./wallLight";

type Project = (p: Point) => Point;
type Img = TileSource | HTMLCanvasElement;

/** Heights and sizes on a return face, in metres. */
export const RETURN = {
  /** The precast string course between the ground storey and the fascia band. */
  course: 2.72,
  courseTop: 2.84,
  courseProud: 0.06,
  /** The display bays' stall riser stands under the saved sill. */
  riserInset: 0.08,
  /** The shop's name over its display, as on the shopfront: four cells. */
  sign: { height: 0.72, cell: 0.5, maxWidth: 2.5, z0: 2.93, proud: 0.05, bold: 0.014 },
  /** The kitchen extract: a louvred box on the pier, its duct up and over the coping. */
  duct: { width: 0.36, proud: 0.24, box: [1.7, 2.25] as const, over: 0.35 },
  /** How far from the shopfront's corner a bay may be and still be shop. */
  displayReach: 11,
} as const;

/** One composed face of the shop's own building. */
export interface ReturnFace {
  structure: SceneStructure;
  edge: Edge;
  length: number;
  /** Bays (their start along the face) that show the shop. */
  display: number[];
  /** The storeroom bays, painted with the existing window art. */
  store: number[];
  /** A storeroom bay with its grille down. */
  grille?: number;
  /** Where the extract duct's centre stands along the face. */
  duct?: number;
  /** The fascia sign over the display, along the face. */
  sign?: { s0: number; s1: number };
}

/** The face the awning hangs on, for a building with a shop canopy. */
const awningEdge = (s: SceneStructure) =>
  (s.attachments ?? []).find((a) => a.kind === "awning")?.edge as
    "north" | "east" | "south" | "west" | undefined;

/**
 * Which end of a camera-facing face meets the shopfront, if any: the north face runs
 * along x (s = 0 at its west end), the east face along y (s = 0 at its north end).
 */
function cornerOf(face: Edge, front: "north" | "east" | "south" | "west", length: number) {
  if (face === "north") return front === "west" ? 0 : front === "east" ? length : undefined;
  return front === "north" ? 0 : front === "south" ? length : undefined;
}

/**
 * The shop's composed faces: each camera-facing face of a building with a shop
 * canopy, other than the canopy's own, that meets the shopfront at a corner and has
 * bays to compose. `pipeAt` lists where a downpipe already stands on that face.
 */
export function shopReturns(
  env: Pick<SceneEnvironment, "structures" | "entrances">,
  pipeAt: (structure: SceneStructure, edge: Edge) => number | undefined = () => undefined,
): ReturnFace[] {
  const out: ReturnFace[] = [];
  for (const structure of env.structures) {
    if (structure.style !== "shop") continue;
    const front = awningEdge(structure);
    if (!front) continue;
    for (const edge of ["north", "east"] as const) {
      if (edge === front) continue;
      const { length, bays, doors } = facadeOpenings(structure, env.entrances, edge);
      const corner = cornerOf(edge, front, length);
      if (corner === undefined || doors.length || bays.length < 2) continue;
      // only what stands in open air: a bay behind a neighbour is never seen
      const open = exposedSpans(structure, edge, env.structures);
      const seen = bays.filter((b) => open.some(([a, z]) => b >= a && b + BAY.width <= z));
      if (seen.length < 2) continue;
      const distance = (b: number) => (corner === 0 ? b : Math.max(0, corner - (b + BAY.width)));
      const near = [...seen].sort((a, b) => distance(a) - distance(b));
      const count = Math.min(seen.length >= 5 ? 3 : 2, seen.length);
      const display = near
        .slice(0, count)
        .filter((b) => distance(b) < RETURN.displayReach)
        .sort((a, b) => a - b);
      if (!display.length) continue;
      const store = seen.filter((b) => !display.includes(b));
      // the grille: the storeroom bay furthest from the shop, on a long enough face
      const far = [...store].sort((a, b) => distance(b) - distance(a));
      const grille = store.length >= 2 ? far[0] : undefined;
      // the extract: on the pier between the display and the first storeroom bay
      const inner = corner === 0 ? display[display.length - 1]! + BAY.width : display[0]!;
      const next =
        corner === 0
          ? store.filter((b) => b >= inner).sort((a, b) => a - b)[0]
          : store
              .filter((b) => b + BAY.width <= inner)
              .sort((a, b) => b - a)
              .map((b) => b + BAY.width)[0];
      let duct: number | undefined;
      if (next !== undefined) {
        const [a, b] = corner === 0 ? [inner, next] : [next, inner];
        const pipe = pipeAt(structure, edge);
        const centre = (a + b) / 2;
        if (
          b - a >= RETURN.duct.width + 0.3 &&
          (pipe === undefined || Math.abs(pipe - centre) > 0.6)
        )
          duct = centre;
      }
      const run0 = display[0]!,
        run1 = display[display.length - 1]! + BAY.width;
      const width = Math.min(RETURN.sign.maxWidth, run1 - run0);
      const mid = (run0 + run1) / 2;
      out.push({
        structure,
        edge,
        length,
        display,
        store,
        ...(grille !== undefined ? { grille } : {}),
        ...(duct !== undefined ? { duct } : {}),
        sign: { s0: mid - width / 2, s1: mid + width / 2 },
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ drawing */

function faceAt(structure: SceneStructure, edge: Edge, project: Project, ppm: number) {
  const f = edgeFrame(structure.rect, edge);
  return (s: number, out: number, z: number): Point => {
    const p = project(f.world(s, out));
    return { x: p.x, y: p.y - z * ppm };
  };
}
type At = ReturnType<typeof faceAt>;

const path = (ctx: CanvasRenderingContext2D, pts: readonly Point[]) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
};
const fill = (ctx: CanvasRenderingContext2D, pts: readonly Point[], colour: string) => {
  path(ctx, pts);
  ctx.fillStyle = colour;
  ctx.fill();
};
const line = (ctx: CanvasRenderingContext2D, a: Point, b: Point, colour: string, width: number) => {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
};
const ramp = (
  ctx: CanvasRenderingContext2D,
  pts: readonly Point[],
  from: Point,
  to: Point,
  stops: [number, string][],
) => {
  const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  for (const [t, c] of stops) g.addColorStop(t, c);
  path(ctx, pts);
  ctx.fillStyle = g;
  ctx.fill();
};
const quadOf =
  (at: At) =>
  (s0: number, s1: number, z0: number, z1: number, out = 0) => [
    at(s0, out, z0),
    at(s1, out, z0),
    at(s1, out, z1),
    at(s0, out, z1),
  ];

/** Draw a crop of `img` flat on the face plane, filling s0-s1 by z0-z1, `out` from the wall. */
function drawCrop(
  ctx: CanvasRenderingContext2D,
  at: At,
  img: Img,
  s0: number,
  s1: number,
  z0: number,
  z1: number,
  out: number,
) {
  // cover: the image's aspect kept, centred, its sides cropped
  const aspect = (s1 - s0) / (z1 - z0);
  const p = at(s0, out, z1),
    right = at(s1, out, z1),
    foot = at(s0, out, z0);
  const t = ctx.getTransform();
  const device = (q: Point) =>
    Math.hypot(t.a * (q.x - p.x) + t.c * (q.y - p.y), t.b * (q.x - p.x) + t.d * (q.y - p.y));
  const fraction = Math.min(1, (img.height * aspect) / img.width);
  img = sourceFor(img, device(right) / fraction, device(foot));
  const sh = img.height;
  const sw = Math.min(img.width, sh * aspect);
  const sx = (img.width - sw) / 2;
  const o = at(s0, out, z1);
  const u = at(s0 + 1, out, z1);
  const v = at(s0, out, z1 - 1);
  ctx.save();
  ctx.transform(
    ((u.x - o.x) * (s1 - s0)) / sw,
    ((u.y - o.y) * (s1 - s0)) / sw,
    ((v.x - o.x) * (z1 - z0)) / sh,
    ((v.y - o.y) * (z1 - z0)) / sh,
    o.x,
    o.y,
  );
  ctx.drawImage(img, sx, 0, sw, sh, 0, 0, sw, sh);
  ctx.restore();
}

/**
 * A sign mask is 256 px a glyph and is drawn at 15-40 px a glyph: one `drawImage` that
 * far down breaks the strokes into stray pixels. Halve it, smoothed, to a quarter
 * first (the same prefilter `sourceFor` gives painted art), then tint the small copy.
 */
const SIGN_PREFILTER = 2;
const tinted = new WeakMap<object, Map<string, HTMLCanvasElement>>();
function tint(mask: Img, colour: string) {
  let byColour = tinted.get(mask);
  if (!byColour) tinted.set(mask, (byColour = new Map()));
  const hit = byColour.get(colour);
  if (hit) return hit;
  let source: Img = mask;
  for (let i = 0; i < SIGN_PREFILTER; i++) {
    const half = document.createElement("canvas");
    half.width = Math.max(1, Math.round(source.width / 2));
    half.height = Math.max(1, Math.round(source.height / 2));
    const h = half.getContext("2d")!;
    h.imageSmoothingQuality = "high";
    h.drawImage(source, 0, 0, half.width, half.height);
    source = half;
  }
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  const g = c.getContext("2d")!;
  g.fillStyle = colour;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(source, 0, 0);
  byColour.set(colour, c);
  return c;
}

/** The sign's glyph cells on the face. */
function glyphs(face: ReturnFace) {
  const S = RETURN.sign;
  const { s0, s1 } = face.sign!;
  const cells = STOREFRONT_SIGN.text.length;
  const cell = Math.min(S.cell, (s1 - s0 - 0.16) / cells);
  const width = cell * cells;
  const s = (s0 + s1) / 2 - width / 2;
  const zTop = S.z0 + S.height / 2 + cell / 2;
  return { s, zTop, width, cell };
}

export interface ReturnArt {
  /** Neutral plaster and ceramic field, shared with the shopfront. */
  wall?: Img;
  /** The storefront's lit interior (`window-interior`). */
  interior?: Img;
  /** The shop's name, as a mask (`shenye-ichiba`). */
  kanji?: Img;
}

/** The storeroom bays the existing window art still paints (`paintFacadeArt`'s `skip`). */
export const composedBays = (face: ReturnFace) => [
  ...face.display,
  ...(face.grille !== undefined ? [face.grille] : []),
];

/**
 * The composed face, albedo, in two layers: `wall` (the fascia band and the string
 * course, laid first so the plinth, pipes and storeroom windows draw over them) and
 * `fittings` (the display, the grille, the sign and the extract, laid last). The
 * storeroom windows are the caller's (`paintFacadeArt`, skipping `composedBays`).
 * `clip` limits it to a cutaway piece's stretch and height.
 */
export function paintReturnFace(
  ctx: CanvasRenderingContext2D,
  face: ReturnFace,
  project: Project,
  ppm: number,
  art: ReturnArt,
  materials: MaterialSet | undefined,
  layer: "wall" | "fittings",
  clip?: { s0: number; s1: number; zMax: number },
) {
  const { structure, edge, length } = face;
  const at = faceAt(structure, edge, project, ppm);
  const quad = quadOf(at);
  const h = structure.height;
  const R = RETURN;
  const r = structure.rect;
  const basis = (key: "painted-render" | "shutter" | "painted-metal") =>
    wallBasis(
      project,
      edge === "north" ? "x" : "y",
      edge === "north" ? r.y : r.x + r.width,
      SURFACE_MATERIALS[key].metres,
      ppm,
    );
  ctx.save();
  if (clip) {
    path(ctx, [
      at(clip.s0, -0.3, 0),
      at(clip.s1, -0.3, 0),
      at(clip.s1, 0.4, 0),
      at(clip.s1, 0.4, clip.zMax),
      at(clip.s0, 0.4, clip.zMax),
      at(clip.s0, -0.3, clip.zMax),
    ]);
    ctx.clip();
  }

  if (layer === "fittings") {
    paintFittings(ctx, face, at, quad, art, materials, basis);
    ctx.restore();
    return;
  }
  paintShopFinish(ctx, at, length, art.wall);
  if (art.wall) paintRetailFrames(ctx, at, length, [...face.display, ...face.store], []);
  // --- the fascia band: render above the string course, to the coping ----------
  const band = quad(0, length, R.courseTop, h);
  if (
    !fillMaterial(ctx, materials, band, {
      key: "painted-render",
      basis: basis("painted-render"),
      target: "#493133",
    })
  )
    fill(ctx, band, "#493133");
  // weathering washed down from the coping: soft, never a pattern
  ramp(ctx, quad(0, length, h - 0.5, h - 0.06), at(0, 0, h - 0.06), at(0, 0, h - 0.5), [
    [0, "rgba(24,20,14,.28)"],
    [1, "rgba(24,20,14,0)"],
  ]);

  if (art.wall) {
    paintShopCornice(ctx, at, length);
    ctx.restore();
    return;
  }
  // --- the string course: precast, proud, its top catching the sky --------------
  const P = R.courseProud;
  ramp(
    ctx,
    quad(0, length, R.course - 0.28, R.course),
    at(0, 0, R.course),
    at(0, 0, R.course - 0.28),
    [
      [0, "rgba(0,0,0,.4)"],
      [1, "rgba(0,0,0,0)"],
    ],
  );
  fill(ctx, quad(0, length, R.course, R.courseTop, P), "#6e6a62");
  fill(
    ctx,
    [
      at(0, 0, R.courseTop),
      at(length, 0, R.courseTop),
      at(length, P, R.courseTop),
      at(0, P, R.courseTop),
    ],
    "#a59d8e",
  );
  line(ctx, at(0, P, R.course), at(length, P, R.course), "rgba(0,0,0,.55)", 1);
  ctx.restore();
}

function paintFittings(
  ctx: CanvasRenderingContext2D,
  face: ReturnFace,
  at: At,
  quad: ReturnType<typeof quadOf>,
  art: ReturnArt,
  materials: MaterialSet | undefined,
  basis: (key: "painted-render" | "shutter" | "painted-metal") => ReturnType<typeof wallBasis>,
) {
  const R = RETURN;
  const h = face.structure.height;
  // --- display bays -----------------------------------------------------------
  const lo = BAY.sill,
    hi = BAY.head,
    d = BAY.depth;
  for (const s0 of face.display) {
    const s1 = s0 + BAY.width;
    // stall riser: painted steel under the glass, a kick plate at the foot
    if (!art.wall) {
      fill(ctx, quad(s0, s1, 0, lo), "#172f2c");
      fill(ctx, quad(s0 + R.riserInset, s1 - R.riserInset, 0.1, lo - 0.08), "#264a40");
      line(
        ctx,
        at(s0 + R.riserInset, 0, lo - 0.08),
        at(s1 - R.riserInset, 0, lo - 0.08),
        "#5b6c72",
        1,
      );
    }
    fill(ctx, quad(s0, s1, 0, 0.07), "#161f23");
    // the opening, and the shop behind it, set back from the wall
    const opening = quad(s0, s1, lo, hi);
    fill(ctx, opening, "#080d10");
    ctx.save();
    path(ctx, opening);
    ctx.clip();
    if (art.interior) {
      drawCrop(ctx, at, art.interior, s0, s1, lo, hi, -d);
      fill(ctx, opening, "rgba(8,16,20,.3)");
    } else fill(ctx, opening, "#1a272c");
    fill(ctx, opening, "rgba(52,92,104,.12)");
    ramp(ctx, opening, at(s0, 0, hi), at(s1, 0, lo), [
      [0, "rgba(180,220,230,.10)"],
      [0.35, "rgba(180,220,230,0)"],
      [1, "rgba(180,220,230,0)"],
    ]);
    // the reveal: the near jamb in shade, the head's shadow on the glass
    fill(ctx, [at(s0, 0, lo), at(s0, -d, lo), at(s0, -d, hi), at(s0, 0, hi)], "#0a1114");
    ramp(ctx, quad(s0, s1, hi - 0.45, hi), at(s0, 0, hi), at(s0, 0, hi - 0.45), [
      [0, "rgba(0,0,0,.56)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    ctx.restore();
    // the sill ledge, and the aluminium frame with its mullion
    fill(ctx, [at(s0, 0, lo), at(s1, 0, lo), at(s1, -d, lo), at(s0, -d, lo)], "#6b7878");
    line(ctx, at(s0, 0, lo), at(s1, 0, lo), "#a2afad", 1.2);
    const bar = "#1b252a",
      f = BAY.frame;
    fill(ctx, quad(s0, s1, hi - f, hi), bar);
    fill(ctx, quad(s0, s1, lo, lo + f), bar);
    fill(ctx, quad(s0, s0 + f, lo, hi), bar);
    fill(ctx, quad(s1 - f, s1, lo, hi), bar);
    const mid = (s0 + s1) / 2;
    fill(ctx, quad(mid - 0.025, mid + 0.025, lo, hi), bar);
    line(ctx, at(s0, 0, hi), at(s1, 0, hi), "#5a676c", 0.8);
  }

  // --- the grille: a storeroom bay shut for the night ---------------------------
  if (face.grille !== undefined) {
    const s0 = face.grille,
      s1 = s0 + BAY.width;
    const curtain = quad(s0, s1, lo, hi, -0.04);
    if (
      !fillMaterial(ctx, materials, curtain, {
        key: "shutter",
        basis: basis("shutter"),
        target: "#2f3a3e",
        strength: 0.9,
      })
    )
      fill(ctx, curtain, "#2f3a3e");
    ramp(ctx, curtain, at(s0, 0, hi), at(s0, 0, hi - 0.4), [
      [0, "rgba(0,0,0,.55)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    // guides either side, and the coil box under the course
    for (const [a, b] of [
      [s0 - 0.06, s0],
      [s1, s1 + 0.06],
    ] as const)
      fill(ctx, quad(a, b, lo - 0.02, hi, 0.03), "#3a474c");
    const top = Math.min(hi + 0.26, R.course - 0.04);
    fill(
      ctx,
      [
        at(s0 - 0.1, 0, top),
        at(s1 + 0.1, 0, top),
        at(s1 + 0.1, 0.13, top),
        at(s0 - 0.1, 0.13, top),
      ],
      "#6c7b80",
    );
    fill(ctx, quad(s0 - 0.1, s1 + 0.1, hi, top, 0.13), "#404f55");
    line(ctx, at(s0 - 0.1, 0.13, hi), at(s1 + 0.1, 0.13, hi), "#151d20", 1.2);
    // the bay keeps its precast sill
    fill(
      ctx,
      [
        at(s0 - 0.07, 0, lo),
        at(s1 + 0.07, 0, lo),
        at(s1 + 0.07, 0.08, lo),
        at(s0 - 0.07, 0.08, lo),
      ],
      "#9a9283",
    );
  }

  // --- the fascia sign: a flush light-box, rim and bolts; lit in code -----------
  if (face.sign) {
    const S = R.sign;
    const { s0, s1 } = face.sign;
    const z0 = S.z0,
      z1 = S.z0 + S.height,
      out = S.proud;
    ramp(ctx, quad(s0 - 0.05, s1 + 0.05, z0 - 0.2, z0), at(s0, 0, z0), at(s0, 0, z0 - 0.2), [
      [0, "rgba(0,0,0,.4)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    fill(ctx, quad(s0, s1, z0, z1, out), "#161a20");
    fill(ctx, [at(s0, out, z1), at(s1, out, z1), at(s1, 0, z1), at(s0, 0, z1)], "#59666c");
    const rim = 0.035;
    for (const piece of [
      quad(s0, s1, z1 - rim, z1, out),
      quad(s0, s1, z0, z0 + rim, out),
      quad(s0, s0 + rim, z0, z1, out),
      quad(s1 - rim, s1, z0, z1, out),
    ])
      fill(ctx, piece, "#46545a");
    if (art.kanji) {
      const g = glyphs(face);
      drawCrop(
        ctx,
        at,
        tint(art.kanji, "#8a3a4a"),
        g.s,
        g.s + g.width,
        g.zTop - g.cell,
        g.zTop,
        out + 0.01,
      );
    }
  }

  // --- the kitchen extract ------------------------------------------------------
  if (face.duct !== undefined) {
    const D = R.duct;
    const c = face.duct;
    const a = c - D.width / 2,
      b = c + D.width / 2;
    const [z0, z1] = D.box;
    // louvred box on the wall, with soot above it
    ramp(ctx, quad(a - 0.1, b + 0.1, z1, z1 + 0.8), at(a, 0, z1), at(a, 0, z1 + 0.8), [
      [0, "rgba(12,10,8,.34)"],
      [1, "rgba(12,10,8,0)"],
    ]);
    fill(ctx, quad(a - 0.12, b + 0.12, z0, z1, 0.16), "#56605f");
    fill(
      ctx,
      [at(b + 0.12, 0, z0), at(b + 0.12, 0.16, z0), at(b + 0.12, 0.16, z1), at(b + 0.12, 0, z1)],
      "#252c2e",
    );
    for (let z = z0 + 0.06; z < z1 - 0.03; z += 0.06)
      line(ctx, at(a - 0.08, 0.16, z), at(b + 0.08, 0.16, z), "#1a2022", 1);
    // the duct: galvanised steel, up the pier and over the coping
    const top = h + D.over;
    const pipe = quad(a, b, z1, top, D.proud);
    if (
      !fillMaterial(ctx, materials, pipe, {
        key: "painted-metal",
        basis: basis("painted-metal"),
        target: "#97a1a3",
        strength: 0.5,
      })
    )
      fill(ctx, pipe, "#97a1a3");
    ramp(ctx, pipe, at(a, D.proud, z1), at(b, D.proud, z1), [
      [0, "rgba(232,238,240,.42)"],
      [0.35, "rgba(232,238,240,0)"],
      [1, "rgba(0,0,0,.3)"],
    ]);
    fill(ctx, [at(b, 0, z1), at(b, D.proud, z1), at(b, D.proud, top), at(b, 0, top)], "#3a4244");
    // its shadow on the wall, and the brackets that hold it
    ramp(ctx, quad(b, b + 0.22, z1, h - 0.05), at(b, 0, z1), at(b + 0.22, 0, z1), [
      [0, "rgba(0,0,0,.36)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    for (let z = z1 + 0.5; z < h - 0.2; z += 0.9)
      fill(ctx, quad(a - 0.03, b + 0.03, z, z + 0.05, D.proud + 0.01), "#2a3133");
    // the cowl
    fill(ctx, quad(a - 0.08, b + 0.08, top, top + 0.07, D.proud + 0.04), "#5e686b");
    fill(
      ctx,
      [
        at(a - 0.08, D.proud + 0.04, top + 0.07),
        at(b + 0.08, D.proud + 0.04, top + 0.07),
        at(b + 0.08, -0.04, top + 0.07),
        at(a - 0.08, -0.04, top + 0.07),
      ],
      "#a7b0b2",
    );
  }
}

/**
 * The composed face's light: the shop lit behind its display, the light on each
 * display's sill and surround and the neon's on the render (`light`, multiplied by the
 * art), and its glass and neon (`glow`, added). The storeroom stays dark.
 *
 * With `clip` (a cutaway piece: `s0`-`s1` along the face, up to `zMax`) both passes
 * are clipped to that piece. The renderer masks the light pass to the piece's albedo,
 * but the glow is added after that mask, so an unclipped glow would light glass the
 * reveal has taken away, above a low piece, and again in the piece beside it.
 */
export function paintReturnLight(
  ctx: CanvasRenderingContext2D,
  face: ReturnFace,
  project: Project,
  ppm: number,
  art: ReturnArt,
  night: NightLighting,
  pass: "light" | "glow",
  clip?: { s0: number; s1: number; zMax: number },
) {
  const at = faceAt(face.structure, face.edge, project, ppm);
  const quad = quadOf(at);
  const warm = night.window.color;
  const lo = BAY.sill,
    hi = BAY.head;
  const reaches = (a: number, b: number) => !clip || (b > clip.s0 && a < clip.s1);
  const signed = !clip || clip.zMax > RETURN.sign.z0 + RETURN.sign.height;
  ctx.save();
  if (clip) {
    path(ctx, quad(clip.s0, clip.s1, 0, clip.zMax));
    ctx.clip();
  }
  for (const s0 of face.display) {
    const s1 = s0 + BAY.width;
    // a piece below the sill keeps none of the window, and gives none of its light
    if (!reaches(s0, s1) || (clip && clip.zMax <= lo)) continue;
    ramp(ctx, quad(s0, s1, lo, hi), at(s0, 0, lo), at(s0, 0, hi), [
      [0, lightColor(warm, pass === "light" ? 0.58 : 0.13)],
      [0.6, lightColor(warm, pass === "light" ? 0.44 : 0.05)],
      [1, lightColor(warm, pass === "light" ? 0.3 : 0.02)],
    ]);
    // the lit room reaches its sill, its reveal and the wall round it
    if (pass === "light")
      paintWindowSurround(ctx, at, { s0, s1, z0: lo, z1: hi }, warm, RETURN_SURROUND);
  }
  if (face.sign && signed && reaches(face.sign.s0, face.sign.s1)) paintSignLight();
  ctx.restore();

  function paintSignLight() {
    const S = RETURN.sign;
    const sign = face.sign!;
    if (pass === "light") {
      // the light-box's neon falls on the render round it, a little, and on the course
      const c = at((sign.s0 + sign.s1) / 2, 0, S.z0 + S.height / 2);
      const r = 1.4 * ppm;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, lightColor(night.neon, 0.34));
      g.addColorStop(1, lightColor(night.neon, 0));
      path(ctx, quad(sign.s0 - 1.2, sign.s1 + 1.2, RETURN.course, face.structure.height));
      ctx.fillStyle = g;
      ctx.fill();
      return;
    }
    if (!art.kanji) return;
    const g = glyphs(face);
    ctx.save();
    ctx.shadowColor = "rgba(255,70,110,.9)";
    ctx.shadowBlur = 5 * Math.max(1, ppm / 12);
    // thickened by a few millimetres of offset copies: one-pixel tubes vanish at play zoom
    const tube = (colour: string) => {
      for (const d of [-S.bold, 0, S.bold])
        drawCrop(
          ctx,
          at,
          tint(art.kanji!, colour),
          g.s + d,
          g.s + g.width + d,
          g.zTop - g.cell + d,
          g.zTop + d,
          S.proud + 0.01,
        );
    };
    tube("#ff614b");
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.6;
    tube("#ffe0be");
    ctx.restore();
  }
}

/** The strength of the light on a display's sill and the wall round it (`paintWindowSurround`). */
export const RETURN_SURROUND = 0.26;

/** The display's spill onto the pavement: the shop's own window light, a little less. */
export function returnLights(faces: readonly ReturnFace[], night: NightLighting): GroundLight[] {
  return faces.flatMap((face) => {
    const f = edgeFrame(face.structure.rect, face.edge);
    const o = f.world(0, 0),
      a = f.world(1, 0),
      b = f.world(0, 1);
    return face.display.map((s0): GroundLight => ({
      kind: "spill",
      origin: o,
      along: { x: a.x - o.x, y: a.y - o.y },
      out: { x: b.x - o.x, y: b.y - o.y },
      s0,
      s1: s0 + BAY.width,
      reach: night.window.reach * 0.85,
      spread: night.window.spread,
      color: night.window.color,
      intensity: night.window.intensity * night.returnDisplay,
    }));
  });
}

/* --------------------------------------------------------------- neighbours */

/**
 * The shop's neighbours are another business, shut for the night: their barred high
 * windows and louvre stay as they are (`frontage.ts`), and the face gains what a
 * shop front has above its openings. A string course over the window heads, painted
 * metal cladding above it to the coping, and on the block's longest neighbour face
 * one painted fascia board with its name, lit by two gooseneck lamps: the only light
 * on the neighbours, and it stays on the board.
 */
export const NEIGHBOUR_FRONT = {
  course: 2.86,
  courseTop: 2.94,
  board: { z0: 3.0, height: 0.52, maxWidth: 4.4, cell: 0.4, gap: 0.22, proud: 0.04 },
  lamp: { arm: 0.42, rise: 0.22, radius: 1.3, intensity: 0.55 },
  /** A face this short has no room for a fascia. */
  minSpan: 8,
} as const;

/** One neighbour face, and the fascia board on it if this is the one that has it. */
export interface NeighbourFront {
  structure: SceneStructure;
  edge: Edge;
  span: [number, number];
  board?: { s0: number; s1: number };
}

/** The wall line a face stands on: its edge, and its x (east) or y (north). */
const lineOf = (s: SceneStructure, edge: Edge) =>
  edge === "north" ? s.rect.y : s.rect.x + s.rect.width;

/**
 * The block's neighbour faces, and which one carries the board: a face tall and long
 * enough, on the shopfront's own street line if one is (it continues the shop's
 * frontage), else the longest; clear of its downpipe.
 */
export function neighbourFronts(
  neighbours: readonly SceneStructure[],
  structures: readonly SceneStructure[],
  pipeAt: (structure: SceneStructure, edge: Edge) => number | undefined = () => undefined,
  /** The shopfront's face. */
  shop?: { structure: SceneStructure; edge: Edge },
): NeighbourFront[] {
  const N = NEIGHBOUR_FRONT;
  const faces: NeighbourFront[] = neighbours.flatMap((structure) =>
    (["north", "east"] as const).flatMap((edge) =>
      exposedSpans(structure, edge, structures).map((span) => ({ structure, edge, span })),
    ),
  );
  const tall = (f: NeighbourFront) =>
    f.structure.height >= N.board.z0 + N.board.height + 0.3 && f.span[1] - f.span[0] >= N.minSpan;
  const inLine = (f: NeighbourFront) =>
    !!shop &&
    f.edge === shop.edge &&
    lineOf(f.structure, f.edge) === lineOf(shop.structure, shop.edge);
  const best = faces
    .filter(tall)
    .sort(
      (a, b) =>
        Number(inLine(b)) - Number(inLine(a)) || b.span[1] - b.span[0] - (a.span[1] - a.span[0]),
    )[0];
  if (best) {
    const [a, b] = best.span;
    const width = Math.min(N.board.maxWidth, b - a - 2);
    let s0 = (a + b) / 2 - width / 2;
    if (shop && inLine(best)) {
      // the end of the face nearest the shop: where the street meets it
      const f = edgeFrame(best.structure.rect, best.edge);
      const g = edgeFrame(shop.structure.rect, shop.edge);
      const mid = g.world(g.length / 2, 0);
      const d = (s: number) => {
        const p = f.world(s, 0);
        return Math.hypot(p.x - mid.x, p.y - mid.y);
      };
      s0 = d(b) < d(a) ? b - 1 - width : a + 1;
    }
    const pipe = pipeAt(best.structure, best.edge);
    // keep clear of the downpipe: slide away from it, inside the span
    if (pipe !== undefined && pipe > s0 - 0.5 && pipe < s0 + width + 0.5)
      s0 =
        pipe < (a + b) / 2
          ? Math.min(b - 1 - width, pipe + 0.6)
          : Math.max(a + 1, pipe - 0.6 - width);
    best.board = { s0, s1: s0 + width };
  }
  return faces;
}

/** A neighbour face, albedo: the course, the cladding, and the board if it has one. */
export function paintNeighbourFront(
  ctx: CanvasRenderingContext2D,
  front: NeighbourFront,
  project: Project,
  ppm: number,
  sign: Img | undefined,
  materials: MaterialSet | undefined,
) {
  const N = NEIGHBOUR_FRONT;
  const { structure, edge } = front;
  const [a, b] = front.span;
  const at = faceAt(structure, edge, project, ppm);
  const quad = quadOf(at);
  const h = structure.height;
  const r = structure.rect;
  const basis = wallBasis(
    project,
    edge === "north" ? "x" : "y",
    edge === "north" ? r.y : r.x + r.width,
    SURFACE_MATERIALS["painted-metal"].metres,
    ppm,
  );
  // Workshop enamel dado: a distinct, closed business below the high windows.
  // Broad material bands survive play zoom; the upper rooms stay on their own painter.
  fill(ctx, quad(a, b, 0.12, 1.72), "#304b4d");
  for (let s = a + 0.2; s < b - 0.2; s += 3.2) {
    const end = Math.min(b - 0.16, s + 2.88);
    fill(ctx, quad(s, end, 0.27, 1.52), "#263d40");
    line(ctx, at(s, 0.02, 1.52), at(end, 0.02, 1.52), "#697c76", 0.75);
    line(ctx, at(end, 0.02, 0.27), at(end, 0.02, 1.52), "#15272a", 1);
  }
  fill(ctx, quad(a, b, 1.72, 1.84, 0.08), "#7d8272");
  fill(ctx, [at(a, 0, 1.84), at(b, 0, 1.84), at(b, 0.1, 1.84), at(a, 0.1, 1.84)], "#a1a48e");
  // cladding: profiled metal sheet from the course to the coping
  const clad = quad(a, b, N.courseTop, h);
  if (
    !fillMaterial(ctx, materials, clad, {
      key: "painted-metal",
      basis,
      target: "#3c4a4c",
      strength: 0.75,
    })
  )
    fill(ctx, clad, "#3c4a4c");
  for (let s = a + 0.25; s < b - 0.05; s += 0.25)
    line(ctx, at(s, 0, N.courseTop + 0.02), at(s, 0, h - 0.04), "rgba(0,0,0,.16)", 0.7);
  // the course: a pressed-metal flashing over the window heads, with its drip shadow
  ramp(ctx, quad(a, b, N.course - 0.22, N.course), at(a, 0, N.course), at(a, 0, N.course - 0.22), [
    [0, "rgba(0,0,0,.36)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  fill(ctx, quad(a, b, N.course, N.courseTop, 0.04), "#4d5859");
  fill(
    ctx,
    [
      at(a, 0, N.courseTop),
      at(b, 0, N.courseTop),
      at(b, 0.04, N.courseTop),
      at(a, 0.04, N.courseTop),
    ],
    "#8c9697",
  );
  if (!front.board) return;
  const B = N.board;
  const { s0, s1 } = front.board;
  const z0 = B.z0,
    z1 = B.z0 + B.height;
  // the board: painted steel on a frame, its shadow on the cladding
  ramp(ctx, quad(s0, s1, z0 - 0.16, z0), at(s0, 0, z0), at(s0, 0, z0 - 0.16), [
    [0, "rgba(0,0,0,.42)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  fill(ctx, quad(s0, s1, z0, z1, B.proud), "#203a33");
  fill(ctx, [at(s0, B.proud, z1), at(s1, B.proud, z1), at(s1, 0, z1), at(s0, 0, z1)], "#5a6b64");
  fill(ctx, [at(s1, 0, z0), at(s1, B.proud, z0), at(s1, B.proud, z1), at(s1, 0, z1)], "#12201c");
  line(
    ctx,
    at(s0 + 0.04, B.proud, z1 - 0.04),
    at(s1 - 0.04, B.proud, z1 - 0.04),
    "rgba(214,204,170,.5)",
    0.8,
  );
  line(
    ctx,
    at(s0 + 0.04, B.proud, z0 + 0.04),
    at(s1 - 0.04, B.proud, z0 + 0.04),
    "rgba(214,204,170,.5)",
    0.8,
  );
  if (sign) {
    // painted letters, spaced across the board: four cells of the mask
    const cells = 4;
    const cell = Math.min(B.cell, B.height - 0.1);
    const pitch = Math.min(cell + B.gap, (s1 - s0 - 0.3) / cells);
    const start = (s0 + s1) / 2 - (pitch * (cells - 1) + cell) / 2;
    const zTop = (z0 + z1) / 2 + cell / 2;
    const t = ctx.getTransform();
    const p = at(start, B.proud, zTop),
      q = at(start + cell, B.proud, zTop),
      v = at(start, B.proud, zTop - cell);
    const device = (a: Point) =>
      Math.hypot(t.a * (a.x - p.x) + t.c * (a.y - p.y), t.b * (a.x - p.x) + t.d * (a.y - p.y));
    const letters = sourceFor(tint(sign, "#d9cfb2"), device(q) * cells, device(v));
    for (let i = 0; i < cells; i++) {
      const sx = start + i * pitch;
      // one cell of the mask: crop its quarter
      const o = at(sx, B.proud + 0.005, zTop);
      const u = at(sx + 1, B.proud + 0.005, zTop);
      const v = at(sx, B.proud + 0.005, zTop - 1);
      const cw = letters.width / cells;
      ctx.save();
      ctx.transform(
        ((u.x - o.x) * cell) / cw,
        ((u.y - o.y) * cell) / cw,
        ((v.x - o.x) * cell) / letters.height,
        ((v.y - o.y) * cell) / letters.height,
        o.x,
        o.y,
      );
      ctx.drawImage(letters, i * cw, 0, cw, letters.height, 0, 0, cw, letters.height);
      ctx.restore();
    }
  }
  // the two gooseneck lamps that light it
  for (const s of lampsOf(front)) {
    const L = N.lamp;
    line(ctx, at(s, 0, z1 + 0.08), at(s, L.arm * 0.6, z1 + L.rise + 0.06), "#1a2224", 1.6);
    line(
      ctx,
      at(s, L.arm * 0.6, z1 + L.rise + 0.06),
      at(s, L.arm, z1 + L.rise - 0.02),
      "#1a2224",
      1.6,
    );
    fill(ctx, quad(s - 0.08, s + 0.08, z1 + L.rise - 0.1, z1 + L.rise, L.arm), "#2c3537");
    fill(ctx, quad(s - 0.03, s + 0.03, z1 + 0.04, z1 + 0.12, 0.01), "#2a3234");
  }
}

/** Where the board's two lamps stand along the face. */
const lampsOf = (front: NeighbourFront) => {
  if (!front.board) return [];
  const { s0, s1 } = front.board;
  const inset = Math.min(0.9, (s1 - s0) / 4);
  return [s0 + inset, s1 - inset];
};

/**
 * The goosenecks' light, on the board and the cladding just under them (`light`), and
 * their lenses (`glow`). Nothing reaches the pavement: this is a sign light.
 */
export function paintNeighbourLight(
  ctx: CanvasRenderingContext2D,
  front: NeighbourFront,
  project: Project,
  ppm: number,
  night: NightLighting,
  pass: "light" | "glow",
) {
  if (!front.board) return;
  const N = NEIGHBOUR_FRONT;
  const L = N.lamp;
  const at = faceAt(front.structure, front.edge, project, ppm);
  const quad = quadOf(at);
  const z1 = N.board.z0 + N.board.height;
  const warm = night.streetLamp.color;
  for (const s of lampsOf(front)) {
    if (pass === "glow") {
      fill(
        ctx,
        quad(s - 0.06, s + 0.06, z1 + L.rise - 0.1, z1 + L.rise - 0.07, L.arm),
        lightColor(warm, 0.9),
      );
      continue;
    }
    // a pool on the wall under each head, strongest on the board
    const c = at(s, 0, z1 - 0.1);
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, L.radius * ppm);
    g.addColorStop(0, lightColor(warm, L.intensity));
    g.addColorStop(0.45, lightColor(warm, L.intensity * 0.45));
    g.addColorStop(1, lightColor(warm, 0));
    path(ctx, quad(front.span[0], front.span[1], N.course - 0.6, front.structure.height));
    ctx.fillStyle = g;
    ctx.fill();
  }
}
