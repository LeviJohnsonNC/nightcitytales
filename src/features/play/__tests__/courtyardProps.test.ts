import { describe, expect, it } from "vitest";
import {
  arenaFor,
  coverStatuses,
  coverBlocking,
  applyCoverDamage,
  blockedTiles,
  tileKey,
  tileOf,
  coverDamageFrom,
  rectContains,
  placeHostiles,
  SELECTABLE_ARENAS,
} from "@/engine";
import {
  GRID_DEPTH,
  YARD_PROPS,
  propCondition,
  propKind,
  propPlacement,
} from "../courtyard/propPresentation";
import { battlefieldProjection } from "../battlefieldProjection";

const arena = arenaFor("night_shift_grid");
describe("courtyard props tell the same truth as the engine", () => {
  it("keeps every retired layout resolvable for fights already on it", () => {
    const old = arenaFor("night_shift");
    expect(old.cover?.map((p) => [p.id, p.rect])).toEqual([
      ["cargo_west", { x: 6, y: 10, width: 2, height: 2 }],
      ["cargo_middle", { x: 12, y: 11, width: 2, height: 2 }],
      ["cargo_east", { x: 17, y: 7, width: 2, height: 2 }],
      ["cargo_rear", { x: 10, y: 17, width: 2, height: 2 }],
    ]);
    expect(coverDamageFrom(old, { cargo_middle: 12 })).toEqual({ cargo_middle: 12 });
    expect(propKind(old.key, "cargo_middle")).toBe("cargo");
    // The pre-grid yard keeps its off-lattice geometry rather than being edited.
    const preGrid = arenaFor("night_shift_yard");
    expect(preGrid.retired).toBe(true);
    expect(preGrid.cover?.find((p) => p.id === "generator")?.rect.y).toBe(11);
    expect(SELECTABLE_ARENAS.map((a) => a.key)).not.toContain("night_shift_yard");
  });
  it("puts every section and every spawn on a whole square", () => {
    for (const piece of arena.cover!) {
      expect([piece.rect.x % 2, piece.rect.y % 2]).toEqual([0, 0]);
      expect([piece.rect.width, piece.rect.height]).toEqual([2, 2]);
    }
    for (const point of [arena.playerStart, ...arena.hostileSlots])
      expect([point.x % 2, point.y % 2]).toEqual([1, 1]);
  });
  it("provides exactly one art association per section and clear spawn points", () => {
    expect(Object.keys(YARD_PROPS).sort()).toEqual(arena.cover!.map((p) => p.id).sort());
    expect(new Set(Object.values(YARD_PROPS)).size).toBe(7);
    for (const point of [arena.playerStart, ...placeHostiles(arena, 6)])
      for (const piece of arena.cover!) expect(rectContains(piece.rect, point)).toBe(false);
  });
  it("loses the cab's cover and detour without destroying the cargo half", () => {
    const cab = arena.cover!.find((p) => p.id === "truck_cab")!;
    const from = { x: 15, y: 1 },
      to = { x: 15, y: 7 };
    const cabSquare = tileKey(tileOf(arena, { x: 15, y: 3 }));
    expect(coverBlocking(arena, from, to, {}).map((p) => p.id)).toEqual(["truck_cab"]);
    expect(blockedTiles(arena, {}).has(cabSquare)).toBe(true);
    const scratched = applyCoverDamage(cab, {}, 1);
    expect(
      propCondition(coverStatuses(arena, scratched.damageMap).find((s) => s.piece.id === cab.id)!),
    ).toBe("damaged");
    expect(coverBlocking(arena, from, to, scratched.damageMap)).toHaveLength(1);
    const wreck = applyCoverDamage(cab, scratched.damageMap, 1000);
    const reloaded = coverDamageFrom(arena, JSON.parse(JSON.stringify(wreck.damageMap)));
    expect(blockedTiles(arena, reloaded).has(cabSquare)).toBe(false);
    expect(coverBlocking(arena, from, to, reloaded)).toEqual([]);
    const statuses = coverStatuses(arena, reloaded);
    expect(propCondition(statuses.find((s) => s.piece.id === "truck_cab")!)).toBe("wrecked");
    expect(propCondition(statuses.find((s) => s.piece.id === "truck_cargo")!)).toBe("intact");
    expect(
      coverBlocking(arena, { x: 13, y: 1 }, { x: 13, y: 7 }, reloaded).map((p) => p.id),
    ).toEqual(["truck_cargo"]);
  });
  it("registers every condition to the engine's projected footprint and keeps wreckage under units", () => {
    const { project } = battlefieldProjection(arena.extent.width, arena.extent.height);
    for (const intact of coverStatuses(arena, {})) {
      const r = intact.piece.rect;
      const hit = applyCoverDamage(intact.piece, {}, intact.hpMax);
      const wreck = coverStatuses(arena, hit.damageMap).find(
        (s) => s.piece.id === intact.piece.id,
      )!;
      const a = propPlacement(intact, project),
        b = propPlacement(wreck, project);
      expect([a.x, a.y, a.width, a.groundDepth]).toEqual([b.x, b.y, b.width, b.groundDepth]);
      expect(a.y).toBe(project({ x: r.x + r.width, y: r.y }).y);
      expect(a.width).toBeCloseTo(
        project({ x: r.x + r.width, y: r.y + r.height }).x - project({ x: r.x, y: r.y }).x,
      );
      expect(b.depth).toBeLessThan(project({ x: r.x, y: r.y + r.height }).y);
    }
  });
  it("keeps the movement overlay under everything standing on the floor", () => {
    // The lit squares are painted into the scene at GRID_DEPTH so the art
    // occludes them. That only holds while nothing standing on the ground
    // sorts below it — props by their projected centre, wreckage by a fixed
    // -500, and units by their own projected y.
    const { project } = battlefieldProjection(arena.extent.width, arena.extent.height);
    for (const status of coverStatuses(arena, {})) {
      expect(propPlacement(status, project).depth).toBeGreaterThan(GRID_DEPTH);
      const wrecked = coverStatuses(
        arena,
        applyCoverDamage(status.piece, {}, status.hpMax).damageMap,
      ).find((s) => s.piece.id === status.piece.id)!;
      expect(propPlacement(wrecked, project).depth).toBeGreaterThan(GRID_DEPTH);
    }
    for (const point of [arena.playerStart, ...placeHostiles(arena, 6)])
      expect(project(point).y).toBeGreaterThan(GRID_DEPTH);
  });
});
