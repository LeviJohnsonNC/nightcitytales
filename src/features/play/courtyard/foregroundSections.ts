/** Presentation-only cutaways from saved geometry and the current action. */
import type { Point, Rect, SceneStructure } from "@/engine";
import { buildingHidesGround } from "./activityReveal";

/** A small world-space apron protects the person's silhouette, not just their feet. */
export function foregroundObstructs(s: SceneStructure, points: readonly Point[]): boolean {
  return points.some((p) =>
    [-0.55, 0, 0.55].some((dx) =>
      [-0.55, 0, 0.55].some((dy) => buildingHidesGround(s, { x: p.x + dx, y: p.y + dy })),
    ),
  );
}

/** Keep a full wall section only when it cannot obscure the current action. */
export function retainForegroundSection(s: SceneStructure, rect: Rect, points: readonly Point[]) {
  return !foregroundObstructs({ ...s, rect }, points);
}

/** Route segments may be long; protect their length, not just their endpoints. */
export function foregroundRoute(path: readonly Point[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!;
    points.push(a);
    const b = path[i + 1];
    if (!b) continue;
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let j = 1; j < steps; j++)
      points.push({ x: a.x + ((b.x - a.x) * j) / steps, y: a.y + ((b.y - a.y) * j) / steps });
  }
  return points;
}
