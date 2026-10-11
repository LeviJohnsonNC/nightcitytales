/** Canvas primitives shared by the storefront's painters. See `../storefront.ts`. */
import type { Point } from "@/engine";

export const hull = (points: Point[]): Point[] => {
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

export const path = (ctx: CanvasRenderingContext2D, pts: readonly Point[]) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
};
export const fillPoly = (ctx: CanvasRenderingContext2D, pts: readonly Point[], fill: string) => {
  path(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
};
export const strokeLine = (
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
export const gradientFill = (
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
