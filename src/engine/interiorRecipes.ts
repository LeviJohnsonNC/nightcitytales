/** Authored room organizations; all resolve through the shared cluster/grid machinery. */
import { type Arena, type Rect, type Point } from "./battlefield";
import { industrialPlan } from "./industrialRecipes";
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
export type InteriorPlan = { rooms: SceneZone[]; doors: Connection[]; label: string };
function office(variant: number): InteriorPlan {
  // Function-first programs: visitor rooms at the primary entry, staff work
  // beyond that threshold, smaller support rooms with an independent exit.
  if (variant === 0)
    return {
      label: "Reception spine and staff suites",
      rooms: [
        zone("reception", "reception", 2, 2, 8, 6),
        zone("meeting", "meeting", 12, 2, 10, 6),
        zone("hall", "corridor", 2, 10, 20, 2),
        zone("work", "workspace", 2, 14, 12, 10),
        zone("private", "workspace", 16, 14, 6, 4),
        zone("service", "service", 16, 20, 6, 4),
      ],
      doors: [
        ["reception", "hall", 6, 8],
        ["meeting", "hall", 16, 8],
        ["hall", "work", 6, 12],
        ["hall", "private", 18, 12],
        ["work", "service", 14, 20],
        ["reception", "outside", 0, 2, 2, 4],
        ["service", "outside", 22, 22],
      ],
    };
  if (variant === 1)
    return {
      label: "Visitor front and circulation loop",
      rooms: [
        zone("reception", "reception", 2, 2, 8, 6),
        zone("meeting", "meeting", 12, 2, 6, 6),
        zone("service", "service", 20, 2, 6, 6),
        zone("hall", "corridor", 2, 10, 24, 2),
        zone("west", "corridor", 2, 14, 2, 8),
        zone("east", "corridor", 24, 14, 2, 8),
        zone("rear", "corridor", 2, 24, 24, 2),
        zone("work", "workspace", 6, 14, 16, 8),
      ],
      doors: [
        ["reception", "hall", 6, 8],
        ["meeting", "hall", 14, 8],
        ["hall", "west", 2, 12],
        ["hall", "east", 24, 12],
        ["west", "rear", 2, 22],
        ["east", "rear", 24, 22],
        ["hall", "work", 12, 12],
        ["work", "rear", 12, 22],
        ["hall", "service", 22, 8],
        ["reception", "outside", 0, 4, 2, 4],
        ["service", "outside", 26, 4],
      ],
    };
  return {
    label: "Open work core with perimeter rooms",
    rooms: [
      zone("reception", "reception", 2, 2, 8, 6),
      zone("meeting", "meeting", 12, 2, 10, 6),
      zone("work", "workspace", 2, 10, 12, 12),
      zone("service", "service", 16, 16, 6, 6),
      zone("private", "workspace", 16, 10, 6, 4),
    ],
    doors: [
      ["reception", "work", 4, 8, 4, 2],
      ["meeting", "work", 12, 8],
      ["work", "service", 14, 18],
      ["work", "private", 14, 12],
      ["reception", "outside", 0, 4, 2, 4],
      ["service", "outside", 22, 20],
    ],
  };
}
function nightclub(variant: number): InteriorPlan {
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
  const solid = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < extent.width &&
    y < extent.height &&
    !spaces.some((z) => rectInside({ x, y, width: 2, height: 2 }, z.rect));
  const add = (rect: Rect) =>
    result.push({
      id: `wall_${result.length}`,
      label: "Permanent interior wall",
      rect,
      height: 1.4,
      style: "interior-wall",
      blocksMovement: true,
      blocksShots: true,
    });
  // Half-metre walls join through blocked tile centres. Movement retains the
  // 2m lattice; shooting and artwork share the actual, narrower wall solids.
  for (let y = 0; y < extent.height; y += 2) {
    let start: number | null = null;
    for (let x = 0; x <= extent.width; x += 2) {
      if (solid(x, y) && start === null) start = x;
      if (!solid(x, y) && start !== null) {
        add({ x: start + 0.75, y: y + 0.75, width: x - start - 1.5, height: 0.5 });
        start = null;
      }
      if (solid(x, y) && solid(x, y + 2))
        add({ x: x + 0.75, y: y + 1.25, width: 0.5, height: 1.5 });
    }
  }
  return result;
}
export function composeInterior(
  kind: "office" | "nightclub" | "warehouse" | "garage",
  seed: number,
): AuthoredScene {
  const variant = (seed + 2) % 3;
  const plan =
    kind === "office"
      ? office(variant)
      : kind === "nightclub"
        ? nightclub(variant)
        : industrialPlan(kind, variant);
  const size = kind === "office" ? (variant === 1 ? 28 : 24) : 32;
  const extent = { width: size, height: kind === "office" && variant === 0 ? 26 : size };
  const rooms = plan.rooms;
  if (variant === 2)
    rooms.forEach((room) => {
      if (room.rect.width >= 6) room.axis = "x";
    });
  // Long bar runs follow the service room, with staff and customers on opposite sides.
  rooms
    .filter((room) => room.id === "bar")
    .forEach((room) => {
      room.axis = room.rect.height >= room.rect.width ? "x" : "y";
    });
  const publicRoom = rooms.find((z) => z.id === "reception")!.rect;
  const backRoom = rooms.find((z) => z.id === "service")!.rect;
  const boundaryDoor = (id: string, r: Rect): Connection =>
    r.x === 2
      ? [id, "outside", 0, r.y + 2]
      : r.x + r.width === extent.width - 2
        ? [id, "outside", extent.width - 2, r.y + 2]
        : r.y === 2
          ? [id, "outside", r.x + 2, 0]
          : [id, "outside", r.x + 2, extent.height - 2];
  if (kind !== "office") {
    plan.doors.push(boundaryDoor("reception", publicRoom));
    plan.doors.push(boundaryDoor("service", backRoom));
  }
  const doorZones = plan.doors.map((d, i) =>
    zone(`door_${i}`, "doorway", d[2], d[3], d[4] ?? 2, d[5] ?? 2),
  );
  const env: SceneEnvironment = {
    version: 1,
    recipe: kind,
    recipeVersion: 4,
    seed,
    entrances: [],
    zones: [...rooms, ...doorZones],
    structures: walls([...rooms, ...doorZones], extent),
    clusters: [],
    props: [],
    dressing: [],
    interior: {
      connections: plan.doors.map((d, i) => ({ zoneId: `door_${i}`, from: d[0], to: d[1] })),
      access: [],
    },
  };
  // A four-metre entrance landing gives visitors room to arrive and turn.
  // It is a saved aisle, so every placement pass protects it, including later
  // adventure-context substitutions. Existing snapshots keep their own zones.
  if (kind === "office") {
    const primary = plan.doors.find((d) => d[0] === "reception" && d[1] === "outside")!;
    env.zones.push(zone("entry_landing", "aisle", 2, primary[3], 4, primary[5] ?? 2));
  }
  const reserved: Rect[] = [];
  for (const c of env.interior!.connections) {
    const door = env.zones.find((z) => z.id === c.zoneId)!;
    (c.to === "outside"
      ? exteriorDoorwayApproaches(door.rect, rooms.find((z) => z.id === c.from)!.rect, extent)
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
  const primaryDoor =
    doorZones[plan.doors.findIndex((d) => d[0] === "reception" && d[1] === "outside")]!;
  const playerStart =
    kind === "office"
      ? exteriorDoorwayApproaches(primaryDoor.rect, entry, extent).find((p) =>
          rectInside({ x: p.x - 1, y: p.y - 1, width: 2, height: 2 }, entry),
        )!
      : { x: entry.x + 1, y: entry.y + 1 };
  const arena: Arena = {
    key: `scene:composed-${kind}:v1:${seed}`,
    label: `North Heywood · ${kind} · ${plan.label}`,
    extent,
    playerStart,
    hostileSlots: [],
    cover: [],
    environment: env,
  };
  const slots: Slot[] = [];
  for (const room of rooms) {
    if (["corridor", "dance"].includes(room.kind)) continue;
    const cluster =
      room.kind === "storage"
        ? "racking"
        : room.kind === "workbay"
          ? "vehicle_bay"
          : room.kind === "staging"
            ? "freight"
            : room.id === "bar"
              ? "bar"
              : room.kind === "workspace"
                ? "workstation"
                : room.kind === "meeting"
                  ? "meeting"
                  : room.kind === "service"
                    ? kind === "warehouse" || kind === "garage"
                      ? "workbench"
                      : kind === "nightclub"
                        ? "storage_cabinet"
                        : "server"
                    : room.kind === "performance"
                      ? "performance"
                      : room.kind === "seating"
                        ? "booth"
                        : kind === "nightclub"
                          ? "seating"
                          : "reception";
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
    if (["racking", "vehicle_bay"].includes(cluster)) {
      candidates.length = 0;
      for (let y = r.y + 2; y < r.y + r.height - 4; y += 6)
        for (let x = r.x + 2; x < r.x + r.width - 4; x += 6) candidates.push({ x, y });
    }
    if (cluster === "booth") {
      candidates.length = 0;
      for (let y = r.y + 2; y < r.y + r.height - 2; y += 6) candidates.push({ x: r.x, y });
    }
    // Small enclosed offices still need a legal workstation candidate.
    if (cluster === "workstation" && !candidates.length)
      for (let y = r.y; y < r.y + r.height; y += 2)
        for (let x = r.x; x < r.x + r.width; x += 2) candidates.push({ x, y });
    const count = ["racking", "vehicle_bay"].includes(cluster)
      ? 12
      : cluster === "freight"
        ? 3
        : cluster === "workbench"
          ? 2
          : cluster === "workstation"
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
  // Complete each room's activity with secondary furniture along its perimeter.
  // Candidate order is authored; shared placement protects doors, working space,
  // and connectivity instead of treating unused floor as arbitrary clutter space.
  if (kind === "office" || kind === "nightclub") {
    const secondary: Slot[] = [];
    for (const room of rooms) {
      const families =
        room.kind === "workspace"
          ? ["storage_cabinet", "garden", "workstation"]
          : room.kind === "meeting"
            ? ["seating", "storage_cabinet", "garden"]
            : room.kind === "reception"
              ? ["booth", "garden"]
              : room.kind === "seating"
                ? ["booth", "garden"]
                : room.id === "bar"
                  ? ["bar", "supplies"]
                  : room.kind === "service"
                    ? kind === "nightclub"
                      ? ["storage_cabinet", "supplies"]
                      : ["workbench", "supplies", "server"]
                    : room.kind === "performance"
                      ? ["speakers"]
                      : [];
      const r = room.rect;
      const candidates: Point[] = [];
      for (let y = r.y; y <= r.y + r.height - 2; y += 2)
        for (let x = r.x; x <= r.x + r.width - 2; x += 2)
          if (x === r.x || x >= r.x + r.width - 4 || y === r.y || y >= r.y + r.height - 4)
            candidates.push({ x, y });
      const passes =
        room.kind === "reception" ? Math.max(3, Math.ceil((r.width * r.height) / 48)) : 3;
      for (let pass = 0; pass < passes; pass++)
        for (const family of families)
          secondary.push({
            id: `${room.id}_detail_${family}_${pass}`,
            kind: family,
            zone: room.id,
            at: candidates[0]!,
            candidates,
          });
    }
    placeSceneClusters(arena, secondary, reserved, seed, false);
  }
  const castRooms =
    kind === "office"
      ? ["work", "service", "meeting"]
      : kind === "nightclub"
        ? ["bar", "performance", "seating"]
        : ["work", "service", "reception"];
  const actors = castRooms.map((id, i) => {
    const position = env.interior!.access.find(
      (a) => a.zoneId === id && (a.position.x !== playerStart.x || a.position.y !== playerStart.y),
    )!.position;
    return {
      id: `occupant_${i}`,
      name:
        i === 0
          ? "Security officer"
          : i === 1
            ? "Shift supervisor"
            : kind === "office"
              ? "Office worker"
              : kind === "nightclub"
                ? "Club patron"
                : kind === "garage"
                  ? "Mechanic"
                  : "Warehouse worker",
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
      kind === "warehouse"
        ? "A loading apron opens onto stocked rack aisles, with a small dispatch office and a maintenance room beside the freight hall."
        : kind === "garage"
          ? "Vehicle bays face a clear loading approach. Workbenches and parts storage sit beyond the customer reception, with working space beside each parked car."
          : kind === "office"
            ? "Reception opens onto an office of workstations, meeting space and a service room. Open doorways connect the rooms; security watches the work floor."
            : "Beyond the club entrance, an open dance floor separates booths, a staffed bar and a floor-level DJ console. Service rooms sit behind the public areas. Security watches the room.",
    layout: snapshotBattlefield(arena),
    actors,
  };
}
