import type { Arena, Rect } from "@/engine";

/** Presentation derives from saved connections; no new doors or movement rules. */
export function interiorThresholds(arena: Arena) {
  const env = arena.environment;
  return (env?.interior?.connections ?? []).map((connection) => {
    const door = env!.zones.find((z) => z.id === connection.zoneId)!;
    const room = env!.zones.find((z) => z.id === connection.from)!;
    const horizontal =
      room.rect.x + room.rect.width === door.rect.x ||
      door.rect.x + door.rect.width === room.rect.x;
    const other = env!.zones.find((z) => z.id === connection.to);
    const role =
      (room.kind === "corridor" && other?.kind === "corridor") ||
      (connection.to !== "outside" && Math.max(door.rect.width, door.rect.height) >= 6)
        ? "passage"
        : connection.to !== "outside"
          ? "room"
          : room.kind === "reception"
            ? "primary"
            : "service";
    const r = door.rect;
    // Wall solids stop 0.75m outside the opening tile. Seat trim against
    // those cut ends rather than leaving isolated poles inside the gap.
    const posts = horizontal
      ? [
          { x: r.x + r.width / 2, y: r.y - 0.75 },
          { x: r.x + r.width / 2, y: r.y + r.height + 0.75 },
        ]
      : [
          { x: r.x - 0.75, y: r.y + r.height / 2 },
          { x: r.x + r.width + 0.75, y: r.y + r.height / 2 },
        ];
    const mat: Rect = {
      x: r.x + 0.15,
      y: r.y + 0.15,
      width: r.width - 0.3,
      height: r.height - 0.3,
    };
    return { id: door.id, role, posts, mat, horizontal };
  });
}
