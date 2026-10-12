/**
 * The storefront's face: the wall, windows, shutter door, fascia and its kanji sign,
 * and the light on and from them. See `../storefront.ts`.
 */
import type { Point } from "@/engine";
import { architecturalDepth } from "../architecturalDepth";
import { sourceFor } from "../architectureArt";
import { paintDownpipe, paintPlinth, solidSpans } from "../frontage";
import { INTERSECTION_NIGHT, lightColor } from "../nightLighting";
import { paintArchitecturalBay } from "../paintedArchitecture";
import {
  paintShopFinish,
  paintShopCornice,
  paintRetailFrames,
  paintShopDisplay,
} from "../shopFinish";
import {
  STOREFRONT_FACE,
  STOREFRONT_LEVELS as L,
  STOREFRONT_SIGN as SIGN,
} from "../storefrontPack";
import { SURFACE_MATERIALS, fillMaterial, wallBasis, type TileSource } from "../surfaceMaterials";
import { fillPoly, gradientFill, hull, path, strokeLine } from "./draw";
import { streetLamp } from "./lamp";
import { facePoint, type FaceOptions, type Storefront } from "./model";

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
export function drawOnFace(
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
export function tintedMask(mask: TileSource, color: string): HTMLCanvasElement {
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
    const corners = [-0.4, 0.3].flatMap((out) => [
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
  for (const start of sf.bays)
    paintArchitecturalBay(
      ctx,
      o.art.paintedFrontage,
      at,
      { s0: Math.max(0, start - 0.4), s1: Math.min(sf.length, start + 2.6), z0: 0.07, z1: 2.74 },
      { s0: start, s1: start + 2.2, z0: L.riser, z1: L.glazingTop },
      "frontage",
      true,
    );

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
  const depth = 0.34;
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
    const interior = o.art.paintedInterior ?? o.art.window;
    if (interior) {
      drawOnFace(
        o,
        interior,
        s0,
        top,
        STOREFRONT_FACE.bayWidth,
        top - bottom,
        -depth,
        index % 2 === 1,
      );
      // dim the room so it reads as interior, not as a second facade
      fillPoly(ctx, opening, "rgba(8,16,20,.16)");
    } else {
      fillPoly(ctx, opening, "#1a272c");
    }
    if (!o.art.paintedInterior) paintShopDisplay(ctx, at, s0, bottom, top, index);
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
    architecturalDepth(ctx, at, true, o.materials).bay({ s0, s1, z0: bottom, z1: top }, 0.25);
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
    // Open market doorway: recessed goods, a clear tiled threshold, curtain overhead.
    ctx.save();
    path(ctx, quad(s0, s1, 0.04, 1.88));
    ctx.clip();
    fillPoly(ctx, quad(s0, s1, 0.04, 1.88), "#2d3429");
    const goods = o.art.paintedInterior ?? o.art.window;
    if (goods) drawOnFace(o, goods, s0, 1.84, s1 - s0, 1.55, -0.42);
    fillPoly(
      ctx,
      [at(s0, 0, 0.04), at(s1, 0, 0.04), at(s1, -0.42, 0.04), at(s0, -0.42, 0.04)],
      "#9b8962",
    );
    fillPoly(
      ctx,
      [at(s0, 0, 0.04), at(s0, 0, 1.88), at(s0, -0.42, 1.88), at(s0, -0.42, 0.04)],
      "#6d6850",
    );
    fillPoly(
      ctx,
      [at(s1, 0, 0.04), at(s1, 0, 1.88), at(s1, -0.42, 1.88), at(s1, -0.42, 0.04)],
      "#313c31",
    );
    ctx.restore();
    fillPoly(ctx, quad(s0, s1, 1.84, 1.9, 0.04), "#6c7973");
    // The guide rails still reach the pavement.

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
      quad(sf.awning.offset, sf.awning.offset + sf.awning.span, L.awningWall - 1.15, L.awningWall),
      at(0, 0, L.awningWall),
      at(0, 0, L.awningWall - 1.15),
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
export function lightKanji(
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
    if (reaches(door0, door1))
      fillPoly(ctx, quad(door0, door1, 0.05, 1.84), lightColor(warm, 0.64));
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
