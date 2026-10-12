import type { Point, Rect } from "@/engine";

export type Project = (p: Point) => Point;

export function painter(ctx: CanvasRenderingContext2D, project: Project) {
  /** A null colour strokes the outline only: its fill was laid as a material. */
  const poly = (points: Point[], color: string | null, stroke?: string) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (color) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  };
  const corners = (r: Rect, z = 0) =>
    [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height },
    ].map((p) => {
      const q = project(p);
      return { x: q.x, y: q.y - z };
    });
  const rect = (r: Rect, color: string | null, stroke?: string) => poly(corners(r), color, stroke);
  const line = (a: Point, b: Point, color: string, width = 1) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const glow = (p: Point, radius: number, color: string) => {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  };
  return { poly, corners, rect, line, glow };
}
