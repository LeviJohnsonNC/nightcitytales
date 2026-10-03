/** Resolved, saved composition. Rendering and mechanics read these same footprints. */
import type { Arena, Point, Rect } from "./battlefield";

export const ZONE_KINDS = [
  "road",
  "intersection",
  "sidewalk",
  "frontage",
  "alley",
  "loading",
  "crosswalk",
  "reception",
  "workspace",
  "meeting",
  "seating",
  "service",
  "corridor",
  "doorway",
  "dance",
  "performance",
  "aisle",
  "storage",
  "workbay",
  "staging",
  "garden",
  "driveway",
] as const;
export type ZoneKind = (typeof ZONE_KINDS)[number];
export const ENVIRONMENT_ART = [
  "sedan-engine",
  "sedan-cabin",
  "food-cart",
  "cargo",
  "pallet",
  "dumpster",
  "generator",
  "barrier",
  "desk",
  "reception",
  "meeting-table",
  "seat",
  "bar",
  "server",
  "shelf",
  "dj",
  "partition",
  "workbench",
  "planter",
] as const;
export type EnvironmentArt = (typeof ENVIRONMENT_ART)[number];
export const DRESSING_KINDS = [
  "lamp",
  "sign",
  "litter",
  "stools",
  "supplies",
  "drain",
  "bollards",
] as const;
export type SceneZone = { id: string; kind: ZoneKind; rect: Rect; axis: "x" | "y" };
export type SceneStructure = {
  id: string;
  label: string;
  rect: Rect;
  height: number;
  style: "shop" | "workshop" | "warehouse" | "interior-wall" | "residential";
  blocksMovement: boolean;
  blocksShots: boolean;
};
export type SceneEnvironment = {
  version: 1;
  recipe:
    "intersection" | "alley" | "office" | "nightclub" | "warehouse" | "garage" | "residential";
  recipeVersion: 1 | 2 | 3;
  /** Room connections are openings, not interactive doors or a second navigation system. */
  interior?: {
    connections: { zoneId: string; from: string; to: string }[];
    access: { id: string; zoneId: string; position: Point; label: string }[];
  };
  /** Exterior approach tiles; doors remain closed, with no implied interior. */
  entrances?: { id: string; structureId: string; position: Point; label: string }[];
  seed: number;
  zones: SceneZone[];
  structures: SceneStructure[];
  clusters: { id: string; kind: string; zoneId: string; reason: string }[];
  /** References canonical cover IDs rather than keeping a second prop position. */
  props: { coverId: string; art: EnvironmentArt; rotation: 0 | 90; clusterId: string }[];
  /** Nonblocking dressing only. Substantial objects must be props or structures. */
  dressing: {
    id: string;
    kind: (typeof DRESSING_KINDS)[number];
    position: Point;
    clusterId: string;
  }[];
};
export function rectInside(inner: Rect, outer: Rect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
export function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
const fail = (): never => {
  throw new Error("Invalid saved scene composition.");
};
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
}
function str(v: unknown): string {
  return typeof v === "string" && v.length > 0 && v.length <= 160 ? v : fail();
}
function num(v: unknown, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fail();
}
function list(v: unknown, max: number): unknown[] {
  return Array.isArray(v) && v.length <= max ? v : fail();
}
function choice<T extends string>(v: unknown, values: readonly T[]): T {
  return values.includes(v as T) ? (v as T) : fail();
}
function bool(v: unknown): boolean {
  return typeof v === "boolean" ? v : fail();
}
function rectangle(v: unknown): Rect {
  const r = obj(v);
  const out = {
    x: num(r["x"], -20, 120),
    y: num(r["y"], -20, 120),
    width: num(r["width"], 2, 120),
    height: num(r["height"], 2, 120),
  };
  if (Object.values(out).some((n) => n % 2)) fail();
  return out;
}
/** Closed vocabulary, bounded geometry, referential integrity; no catalog regeneration. */
export function readSceneEnvironment(value: unknown, arena: Arena): SceneEnvironment {
  const r = obj(value);
  if (r["version"] !== 1 || ![1, 2, 3].includes(r["recipeVersion"] as number)) fail();
  const ids = new Set<string>();
  const id = (v: unknown) => {
    const key = str(v);
    if (ids.has(key)) fail();
    ids.add(key);
    return key;
  };
  const zones = list(r["zones"], 64).map((v) => {
    const z = obj(v);
    return {
      id: id(z["id"]),
      kind: choice(z["kind"], ZONE_KINDS),
      rect: rectangle(z["rect"]),
      axis: choice(z["axis"], ["x", "y"] as const),
    };
  });
  const structures = list(r["structures"], 128).map((v) => {
    const s = obj(v);
    return {
      id: id(s["id"]),
      label: str(s["label"]),
      rect: rectangle(s["rect"]),
      height: num(s["height"], 1, 12),
      style: choice(s["style"], [
        "shop",
        "workshop",
        "warehouse",
        "interior-wall",
        "residential",
      ] as const),
      blocksMovement: bool(s["blocksMovement"]),
      blocksShots: bool(s["blocksShots"]),
    };
  });
  const entrances =
    r["entrances"] === undefined && r["recipeVersion"] === 1
      ? undefined
      : list(r["entrances"], 32).map((v) => {
          const e = obj(v),
            p = obj(e["position"]);
          const position = {
            x: num(p["x"], 1, arena.extent.width - 1),
            y: num(p["y"], 1, arena.extent.height - 1),
          };
          const structureId = str(e["structureId"]);
          const structure = structures.find((s) => s.id === structureId);
          if (!structure || position.x % 2 !== 1 || position.y % 2 !== 1) fail();
          const b = structure!.rect;
          const besideX =
            (position.x === b.x - 1 || position.x === b.x + b.width + 1) &&
            position.y > b.y &&
            position.y < b.y + b.height;
          const besideY =
            (position.y === b.y - 1 || position.y === b.y + b.height + 1) &&
            position.x > b.x &&
            position.x < b.x + b.width;
          const tile = { x: position.x - 1, y: position.y - 1, width: 2, height: 2 };
          if (
            (!besideX && !besideY) ||
            structures.some((s) => rectsOverlap(s.rect, tile)) ||
            arena.cover?.some((c) => rectsOverlap(c.rect, tile))
          )
            fail();
          return { id: id(e["id"]), structureId, position, label: str(e["label"]) };
        });
  if (
    entrances &&
    new Set(entrances.map((e) => `${e.position.x},${e.position.y}`)).size !== entrances.length
  )
    fail();
  const clusters = list(r["clusters"], 64).map((v) => {
    const c = obj(v);
    const zoneId = str(c["zoneId"]);
    if (!zones.some((z) => z.id === zoneId)) fail();
    return { id: id(c["id"]), kind: str(c["kind"]), zoneId, reason: str(c["reason"]) };
  });
  const cluster = (v: unknown) => {
    const key = str(v);
    if (!clusters.some((c) => c.id === key)) fail();
    return key;
  };
  const bindings = new Set<string>();
  const props = list(r["props"], 256).map((v) => {
    const p = obj(v);
    const coverId = str(p["coverId"]);
    const piece = arena.cover?.find((c) => c.id === coverId);
    if (!piece || bindings.has(coverId) || (p["rotation"] !== 0 && p["rotation"] !== 90)) fail();
    bindings.add(coverId);
    const clusterId = cluster(p["clusterId"]);
    const zone = zones.find((z) => z.id === clusters.find((c) => c.id === clusterId)!.zoneId)!;
    if (
      !rectInside(piece!.rect, zone.rect) ||
      structures.some((s) => rectsOverlap(s.rect, piece!.rect)) ||
      zones.some(
        (z) =>
          ["crosswalk", "intersection", "corridor", "doorway", "dance", "aisle"].includes(z.kind) &&
          rectsOverlap(z.rect, piece!.rect),
      )
    )
      fail();
    return {
      coverId,
      art: choice(p["art"], ENVIRONMENT_ART),
      rotation: p["rotation"] as 0 | 90,
      clusterId,
    };
  });
  if (bindings.size !== (arena.cover?.length ?? 0)) fail();
  const dressing = list(r["dressing"], 128).map((v) => {
    const d = obj(v),
      p = obj(d["position"]);
    const position = { x: num(p["x"], -20, 120), y: num(p["y"], -20, 120) };
    const clusterId = cluster(d["clusterId"]);
    const zone = zones.find((z) => z.id === clusters.find((c) => c.id === clusterId)!.zoneId)!;
    if (
      !rectInside({ ...position, width: 0, height: 0 }, zone.rect) ||
      structures.some(
        (s) =>
          position.x > s.rect.x &&
          position.x < s.rect.x + s.rect.width &&
          position.y > s.rect.y &&
          position.y < s.rect.y + s.rect.height,
      )
    )
      fail();
    return { id: id(d["id"]), kind: choice(d["kind"], DRESSING_KINDS), position, clusterId };
  });
  const worldBounds = {
    x: -20,
    y: -20,
    width: arena.extent.width + 40,
    height: arena.extent.height + 40,
  };
  if ([...zones, ...structures].some((item) => !rectInside(item.rect, worldBounds))) fail();
  const seed = num(r["seed"], 0, 4294967295);
  if (!Number.isInteger(seed)) fail();
  for (let i = 0; i < structures.length; i++) {
    if (structures.slice(i + 1).some((s) => rectsOverlap(structures[i]!.rect, s.rect))) fail();
    if (arena.cover?.some((p) => p.id === structures[i]!.id)) fail();
  }
  const interior = readInterior(r["interior"], zones, structures, arena);
  const interiorRecipe = ["office", "nightclub", "warehouse", "garage"].includes(
    r["recipe"] as string,
  );
  if (interiorRecipe !== Boolean(interior) || (interiorRecipe && r["recipeVersion"] !== 3)) fail();
  return {
    version: 1,
    ...(interior ? { interior } : {}),
    recipe: choice(r["recipe"], [
      "intersection",
      "alley",
      "office",
      "nightclub",
      "warehouse",
      "garage",
      "residential",
    ] as const),
    recipeVersion: r["recipeVersion"] as 1 | 2 | 3,
    ...(entrances ? { entrances } : {}),
    seed,
    zones,
    structures,
    clusters,
    props,
    dressing,
  };
}

/** Opening and both approach points, derived from the saved room boundaries. */
export function doorwayApproaches(door: Rect, a: Rect, b: Rect): Point[] {
  const horizontal =
    (a.x + a.width === door.x && door.x + door.width === b.x) ||
    (b.x + b.width === door.x && door.x + door.width === a.x);
  const vertical =
    (a.y + a.height === door.y && door.y + door.height === b.y) ||
    (b.y + b.height === door.y && door.y + door.height === a.y);
  if (
    horizontal &&
    door.width === 2 &&
    [a, b].every((r) => door.y >= r.y && door.y + door.height <= r.y + r.height)
  )
    return Array.from({ length: door.height / 2 }, (_, i) => [
      { x: door.x - 1, y: door.y + 1 + i * 2 },
      { x: door.x + 1, y: door.y + 1 + i * 2 },
      { x: door.x + 3, y: door.y + 1 + i * 2 },
    ]).flat();
  if (
    vertical &&
    door.height === 2 &&
    [a, b].every((r) => door.x >= r.x && door.x + door.width <= r.x + r.width)
  )
    return Array.from({ length: door.width / 2 }, (_, i) => [
      { x: door.x + 1 + i * 2, y: door.y - 1 },
      { x: door.x + 1 + i * 2, y: door.y + 1 },
      { x: door.x + 1 + i * 2, y: door.y + 3 },
    ]).flat();
  return fail();
}
/** Exterior openings reserve only the in-bounds approach; they add no travel action. */
export function exteriorDoorwayApproaches(
  door: Rect,
  room: Rect,
  extent: Arena["extent"],
): Point[] {
  let outside: Rect;
  if (door.x === 0) outside = { x: -2, y: door.y, width: 2, height: door.height };
  else if (door.x + door.width === extent.width)
    outside = { x: extent.width, y: door.y, width: 2, height: door.height };
  else if (door.y === 0) outside = { x: door.x, y: -2, width: door.width, height: 2 };
  else if (door.y + door.height === extent.height)
    outside = { x: door.x, y: extent.height, width: door.width, height: 2 };
  else return fail();
  return doorwayApproaches(door, room, outside).filter(
    (p) => p.x > 0 && p.y > 0 && p.x < extent.width && p.y < extent.height,
  );
}
function readInterior(
  value: unknown,
  zones: SceneZone[],
  structures: SceneStructure[],
  arena: Arena,
): SceneEnvironment["interior"] {
  if (value === undefined) return undefined;
  const r = obj(value),
    bounds = { x: 0, y: 0, ...arena.extent };
  const spaces = zones.filter((z) => !["aisle", "doorway"].includes(z.kind));
  const doors = zones.filter((z) => z.kind === "doorway");
  if (!spaces.length || zones.some((z) => !rectInside(z.rect, bounds))) fail();
  for (const [i, space] of spaces.entries()) {
    if (
      spaces.slice(i + 1).some((z) => rectsOverlap(space.rect, z.rect)) ||
      structures.some((w) => rectsOverlap(w.rect, space.rect))
    )
      fail();
  }
  const used = new Set<string>();
  const open = (p: Point) => {
    const tile = { x: p.x - 1, y: p.y - 1, width: 2, height: 2 };
    if (
      !rectInside(tile, bounds) ||
      p.x % 2 !== 1 ||
      p.y % 2 !== 1 ||
      structures.some((w) => rectsOverlap(w.rect, tile)) ||
      arena.cover?.some((c) => rectsOverlap(c.rect, tile))
    )
      fail();
  };
  const connections = list(r["connections"], 32).map((v) => {
    const c = obj(v),
      zoneId = str(c["zoneId"]),
      from = str(c["from"]),
      to = str(c["to"]);
    const door = doors.find((z) => z.id === zoneId),
      a = spaces.find((z) => z.id === from),
      b = spaces.find((z) => z.id === to);
    if (!door || !a || (!b && to !== "outside") || a === b || used.has(zoneId)) fail();
    used.add(zoneId);
    (b
      ? doorwayApproaches(door!.rect, a!.rect, b.rect)
      : exteriorDoorwayApproaches(door!.rect, a!.rect, arena.extent)
    ).forEach(open);
    return { zoneId, from, to };
  });
  if (used.size !== doors.length) fail();
  for (const [i, door] of doors.entries())
    if ([...spaces, ...doors.slice(i + 1)].some((z) => rectsOverlap(z.rect, door.rect))) fail();
  const accessIds = new Set<string>();
  const access = list(r["access"], 64).map((v) => {
    const a = obj(v),
      p = obj(a["position"]),
      zoneId = str(a["zoneId"]),
      key = str(a["id"]);
    const position = {
      x: num(p["x"], 1, arena.extent.width - 1),
      y: num(p["y"], 1, arena.extent.height - 1),
    };
    const zone = spaces.find((z) => z.id === zoneId);
    if (
      !zone ||
      accessIds.has(key) ||
      !rectInside({ x: position.x - 1, y: position.y - 1, width: 2, height: 2 }, zone.rect)
    )
      fail();
    accessIds.add(key);
    open(position);
    return { id: key, zoneId, position, label: str(a["label"]) };
  });
  if (spaces.some((z) => !access.some((a) => a.zoneId === z.id))) fail();
  // A saved interior cannot erase a wall or invent unseen solid space.
  for (let x = 0; x < arena.extent.width; x += 2)
    for (let y = 0; y < arena.extent.height; y += 2) {
      const tile = { x, y, width: 2, height: 2 };
      const floor = [...spaces, ...doors].some((z) => rectInside(tile, z.rect));
      const wall = structures.some(
        (w) => rectInside(tile, w.rect) && w.blocksMovement && w.blocksShots,
      );
      if (floor === wall) fail();
    }
  return { connections, access };
}
