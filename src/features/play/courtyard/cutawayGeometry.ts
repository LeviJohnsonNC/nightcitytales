import type { Point, Rect, SceneStructure, SceneEnvironment } from "@/engine";
import { buildingHidesGround } from "./activityReveal";

export interface CutawayWall {
  rect: Rect;
  height: number;
}

/** Independent visual pieces, never new engine obstacles. A building-sized
 * image cannot sort correctly against props along both ends of its frontage.
 */
export function cutawayWalls(
  structure: SceneStructure,
  entrances: SceneEnvironment["entrances"] = [],
  activity?: readonly Point[],
): CutawayWall[] {
  const r = structure.rect,
    t = 0.24;
  const walls: CutawayWall[] = [];
  const add = (rect: Rect, height = 0.65) => {
    // Preserve a ground-storey facade wherever it cannot hide playable activity.
    // Obstructing segments remain a low, closed section of the same saved solid.
    const retained = Math.min(structure.height, height === 0.95 ? 2.6 : 2.4);
    const clear =
      activity &&
      !activity.some((p) => buildingHidesGround({ ...structure, rect, height: retained }, p));
    walls.push({ rect, height: clear ? retained : height });
  };
  for (let x = r.x; x < r.x + r.width; x += 2) {
    const width = Math.min(2, r.x + r.width - x);
    add({ x, y: r.y, width, height: t });
    add({ x, y: r.y + r.height - t, width, height: t });
  }
  for (let y = r.y + t; y < r.y + r.height - t; y += 2) {
    const height = Math.min(2, r.y + r.height - t - y);
    add({ x: r.x, y, width: t, height });
    add({ x: r.x + r.width - t, y, width: t, height });
  }
  for (const e of entrances ?? []) {
    if (e.structureId !== structure.id) continue;
    const q = e.position,
      north = q.y < r.y,
      south = q.y > r.y + r.height;
    const east = q.x > r.x + r.width;
    const door: Rect =
      north || south
        ? { x: q.x - 0.8, y: north ? r.y : r.y + r.height - 0.4, width: 1.6, height: 0.4 }
        : { x: east ? r.x + r.width - 0.4 : r.x, y: q.y - 0.8, width: 0.4, height: 1.6 };
    add(door);
    for (const offset of [-0.9, 0.75])
      add(
        north || south
          ? { x: q.x + offset, y: door.y, width: 0.15, height: 0.4 }
          : { x: door.x, y: q.y + offset, width: 0.4, height: 0.15 },
        0.95,
      );
  }
  return walls;
}
