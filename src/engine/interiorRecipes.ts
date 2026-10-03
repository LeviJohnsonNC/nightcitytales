/** Authored room organizations; all resolve through the shared cluster/grid machinery. */
import { type Arena, type Rect, type Point } from "./battlefield";
import { snapshotBattlefield } from "./battlefieldSnapshot";
import type { AuthoredScene } from "./authoredScene";
import { threatFor } from "./threats";
import {
  doorwayApproaches,
  exteriorDoorwayApproaches,
  rectInside,
  type SceneZone,
  type SceneEnvironment,
  type ZoneKind,
} from "./sceneEnvironment";
import { placeSceneClusters, type Slot } from "./sceneClusters";

const zone = (
  id: string,
  kind: ZoneKind,
  x: number,
  y: number,
  width: number,
  height: number,
): SceneZone => ({ id, kind, rect: { x, y, width, height }, axis: "y" });
type Connection = [from: string, to: string, x: number, y: number, width?: number, height?: number];
type Plan = { rooms: SceneZone[]; doors: Connection[]; label: string };
function office(variant: number): Plan {
  if (variant === 0)
    return {
      label: "Central corridor",
      rooms: [
        zone("hall", "corridor", 14, 2, 4, 28),
        zone("reception", "reception", 2, 2, 10, 10),
        zone("work", "workspace", 2, 14, 10, 16),
        zone("meeting", "meeting", 20, 2, 10, 12),
        zone("service", "service", 20, 16, 10, 14),
      ],
      doors: [
        ["reception", "hall", 12, 6],
        ["work", "hall", 12, 22],
        ["hall", "meeting", 18, 6],
        ["hall", "service", 18, 24],
      ],
    };
  if (variant === 1)
    return {
      label: "Open work floor",
      rooms: [
        zone("reception", "reception", 2, 2, 8, 28),
        zone("work", "workspace", 12, 2, 18, 18),
        zone("meeting", "meeting", 12, 22, 10, 8),
        zone("service", "service", 24, 22, 6, 8),
      ],
      doors: [
        ["reception", "work", 10, 8],
        ["reception", "meeting", 10, 24],
        ["work", "meeting", 18, 20],
        ["work", "service", 26, 20],
      ],
    };
  return {
    label: "Private room suite",
    rooms: [
      zone("hall", "corridor", 2, 14, 28, 4),
      zone("reception", "reception", 2, 2, 12, 10),
      zone("work", "workspace", 16, 2, 14, 10),
      zone("meeting", "meeting", 2, 20, 12, 10),
      zone("service", "service", 16, 20, 14, 10),
    ],
    doors: [
      ["reception", "hall", 6, 12],
      ["work", "hall", 22, 12],
      ["hall", "meeting", 6, 18],
      ["hall", "service", 22, 18],
    ],
  };
}
function nightclub(variant: number): Plan {
  if (variant === 0)
    return {
      label: "Central dance floor",
      rooms: [
        zone("reception", "reception", 2, 2, 28, 4),
        zone("performance", "performance", 10, 8, 12, 6),
        zone("dance", "dance", 10, 16, 12, 14),
        zone("seating", "seating", 2, 8, 6, 22),
        zone("bar", "service", 24, 8, 6, 14),
        zone("service", "service", 24, 24, 6, 6),
      ],
      doors: [
        ["reception", "performance", 14, 6],
        ["reception", "seating", 4, 6],
        ["reception", "bar", 26, 6],
        ["performance", "dance", 10, 14, 12, 2],
        ["seating", "dance", 8, 18, 2, 10],
        ["dance", "bar", 22, 16, 2, 6],
        ["bar", "service", 26, 22],
      ],
    };
  if (variant === 1)
    return {
      label: "Long room club",
      rooms: [
        zone("reception", "reception", 2, 2, 8, 10),
        zone("service", "service", 2, 14, 8, 16),
        zone("dance", "dance", 12, 10, 10, 20),
        zone("performance", "performance", 12, 2, 10, 6),
        zone("seating", "seating", 24, 2, 6, 16),
        zone("bar", "service", 24, 20, 6, 10),
      ],
      doors: [
        ["reception", "service", 6, 12],
        ["service", "dance", 10, 24],
        ["reception", "performance", 10, 4],
        ["performance", "dance", 12, 8, 10, 2],
        ["performance", "seating", 22, 4],
        ["dance", "bar", 22, 22, 2, 6],
        ["seating", "bar", 24, 18, 6, 2],
      ],
    };
  return {
    label: "Lounge and main room",
    rooms: [
      zone("hall", "corridor", 2, 14, 28, 4),
      zone("reception", "reception", 2, 20, 10, 10),
      zone("bar", "service", 14, 20, 8, 10),
      zone("service", "service", 24, 20, 6, 10),
      zone("seating", "seating", 2, 2, 10, 10),
      zone("dance", "dance", 14, 2, 10, 10),
      zone("performance", "performance", 26, 2, 4, 10),
    ],
    doors: [
      ["reception", "hall", 6, 18],
      ["bar", "hall", 18, 18],
      ["service", "hall", 26, 18],
      ["seating", "hall", 6, 12],
      ["dance", "hall", 14, 12, 10, 2],
      ["dance", "performance", 24, 2, 2, 10],
    ],
  };
}
function walls(spaces: SceneZone[], extent: Arena["extent"]): SceneEnvironment["structures"] {
  const result: SceneEnvironment["structures"] = [];
  // Merge horizontal blocked runs; no overlapping wall solids at corners.
  for (let y = 0; y < extent.height; y += 2) {
    let start: number | null = null;
    for (let x = 0; x <= extent.width; x += 2) {
      const solid =
        x < extent.width && !spaces.some((z) => rectInside({ x, y, width: 2, height: 2 }, z.rect));
      if (solid && start === null) start = x;
      if (!solid && start !== null) {
        result.push({
          id: `wall_${start}_${y}`,
          label: "Permanent interior wall",
          rect: { x: start, y, width: x - start, height: 2 },
          height: 1.4,
          style: "interior-wall",
          blocksMovement: true,
          blocksShots: true,
        });
        start = null;
      }
    }
  }
  return result;
}
export function composeInterior(kind: "office" | "nightclub", seed: number): AuthoredScene {
  const variant = (seed + 2) % 3;
  const plan = kind === "office" ? office(variant) : nightclub(variant);
  const rooms = plan.rooms;
  if (variant === 2)
    rooms.forEach((room) => {
      if (room.rect.width >= 6) room.axis = "x";
    });
  const publicRoom = rooms.find((z) => z.id === "reception")!.rect;
  const backRoom = rooms.find((z) => z.id === "service")!.rect;
  plan.doors.push(["reception", "outside", 0, publicRoom.y + 2]);
  plan.doors.push([
    "service",
    "outside",
    backRoom.x + backRoom.width === 30 ? 30 : 0,
    backRoom.y + 2,
  ]);
  const doorZones = plan.doors.map((d, i) =>
    zone(`door_${i}`, "doorway", d[2], d[3], d[4] ?? 2, d[5] ?? 2),
  );
  const env: SceneEnvironment = {
    version: 1,
    recipe: kind,
    recipeVersion: 3,
    seed,
    entrances: [],
    zones: [...rooms, ...doorZones],
    structures: walls([...rooms, ...doorZones], { width: 32, height: 32 }),
    clusters: [],
    props: [],
    dressing: [],
    interior: {
      connections: plan.doors.map((d, i) => ({ zoneId: `door_${i}`, from: d[0], to: d[1] })),
      access: [],
    },
  };
  const reserved: Rect[] = [];
  for (const c of env.interior!.connections) {
    const door = env.zones.find((z) => z.id === c.zoneId)!;
    (c.to === "outside"
      ? exteriorDoorwayApproaches(door.rect, rooms.find((z) => z.id === c.from)!.rect, {
          width: 32,
          height: 32,
        })
      : doorwayApproaches(
          door.rect,
          rooms.find((z) => z.id === c.from)!.rect,
          rooms.find((z) => z.id === c.to)!.rect,
        )
    ).forEach((p) => reserved.push({ x: p.x - 1, y: p.y - 1, width: 2, height: 2 }));
  }
  // One authored room-access anchor, plus furniture-specific working space below.
  for (const z of rooms) {
    const position = { x: z.rect.x + 1, y: z.rect.y + 1 };
    env.interior!.access.push({
      id: `${z.id}_approach`,
      zoneId: z.id,
      position,
      label: `${z.id} approach`,
    });
    reserved.push({ x: position.x - 1, y: position.y - 1, width: 2, height: 2 });
  }
  const entry = rooms.find((z) => z.id === "reception")!.rect;
  const playerStart = { x: entry.x + 1, y: entry.y + 1 };
  const arena: Arena = {
    key: `scene:composed-${kind}:v1:${seed}`,
    label: `North Heywood · ${kind} · ${plan.label}`,
    extent: { width: 32, height: 32 },
    playerStart,
    hostileSlots: [],
    cover: [],
    environment: env,
  };
  const slots: Slot[] = [];
  for (const room of rooms) {
    if (["corridor", "dance"].includes(room.kind)) continue;
    const cluster =
      room.id === "bar"
        ? "bar"
        : room.kind === "workspace"
          ? "workstation"
          : room.kind === "meeting"
            ? "meeting"
            : room.kind === "service"
              ? "server"
              : room.kind === "performance"
                ? "performance"
                : room.kind === "seating"
                  ? "booth"
                  : kind === "office"
                    ? "reception"
                    : "seating";
    const r = room.rect;
    // Bounded frontage candidates, ordered reproducibly; never free-cell scatter.
    const candidates: Point[] = [];
    for (const y of [r.y + 2, r.y + r.height - 4, r.y + 4, r.y])
      for (const x of [r.x + 2, r.x + r.width - 4, r.x, r.x + r.width - 2])
        if (x >= r.x && y >= r.y && !candidates.some((p) => p.x === x && p.y === y))
          candidates.push({ x, y });
    if (cluster === "workstation") {
      candidates.length = 0;
      for (let y = r.y + 2; y < r.y + r.height - 2; y += 6)
        for (let x = r.x + 2; x < r.x + r.width - 2; x += 4) candidates.push({ x, y });
    }
    if (cluster === "booth") {
      candidates.length = 0;
      for (let y = r.y + 2; y < r.y + r.height - 2; y += 6) candidates.push({ x: r.x, y });
    }
    const count =
      cluster === "workstation"
        ? 12
        : cluster === "booth"
          ? 4
          : cluster === "seating"
            ? 3
            : cluster === "server"
              ? 2
              : 1;
    for (let i = 0; i < count; i++)
      slots.push({
        id: `${room.id}_${i}`,
        kind: cluster,
        zone: room.id,
        at: candidates[0]!,
        candidates,
        required: i === 0,
      });
  }
  if (kind === "office") {
    const reception = rooms.find((r) => r.id === "reception")!;
    const r = reception.rect;
    const candidates = [
      { x: r.x, y: r.y + r.height - 4 },
      { x: r.x + r.width - 2, y: r.y + r.height - 4 },
      { x: r.x, y: r.y + 4 },
    ];
    for (let i = 0; i < 3; i++)
      slots.push({
        id: `waiting_${i}`,
        kind: "seating",
        zone: reception.id,
        at: candidates[0]!,
        candidates,
      });
  }
  placeSceneClusters(arena, slots, reserved, seed, false);
  const castRooms =
    kind === "office" ? ["work", "service", "meeting"] : ["bar", "performance", "seating"];
  const actors = castRooms.map((id, i) => {
    const position = env.interior!.access.find((a) => a.zoneId === id)!.position;
    return {
      id: `occupant_${i}`,
      name:
        i === 0
          ? "Security officer"
          : i === 1
            ? "Shift supervisor"
            : kind === "office"
              ? "Office worker"
              : "Club patron",
      side: i < 2 ? ("hostile" as const) : ("neutral" as const),
      profile: i < 2 ? { ...threatFor("ganger") } : null,
      position,
    };
  });
  arena.hostileSlots = actors.filter((a) => a.side === "hostile").map((a) => a.position);
  // Snapshot validation checks every floor tile and every saved working-space anchor.
  return {
    locationKey: "north_heywood",
    template: `composed-${kind}`,
    templateVersion: 1,
    anchor: `composition-${kind}-v1-${seed}`,
    narration:
      kind === "office"
        ? "Reception opens onto an office of workstations, meeting space and a service room. Open doorways connect the rooms; security watches the work floor."
        : "Beyond the club entrance, an open dance floor separates booths, a staffed bar and a floor-level DJ console. Service rooms sit behind the public areas. Security watches the room.",
    layout: snapshotBattlefield(arena),
    actors,
  };
}
