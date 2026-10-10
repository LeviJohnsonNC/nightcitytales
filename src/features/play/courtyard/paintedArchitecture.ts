/** Painted architectural bays registered to existing apertures. The nine regions
 * share the face transform and caller's cutaway clip; no geometry is authored here. */
import type { Point } from "@/engine";
import { sourceFor } from "./architectureArt";
import type { TileSource } from "./surfaceMaterials";

export interface FacadeRect {
  s0: number;
  s1: number;
  z0: number;
  z1: number;
}

/** Measured glass edges in the returned 887px panels, not prompt estimates. */
export const PAINTED_APERTURE = {
  upper: { x0: 204 / 887, x1: 684 / 887, y0: 240 / 887, y1: 568 / 887 },
  frontage: { x0: 204 / 887, x1: 684 / 887, y0: 228 / 887, y1: 572 / 887 },
} as const;

export function facadeSlices(outer: FacadeRect, opening: FacadeRect) {
  if (
    outer.s0 > opening.s0 ||
    outer.s1 < opening.s1 ||
    outer.z0 > opening.z0 ||
    outer.z1 < opening.z1
  )
    return undefined;
  return {
    x: [outer.s0, opening.s0, opening.s1, outer.s1],
    z: [outer.z1, opening.z1, opening.z0, outer.z0],
  };
}

export function paintArchitecturalBay(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource | undefined,
  at: (s: number, out: number, z: number) => Point,
  outer: FacadeRect,
  opening: FacadeRect,
  kind: keyof typeof PAINTED_APERTURE,
  /** Ground floors retain their separate interior and emission passes. */
  surroundOnly = false,
) {
  const grid = facadeSlices(outer, opening);
  if (!image || !grid) return false;
  const origin = at(0, 0, 0),
    u = at(1, 0, 0),
    v = at(0, 0, -1);
  const t = ctx.getTransform();
  const size = (p: Point) =>
    Math.hypot(
      t.a * (p.x - origin.x) + t.c * (p.y - origin.y),
      t.b * (p.x - origin.x) + t.d * (p.y - origin.y),
    );
  const src = sourceFor(
    image as TileSource,
    size(u) * (outer.s1 - outer.s0),
    size(v) * (outer.z1 - outer.z0),
  );
  const aperture = PAINTED_APERTURE[kind];
  const sx = [0, aperture.x0 * src.width, aperture.x1 * src.width, src.width];
  const sy = [0, aperture.y0 * src.height, aperture.y1 * src.height, src.height];
  ctx.save();
  ctx.transform(u.x - origin.x, u.y - origin.y, v.x - origin.x, v.y - origin.y, origin.x, origin.y);
  ctx.imageSmoothingEnabled = true;
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      if (surroundOnly && row === 1 && col === 1) continue;
      const width = grid.x[col + 1]! - grid.x[col]!;
      const height = grid.z[row]! - grid.z[row + 1]!;
      if (width <= 0 || height <= 0) continue;
      ctx.drawImage(
        src,
        sx[col]!,
        sy[row]!,
        sx[col + 1]! - sx[col]!,
        sy[row + 1]! - sy[row]!,
        grid.x[col]!,
        -grid.z[row]!,
        width,
        height,
      );
    }
  ctx.restore();
  return true;
}
