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
  awning: "/images/storefront/awning-fabric.webp",
  wear: "/images/storefront/shutter-wear.webp",
  kanji: "/images/signs/shenye-ichiba.webp",
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
  return { structure, awning, edge, length, door, bays, litBays, ...(lamp ? { lamp } : {}) };
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

  // --- the wall's own trim: base shade, pier lines at both corners ------------
  gradientFill(ctx, quad(0, sf.length, 0, 0.5), at(0, 0, 0), at(0, 0, 0.5), [
    [0, "rgba(6,12,16,.34)"],
    [1, "rgba(6,12,16,0)"],
  ]);
  for (const s of [0.02, sf.length - 0.02]) {
    strokeLine(ctx, at(s, 0, 0), at(s, 0, L.parapetTop), "#10191f", 3);
    strokeLine(ctx, at(s, 0, 0), at(s, 0, L.parapetTop), "#6c7571", 0.8);
  }

  // --- window bays ---------------------------------------------------------
  const depth = 0.12;
  const frame = 0.07;
  o.sf.bays.forEach((s0, index) => {
    const s1 = s0 + STOREFRONT_FACE.bayWidth;
    // A cutaway piece paints only the bays it actually carries.
    if (!reaches(s0, s1)) return;
    const top = L.glazingTop;
    const bottom = L.riser;
    // stall riser: painted steel panel under the glass, with a kick plate
    fillPoly(ctx, quad(s0, s1, 0, bottom), "#2c383b");
    fillPoly(ctx, quad(s0 + 0.08, s1 - 0.08, 0.1, bottom - 0.1), "#344246");
    strokeLine(ctx, at(s0 + 0.08, 0, bottom - 0.1), at(s1 - 0.08, 0, bottom - 0.1), "#55646a", 1);
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
      "#10191d",
    );
    gradientFill(
      ctx,
      quad(s0, s1, bottom, bottom + 0.5, -depth),
      at(s0, -depth, bottom),
      at(s0, -depth, bottom + 0.5),
      [
        [0, "rgba(0,0,0,.0)"],
        [1, "rgba(0,0,0,0)"],
      ],
    );
    // inner shadow under the head
    gradientFill(ctx, quad(s0, s1, top - 0.45, top, 0), at(s0, 0, top), at(s0, 0, top - 0.45), [
      [0, "rgba(0,0,0,.42)"],
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
  });

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
      [0, "rgba(0,0,0,.5)"],
      [1, "rgba(0,0,0,0)"],
    ]);
    gradientFill(ctx, opening, at(sf.door, 0, 0), at(sf.door, 0, 0.3), [
      [0, "rgba(0,0,0,.35)"],
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
        target: "#313d43",
      });
    if (!done) fillPoly(ctx, fascia, "#313d43");
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
        [0, "rgba(0,0,0,.42)"],
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
    fillPoly(ctx, quad(0, sf.length, L.fasciaTop, L.parapetTop), "#3a464b");
    strokeLine(ctx, at(0, 0, L.parapetTop), at(sf.length, 0, L.parapetTop), "#97a3a1", 1.6);
    strokeLine(ctx, at(0, 0, L.fasciaTop), at(sf.length, 0, L.fasciaTop), "#0f171c", 1.4);
  }

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
  const halo = tintedMask(mask, "#ff5d7c");
  for (const d of offsets)
    drawOnFace(o, halo, g.s + d, g.zTop + (bold ? d : 0), g.width, g.height, out);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.6;
  const core = tintedMask(mask, "#ffd7df");
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
      gradientFill(ctx, quad(s0, s1, bottom, top), at(s0, 0, bottom), at(s0, 0, top), [
        [0, lightColor(warm, 0.95)],
        [0.6, lightColor(warm, 0.7)],
        [1, lightColor(warm, 0.45)],
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
    // the streetlight's wash on the end of the wall nearest it
    const lamp = streetLamp(sf);
    if (lamp) {
      const c = at(lamp.s, 0, lamp.headZ - 0.8);
      const r = 4.6 * ppm;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, lightColor(night.lamp.color, 0.6));
      g.addColorStop(0.45, lightColor(night.lamp.color, 0.22));
      g.addColorStop(1, lightColor(night.lamp.color, 0));
      path(ctx, quad(0, sf.length, 0, L.parapetTop + 0.1, 0));
      ctx.fillStyle = g;
      ctx.fill();
    }
    return;
  }
  // glow: what gives light. The glass of each lit window, faintly, over its room.
  for (const s0 of sf.litBays) {
    const s1 = s0 + STOREFRONT_FACE.bayWidth;
    if (!reaches(s0, s1)) continue;
    gradientFill(ctx, quad(s0, s1, bottom, top), at(s0, 0, bottom), at(s0, 0, top), [
      [0, lightColor(warm, 0.26)],
      [0.55, lightColor(warm, 0.11)],
      [1, lightColor(warm, 0.05)],
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
  if (o.pass !== "albedo") {
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
  paintFabric(top, "rgba(0,0,0,.10)", 0);
  // light is higher at the wall edge and falls off down the slope
  gradientFill(ctx, top, at(offset, 0, wall), at(offset, projection, outer), [
    [0, "rgba(255,255,255,.07)"],
    [1, "rgba(0,0,0,.14)"],
  ]);
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
      [0, "rgba(2,6,9,.62)"],
      [0.35, "rgba(2,6,9,.26)"],
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
  const out = { x: b.x - o.x, y: b.y - o.y };
  const head = { x: sf.lamp.x + out.x * night.lamp.arm, y: sf.lamp.y + out.y * night.lamp.arm };
  const r = sf.structure.rect;
  const s = sf.edge === "north" ? head.x - r.x : head.y - r.y;
  const outM = sf.edge === "north" ? r.y - head.y : head.x - (r.x + r.width);
  return {
    base: sf.lamp,
    head,
    /** World unit vector from the pole toward the head. */
    out,
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
  const reach = INTERSECTION_NIGHT.lamp.arm;
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
    cone.addColorStop(0, "rgba(255,214,150,.16)");
    cone.addColorStop(0.5, "rgba(255,204,140,.05)");
    cone.addColorStop(1, "rgba(255,200,130,0)");
    path(ctx, [
      { x: lensMid.x - 3, y: lensMid.y },
      { x: lensMid.x + 3, y: lensMid.y },
      footR,
      footL,
    ]);
    ctx.fillStyle = cone;
    ctx.fill();
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
