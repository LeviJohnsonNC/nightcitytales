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

/** Substantial shop joinery around existing openings; no invented doorway or bay. */
export function paintRetailFrames(
  ctx: CanvasRenderingContext2D,
  at: At,
  length: number,
  bays: readonly number[],
  doors: readonly number[],
  sill = 0.65,
) {
  const poly = (pts: Point[], color: string) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const face = (a: number, b: number, lo: number, hi: number, color: string, out = 0.08) =>
    poly([at(a, out, lo), at(b, out, lo), at(b, out, hi), at(a, out, hi)], color);
  const cap = (a: number, b: number, z: number) =>
    poly([at(a, 0, z), at(b, 0, z), at(b, 0.12, z), at(a, 0.12, z)], "#afa68e");
  ctx.save();
  // Enamel stall risers read as a continuous shop base, with recessed panels.
  for (const s of bays) {
    const end = s + 2.2;
    face(s, end, 0.06, sill - 0.04, "#263e39", 0.025);
    face(s + 0.14, end - 0.14, 0.16, sill - 0.16, "#172b29", 0.03);
    face(s + 0.15, end - 0.15, sill - 0.2, sill - 0.17, "#687566", 0.04);
    // Jambs frame the opening without changing its aperture.
    for (const [a, b] of [
      [Math.max(0, s - 0.18), s - 0.03],
      [end + 0.03, Math.min(length, end + 0.18)],
    ] as const) {
      if (b <= a) continue;
      face(a, b, 0.08, 2.57, "#8b8270");
      face(b - 0.035, b, 0.08, 2.57, "#3a4039", 0.12);
      face(a, a + 0.025, 0.12, 2.57, "#b0a58b", 0.12);
      face(a, b, 0.1, 0.4, "#56594e", 0.12);
    }
    face(Math.max(0, s - 0.18), Math.min(length, end + 0.18), 2.4, 2.58, "#807662", 0.12);
    cap(Math.max(0, s - 0.18), Math.min(length, end + 0.18), 2.58);
    // The small transom sits above the original glass, under the masonry lintel.
    face(s, end, 2.36, 2.42, "#1e2b28", 0.04);
  }
  for (const centre of doors) {
    const a = Math.max(0, centre - 0.96),
      b = Math.min(length, centre + 0.96);
    // Deep dark returns distinguish the saved entrance from display glazing.
    face(a, a + 0.13, 0, 2.55, "#40463b", 0.11);
    face(b - 0.13, b, 0, 2.55, "#252e28", 0.11);
    face(a, b, 2.43, 2.62, "#8d8068", 0.14);
    cap(a, b, 2.62);
  }
  ctx.restore();
}
