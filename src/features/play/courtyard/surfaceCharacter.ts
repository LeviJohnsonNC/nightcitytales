/** Broad material colour and weathering in metres, below openings and lighting.
 * Coordinates belong to the surface, so cutaways and neighbouring pieces agree.
 * No randomness, raster post-processing, geometry or tactical state. */
import type { Point } from "@/engine";
import type { Basis, MaterialKey } from "./surfaceMaterials";

const noise = (x: number, y: number, salt: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 73.9) * 43758.5453;
  return n - Math.floor(n);
};

export function surfaceCoordinates(points: readonly Point[], basis: Basis): Point[] {
  const { origin: o, u, v } = basis;
  const determinant = u.x * v.y - u.y * v.x;
  if (Math.abs(determinant) < 1e-6) return [];
  return points.map((p) => ({
    x: ((p.x - o.x) * v.y - (p.y - o.y) * v.x) / determinant,
    y: (u.x * (p.y - o.y) - u.y * (p.x - o.x)) / determinant,
  }));
}

export function paintSurfaceCharacter(
  ctx: CanvasRenderingContext2D,
  polygon: readonly Point[],
  basis: Basis,
  key: MaterialKey,
  groundLine: number,
) {
  const wall = key === "painted-render" || key === "facade-concrete" || key === "home-masonry";
  const paving = key === "sidewalk";
  const road = key === "asphalt";
  if (!wall && !paving && !road) return;
  const local = surfaceCoordinates(polygon, basis);
  if (!local.length) return;
  const minX = Math.min(...local.map((p) => p.x)),
    maxX = Math.max(...local.map((p) => p.x));
  const minY = Math.min(...local.map((p) => p.y)),
    maxY = Math.max(...local.map((p) => p.y));
  const { origin: o, u, v } = basis;
  ctx.save();
  // Caller retains the actual face clip; use metres for the broad brush shapes.
  ctx.transform(u.x, u.y, v.x, v.y, o.x, o.y);
  ctx.globalCompositeOperation = "source-over";
  const width = wall ? 5.6 : 7.5,
    height = wall ? 3.2 : 5.5;
  for (let ix = Math.floor(minX / width) - 1; ix <= Math.ceil(maxX / width); ix++) {
    for (let iy = Math.floor(minY / height) - 1; iy <= Math.ceil(maxY / height); iy++) {
      const seed = noise(ix, iy, 11);
      const x = ix * width + noise(ix, iy, 2) * width * 0.35;
      const y = iy * height + noise(ix, iy, 3) * height * 0.4;
      const w = width * (0.65 + noise(ix, iy, 4) * 0.7);
      const h = height * (0.55 + noise(ix, iy, 5) * 0.75);
      const colour = wall
        ? seed < 0.38
          ? "138,107,70"
          : seed < 0.7
            ? "112,137,125"
            : "30,42,40"
        : paving
          ? seed < 0.55
            ? "155,140,110"
            : "31,45,44"
          : seed < 0.55
            ? "106,113,109"
            : "13,26,30";
      // Several overlapping translucent passes give a feathered perimeter without
      // blurring the architecture, texture grain, or neighbouring surfaces.
      for (let pass = 0; pass < 3; pass++) {
        const inset = pass * 0.16;
        ctx.fillStyle = `rgba(${colour},${wall ? 0.075 : paving ? 0.065 : 0.045})`;
        ctx.beginPath();
        ctx.moveTo(x + inset, y + h * 0.12 + inset);
        ctx.bezierCurveTo(
          x + w * 0.3,
          y - h * 0.12 + inset,
          x + w * 0.7,
          y + h * 0.2,
          x + w - inset,
          y + inset,
        );
        ctx.lineTo(x + w * 0.94 - inset, y + h * 0.78 - inset);
        ctx.bezierCurveTo(
          x + w * 0.6,
          y + h * 1.13 - inset,
          x + w * 0.4,
          y + h * 0.8,
          x + inset,
          y + h - inset,
        );
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  if (wall && Math.abs(v.x) < 1e-6) {
    // Splash darkening belongs to the actual ground line, not every cutaway edge.
    const wash = ctx.createLinearGradient(0, groundLine - 1.5, 0, groundLine);
    wash.addColorStop(0, "rgba(23,34,31,0)");
    wash.addColorStop(0.65, "rgba(23,34,31,.13)");
    wash.addColorStop(1, "rgba(17,29,27,.40)");
    ctx.fillStyle = wash;
    ctx.fillRect(minX, groundLine - 1.5, maxX - minX, 1.5);
    // Uneven vertical runoff. Sparse, broad streaks remain quiet behind windows.
    for (let x = Math.floor(minX / 2.8) * 2.8; x < maxX; x += 2.8) {
      const n = noise(x, 0, 29);
      if (n < 0.4) continue;
      for (let start = Math.floor(minY / 3) * 3; start < maxY; start += 3) {
        const g = ctx.createLinearGradient(x, start, x, start + 2.8);
        g.addColorStop(0, "rgba(30,39,33,.17)");
        g.addColorStop(1, "rgba(30,39,33,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x + n, start, 0.18 + n * 0.44, 2.8);
      }
    }
  }
  ctx.restore();
}
