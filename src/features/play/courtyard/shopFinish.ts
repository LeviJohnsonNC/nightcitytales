/** Neutral, world-scaled shop cladding. Draw before openings; never saved geometry. */
import type { Point } from "@/engine";
import { sourceFor } from "./architectureArt";
import type { TileSource } from "./surfaceMaterials";

export const SHOP_FINISH = { width: 2.0625, height: 2.75 } as const;
type At = (s: number, out: number, z: number) => Point;

/** The caller's cutaway clip remains in force. The field never extends above the fascia. */
export function paintShopFinish(
  ctx: CanvasRenderingContext2D,
  at: At,
  length: number,
  image: TileSource | undefined,
) {
  if (!image) return;
  const { width, height } = SHOP_FINISH;
  const p = at(0, 0, height);
  const u = at(width, 0, height);
  const v = at(0, 0, 0);
  const t = ctx.getTransform();
  const device = (a: Point) =>
    Math.hypot(t.a * (a.x - p.x) + t.c * (a.y - p.y), t.b * (a.x - p.x) + t.d * (a.y - p.y));
  const img = sourceFor(image, device(u), device(v));
  ctx.save();
  ctx.beginPath();
  [at(0, 0, 0), at(length, 0, 0), at(length, 0, height), p].forEach((a, i) =>
    i ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y),
  );
  ctx.closePath();
  ctx.clip();
  ctx.transform(
    (u.x - p.x) / img.width,
    (u.y - p.y) / img.width,
    (v.x - p.x) / img.height,
    (v.y - p.y) / img.height,
    p.x,
    p.y,
  );
  ctx.imageSmoothingEnabled = true;
  for (let s = 0; s < length; s += width) ctx.drawImage(img, (s / width) * img.width, 0);
  ctx.restore();
}

/** A built lintel, with a soffit and top ledge. Shared by the shop's two elevations. */
export function paintShopCornice(ctx: CanvasRenderingContext2D, at: At, length: number) {
  const poly = (points: Point[], color: string | CanvasGradient) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  // The 18 cm projection is wholly decorative, inside the existing face clip's apron.
  const z = 2.74,
    top = 2.86,
    proud = 0.18;
  const g = ctx.createLinearGradient(
    at(0, 0, z).x,
    at(0, 0, z).y,
    at(0, 0, z - 0.4).x,
    at(0, 0, z - 0.4).y,
  );
  g.addColorStop(0, "rgba(4,8,9,.62)");
  g.addColorStop(1, "rgba(4,8,9,0)");
  poly([at(0, 0, z), at(length, 0, z), at(length, 0, z - 0.4), at(0, 0, z - 0.4)], g);
  // Actual structural planes: dark soffit, aged stone front, lighter top.
  poly([at(0, 0, z), at(length, 0, z), at(length, proud, z), at(0, proud, z)], "#202923");
  poly(
    [at(0, proud, z), at(length, proud, z), at(length, proud, top), at(0, proud, top)],
    "#817966",
  );
  poly([at(0, 0, top), at(length, 0, top), at(length, proud, top), at(0, proud, top)], "#aaa18a");
}
