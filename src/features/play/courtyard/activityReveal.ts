import type { Arena, Point, SceneStructure } from "@/engine";

/** Visual occlusion only. The shipping isometric camera looks along (+x, -y).
 * A metre toward the camera lowers the projected ground by the same pixel
 * distance that a metre of building height raises it. Intersect that ray with
 * the saved footprint; a sprite's bounding box would fade unrelated buildings.
 * This does not confer tactical elevation or change a shot/movement decision.
 */
export function buildingHidesGround(s: SceneStructure, p: Point): boolean {
  if (s.style === "interior-wall" || s.style === "mesh-fence") return false;
  const r = s.rect;
  if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) return false;
  const enter = Math.max(0, r.x - p.x, p.y - r.y - r.height);
  const leave = Math.min(s.height, r.x + r.width - p.x, p.y - r.y);
  return leave > enter;
}

/** Reveal authored arrivals, work groups and their reserved walking ground,
 * even before an actor happens to stand there. Derived once from frozen data.
 */
export function activityOccluders(arena: Arena): Set<string> {
  const env = arena.environment;
  if (!env || env.interior) return new Set();
  const points: Point[] = [
    ...(env.entrances ?? []).map((e) => e.position),
    ...(arena.cover ?? []).map(({ rect: r }) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })),
  ];
  for (const z of env.zones.filter((z) => ["aisle", "sidewalk", "doorway"].includes(z.kind)))
    for (let x = z.rect.x + 1; x < z.rect.x + z.rect.width; x += 2)
      for (let y = z.rect.y + 1; y < z.rect.y + z.rect.height; y += 2) points.push({ x, y });
  return new Set(
    env.structures.filter((s) => points.some((p) => buildingHidesGround(s, p))).map((s) => s.id),
  );
}
