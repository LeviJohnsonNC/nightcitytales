/**
 * The storefront as data: what a painter is drawing, the art it may use, the shop's
 * face read from the saved structure (`storefrontFor`), the streetlight's arm
 * (`lampArm`) and the face's coordinate helpers. See `../storefront.ts`.
 */
import type { Point, Rect, SceneAttachment, SceneEnvironment, SceneStructure } from "@/engine";
import type { Downpipe } from "../frontage";
import { INTERSECTION_NIGHT } from "../nightLighting";
import type { MaterialSet, TileSource } from "../surfaceMaterials";
import { hull } from "./draw";

/**
 * What a painter is drawing. `albedo` is the art as it is under no light at all
 * but the ambient; `light` is the light that FALLS on a surface, which the renderer
 * multiplies by that surface's albedo; `glow` is light a surface GIVES (a lit lens,
 * a window's glass, neon), added as it is.
 */
export type Pass = "albedo" | "light" | "glow";

export const STOREFRONT_ART_FILES = {
  paintedFrontage: "/images/architecture/painted/market-frontage.webp",
  paintedInterior: "/images/architecture/painted/market-interior.webp",
  paintedCanopy: "/images/architecture/painted/market-canopy.webp",
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

export type Project = (p: Point) => Point;
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
