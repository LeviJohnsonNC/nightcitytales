import type { Point } from "@/engine";

/** Match SVG's xMidYMid meet exactly, including letterboxing and camera offsets. */
export function courtyardCamera(
  width: number,
  height: number,
  camera: { x: number; y: number; zoom: number },
) {
  return {
    zoom: Math.min(width / 1100, height / 680) * camera.zoom,
    x: 550 + camera.x,
    y: 340 + camera.y,
  };
}

/** Constant speed along the saved route; interpolation never supplies a command position. */
export function routePosition(path: Point[], progress: number): Point | null {
  if (!path.length) return null;
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y));
  let remaining = lengths.reduce((sum, n) => sum + n, 0) * Math.min(1, Math.max(0, progress));
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    if (length > 0 && remaining <= length) {
      const a = path[i]!,
        b = path[i + 1]!;
      return {
        x: a.x + ((b.x - a.x) * remaining) / length,
        y: a.y + ((b.y - a.y) * remaining) / length,
      };
    }
    remaining -= length;
  }
  return path[path.length - 1]!;
}
