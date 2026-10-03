import { describe, expect, it } from "vitest";
import {
  arenaFor,
  northHeywoodScene,
  coverStatuses,
  blockedTiles,
  tileKey,
  tileOf,
} from "@/engine";
import { scenicTheme, STREET_PROPS, civilianCell } from "../courtyard/scenicPresentation";
import { propCondition, propPlacement } from "../courtyard/propPresentation";
import { battlefieldProjection } from "../battlefieldProjection";

const arena = northHeywoodScene().layout.arena;
describe("North Heywood scenic art", () => {
  it("requires the authored geometry, not just a familiar key or title", () => {
    expect(scenicTheme(arena)).toBe("street");
    expect(scenicTheme({ ...arena, cover: [...arena.cover!].reverse() })).toBe("street");
    expect(scenicTheme({ ...arena, key: "scene:north-heywood-intersection:v2" })).toBeNull();
    expect(scenicTheme({ ...arena, extent: { width: 26, height: 24 } })).toBeNull();
    expect(scenicTheme({ ...arena, cover: [] })).toBeNull();
    const moved = structuredClone(arena);
    moved.cover![0]!.rect.x -= 2;
    expect(scenicTheme(moved)).toBeNull();
    const unknown = structuredClone(arena);
    unknown.cover![0]!.id = "new_prop";
    expect(scenicTheme(unknown)).toBeNull();
    for (const key of ["night_shift", "night_shift_yard", "night_shift_grid"])
      expect(scenicTheme(arenaFor(key))).toBe("courtyard");
  });
  it("preserves independent cruiser section states and their saved footprints", () => {
    expect(Object.keys(STREET_PROPS).sort()).toEqual(arena.cover!.map((p) => p.id).sort());
    const damage = JSON.parse(JSON.stringify({ thorton_engine: 1000, broth_cart_cart: 1 }));
    const statuses = coverStatuses(arena, damage);
    expect(Object.fromEntries(statuses.map((s) => [s.piece.id, propCondition(s)]))).toEqual({
      thorton_engine: "wrecked",
      thorton_cabin: "intact",
      broth_cart_cart: "damaged",
    });
    const blocked = blockedTiles(arena, damage);
    expect(blocked.has(tileKey(tileOf(arena, { x: 19, y: 9 })))).toBe(false);
    expect(blocked.has(tileKey(tileOf(arena, { x: 21, y: 9 })))).toBe(true);
    const { project } = battlefieldProjection(arena.extent.width, arena.extent.height);
    for (const status of statuses) {
      const intact = coverStatuses(arena, {}).find((s) => s.piece.id === status.piece.id)!;
      const a = propPlacement(status, project),
        b = propPlacement(intact, project);
      expect([a.x, a.y, a.width, a.groundDepth]).toEqual([b.x, b.y, b.width, b.groundDepth]);
    }
  });
  it("keeps both civilians crouched until an explicit death is presented", () => {
    expect(civilianCell(false, false)).toBe(1);
    expect(civilianCell(false, true)).toBe(4);
    expect(civilianCell(true, false)).toBe(2);
    expect(civilianCell(true, true)).toBe(5);
  });
});
