import { readSceneEnvironment } from "./sceneEnvironment";
/** Frozen geometry for a fight. Unknown versions fail closed; legacy rows use their arena key. */
import { arenaFor, rectContains, type Arena, type Point } from "./battlefield";
import { blockedTiles, tileKey, tileOf } from "./grid";
import { coverMaxHp, COVER_MATERIAL_KEYS, type CoverDamage } from "./cover";

export type BattlefieldSnapshot = { version: 1 | 2; arena: Arena };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid battlefield snapshot.");
  return value as Record<string, unknown>;
}
function number(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max)
    throw new Error("Invalid battlefield dimension.");
  return value;
}
function label(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 160)
    throw new Error("Invalid battlefield label.");
  return value;
}

/** Validate and copy persisted geometry. Never repair an invalid snapshot by changing the map. */
export function readBattlefieldSnapshot(value: unknown): BattlefieldSnapshot {
  const raw = object(value);
  if (raw["version"] !== 1 && raw["version"] !== 2)
    throw new Error("Unsupported battlefield snapshot version. Refresh the game.");
  const source = object(raw["arena"]);
  const extent = object(source["extent"]);
  const width = number(extent["width"], 100);
  const height = number(extent["height"], 100);
  if (width < 2 || height < 2 || width % 2 || height % 2)
    throw new Error("Invalid battlefield grid.");
  const point = (value: unknown): Point => {
    const p = object(value);
    const x = number(p["x"], width - 1);
    const y = number(p["y"], height - 1);
    if (x % 2 !== 1 || y % 2 !== 1) throw new Error("Battlefield position is off grid.");
    return { x, y };
  };
  const slots = source["hostileSlots"];
  const pieces = source["cover"];
  if (!Array.isArray(slots) || slots.length > 32 || !Array.isArray(pieces) || pieces.length > 256)
    throw new Error("Invalid battlefield contents.");
  const ids = new Set<string>();
  const footprints = new Set<string>();
  const arena: Arena = {
    key: label(source["key"]),
    label: label(source["label"]),
    extent: { width, height },
    playerStart: point(source["playerStart"]),
    hostileSlots: slots.map(point),
    cover: pieces.map((value) => {
      const piece = object(value);
      const rect = object(piece["rect"]);
      const id = label(piece["id"]);
      if (ids.has(id)) throw new Error("Duplicate battlefield object ID.");
      ids.add(id);
      const x = number(rect["x"], width - 2);
      const y = number(rect["y"], height - 2);
      if (x % 2 || y % 2 || rect["width"] !== 2 || rect["height"] !== 2)
        throw new Error("Invalid cover section.");
      const tile = `${x},${y}`;
      if (footprints.has(tile)) throw new Error("Overlapping battlefield objects.");
      footprints.add(tile);
      const material = label(piece["material"]);
      const thickness = piece["thickness"];
      if (thickness !== "thin" && thickness !== "thick")
        throw new Error("Unsupported cover material.");
      if (piece["blocksMovement"] !== undefined && typeof piece["blocksMovement"] !== "boolean")
        throw new Error("Invalid obstacle behavior.");
      return {
        id,
        label: label(piece["label"]),
        material,
        thickness,
        rect: { x, y, width: 2, height: 2 },
        maxHp: number(piece["maxHp"], 1000),
        ...(piece["blocksMovement"] === false ? { blocksMovement: false } : {}),
      };
    }),
  };
  if (raw["version"] === 2) arena.environment = readSceneEnvironment(source["environment"], arena);
  else if (source["environment"] !== undefined)
    throw new Error("Composition requires battlefield version 2.");
  const occupied = new Set<string>();
  for (const p of [arena.playerStart, ...arena.hostileSlots]) {
    const key = `${p.x},${p.y}`;
    if (occupied.has(key)) throw new Error("Overlapping battlefield spawns.");
    occupied.add(key);
    if (
      arena.environment?.structures.some((s) => s.blocksMovement && rectContains(s.rect, p)) ||
      arena.cover!.some(
        (c) => c.blocksMovement !== false && c.rect.x === p.x - 1 && c.rect.y === p.y - 1,
      )
    )
      throw new Error("Battlefield spawn is inside an obstacle.");
  }
  return { version: raw["version"], arena };
}

/** Copy mechanical HP as well as geometry so catalog changes cannot alter an ongoing fight. */
export function snapshotBattlefield(arena: Arena): BattlefieldSnapshot {
  if ((arena.cover ?? []).some((piece) => !COVER_MATERIAL_KEYS.includes(piece.material)))
    throw new Error("Unsupported authored cover material.");
  return readBattlefieldSnapshot({
    version: arena.environment ? 2 : 1,
    arena: {
      ...arena,
      cover: (arena.cover ?? []).map((p) => ({ ...p, maxHp: coverMaxHp(p) })),
    },
  });
}

export function battlefieldFor(encounter: {
  arena: string | null;
  layout?: BattlefieldSnapshot;
}): Arena {
  return encounter.layout?.arena ?? arenaFor(encounter.arena);
}

/** Stored actors are validated, never silently snapped onto different ground. */
export function readBattlefieldPositions(
  snapshot: BattlefieldSnapshot,
  values: unknown[],
  damage: CoverDamage,
): Point[] {
  const arena = snapshot.arena;
  const blocked = blockedTiles(arena, damage);
  const seen = new Set<string>();
  return values.map((value) => {
    const raw = object(value);
    const point = {
      x: number(raw["x"], arena.extent.width - 1),
      y: number(raw["y"], arena.extent.height - 1),
    };
    if (point.x % 2 !== 1 || point.y % 2 !== 1)
      throw new Error("Saved battlefield position is off grid.");
    const key = tileKey(tileOf(arena, point));
    if (seen.has(key) || blocked.has(key))
      throw new Error("Saved battlefield position is occupied.");
    seen.add(key);
    return point;
  });
}
