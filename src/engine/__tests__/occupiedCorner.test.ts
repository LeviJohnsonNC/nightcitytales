import { expect, it } from "vitest";
import v12 from "./fixtures/intersection-v12.json";
import { composeScene } from "../sceneComposer";
import { readSceneManifest } from "../persistentScene";
import { buildOccupiedCorner } from "../intersectionPrograms";
import { rectsOverlap } from "../sceneEnvironment";
import { blockedTiles, reachableTiles, tileKey, tileOf } from "../grid";
import { coverMaxHp } from "../cover";

it("retains real v12 saves while replacing only the new seed8 repair architecture", () => {
  const previous = readSceneManifest({ version: 1, scene: structuredClone(v12) });
  expect(previous).toEqual(v12);
  const scene = composeScene("intersection", 8),
    arena = scene.layout.arena,
    env = arena.environment!,
    old = previous.layout.arena.environment!;
  expect(env.recipeVersion).toBe(14);
  const front = env.structures.find((s) => s.id === "building_3")!;
  const market = env.structures.find((s) => s.id === "building_0")!;
  const previousMarket = old.structures.find((s) => s.id === market.id)!;
  expect(market.rect).toEqual(previousMarket.rect);
  expect(market.height).toBe(previousMarket.height);
  expect(market.attachments![0]).toEqual({
    ...previousMarket.attachments![0],
    span: 6,
    projection: 1.8,
  });
  expect(previousMarket.attachments![0]!.span).toBe(4);
  expect(front.rect).toEqual({ x: 22, y: 22, width: 6, height: 6 });
  expect([front.height, front.style]).toEqual([7.2, "shop"]);
  expect(env.structures.find((s) => s.id === "building_3_loft_a")!.height).toBe(10.2);
  expect(env.structures.find((s) => s.id === "building_3_service")!.height).toBe(3.2);
  expect(
    env.structures.filter((s) => !s.id.startsWith("building_3") && s.id !== "building_0"),
  ).toEqual(old.structures.filter((s) => !s.id.startsWith("building_3") && s.id !== "building_0"));
  expect(env.props).toEqual(old.props);
  expect(arena.cover).toEqual(previous.layout.arena.cover);
  expect(arena.playerStart).toEqual(previous.layout.arena.playerStart);
  expect(arena.hostileSlots).toEqual(previous.layout.arena.hostileSlots);
  expect(scene.actors).toEqual(previous.actors);
  expect(env.zones.find((z) => z.id === "repair-passage")!.rect).toEqual({
    x: 28,
    y: 22,
    width: 4,
    height: 12,
  });
  for (const a of env.structures) {
    expect(env.structures.some((b) => a !== b && rectsOverlap(a.rect, b.rect))).toBe(false);
    expect(arena.cover!.some((c) => rectsOverlap(a.rect, c.rect))).toBe(false);
    expect(
      env.zones
        .filter((z) => ["aisle", "crosswalk"].includes(z.kind))
        .some((z) => rectsOverlap(a.rect, z.rect)),
    ).toBe(false);
  }
});

it("connects the full passage, entrances and existing activity positions before and after damage", () => {
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
      ...[29, 31].flatMap((x) => [23, 25, 27, 29, 31].map((y) => ({ x, y }))),
      { x: 31, y: 19 },
      { x: 31, y: 21 },
    ];
    for (const p of points) {
      const key = tileKey(tileOf(arena, p));
      expect(blocked.has(key), JSON.stringify(p)).toBe(false);
      expect(seen.has(key), JSON.stringify(p)).toBe(true);
    }
  }
});

it("persists exactly, applies once and leaves control recipes unchanged", () => {
  const scene = composeScene("intersection", 8);
  const saved = JSON.stringify(scene);
  buildOccupiedCorner(scene.layout.arena);
  expect(JSON.stringify(scene)).toBe(saved);
  expect(readSceneManifest({ version: 1, scene: JSON.parse(saved) })).toEqual(scene);
  expect(composeScene("intersection", 8)).toEqual(scene);
  for (const seed of [0, 7, 9])
    expect(composeScene("intersection", seed).layout.arena.environment!.recipeVersion).toBe(10);
  for (const seed of [1, 2, 3])
    expect(composeScene("intersection", seed).layout.arena.environment!.recipeVersion).toBe(5);
});
