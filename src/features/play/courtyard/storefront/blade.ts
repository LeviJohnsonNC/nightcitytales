/** The storefront's blade sign. See `../storefront.ts`. */
import type { Point, Rect } from "@/engine";
import { sourceFor } from "../architectureArt";
import type { TileSource } from "../surfaceMaterials";
import { fillPoly, path, strokeLine } from "./draw";
import { tintedMask } from "./face";
import { facePoint, type Pass, type Project, type Storefront, type StorefrontArt } from "./model";

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
  const beside = after < sf.length - 0.6 ? after : before > 0.6 ? before : undefined;
  // A full-width canopy still needs the market identity. On tall fronts the
  // existing sign bottom clears the canopy, so mount it above the end bay.
  const s = beside ?? (sf.structure.height >= 6 && sf.length >= 2 ? sf.length - 0.5 : undefined);
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
    ctx.shadowColor = "rgba(255,24,122,.95)";
    ctx.shadowBlur = Math.max(3, ppm * 0.35);
    path(ctx, tube);
    ctx.strokeStyle = "rgba(255,60,155,1)";
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
            tintedMask(c, "#ff389d"),
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
