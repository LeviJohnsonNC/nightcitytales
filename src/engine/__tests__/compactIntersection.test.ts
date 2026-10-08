import { expect, it } from "vitest";
import v10 from "./fixtures/intersection-v10.json";
import { composeScene } from "../sceneComposer";
import { readSceneManifest } from "../persistentScene";
import { compactIntersectionPrototype } from "../intersectionPrograms";
import { rectsOverlap } from "../sceneEnvironment";
import { blockedTiles, reachableTiles, tileKey, tileOf } from "../grid";
import { coverMaxHp } from "../cover";

it("loads the actual seed8 v10 save unchanged instead of applying the prototype", () => {
  expect(readSceneManifest({ version: 1, scene: structuredClone(v10) })).toEqual(v10);
  expect(v10.layout.arena.environment.recipeVersion).toBe(10);
});

it("halves the junction area without scaling buildings, furniture or cover strength", () => {
  const scene = composeScene("intersection", 8),
    arena = scene.layout.arena,
    env = arena.environment!;
  const before = readSceneManifest({ version: 1, scene: v10 }).layout.arena;
  expect(env.recipeVersion).toBe(11);
  expect(env.zones.find((z) => z.id === "junction")!.rect).toEqual({
    x: 12,
    y: 14,
    width: 6,
    height: 4,
  });
  expect(env.zones.find((z) => z.id === "street")!.rect.width).toBe(6);
  expect(env.zones.find((z) => z.id === "cross-street")!.rect.height).toBe(4);
  expect(arena.cover!.map((c) => c.id)).toEqual(before.cover!.map((c) => c.id));
  for (const current of [...env.structures, ...arena.cover!]) {
    const old = [...before.environment!.structures, ...before.cover!].find(
      (s) => s.id === current.id,
    )!;
    expect([current.rect.width, current.rect.height]).toEqual([old.rect.width, old.rect.height]);
  }
  for (const c of arena.cover!)
    expect(coverMaxHp(c)).toBe(coverMaxHp(before.cover!.find((b) => b.id === c.id)!));
  expect(env.props).toEqual(before.environment!.props);
  expect(env.structures.map((s) => s.height)).toEqual(
    before.environment!.structures.map((s) => s.height),
  );
  expect(env.zones.every((z) => z.rect.width > 0 && z.rect.height > 0)).toBe(true);
});

it("retains four parked cars, a clear four-metre travel lane and four clear crossings", () => {
  const arena = composeScene("intersection", 8).layout.arena,
    env = arena.environment!;
  const lane = env.zones.find((z) => z.id === "travel-lane")!.rect;
  expect([lane.x, lane.width]).toEqual([12, 4]);
  const cars = env.props.filter((p) => p.art === "sedan-engine");
  expect(cars).toHaveLength(4);
  expect(cars.map((p) => arena.cover!.find((c) => c.id === p.coverId)!.rect.x)).toEqual([
    16, 16, 16, 16,
  ]);
  for (const route of [lane, ...env.zones.filter((z) => z.kind === "crosswalk").map((z) => z.rect)])
    expect(arena.cover!.some((c) => rectsOverlap(c.rect, route))).toBe(false);
  for (const a of arena.cover!) {
    expect(env.structures.some((s) => rectsOverlap(s.rect, a.rect))).toBe(false);
    expect(arena.cover!.some((b) => a !== b && rectsOverlap(a.rect, b.rect))).toBe(false);
  }
});

it("preserves connected actor, entrance and browsing access through damage and exact saves", () => {
  const scene = composeScene("intersection", 8),
    arena = scene.layout.arena,
    env = arena.environment!;
  for (const damage of [{}, Object.fromEntries(arena.cover!.map((c) => [c.id, coverMaxHp(c)]))]) {
    const seen = reachableTiles({
      arena,
      cover: damage,
      from: tileOf(arena, arena.playerStart),
      allowance: 1000,
    });
    const blocked = blockedTiles(arena, damage);
    const points = [
      ...scene.actors.map((a) => a.position),
      ...env.entrances!.map((e) => e.position),
      ...env.zones
        .filter((z) => z.kind === "aisle")
        .map((z) => ({
          x: Math.max(1, Math.min(31, z.rect.x + 1)),
          y: Math.max(1, Math.min(31, z.rect.y + 1)),
        })),
    ];
    for (const p of points) {
      expect(blocked.has(tileKey(tileOf(arena, p)))).toBe(false);
      expect(seen.has(tileKey(tileOf(arena, p)))).toBe(true);
    }
  }
  const saved = JSON.stringify(scene);
  compactIntersectionPrototype(arena, scene.actors);
  expect(JSON.stringify(scene)).toBe(saved);
  expect(readSceneManifest({ version: 1, scene: JSON.parse(saved) })).toEqual(scene);
  expect(composeScene("intersection", 8)).toEqual(scene);
  for (const seed of [0, 7, 9])
    expect(composeScene("intersection", seed).layout.arena.environment!.recipeVersion).toBe(10);
});
