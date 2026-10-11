/** Constructed facade volumes. Apertures stay on the registered artwork/light plane;
 * stone and metal project around them. All coordinates are metres on the host face. */
import type { Point } from "@/engine";
import { fillMaterial, type MaterialSet } from "./surfaceMaterials";
import type { FacadeRect } from "./paintedArchitecture";

type At = (s: number, out: number, z: number) => Point;
export function architecturalDepth(
  ctx: CanvasRenderingContext2D,
  at: At,
  warm: boolean,
  materials?: MaterialSet,
) {
  const palette = warm
    ? { face: "#554c40", top: "#756b56", side: "#343731", dark: "#242b29" }
    : { face: "#47534f", top: "#69766b", side: "#293d3e", dark: "#1c2a2d" };
  const fill = (ps: Point[], color: string | CanvasGradient) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (typeof color === "string" && color.startsWith("#")) {
      const o = at(0, 0, 0),
        u = at(1, 0, 0),
        v = at(0, 0, -1);
      fillMaterial(ctx, materials, ps, {
        key: "facade-concrete",
        target: color,
        strength: 0.85,
        basis: { origin: o, u: { x: u.x - o.x, y: u.y - o.y }, v: { x: v.x - o.x, y: v.y - o.y } },
      });
    }
  };
  const panel = (a: number, b: number, lo: number, hi: number, out: number, color: string) =>
    fill([at(a, out, lo), at(b, out, lo), at(b, out, hi), at(a, out, hi)], color);
  const slab = (a: number, b: number, lo: number, hi: number, out: number) => {
    // Five visible planes, with the wall connection and underside clearly separated.
    fill([at(a, 0, lo), at(b, 0, lo), at(b, out, lo), at(a, out, lo)], palette.dark);
    panel(a, b, lo, hi, out, palette.face);
    for (const x of [a, b])
      fill([at(x, 0, lo), at(x, out, lo), at(x, out, hi), at(x, 0, hi)], palette.side);
    fill([at(a, 0, hi), at(b, 0, hi), at(b, out, hi), at(a, out, hi)], palette.top);
    panel(a, b, hi - 0.035, hi, out, palette.top);
  };
  const shade = (a: number, b: number, z: number, drop: number, opacity = 0.48) => {
    const p = at(a, 0, z),
      q = at(a, 0, z - drop);
    const g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
    g.addColorStop(0, `rgba(7,16,18,${opacity})`);
    g.addColorStop(1, "rgba(7,16,18,0)");
    fill([at(a, 0, z), at(b, 0, z), at(b, 0, z - drop), at(a, 0, z - drop)], g);
  };
  const bay = (w: FacadeRect, depth = 0.34) => {
    const { s0: a, s1: b, z0: lo, z1: hi } = w;
    shade(a - 0.19, b + 0.19, lo, 0.46, 0.55);
    // Forward jambs make the fixed glass plane read as a deep recess, without
    // moving an emission mask or pretending a new opening is traversable.
    for (const [x, far] of [
      [a - 0.14, a],
      [b, b + 0.14],
    ]) {
      slab(x!, far!, lo - 0.1, hi + 0.14, depth);
    }
    fill([at(a, depth, hi), at(b, depth, hi), at(b, 0, hi), at(a, 0, hi)], palette.dark);
    fill([at(a, depth, lo), at(b, depth, lo), at(b, 0, lo), at(a, 0, lo)], palette.top);
    slab(a - 0.23, b + 0.23, lo - 0.18, lo - 0.06, depth + 0.13);
    slab(a - 0.2, b + 0.2, hi + 0.04, hi + 0.21, depth + 0.09);
    shade(a, b, hi, 0.34, 0.54);
  };
  const course = (length: number, z: number, depth = 0.4) => {
    shade(0, length, z - 0.19, 0.68, 0.6);
    slab(0.02, length - 0.02, z - 0.2, z - 0.02, depth * 0.7);
    slab(0, length, z - 0.02, z + 0.12, depth);
    // Broad spandrel, then one cap catching the edge, rather than parallel outlines.
    panel(0.08, length - 0.08, z - 0.34, z - 0.2, 0.1, palette.dark);
  };
  const pier = (a: number, b: number, lo: number, hi: number) => {
    panel(b, b + 0.14, lo, hi, 0, "rgba(8,18,19,.35)");
    slab(a, b, lo, hi, 0.2);
    slab(a - 0.07, b + 0.07, lo, lo + 0.19, 0.29);
    slab(a - 0.08, b + 0.08, hi - 0.23, hi, 0.3);
  };
  return { bay, course, pier, slab, shade };
}
