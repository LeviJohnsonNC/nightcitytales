/**
 * The seed-7 corner shop, finished: window recesses with interiors, a shutter
 * door with housing and rails, a fascia with a kanji sign, a canvas awning, and the
 * contact shadows and light that sit them in the street.
 *
 * Presentation only. Every position is read from the saved structure, its saved
 * entrance and awning attachment, and the numbers in `storefrontPack.ts`; nothing
 * here moves a wall, a door, a cover piece or a shot line. It paints into the same
 * canvases the renderer already makes (the building sprite, its cutaway pieces, one
 * awning sprite and the ground), through the scene's own projection, so scale,
 * registration and depth ordering are the renderer's.
 *
 * Coordinates: `s` is metres along the face from the building's first corner, `out`
 * is metres away from the wall (negative: into the building), `z` is height.
 */
import { sourceFor } from "./architectureArt";
import {
  paintShopFinish,
  paintShopCornice,
  paintRetailFrames,
  paintShopDisplay,
} from "./shopFinish";
import { paintDownpipe, paintPlinth, solidSpans, type Downpipe } from "./frontage";
import type { Point, Rect, SceneAttachment, SceneEnvironment, SceneStructure } from "@/engine";
import {
  SURFACE_MATERIALS,
  fillMaterial,
  patternMatrix,
  wallBasis,
  type MaterialSet,
  type TileSource,
} from "./surfaceMaterials";
import { STOREFRONT_FACE, STOREFRONT_LEVELS as L, STOREFRONT_SIGN as SIGN } from "./storefrontPack";
import {
  INTERSECTION_NIGHT,
  lightColor,
  paintGroundLight,
  type GroundLight,
  type NightLighting,
} from "./nightLighting";

/**
 * What a painter is drawing. `albedo` is the art as it is under no light at all
 * but the ambient; `light` is the light that FALLS on a surface, which the renderer
 * multiplies by that surface's albedo; `glow` is light a surface GIVES (a lit lens,
 * a window's glass, neon), added as it is.
 */
export type Pass = "albedo" | "light" | "glow";

export const STOREFRONT_ART_FILES = {
  window: "/images/storefront/window-interior.webp",
  wall: "/images/storefront/wall-finish.webp",
  awning: "/images/storefront/awning-fabric.webp",
  wear: "/images/storefront/shutter-wear.webp",
  kanji: "/images/signs/shenye-ichiba.webp",
  /** The neighbour's painted fascia, 電器修理 ("electrical repairs"): `streetfront.ts`. */
  service: "/images/signs/denki-shuri.webp",
} as const;
export type StorefrontArtKey = keyof typeof STOREFRONT_ART_FILES;
export type StorefrontArt = Partial<Record<StorefrontArtKey, TileSource>>;
export const storefrontAssetKey = (key: StorefrontArtKey) => `storefront-${key}`;

type Project = (p: Point) => Point;
type Edge = "north" | "east";

export interface Storefront {
  structure: SceneStructure;
  awning: SceneAttachment;
  edge: Edge;
  /** Length of the face, in metres. */
  length: number;
  /** Metres along the face to the door's centre. */
  door: number;
  /** Metres along the face to the start of each window bay. */
  bays: number[];
  /** The bays that face the street. A bay behind a neighbouring building faces its
   * wall: it is painted, but its room is dark and it throws no light. */
  litBays: number[];
  /** The saved streetlight beside the shop, if the recipe has one. */
  lamp?: Point;
  /** Which way its arm reaches from that saved base, and how far (`lampArm`). */
  arm?: LampArm;
}

/** A streetlight arm: a world unit vector from the pole, and its length in metres. */
export interface LampArm {
  dir: Point;
  length: number;
  /** False when no candidate cleared everything and the arm fell back to the facade normal. */
  clear: boolean;
}

/** Screen position in units of the scene's pixels-per-metre, for this camera. Linear in
 * metres, so clearance can be judged without a projection or a zoom. */
const unitScreen = (x: number, y: number, z: number) => ({
  x: (x + y) * Math.cos(Math.PI / 6),
  y: (x - y) * 0.5 - z,
});

/**
 * Which way the saved streetlight's arm reaches, judged from saved geometry only.
 *
 * The base never moves. Candidate arms (every 15°, 1.2–2.4 m, the range of real
 * cobra-head mast arms) are kept only if the head hangs over open ground, clear of
 * every building footprint and every cover piece, and only if the lantern, seen from
 * this camera, clears the silhouette of every cover piece: a lantern drawn over a
 * parked car's bonnet reads as its headlight. Of those, the one closest to pointing
 * straight out from the facade, and then nearest the usual 1.5 m, wins. When none clears, the arm
 * falls back to straight out at 1.5 m and says so (`clear: false`).
 */
export function lampArm(
  base: Point,
  outward: Point,
  structures: readonly SceneStructure[],
  cover: readonly { rect: Rect }[],
  poleHeight: number,
): LampArm {
  const pad = (r: Rect, m: number) => ({
    x: r.x - m,
    y: r.y - m,
    width: r.width + 2 * m,
    height: r.height + 2 * m,
  });
  const inside = (p: Point, r: Rect) =>
    p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
  const solids = structures.filter((s) => s.style !== "mesh-fence" && s.style !== "interior-wall");
  // Each cover piece's silhouette from this camera: its footprint lifted to car height.
  const silhouettes = cover.map(({ rect: r }) =>
    [0, 1.7].flatMap((z) =>
      [
        [r.x, r.y],
        [r.x + r.width, r.y],
        [r.x + r.width, r.y + r.height],
        [r.x, r.y + r.height],
      ].map(([x, y]) => unitScreen(x!, y!, z)),
    ),
  );
  const hulls = silhouettes.map(hull);
  /** Distance from a point to a convex polygon: zero inside it. */
  const distance = (p: Point, poly: Point[]) => {
    let inside = true;
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      if (ex * (p.y - a.y) - ey * (p.x - a.x) < 0) inside = false;
      const t = Math.max(
        0,
        Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / (ex * ex + ey * ey)),
      );
      best = Math.min(best, Math.hypot(p.x - a.x - ex * t, p.y - a.y - ey * t));
    }
    return inside ? 0 : best;
  };
  const headZ = poleHeight - 0.15;
  /** Screen clearance kept around the lantern and its halo, in metres. */
  const margin = 0.5;
  let best: (LampArm & { cost: number }) | undefined;
  for (let deg = 0; deg < 360; deg += 15) {
    const a = (deg * Math.PI) / 180;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    const turn = Math.acos(Math.max(-1, Math.min(1, dir.x * outward.x + dir.y * outward.y)));
    for (const length of [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3]) {
      const head = { x: base.x + dir.x * length, y: base.y + dir.y * length };
      const mid = { x: base.x + dir.x * length * 0.5, y: base.y + dir.y * length * 0.5 };
      if (solids.some((s) => inside(head, pad(s.rect, 0.3)) || inside(mid, s.rect))) continue;
      if (cover.some((c) => inside(head, pad(c.rect, 0.3)))) continue;
      const lens = unitScreen(head.x, head.y, headZ);
      if (hulls.some((h) => distance(lens, h) < margin)) continue;
      const cost = turn * 2 + Math.abs(length - 1.5) * 0.5;
      if (!best || cost < best.cost - 1e-9) best = { dir, length, clear: true, cost };
    }
  }
  if (!best) return { dir: outward, length: 1.5, clear: false };
  return { dir: best.dir, length: best.length, clear: true };
}

/**
 * The shop of an intersection, if it has a camera-facing awning face. A face the
 * camera cannot see (a west or south edge) is not a storefront here: the renderer
 * has never drawn those attachments, and still does not.
 */
export function storefrontFor(
  structure: SceneStructure,
  env: Pick<SceneEnvironment, "entrances" | "dressing"> &
    Partial<Pick<SceneEnvironment, "structures">>,
  /** The arena's cover pieces: the streetlight's arm is chosen to clear them. */
  cover: readonly { rect: Rect }[] = [],
  poleHeight = INTERSECTION_NIGHT.lamp.poleHeight,
): Storefront | undefined {
  if (structure.style !== "shop") return undefined;
  const awning = structure.attachments?.find((a) => a.id === "shop-canopy" && a.kind === "awning");
  if (!awning || (awning.edge !== "north" && awning.edge !== "east")) return undefined;
  const edge = awning.edge;
  const r = structure.rect;
  const entrance = (env.entrances ?? []).find((e) => e.structureId === structure.id);
  if (!entrance) return undefined;
  const length = edge === "north" ? r.width : r.height;
  const door = edge === "north" ? entrance.position.x - r.x : entrance.position.y - r.y;
  // The renderer's own bay rule: a 2.2 m bay every 3 m from 0.5 m, none where the door is.
  const bays: number[] = [];
  for (let s = 0.5; s + 2.2 < length; s += 3) if (!(door > s - 1.1 && door < s + 3.3)) bays.push(s);
  const lamp = env.dressing.find((d) => d.id === "shop_lamp_detail_0")?.position;
  const front = (s: number): Point =>
    edge === "north" ? { x: r.x + s, y: r.y - 0.5 } : { x: r.x + r.width + 0.5, y: r.y + s };
  const covered = (p: Point) =>
    (env.structures ?? []).some(
      (o) =>
        o !== structure &&
        o.style !== "mesh-fence" &&
        o.style !== "interior-wall" &&
        p.x > o.rect.x &&
        p.x < o.rect.x + o.rect.width &&
        p.y > o.rect.y &&
        p.y < o.rect.y + o.rect.height,
    );
  const litBays = bays.filter((s) => !covered(front(s + 1.1)));
  const outward = edge === "north" ? { x: 0, y: -1 } : { x: 1, y: 0 };

  return {
    structure,
    awning,
    edge,
    length,
    door,
    bays,
    litBays,
    ...(lamp
      ? { lamp, arm: lampArm(lamp, outward, env.structures ?? [structure], cover, poleHeight) }
      : {}),
  };
}

/** Screen point for `s` along the face, `out` from the wall, `z` up. */
export function facePoint(sf: Storefront, project: Project, ppm: number) {
  const r = sf.structure.rect;
  return (s: number, out: number, z: number): Point => {
    const w =
      sf.edge === "north" ? { x: r.x + s, y: r.y - out } : { x: r.x + r.width + out, y: r.y + s };
    const p = project(w);
    return { x: p.x, y: p.y - z * ppm };
  };
}

/** The ground point (metres) under a face coordinate. */
export function faceWorld(sf: Storefront, s: number, out: number): Point {
  const r = sf.structure.rect;
  return sf.edge === "north"
    ? { x: r.x + s, y: r.y - out }
    : { x: r.x + r.width + out, y: r.y + s };
}

/** The awning's footprint on the ground, which is also its depth-sort rectangle. */
export function awningFootprint(sf: Storefront): Rect {
  const { offset, span, projection } = sf.awning;
  const r = sf.structure.rect;
  return sf.edge === "north"
    ? { x: r.x + offset, y: r.y - projection, width: span, height: projection }
    : { x: r.x + r.width, y: r.y + offset, width: projection, height: span };
}

const hull = (points: Point[]): Point[] => {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const build = (list: Point[]) => {
    const out: Point[] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, q) <= 0)
        out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...build(p), ...build([...p].reverse())];
};

const path = (ctx: CanvasRenderingContext2D, pts: readonly Point[]) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
};
const fillPoly = (ctx: CanvasRenderingContext2D, pts: readonly Point[], fill: string) => {
  path(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
};
const strokeLine = (
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  color: string,
  width: number,
) => {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
};
const gradientFill = (
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

export interface FaceOptions {
  ctx: CanvasRenderingContext2D;
  sf: Storefront;
  project: Project;
  ppm: number;
  art: StorefrontArt;
  materials?: MaterialSet | undefined;
  pass: Pass;
  /** Paint only this part of the face: a cutaway piece, at its height. */
  clip?: { s0: number; s1: number; zMax: number };
  /** The architectural pilot's fittings on this face (`frontage.ts`). */
  frontage?: { pipe?: Downpipe };
}

/** The shop's electricity meter: a steel box on the solid wall between door and first bay. */
export const METER_BOX = { width: 0.42, z0: 0.95, z1: 1.6, proud: 0.12 } as const;

/** Where the meter box sits along the face, or nothing if the wall has no room for it. */
export function meterBox(sf: Storefront): number | undefined {
  const doorEnd = sf.door + STOREFRONT_FACE.doorWidth / 2 + 0.2;
  const firstBay = sf.bays.find((b) => b > doorEnd) ?? sf.length;
  const room = firstBay - doorEnd;
  return room >= METER_BOX.width + 0.6 ? doorEnd + (room - METER_BOX.width) * 0.55 : undefined;
}

/** The stretches of the face that are wall, not door or glass. */
export function storefrontOpenings(sf: Storefront): [number, number][] {
  const half = STOREFRONT_FACE.doorWidth / 2;
  return [
    [sf.door - half - 0.12, sf.door + half + 0.12],
    ...sf.bays.map((b) => [b, b + STOREFRONT_FACE.bayWidth] as [number, number]),
  ];
}

/** Draw `image` straight-on on the face plane, `out` metres from the wall. */
function drawOnFace(
  o: FaceOptions,
  image: TileSource,
  s0: number,
  zTop: number,
  widthM: number,
  heightM: number,
  out = 0,
  mirror = false,
) {
  const at = facePoint(o.sf, o.project, o.ppm);
  const origin = at(mirror ? s0 + widthM : s0, out, zTop);
  const along = at((mirror ? s0 + widthM : s0) + (mirror ? -1 : 1), out, zTop);
  const t = o.ctx.getTransform?.();
  const scale = t ? Math.hypot(t.a, t.b) : 1;
  image = sourceFor(
    image,
    Math.hypot(along.x - origin.x, along.y - origin.y) * widthM * scale,
    o.ppm * heightM * scale,
  );
  const kx = widthM / image.width;
  const ky = heightM / image.height;
  o.ctx.save();
  o.ctx.transform(
    (along.x - origin.x) * kx,
    (along.y - origin.y) * kx,
    0,
    o.ppm * ky,
    origin.x,
    origin.y,
  );
  o.ctx.drawImage(image, 0, 0);
  o.ctx.restore();
}

const tinted = new WeakMap<object, Map<string, HTMLCanvasElement>>();
/** The kanji mask in one colour. Cached: the mask and the colour are the whole key. */
function tintedMask(mask: TileSource, color: string): HTMLCanvasElement {
  let byColor = tinted.get(mask);
  if (!byColor) tinted.set(mask, (byColor = new Map()));
  const hit = byColor.get(color);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = mask.width;
  canvas.height = mask.height;
  const c = canvas.getContext("2d")!;
  c.fillStyle = color;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(mask, 0, 0);
  byColor.set(color, canvas);
  return canvas;
}

/**
 * The storefront's face, every element, in one routine used for the whole building
 * and for each cutaway piece (clipped to its height), so revealing the street does
 * not change what the wall is. Elements above a piece's height are simply cut.
 */
export function paintStorefrontFace(o: FaceOptions) {
  const { ctx, sf, ppm } = o;
  const at = facePoint(sf, o.project, ppm);
  const quad = (s0: number, s1: number, z0: number, z1: number, out = 0) => [
    at(s0, out, z0),
    at(s1, out, z0),
    at(s1, out, z1),
    at(s0, out, z1),
  ];
  ctx.save();
  if (o.clip) {
    // The piece's front, plus room for what stands proud of the wall or sits behind it.
    const c = o.clip;
    const corners = [-0.2, 0.3].flatMap((out) => [
      at(c.s0, out, 0),
      at(c.s1, out, 0),
      at(c.s1, out, c.zMax),
      at(c.s0, out, c.zMax),
    ]);
    path(ctx, hull(corners));
    ctx.clip();
  }
  const reaches = (a: number, b: number) => !o.clip || (b > o.clip.s0 && a < o.clip.s1);
  const signed = !o.clip || o.clip.zMax > L.fasciaBottom - 0.2;
  if (o.pass !== "albedo") {
    paintFaceLight(o, quad, reaches, signed);
    ctx.restore();
    return;
  }

  paintShopFinish(ctx, at, sf.length, o.art.wall);
  if (o.art.wall) paintRetailFrames(ctx, at, sf.length, sf.bays, [sf.door], L.riser);

  // --- the wall's own trim: base shade, pier lines at both corners ------------
  gradientFill(ctx, quad(0, sf.length, 0, 0.5), at(0, 0, 0), at(0, 0, 0.5), [
    [0, "rgba(6,12,16,.34)"],
    [1, "rgba(6,12,16,0)"],
  ]);
  if (o.frontage) {
    // a rendered plinth on the solid wall only: the door and the bays' risers meet
    // the pavement themselves
    paintPlinth(
      ctx,
      o.project,
      ppm,
      sf.structure,
      sf.edge,
      solidSpans([0, sf.length], storefrontOpenings(sf)),
      "shop",
    );
  }
  for (const s of [0.02, sf.length - 0.02]) {
    strokeLine(ctx, at(s, 0, 0), at(s, 0, L.parapetTop), "#10191f", 3);
    strokeLine(ctx, at(s, 0, 0), at(s, 0, L.parapetTop), "#6c7571", 0.8);
  }

  // --- window bays ---------------------------------------------------------
  const depth = 0.18;
  const frame = 0.07;
  o.sf.bays.forEach((s0, index) => {
    const s1 = s0 + STOREFRONT_FACE.bayWidth;
    // A cutaway piece paints only the bays it actually carries.
    if (!reaches(s0, s1)) return;
    const top = L.glazingTop;
    const bottom = L.riser;
    // stall riser: painted steel panel under the glass, with a kick plate
    if (!o.art.wall) {
      fillPoly(ctx, quad(s0, s1, 0, bottom), "#172f2c");
      fillPoly(ctx, quad(s0 + 0.08, s1 - 0.08, 0.1, bottom - 0.1), "#264a40");
      strokeLine(ctx, at(s0 + 0.08, 0, bottom - 0.1), at(s1 - 0.08, 0, bottom - 0.1), "#55646a", 1);
    }
    fillPoly(ctx, quad(s0, s1, 0, 0.07), "#192226");
    // the opening, and the room behind the glass, set back from the wall
    const opening = quad(s0, s1, bottom, top);
    fillPoly(ctx, opening, "#080d10");
    ctx.save();
    path(ctx, opening);
    ctx.clip();
    if (o.art.window) {
      drawOnFace(
        o,
        o.art.window,
        s0,
        top,
        STOREFRONT_FACE.bayWidth,
        top - bottom,
        -depth,
        index % 2 === 1,
      );
      // dim the room so it reads as interior, not as a second facade
      fillPoly(ctx, opening, "rgba(8,16,20,.34)");
    } else {
      fillPoly(ctx, opening, "#1a272c");
    }
    paintShopDisplay(ctx, at, s0, bottom, top, index);
    // glass: a faint cool tint and one soft diagonal sheen. No reflections.
    fillPoly(ctx, opening, "rgba(52,92,104,.14)");
    gradientFill(ctx, opening, at(s0, 0, top), at(s1, 0, bottom), [
      [0, "rgba(180,220,230,.10)"],
      [0.35, "rgba(180,220,230,0)"],
      [1, "rgba(180,220,230,0)"],
    ]);
    // recess: the wall's thickness shows down the near jamb and across the sill
    fillPoly(
      ctx,
      [at(s0, 0, bottom), at(s0, -depth, bottom), at(s0, -depth, top), at(s0, 0, top)],
      "#0a1114",
    );
    gradientFill(
      ctx,
      quad(s0, s1, bottom, bottom + 0.5, -depth),
      at(s0, -depth, bottom),
      at(s0, -depth, bottom + 0.5),
      [
        [0, "rgba(0,0,0,.38)"],
        [1, "rgba(0,0,0,0)"],
      ],
    );
    // inner shadow under the head
    gradientFill(ctx, quad(s0, s1, top - 0.45, top, 0), at(s0, 0, top), at(s0, 0, top - 0.45), [
      [0, "rgba(0,0,0,.56)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    ctx.restore();
    // the sill ledge catches light
    fillPoly(
      ctx,
      [at(s0, 0, bottom), at(s1, 0, bottom), at(s1, -depth, bottom), at(s0, -depth, bottom)],
      "#6b7878",
    );
    strokeLine(ctx, at(s0, 0, bottom), at(s1, 0, bottom), "#a2afad", 1.2);
    // aluminium frame at the wall plane: head, sill, jambs, mullion
    const bar = "#1b252a";
    fillPoly(ctx, quad(s0, s1, top - frame, top), bar);
    fillPoly(ctx, quad(s0, s1, bottom, bottom + frame), bar);
    fillPoly(ctx, quad(s0, s0 + frame, bottom, top), bar);
    fillPoly(ctx, quad(s1 - frame, s1, bottom, top), bar);
    const mid = (s0 + s1) / 2;
    fillPoly(ctx, quad(mid - 0.025, mid + 0.025, bottom, top), bar);
    strokeLine(ctx, at(s0, 0, top), at(s1, 0, top), "#5a676c", 0.8);
    strokeLine(ctx, at(s0, 0, bottom), at(s0, 0, top), "#5a676c", 0.8);
    if (o.frontage) {
      // the cill: pre-cast, 6 cm proud and past both jambs, with its drip shadow on
      // the riser below; the ledge inside the recess is the glass's own
      const c0 = s0 - 0.06;
      const c1 = s1 + 0.06;
      const cz = bottom - 0.07;
      gradientFill(ctx, quad(c0, c1, cz - 0.28, cz), at(c0, 0, cz), at(c0, 0, cz - 0.28), [
        [0, "rgba(0,0,0,.42)"],
        [1, "rgba(0,0,0,0)"],
      ]);
      fillPoly(ctx, quad(c0, c1, cz, bottom, 0.06), "#5f6866");
      fillPoly(
        ctx,
        [at(c0, 0, bottom), at(c1, 0, bottom), at(c1, 0.06, bottom), at(c0, 0.06, bottom)],
        "#a3aca6",
      );
      fillPoly(
        ctx,
        [at(c1, 0, cz), at(c1, 0.06, cz), at(c1, 0.06, bottom), at(c1, 0, bottom)],
        "#3c4443",
      );
      strokeLine(ctx, at(c0, 0.06, cz), at(c1, 0.06, cz), "#1d2425", 1);
    }
  });

  // --- the meter box and its conduit -------------------------------------------
  const meter = o.frontage ? meterBox(sf) : undefined;
  if (meter !== undefined && reaches(meter - 0.1, meter + METER_BOX.width + 0.1)) {
    const M = METER_BOX;
    const m0 = meter;
    const m1 = meter + M.width;
    // conduit up from the box to under the fascia, clipped to the wall
    fillPoly(ctx, quad(m0 + 0.17, m0 + 0.23, M.z1, L.fasciaBottom - 0.02, 0.03), "#2a3236");
    strokeLine(
      ctx,
      at(m0 + 0.21, 0.03, M.z1),
      at(m0 + 0.21, 0.03, L.fasciaBottom - 0.02),
      "#6b777c",
      0.6,
    );
    // shadow on the wall to its far side and under it
    gradientFill(ctx, quad(m1, m1 + 0.16, M.z0, M.z1), at(m1, 0, M.z0), at(m1 + 0.16, 0, M.z0), [
      [0, "rgba(0,0,0,.4)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    gradientFill(
      ctx,
      quad(m0, m1 + 0.1, M.z0 - 0.2, M.z0),
      at(m0, 0, M.z0),
      at(m0, 0, M.z0 - 0.2),
      [
        [0, "rgba(0,0,0,.35)"],
        [1, "rgba(0,0,0,0)"],
      ],
    );
    // the box: front, side, top, a hinge line, a vision window, a padlock hasp
    fillPoly(ctx, quad(m0, m1, M.z0, M.z1, M.proud), "#56605f");
    fillPoly(
      ctx,
      [at(m1, 0, M.z0), at(m1, M.proud, M.z0), at(m1, M.proud, M.z1), at(m1, 0, M.z1)],
      "#323a3b",
    );
    fillPoly(
      ctx,
      [at(m0, 0, M.z1), at(m1, 0, M.z1), at(m1, M.proud, M.z1), at(m0, M.proud, M.z1)],
      "#8a9491",
    );
    strokeLine(
      ctx,
      at(m0 + 0.03, M.proud, M.z0 + 0.03),
      at(m0 + 0.03, M.proud, M.z1 - 0.03),
      "#2b3233",
      0.8,
    );
    fillPoly(ctx, quad(m0 + 0.12, m1 - 0.12, M.z1 - 0.24, M.z1 - 0.1, M.proud), "#1d2628");
    fillPoly(ctx, quad(m1 - 0.08, m1 - 0.04, M.z0 + 0.25, M.z0 + 0.33, M.proud), "#b49a5c");
    // rust weeping from its foot
    gradientFill(
      ctx,
      quad(m0 + 0.1, m1 - 0.1, M.z0 - 0.5, M.z0),
      at(m0, 0, M.z0),
      at(m0, 0, M.z0 - 0.5),
      [
        [0, "rgba(90,52,24,.3)"],
        [1, "rgba(90,52,24,0)"],
      ],
    );
  }

  // --- shutter door ----------------------------------------------------------
  if (
    reaches(
      sf.door - STOREFRONT_FACE.doorWidth / 2 - 0.2,
      sf.door + STOREFRONT_FACE.doorWidth / 2 + 0.2,
    )
  ) {
    const s0 = sf.door - STOREFRONT_FACE.doorWidth / 2;
    const s1 = sf.door + STOREFRONT_FACE.doorWidth / 2;
    const opening = quad(s0, s1, 0, L.doorHeight);
    const clad = o.materials;
    const laid =
      clad &&
      fillMaterial(ctx, clad, opening, {
        key: "shutter",
        basis: wallBasis(
          o.project,
          sf.edge === "north" ? "x" : "y",
          sf.edge === "north" ? sf.structure.rect.y : sf.structure.rect.x + sf.structure.rect.width,
          SURFACE_MATERIALS.shutter.metres,
          ppm,
        ),
        target: "#2b373c",
        strength: 0.9,
      });
    if (!laid) fillPoly(ctx, opening, "#232f34");
    ctx.save();
    path(ctx, opening);
    ctx.clip();
    if (o.art.wear) {
      // wear, not paint: let the shutter's own colour carry through
      ctx.globalAlpha = 0.78;
      drawOnFace(o, o.art.wear, s0, L.housingTop, STOREFRONT_FACE.doorWidth, L.housingTop);
      ctx.globalAlpha = 1;
    }
    // shade under the housing, and at the foot where the shutter meets the pavement
    gradientFill(ctx, opening, at(sf.door, 0, L.doorHeight), at(sf.door, 0, L.doorHeight - 0.5), [
      [0, "rgba(0,0,0,.62)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    gradientFill(ctx, opening, at(sf.door, 0, 0), at(sf.door, 0, 0.3), [
      [0, "rgba(0,0,0,.48)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    ctx.restore();
    // bottom bar and the two guide rails, standing 4 cm proud
    fillPoly(ctx, quad(s0, s1, 0, 0.06, 0.04), "#1c262a");
    for (const [a, b] of [
      [s0 - 0.08, s0],
      [s1, s1 + 0.08],
    ] as const) {
      fillPoly(ctx, quad(a, b, 0, L.doorHeight + 0.02, 0.04), "#34434a");
      fillPoly(
        ctx,
        [
          at(b, 0.04, 0),
          at(b, 0, 0),
          at(b, 0, L.doorHeight + 0.02),
          at(b, 0.04, L.doorHeight + 0.02),
        ],
        "#202c31",
      );
      strokeLine(ctx, at(a, 0.04, 0), at(a, 0.04, L.doorHeight + 0.02), "#6f7f86", 0.8);
    }
    // housing: a steel box across the head, 15 cm proud, lit from above
    const h0 = s0 - 0.12;
    const h1 = s1 + 0.12;
    const hz0 = L.doorHeight;
    const hz1 = L.housingTop + 0.05;
    const proud = 0.15;
    fillPoly(
      ctx,
      [at(h0, 0, hz1), at(h1, 0, hz1), at(h1, proud, hz1), at(h0, proud, hz1)],
      "#64757c",
    );
    fillPoly(
      ctx,
      [at(h1, 0, hz0), at(h1, proud, hz0), at(h1, proud, hz1), at(h1, 0, hz1)],
      "#222e33",
    );
    fillPoly(ctx, quad(h0, h1, hz0, hz1, proud), "#3f4f56");
    strokeLine(ctx, at(h0, proud, hz1), at(h1, proud, hz1), "#8fa0a6", 1);
    strokeLine(ctx, at(h0, proud, hz0), at(h1, proud, hz0), "#161f23", 1.4);
    // the housing's shadow on the wall beside the door
    gradientFill(ctx, quad(h0 - 0.2, h0, hz0, hz1), at(h0, 0, hz0), at(h0 - 0.2, 0, hz0), [
      [0, "rgba(0,0,0,.3)"],
      [1, "rgba(0,0,0,0)"],
    ]);
  }

  // --- fascia, sign, parapet ---------------------------------------------------
  if (signed) {
    const fascia = quad(0, sf.length, L.fasciaBottom, L.fasciaTop);
    const done =
      o.materials &&
      fillMaterial(ctx, o.materials, fascia, {
        key: "facade-concrete",
        basis: wallBasis(
          o.project,
          sf.edge === "north" ? "x" : "y",
          sf.edge === "north" ? sf.structure.rect.y : sf.structure.rect.x + sf.structure.rect.width,
          SURFACE_MATERIALS["facade-concrete"].metres,
          ppm,
        ),
        target: "#493133",
      });
    if (!done) fillPoly(ctx, fascia, "#493133");
    // Enamel panels sit behind a projecting cornice; broad shade, not outline noise.
    gradientFill(ctx, fascia, at(0, 0, L.fasciaTop), at(0, 0, L.fasciaBottom), [
      [0, "rgba(3,7,9,.66)"],
      [0.3, "rgba(3,7,9,.08)"],
      [1, "rgba(3,7,9,.12)"],
    ]);
    for (let s = 3; s < sf.length; s += 3)
      strokeLine(ctx, at(s, 0, L.fasciaBottom), at(s, 0, L.fasciaTop), "rgba(8,10,12,.6)", 1);
    strokeLine(ctx, at(0, 0, L.fasciaBottom), at(sf.length, 0, L.fasciaBottom), "#0f171c", 2);
    strokeLine(
      ctx,
      at(0, 0, L.fasciaBottom + 0.03),
      at(sf.length, 0, L.fasciaBottom + 0.03),
      "#59666c",
      0.8,
    );
    // the awning's shadow on the wall beneath its wall line, and the shop's lintel shade
    gradientFill(
      ctx,
      quad(0, sf.awning.span, L.awningWall - 0.6, L.awningWall),
      at(0, 0, L.awningWall),
      at(0, 0, L.awningWall - 0.6),
      [
        [0, "rgba(0,0,0,.56)"],
        [1, "rgba(0,0,0,0)"],
      ],
    );
    // the sign: a flush light-box, rim, bolts, and tubes lit in code
    const sx0 = SIGN.s0;
    const sx1 = SIGN.s0 + SIGN.width;
    const sz0 = SIGN.z0;
    const sz1 = SIGN.z0 + SIGN.height;
    fillPoly(ctx, quad(sx0, sx1, sz0, sz1, 0.05), "#161a20");
    fillPoly(
      ctx,
      [at(sx1, 0, sz0), at(sx1, 0.05, sz0), at(sx1, 0.05, sz1), at(sx1, 0, sz1)],
      "#0c0f13",
    );
    fillPoly(
      ctx,
      [at(sx0, 0.05, sz1), at(sx1, 0.05, sz1), at(sx1, 0, sz1), at(sx0, 0, sz1)],
      "#59666c",
    );
    const rim = 0.04;
    for (const piece of [
      quad(sx0, sx1, sz1 - rim, sz1, 0.05),
      quad(sx0, sx1, sz0, sz0 + rim, 0.05),
      quad(sx0, sx0 + rim, sz0, sz1, 0.05),
      quad(sx1 - rim, sx1, sz0, sz1, 0.05),
    ])
      fillPoly(ctx, piece, "#46545a");
    for (const [bs, bz] of [
      [sx0 + 0.1, sz0 + 0.1],
      [sx1 - 0.1, sz0 + 0.1],
      [sx0 + 0.1, sz1 - 0.1],
      [sx1 - 0.1, sz1 - 0.1],
    ] as const) {
      const p = at(bs, 0.05, bz);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = "#8d9b9f";
      ctx.fill();
    }
    if (o.art.kanji) {
      // unlit tubes are dull coral glass; the glow pass lights them
      const g = signGlyphs();
      drawOnFace(o, tintedMask(o.art.kanji, "#8a3a4a"), g.s, g.zTop, g.width, g.height, 0.06);
    }
    // parapet coping
    fillPoly(ctx, quad(0, sf.length, L.fasciaTop, L.parapetTop), "#6a6558");
    strokeLine(ctx, at(0, 0, L.parapetTop), at(sf.length, 0, L.parapetTop), "#97a3a1", 1.6);
    strokeLine(ctx, at(0, 0, L.fasciaTop), at(sf.length, 0, L.fasciaTop), "#0f171c", 1.4);
  }

  if (o.art.wall) paintShopCornice(ctx, at, sf.length);

  // --- the downpipe: last, so it runs over the fascia it is fixed to ------------
  const pipe = o.frontage?.pipe;
  if (pipe && reaches(pipe.s - 0.5, pipe.s + 0.5)) paintDownpipe(ctx, o.project, ppm, pipe, "shop");

  ctx.restore();
}

/** Where the kanji cells of the fascia sign sit on the face. */
const signGlyphs = () => {
  const margin = (SIGN.width - 4 * SIGN.cell) / 2;
  return {
    s: SIGN.s0 + margin,
    zTop: SIGN.z0 + SIGN.height - (SIGN.height - SIGN.cell) / 2,
    width: 4 * SIGN.cell,
    height: SIGN.cell,
  };
};

/** Neon tubes, lit: a coloured halo and a pale core, both added. */
function lightKanji(
  o: FaceOptions,
  mask: TileSource,
  g: { s: number; zTop: number; width: number; height: number },
  out: number,
  blur: number,
  /** Metres to thicken the tubes by, for a sign too small to hold thin strokes. */
  bold = 0,
) {
  const { ctx } = o;
  const offsets = bold ? [-bold, 0, bold] : [0];
  ctx.save();
  ctx.shadowColor = "rgba(255,70,110,.9)";
  ctx.shadowBlur = blur;
  const halo = tintedMask(mask, "#ff614b");
  for (const d of offsets)
    drawOnFace(o, halo, g.s + d, g.zTop + (bold ? d : 0), g.width, g.height, out);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.6;
  const core = tintedMask(mask, "#ffe0be");
  for (const d of offsets) drawOnFace(o, core, g.s + d, g.zTop, g.width, g.height, out);
  ctx.restore();
}

/**
 * The light on the face (`light`) and the light the face gives (`glow`), for the
 * same part of it the albedo paints. The caller has already clipped to a cutaway
 * piece; the renderer clips again to the albedo, so nothing here can light a wall
 * that is not there.
 */
function paintFaceLight(
  o: FaceOptions,
  quad: (s0: number, s1: number, z0: number, z1: number, out?: number) => Point[],
  reaches: (a: number, b: number) => boolean,
  signed: boolean,
) {
  const { ctx, sf, ppm } = o;
  const at = facePoint(sf, o.project, ppm);
  const night = INTERSECTION_NIGHT;
  const warm = night.window.color;
  const bottom = L.riser;
  const top = L.glazingTop;
  const door0 = sf.door - STOREFRONT_FACE.doorWidth / 2;
  const door1 = sf.door + STOREFRONT_FACE.doorWidth / 2;
  const housing = { s0: door0 - 0.12, s1: door1 + 0.12, z: L.doorHeight, proud: 0.15 };
  if (o.pass === "light") {
    // the room behind each window is lit: its interior art shows warm, brightest low
    for (const s0 of sf.litBays) {
      const s1 = s0 + STOREFRONT_FACE.bayWidth;
      if (!reaches(s0, s1)) continue;
      // modest: multiplied by the art and the night's gain, this lifts the room to
      // about its painted brightness, warm, instead of washing it out
      gradientFill(ctx, quad(s0, s1, bottom, top), at(s0, 0, bottom), at(s0, 0, top), [
        [0, lightColor(warm, 0.62)],
        [0.6, lightColor(warm, 0.48)],
        [1, lightColor(warm, 0.34)],
      ]);
    }
    // the downlight under the housing washes the shutter's head and the wall beside it
    if (reaches(housing.s0 - 0.6, housing.s1 + 0.6)) {
      const c = at(sf.door, 0, housing.z);
      const r = 1.5 * ppm;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, lightColor(night.entrance.color, 0.45));
      g.addColorStop(1, lightColor(night.entrance.color, 0));
      path(ctx, quad(housing.s0 - 0.6, housing.s1 + 0.6, 0, L.housingTop + 0.05, 0));
      ctx.fillStyle = g;
      ctx.fill();
    }
    // The streetlight's wash on the wall itself is `wallLight.ts`'s, from the lamp's
    // true position, as on every other face it reaches.
    const lamp = streetLamp(sf);
    if (lamp) {
      const c = at(lamp.s, 0, lamp.headZ - 0.8);
      // Edges that face the lamp catch it: the parapet's top lip and the corner pier
      // nearest it, fading with distance. Nothing else on the building is outlined.
      const reach = 6 * ppm;
      const e = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, reach);
      e.addColorStop(0, lightColor(night.lamp.color, 1));
      e.addColorStop(0.5, lightColor(night.lamp.color, 0.35));
      e.addColorStop(1, lightColor(night.lamp.color, 0));
      ctx.fillStyle = e;
      path(ctx, quad(0, sf.length, L.parapetTop - 0.06, L.parapetTop, 0));
      ctx.fill();
      const corner = lamp.s < sf.length / 2 ? 0 : sf.length - 0.1;
      path(ctx, quad(corner, corner + 0.1, 0, L.parapetTop, 0));
      ctx.fill();
    }
    return;
  }
  // glow: what gives light. The glass of each lit window, faintly, over its room.
  for (const s0 of sf.litBays) {
    const s1 = s0 + STOREFRONT_FACE.bayWidth;
    if (!reaches(s0, s1)) continue;
    gradientFill(ctx, quad(s0, s1, bottom, top), at(s0, 0, bottom), at(s0, 0, top), [
      [0, lightColor(warm, 0.15)],
      [0.55, lightColor(warm, 0.06)],
      [1, lightColor(warm, 0.02)],
    ]);
  }
  // the downlight itself: a bright strip on the housing's underside, front edge
  if (reaches(housing.s0, housing.s1)) {
    strokeLine(
      ctx,
      at(housing.s0 + 0.25, housing.proud, housing.z + 0.02),
      at(housing.s1 - 0.25, housing.proud, housing.z + 0.02),
      lightColor(night.entrance.color, 0.95),
      1.6,
    );
    strokeLine(
      ctx,
      at(housing.s0 + 0.3, housing.proud, housing.z + 0.02),
      at(housing.s1 - 0.3, housing.proud, housing.z + 0.02),
      "rgba(255,246,224,.9)",
      0.7,
    );
  }
  if (signed && o.art.kanji)
    lightKanji(o, o.art.kanji, signGlyphs(), 0.06, 5 * Math.max(1, ppm / 12));
}

/**
 * The blade sign: a thin lightbox standing out from the fascia on two brackets, just
 * past the awning's far end, with the shop's name running down it in neon. It is a
 * fixture of the full building, so the renderer shows it only while that wall stands
 * (the cutaway takes the fascia away, and the blade with it) and fades it with its
 * building. Presentation only: it stands 3 m up and blocks nothing.
 */
export const BLADE = {
  /** Metres out from the wall: the brackets bridge the first 0.18 m. */
  out0: 0.18,
  out1: 0.62,
  z0: 2.95,
  z1: 4.15,
  thickness: 0.07,
  cell: 0.24,
} as const;

/** Where the blade stands along the face, or nothing if the face has no room. */
export function bladeSign(sf: Storefront) {
  const { offset, span } = sf.awning;
  const after = offset + span + 0.5;
  const before = offset - 0.5;
  const s = after < sf.length - 0.6 ? after : before > 0.6 ? before : undefined;
  if (s === undefined) return undefined;
  const r = sf.structure.rect;
  // A taller saved shop carries a readable vertical identity above its canopy.
  // Old low buildings keep the original fixture dimensions.
  const scale =
    sf.structure.height >= 6
      ? Math.min(2.4, (sf.structure.height - BLADE.z0 - 0.4) / (BLADE.z1 - BLADE.z0))
      : 1;
  const dimensions = {
    out0: BLADE.out0,
    out1: Math.min(1, BLADE.out0 + (BLADE.out1 - BLADE.out0) * scale),
    z0: BLADE.z0,
    z1: BLADE.z0 + (BLADE.z1 - BLADE.z0) * scale,
    cell: BLADE.cell * scale,
    gap: 0.03 * scale,
  };
  const t = BLADE.thickness / 2;
  const footprint: Rect =
    sf.edge === "north"
      ? {
          x: r.x + s - t,
          y: r.y - dimensions.out1,
          width: 2 * t,
          height: dimensions.out1 - dimensions.out0,
        }
      : {
          x: r.x + r.width + dimensions.out0,
          y: r.y + s - t,
          width: dimensions.out1 - dimensions.out0,
          height: 2 * t,
        };
  return { s, footprint, ...dimensions };
}

/** Draw `image` on the blade's camera-facing side: across from its outer edge to the
 * wall (screen-right, so the glyphs are not mirrored), and down. */
function drawOnBlade(
  ctx: CanvasRenderingContext2D,
  at: (s: number, out: number, z: number) => Point,
  image: TileSource,
  s: number,
  outA: number,
  zTop: number,
  widthM: number,
  heightM: number,
) {
  const o = at(s, outA, zTop);
  const u = at(s, outA - 1, zTop);
  const v = at(s, outA, zTop - 1);
  const t = ctx.getTransform?.();
  const scale = t ? Math.hypot(t.a, t.b) : 1;
  image = sourceFor(
    image,
    Math.hypot(u.x - o.x, u.y - o.y) * widthM * scale,
    Math.hypot(v.x - o.x, v.y - o.y) * heightM * scale,
  );
  const kx = widthM / image.width;
  const ky = heightM / image.height;
  ctx.save();
  ctx.transform((u.x - o.x) * kx, (u.y - o.y) * kx, (v.x - o.x) * ky, (v.y - o.y) * ky, o.x, o.y);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

/** One glyph of a horizontal four-glyph mask, as its own image (cached). */
const glyphCells = new WeakMap<object, HTMLCanvasElement[]>();
function cellsOf(mask: TileSource): HTMLCanvasElement[] {
  const hit = glyphCells.get(mask);
  if (hit) return hit;
  const w = Math.floor(mask.width / 4);
  const cells = [0, 1, 2, 3].map((i) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = mask.height;
    c.getContext("2d")!.drawImage(mask, i * w, 0, w, mask.height, 0, 0, w, mask.height);
    return c;
  });
  glyphCells.set(mask, cells);
  return cells;
}

export function paintBladeSign(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  sf: Storefront,
  art: StorefrontArt,
  pass: Pass,
) {
  const blade = bladeSign(sf);
  if (!blade || pass === "light") return;
  const at = facePoint(sf, project, ppm);
  const { s } = blade;
  const t = BLADE.thickness / 2;
  const { out0, out1, z0, z1, cell, gap } = blade;
  // the side the camera sees is the +s side of the blade
  const side = s + t;
  const panel = [at(side, out1, z1), at(side, out0, z1), at(side, out0, z0), at(side, out1, z0)];
  const inset = 0.04;
  const tube = [
    at(side, out1 - inset, z1 - inset),
    at(side, out0 + inset, z1 - inset),
    at(side, out0 + inset, z0 + inset),
    at(side, out1 - inset, z0 + inset),
  ];
  const glyphZ = (i: number) => z1 - 0.1 - i * (cell + gap);
  const glyphOut = (out0 + out1) / 2 + cell / 2;
  if (pass === "glow") {
    // a neon border tube and the four glyphs, the colour that reads at play zoom
    ctx.save();
    ctx.shadowColor = "rgba(255,70,110,.85)";
    ctx.shadowBlur = Math.max(3, ppm * 0.35);
    path(ctx, tube);
    ctx.strokeStyle = "rgba(255,93,124,.95)";
    ctx.lineWidth = Math.max(1, ppm * 0.07);
    ctx.stroke();
    if (art.kanji) {
      const cells = cellsOf(art.kanji);
      // thickened by a centimetre each way: thin strokes do not survive this size
      const bold = [-0.012, 0, 0.012];
      cells.forEach((c, i) => {
        for (const d of bold)
          drawOnBlade(
            ctx,
            at,
            tintedMask(c, "#ff614b"),
            side,
            glyphOut + d,
            glyphZ(i) + d,
            cell,
            cell,
          );
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.6;
      cells.forEach((c, i) => {
        for (const d of bold)
          drawOnBlade(ctx, at, tintedMask(c, "#ffe0be"), side, glyphOut + d, glyphZ(i), cell, cell);
      });
    }
    ctx.restore();
    return;
  }
  // brackets: two steel arms from the fascia to the panel's inner edge, and a brace
  for (const z of [z1 - 0.12, z0 + 0.12]) {
    strokeLine(ctx, at(s, 0, z), at(s, out0 + 0.02, z), "#11181c", 2.2);
    strokeLine(ctx, at(s, 0, z + 0.02), at(s, out0 + 0.02, z + 0.02), "#6f7d81", 0.7);
  }
  strokeLine(ctx, at(s, 0, z0 - 0.15), at(s, out0, z0 + 0.12), "#11181c", 1.4);
  // the box: its outer edge, its top, then the face the camera sees
  fillPoly(
    ctx,
    [at(s - t, out1, z1), at(side, out1, z1), at(side, out1, z0), at(s - t, out1, z0)],
    "#0b0f13",
  );
  fillPoly(
    ctx,
    [at(s - t, out1, z1), at(s - t, out0, z1), at(side, out0, z1), at(side, out1, z1)],
    "#4a585e",
  );
  fillPoly(ctx, panel, "#14181e");
  path(ctx, panel);
  ctx.strokeStyle = "#3e4b51";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // unlit, the tubes are dull coral glass
  path(ctx, tube);
  ctx.strokeStyle = "#6e3040";
  ctx.lineWidth = Math.max(0.8, ppm * 0.05);
  ctx.stroke();
  if (art.kanji)
    cellsOf(art.kanji).forEach((c, i) =>
      drawOnBlade(ctx, at, tintedMask(c, "#7a3443"), side, glyphOut, glyphZ(i), cell, cell),
    );
}

/**
 * The canvas awning, on the saved attachment: a sloped plane from the wall line at
 * 2.7 m to the outer edge at 2.45 m, the fabric repeated along the span, a hem and
 * two arms. Drawn as its own sprite so it can sort by its footprint and fade for
 * actors under it.
 */
export function paintAwning(o: Omit<FaceOptions, "clip">) {
  const { ctx, sf, ppm } = o;
  const at = facePoint(sf, o.project, ppm);
  const { offset, span, projection } = sf.awning;
  const wall = L.awningWall;
  const outer = L.awningOuter;
  const hem = AWNING_HEM;
  const top = [
    at(offset, 0, wall),
    at(offset + span, 0, wall),
    at(offset + span, projection, outer),
    at(offset, projection, outer),
  ];
  const valance = [
    at(offset, projection, outer),
    at(offset + span, projection, outer),
    at(offset + span, projection, outer - hem),
    at(offset, projection, outer - hem),
  ];
  // Boxed fabric ends and metal edging give the canopy a constructed profile.
  // All planes remain within the saved awning footprint and existing hem height.
  const cheeks = [offset, offset + span].map((s) => [
    at(s, 0, wall),
    at(s, projection, outer),
    at(s, projection, outer - hem),
    at(s, 0, wall - 0.45),
  ]);
  if (o.pass !== "albedo") {
    if (o.pass === "light") for (const cheek of cheeks) paintAwningLight(o, cheek);
    paintAwningLight(o, [...top.slice(0, 3), valance[2]!, valance[3]!]);
    return;
  }
  const slope = Math.hypot(projection, wall - outer);
  const canvasM = 1.6;
  // fabric pattern: u along the span, v down the slope, anchored at the wall edge
  const o0 = at(offset, 0, wall);
  const alongS = at(offset + 1, 0, wall);
  const downSlope = at(offset, projection, outer);
  const basis = {
    origin: o0,
    u: { x: alongS.x - o0.x, y: alongS.y - o0.y },
    v: { x: (downSlope.x - o0.x) / slope, y: (downSlope.y - o0.y) / slope },
  };
  const paintFabric = (pts: Point[], shade: string, from: number) => {
    if (o.art.awning) {
      const pattern = ctx.createPattern(o.art.awning, "repeat");
      if (pattern) {
        pattern.setTransform(
          patternMatrix(
            { ...basis, origin: { x: o0.x + basis.v.x * from, y: o0.y + basis.v.y * from } },
            canvasM,
            o.art.awning.width,
          ),
        );
        ctx.save();
        path(ctx, pts);
        ctx.clip();
        ctx.fillStyle = pattern;
        ctx.fill();
        ctx.fillStyle = shade;
        ctx.fill();
        ctx.restore();
        return;
      }
    }
    fillPoly(ctx, pts, "#527b76");
  };
  // arms first: they run under the fabric from the wall to the outer corners
  for (const s of [offset + 0.05, offset + span - 0.05])
    strokeLine(ctx, at(s, 0, wall - 0.55), at(s, projection - 0.05, outer - 0.02), "#222d31", 2.4);
  cheeks.forEach((cheek, i) => {
    fillPoly(ctx, cheek, i === 0 ? "#374039" : "#242e2b");
    strokeLine(ctx, cheek[3]!, cheek[2]!, "#111d20", 2.2);
    strokeLine(ctx, cheek[0]!, cheek[3]!, "#788274", 1.3);
    // Diagonal brace is fixed to the cheek rather than hanging in empty space.
    strokeLine(ctx, cheek[3]!, cheek[1]!, "#69766b", 1.2);
  });
  paintFabric(top, "rgba(0,0,0,.10)", 0);
  // light is higher at the wall edge and falls off down the slope
  gradientFill(ctx, top, at(offset, 0, wall), at(offset, projection, outer), [
    [0, "rgba(255,255,255,.07)"],
    [1, "rgba(0,0,0,.14)"],
  ]);
  // Tension ribs separate broad cloth panels at the actual play camera scale.
  for (let i = 1; i < 4; i++) {
    const s = offset + (span * i) / 4;
    strokeLine(ctx, at(s, 0, wall), at(s, projection, outer), "rgba(15,28,28,.48)", 1.4);
    strokeLine(
      ctx,
      at(s + 0.025, 0, wall),
      at(s + 0.025, projection, outer),
      "rgba(204,193,153,.3)",
      0.7,
    );
  }
  // the hem folds over the front: the same cloth, darker, with its own stripe phase
  paintFabric(valance, "rgba(0,0,0,.30)", slope);
  strokeLine(ctx, valance[3]!, valance[2]!, "#1b2428", 1.6);
  strokeLine(ctx, top[0]!, top[1]!, "#1b2428", 1.4);
  for (const s of [offset, offset + span]) {
    strokeLine(ctx, at(s, 0, wall), at(s, projection, outer), "#1b2428", 1.1);
    strokeLine(ctx, at(s, projection, outer), at(s, projection, outer - hem), "#1b2428", 1.1);
  }
  // the shop's name, small, in neon tubes on the valance: the one sign the cutaway keeps
  if (o.art.kanji) {
    // a dark lightbox strip on the valance, and the tubes on it, unlit
    const g = valanceGlyphs(sf);
    fillPoly(
      ctx,
      [
        at(g.s - 0.08, g.out, g.zTop + 0.025),
        at(g.s + g.width + 0.08, g.out, g.zTop + 0.025),
        at(g.s + g.width + 0.08, g.out, g.zTop - g.height - 0.025),
        at(g.s - 0.08, g.out, g.zTop - g.height - 0.025),
      ],
      "#12161c",
    );
    drawOnFace(o, tintedMask(o.art.kanji, "#7a3443"), g.s, g.zTop, g.width, g.height, g.out);
  }
}

/**
 * The awning's valance is 0.32 m deep, to carry four 0.25 m glyphs. A vertical
 * surface this shallow is a few pixels tall from this camera, so the sign is a
 * glowing band that reads as lettering only up close; it is the one sign the
 * cutaway keeps.
 */
const AWNING_HEM = 0.32;
const VALANCE_CELL = 0.25;

/** The valance sign, centred on the canopy. */
function valanceGlyphs(sf: Storefront) {
  const { offset, span, projection } = sf.awning;
  const width = 4 * VALANCE_CELL;
  const centre = offset + span / 2;
  return {
    s: centre - width / 2,
    zTop: L.awningOuter - (AWNING_HEM - VALANCE_CELL) / 2,
    width,
    height: VALANCE_CELL,
    out: projection + 0.005,
  };
}

function paintAwningLight(o: Omit<FaceOptions, "clip">, outline: Point[]) {
  const { ctx, sf, ppm } = o;
  const at = facePoint(sf, o.project, ppm);
  if (o.pass === "light") {
    const lamp = streetLamp(sf);
    if (!lamp) return;
    // the streetlight on the canvas, strongest at the end nearest it
    const c = at(lamp.s, Math.min(sf.awning.projection, Math.max(0, lamp.outM)), L.awningWall);
    const r = 3.6 * ppm;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    g.addColorStop(0, lightColor(INTERSECTION_NIGHT.lamp.color, 0.7));
    g.addColorStop(0.5, lightColor(INTERSECTION_NIGHT.lamp.color, 0.22));
    g.addColorStop(1, lightColor(INTERSECTION_NIGHT.lamp.color, 0));
    path(ctx, outline);
    ctx.fillStyle = g;
    ctx.fill();
    return;
  }
  if (o.art.kanji) {
    const g = valanceGlyphs(sf);
    lightKanji(o, o.art.kanji, g, g.out, 3 * Math.max(1, ppm / 12), 0.012);
  }
}

export interface GroundOptions {
  ctx: CanvasRenderingContext2D;
  sf: Storefront;
  project: Project;
  ppm: number;
  structures: readonly SceneStructure[];
  pass: Pass;
}

/** A ground-plane polygon from world points. */
const groundPoly = (project: Project, pts: Point[]) => pts.map(project);

/** Clip to the whole ground except the footprints of buildings: light and shade
 * fall on pavement, never through a building into its cutaway floor. */
function clipToOpenGround(
  ctx: CanvasRenderingContext2D,
  project: Project,
  structures: readonly SceneStructure[],
) {
  ctx.beginPath();
  ctx.rect(-4000, -4000, 8000, 8000);
  for (const s of structures) {
    if (s.style === "interior-wall" || s.style === "mesh-fence") continue;
    const r = s.rect;
    const pts = groundPoly(project, [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height },
    ]);
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  ctx.clip("evenodd");
}

/**
 * The shop's lights on the ground, in world metres: a warm fan out of each window,
 * a pool under the entrance's downlight, and the streetlight's pool under its head.
 * The ground's light sprite and the tint of everyone standing in them both read this.
 */
export function storefrontLights(sf: Storefront, night: NightLighting): GroundLight[] {
  const o = faceWorld(sf, 0, 0);
  const a = faceWorld(sf, 1, 0);
  const b = faceWorld(sf, 0, 1);
  const along = { x: a.x - o.x, y: a.y - o.y };
  const out = { x: b.x - o.x, y: b.y - o.y };
  const lights: GroundLight[] = sf.litBays.map((s0) => ({
    kind: "spill",
    origin: o,
    along,
    out,
    s0,
    s1: s0 + STOREFRONT_FACE.bayWidth,
    reach: night.window.reach,
    spread: night.window.spread,
    color: night.window.color,
    intensity: night.window.intensity,
  }));
  lights.push({
    kind: "pool",
    centre: faceWorld(sf, sf.door, night.entrance.out),
    radius: night.entrance.radius,
    color: night.entrance.color,
    intensity: night.entrance.intensity,
  });
  const lamp = streetLamp(sf);
  if (lamp)
    lights.push({
      kind: "pool",
      centre: lamp.head,
      radius: night.lamp.radius,
      color: night.lamp.color,
      intensity: night.lamp.intensity,
    });
  return lights;
}

/**
 * Painted into the ground canvas: in the albedo, the contact shadow along the
 * building's base and the awning's shadow on the pavement; in the light pass, the
 * shop's lights. All of it falls on open pavement only, never into a footprint.
 */
export function paintStorefrontGround(o: GroundOptions) {
  const { ctx, sf, project } = o;
  if (o.pass === "glow") return;
  const across = (s: number, out: number) => project(faceWorld(sf, s, out));
  ctx.save();
  clipToOpenGround(ctx, project, o.structures);
  if (o.pass === "light") {
    for (const light of storefrontLights(sf, INTERSECTION_NIGHT))
      paintGroundLight(ctx, project, light);
    ctx.restore();
    return;
  }

  // contact shadow along the wall's foot, 0.8 m deep, darkest at the wall
  {
    const strip = groundPoly(project, [
      faceWorld(sf, 0, 0),
      faceWorld(sf, sf.length, 0),
      faceWorld(sf, sf.length, 0.8),
      faceWorld(sf, 0, 0.8),
    ]);
    gradientFill(ctx, strip, across(0, 0), across(0, 0.8), [
      [0, "rgba(2,6,9,.72)"],
      [0.3, "rgba(2,6,9,.3)"],
      [1, "rgba(2,6,9,0)"],
    ]);
  }
  // the awning: a shadow on the pavement under and just beyond its edge
  {
    const { span, offset, projection } = sf.awning;
    const reach = projection + 0.9;
    const shade = groundPoly(project, [
      faceWorld(sf, offset - 0.1, 0),
      faceWorld(sf, offset + span + 0.1, 0),
      faceWorld(sf, offset + span + 0.5, reach),
      faceWorld(sf, offset + 0.5, reach),
    ]);
    gradientFill(ctx, shade, across(offset, 0), across(offset + 0.5, reach), [
      [0, "rgba(2,6,9,.52)"],
      [0.7, "rgba(2,6,9,.28)"],
      [1, "rgba(2,6,9,0)"],
    ]);
  }
  ctx.restore();
}

/** A soft contact shadow on the roof along the two sides of a rooftop unit the camera sees. */
export function paintRoofShade(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  eq: Rect,
  roofH: number,
) {
  const roof = (x: number, y: number): Point => {
    const p = project({ x, y });
    return { x: p.x, y: p.y - roofH };
  };
  const reach = 0.7;
  const north = [
    roof(eq.x, eq.y),
    roof(eq.x + eq.width, eq.y),
    roof(eq.x + eq.width, eq.y - reach),
    roof(eq.x, eq.y - reach),
  ];
  const east = [
    roof(eq.x + eq.width, eq.y),
    roof(eq.x + eq.width, eq.y + eq.height),
    roof(eq.x + eq.width + reach, eq.y + eq.height),
    roof(eq.x + eq.width + reach, eq.y),
  ];
  gradientFill(ctx, north, roof(eq.x, eq.y), roof(eq.x, eq.y - reach), [
    [0, "rgba(4,8,10,.6)"],
    [1, "rgba(4,8,10,0)"],
  ]);
  gradientFill(ctx, east, roof(eq.x + eq.width, eq.y), roof(eq.x + eq.width + reach, eq.y), [
    [0, "rgba(4,8,10,.5)"],
    [1, "rgba(4,8,10,0)"],
  ]);
}

/**
 * Detail on an existing rooftop unit, drawn over its prism: a rimmed lid, a fan with
 * blades and a grille, louvres down its two visible sides, a rust streak, and on
 * every other unit a vent stack. The unit's footprint and height are the renderer's;
 * this adds only what sits on it.
 */
export function paintRooftopUnit(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  eq: Rect,
  roofH: number,
  lidLift: number,
  index: number,
) {
  const lidH = roofH + lidLift;
  const at = (x: number, y: number, lift: number): Point => {
    const p = project({ x, y });
    return { x: p.x, y: p.y - lift };
  };
  // lid rim
  const inset = 0.14;
  const rim = [
    at(eq.x + inset, eq.y + inset, lidH),
    at(eq.x + eq.width - inset, eq.y + inset, lidH),
    at(eq.x + eq.width - inset, eq.y + eq.height - inset, lidH),
    at(eq.x + inset, eq.y + eq.height - inset, lidH),
  ];
  path(ctx, rim);
  ctx.strokeStyle = "rgba(10,16,20,.7)";
  ctx.lineWidth = 1;
  ctx.stroke();
  strokeLine(ctx, rim[0]!, rim[3]!, "rgba(190,200,196,.35)", 0.8);
  strokeLine(ctx, rim[0]!, rim[1]!, "rgba(190,200,196,.35)", 0.8);
  // louvres on the two faces the camera sees
  for (const f of [0.28, 0.5, 0.72]) {
    const z = roofH + lidLift * f;
    strokeLine(
      ctx,
      at(eq.x + 0.2, eq.y, z),
      at(eq.x + eq.width - 0.2, eq.y, z),
      "rgba(8,14,18,.55)",
      0.9,
    );
    strokeLine(
      ctx,
      at(eq.x + eq.width, eq.y + 0.2, z),
      at(eq.x + eq.width, eq.y + eq.height - 0.2, z),
      "rgba(8,14,18,.55)",
      0.9,
    );
  }
  // fan: a world-space circle, so it is the right ellipse for this camera
  const cx = eq.x + eq.width / 2;
  const cy = eq.y + eq.height / 2;
  const c0 = at(cx, cy, lidH);
  const ex = at(cx + 1, cy, lidH);
  const ey = at(cx, cy + 1, lidH);
  ctx.save();
  ctx.transform(ex.x - c0.x, ex.y - c0.y, ey.x - c0.x, ey.y - c0.y, c0.x, c0.y);
  ctx.beginPath();
  ctx.arc(0, 0, 0.66, 0, Math.PI * 2);
  ctx.fillStyle = "#151e23";
  ctx.fill();
  ctx.strokeStyle = "rgba(150,164,164,.55)";
  ctx.lineWidth = 0.035;
  ctx.stroke();
  const turn = index * 0.5;
  for (let k = 0; k < 5; k++) {
    const a = turn + (k * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 0.56, Math.sin(a) * 0.56);
    ctx.strokeStyle = "#35444b";
    ctx.lineWidth = 0.12;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#6c7b7e";
  ctx.fill();
  ctx.strokeStyle = "rgba(150,164,164,.4)";
  ctx.lineWidth = 0.03;
  for (const r of [0.24, 0.42]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // a rust streak down the camera-facing side
  const sx = eq.x + eq.width * (0.3 + (0.35 * ((index * 7) % 3)) / 2);
  strokeLine(ctx, at(sx, eq.y, lidH - 1), at(sx, eq.y, roofH + 1), "rgba(122,74,42,.38)", 1.4);
  // every other unit has a vent stack beside it
  if (index % 2 === 1) {
    const vx = eq.x + eq.width - 0.45;
    const vy = eq.y + 0.5;
    const top = lidH + 0.7 * ppm;
    strokeLine(ctx, at(vx, vy, lidH), at(vx, vy, top), "#2a363b", 4);
    strokeLine(ctx, at(vx - 0.03, vy, lidH), at(vx - 0.03, vy, top), "#6f7e82", 1.2);
    const cap = at(vx, vy, top);
    ctx.beginPath();
    ctx.ellipse(cap.x, cap.y, 4.2, 2.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#4a585d";
    ctx.fill();
    ctx.strokeStyle = "#151e23";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

/**
 * The saved streetlight's shape, from its saved ground position: a pole, and an arm
 * out from the facade over the pavement to a head. The pool it throws is centred
 * under the head, so the light and its source are one thing. `s` and `out` place the
 * head in the storefront's own face coordinates.
 */
export function streetLamp(sf: Storefront, night: NightLighting = INTERSECTION_NIGHT) {
  if (!sf.lamp) return undefined;
  const o = faceWorld(sf, 0, 0);
  const b = faceWorld(sf, 0, 1);
  const arm = sf.arm ?? {
    dir: { x: b.x - o.x, y: b.y - o.y },
    length: night.lamp.arm,
    clear: false,
  };
  const out = arm.dir;
  const head = { x: sf.lamp.x + out.x * arm.length, y: sf.lamp.y + out.y * arm.length };
  const r = sf.structure.rect;
  const s = sf.edge === "north" ? head.x - r.x : head.y - r.y;
  const outM = sf.edge === "north" ? r.y - head.y : head.x - (r.x + r.width);
  return {
    base: sf.lamp,
    head,
    /** World unit vector from the pole toward the head. */
    out,
    reach: arm.length,
    poleZ: night.lamp.poleHeight,
    headZ: night.lamp.poleHeight - 0.15,
    /** The head in face coordinates: metres along the face, and out from it. */
    s,
    outM,
  };
}

/**
 * The saved streetlight: a footing, a tapered pole, a curved arm and a flat
 * cobra head over the pavement. In the glow pass its lens is the one small bright
 * point, with a tight halo; the light it throws is painted where it falls (the
 * ground, the wall, the awning), never here.
 */
export function paintStreetLamp(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  sf: Storefront,
  pass: Pass,
) {
  const lamp = streetLamp(sf);
  if (!lamp || pass === "light") return;
  const at = (p: Point, z: number) => {
    const q = project(p);
    return { x: q.x, y: q.y - z * ppm };
  };
  const along = (t: number): Point => ({
    x: lamp.base.x + lamp.out.x * t,
    y: lamp.base.y + lamp.out.y * t,
  });
  // the head: 0.9 m long along the arm, 0.32 m wide, 0.16 m deep
  const side = { x: -lamp.out.y, y: lamp.out.x };
  const corner = (t: number, w: number, z: number) =>
    at({ x: along(t).x + side.x * w, y: along(t).y + side.y * w }, z);
  const reach = lamp.reach;
  const h0 = reach - 0.55;
  const h1 = reach + 0.35;
  const zTop = lamp.headZ + 0.12;
  const zBot = lamp.headZ - 0.04;
  if (pass === "glow") {
    // a faint cone from the lens to the pavement ties the fixture to its pool
    const lensMid = at(along((h0 + h1) / 2 + 0.05), zBot);
    const pool = INTERSECTION_NIGHT.lamp.radius * 0.38;
    const footL = at({ x: lamp.head.x - side.x * pool, y: lamp.head.y - side.y * pool }, 0);
    const footR = at({ x: lamp.head.x + side.x * pool, y: lamp.head.y + side.y * pool }, 0);
    const cone = ctx.createLinearGradient(lensMid.x, lensMid.y, lensMid.x, (footL.y + footR.y) / 2);
    cone.addColorStop(0, "rgba(255,214,150,.09)");
    cone.addColorStop(0.5, "rgba(255,204,140,.03)");
    cone.addColorStop(1, "rgba(255,200,130,0)");
    // a haze, not a solid: no hard boundary for the eye to find
    ctx.save();
    ctx.filter = `blur(${Math.max(2, ppm * 0.35)}px)`;
    path(ctx, [
      { x: lensMid.x - 3, y: lensMid.y },
      { x: lensMid.x + 3, y: lensMid.y },
      footR,
      footL,
    ]);
    ctx.fillStyle = cone;
    ctx.fill();
    ctx.restore();
    // the lens: one small, bright point under the head, with a tight halo
    const r = 0.7 * ppm;
    const g = ctx.createRadialGradient(lensMid.x, lensMid.y, 0, lensMid.x, lensMid.y, r);
    g.addColorStop(0, "rgba(255,222,166,.7)");
    g.addColorStop(0.3, "rgba(255,200,130,.2)");
    g.addColorStop(1, "rgba(255,190,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(lensMid.x - r, lensMid.y - r, r * 2, r * 2);
    strokeLine(
      ctx,
      corner(h0 + 0.3, 0, zBot),
      corner(h1 - 0.2, 0, zBot),
      "rgba(255,236,196,.95)",
      1.3,
    );
    return;
  }
  const base = at(lamp.base, 0);
  // contact shadow, footing and base plate
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 6.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(2,6,9,.5)";
  ctx.fill();
  const foot = (z: number, w: number) => [
    at({ x: lamp.base.x - w, y: lamp.base.y - w }, z),
    at({ x: lamp.base.x + w, y: lamp.base.y - w }, z),
    at({ x: lamp.base.x + w, y: lamp.base.y + w }, z),
    at({ x: lamp.base.x - w, y: lamp.base.y + w }, z),
  ];
  const f0 = foot(0, 0.16);
  const f1 = foot(0.35, 0.16);
  fillPoly(ctx, [f0[0]!, f0[1]!, f1[1]!, f1[0]!], "#2a3539");
  fillPoly(ctx, [f0[1]!, f0[2]!, f1[2]!, f1[1]!], "#1a2327");
  fillPoly(ctx, f1, "#56646a");
  // a tapered pole, its edge caught by the light above it
  const top = at(lamp.base, lamp.poleZ);
  const low = at(lamp.base, 0.35);
  fillPoly(
    ctx,
    [
      { x: low.x - 2.2, y: low.y },
      { x: low.x + 2.2, y: low.y },
      { x: top.x + 1.3, y: top.y },
      { x: top.x - 1.3, y: top.y },
    ],
    "#141c20",
  );
  strokeLine(ctx, { x: low.x - 1.2, y: low.y }, { x: top.x - 0.6, y: top.y }, "#8c9a9c", 0.9);
  // the arm: a curve rising off the pole and settling onto the head
  const a0 = at(lamp.base, lamp.poleZ - 0.1);
  const a1 = at(along(reach * 0.35), lamp.poleZ + 0.18);
  const a2 = at(along(h0 + 0.05), lamp.headZ + 0.08);
  ctx.beginPath();
  ctx.moveTo(a0.x, a0.y);
  ctx.quadraticCurveTo(a1.x, a1.y, a2.x, a2.y);
  ctx.strokeStyle = "#141c20";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(a0.x, a0.y - 0.9);
  ctx.quadraticCurveTo(a1.x, a1.y - 0.9, a2.x, a2.y - 0.9);
  ctx.strokeStyle = "#7f8d90";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.lineCap = "butt";
  // the cobra head: a low box, tapered toward its nose
  const topFace = [
    corner(h0, -0.13, zTop),
    corner(h1, -0.1, zTop - 0.04),
    corner(h1, 0.1, zTop - 0.04),
    corner(h0, 0.13, zTop),
  ];
  const sideA = [
    corner(h0, -0.16, zBot),
    corner(h1, -0.12, zBot),
    corner(h1, -0.1, zTop - 0.04),
    corner(h0, -0.13, zTop),
  ];
  const sideB = [
    corner(h0, 0.16, zBot),
    corner(h1, 0.12, zBot),
    corner(h1, 0.1, zTop - 0.04),
    corner(h0, 0.13, zTop),
  ];
  const nose = [
    corner(h1, -0.12, zBot),
    corner(h1, 0.12, zBot),
    corner(h1, 0.1, zTop - 0.04),
    corner(h1, -0.1, zTop - 0.04),
  ];
  const back = [
    corner(h0, -0.16, zBot),
    corner(h0, 0.16, zBot),
    corner(h0, 0.13, zTop),
    corner(h0, -0.13, zTop),
  ];
  for (const face of [back, sideA, sideB, nose]) fillPoly(ctx, face, "#1b2529");
  fillPoly(ctx, topFace, "#4b5a60");
  path(ctx, hull([...topFace, ...sideA, ...sideB]));
  ctx.strokeStyle = "#0a1013";
  ctx.lineWidth = 0.9;
  ctx.stroke();
  strokeLine(ctx, topFace[0]!, topFace[1]!, "#8d9b9e", 0.7);
  // unlit, the lens is a dull sliver of glass
  const lens = [
    corner(h0 + 0.1, -0.12, zBot),
    corner(h1 - 0.06, -0.12, zBot),
    corner(h1 - 0.06, 0.12, zBot),
    corner(h0 + 0.1, 0.12, zBot),
  ];
  strokeLine(ctx, lens[0]!, lens[1]!, "#80857a", 1);
}
