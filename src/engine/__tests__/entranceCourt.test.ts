import { expect, it } from "vitest";
import v12 from "./fixtures/intersection-v12.json";
import v11 from "./fixtures/intersection-v11.json";
import { composeScene } from "../sceneComposer";
import { readSceneManifest } from "../persistentScene";
import { openEntranceCourt } from "../intersectionPrograms";
import { rectsOverlap } from "../sceneEnvironment";
import { blockedTiles, reachableTiles, tileKey, tileOf } from "../grid";
import { snapshotBattlefield } from "../battlefieldSnapshot";
import { coverMaxHp } from "../cover";

// Exercise the historical v12 transform; v13 subsequently rebuilds the corner.
function composeCourt() {
  const scene = readSceneManifest({ version: 1, scene: structuredClone(v11) });
  openEntranceCourt(scene.layout.arena, scene.actors);
  scene.layout.arena.environment!.recipeVersion = 12;
  scene.layout.arena.key = v12.layout.arena.key;
  scene.templateVersion = v12.templateVersion;
  scene.anchor = v12.anchor;
  scene.layout = snapshotBattlefield(scene.layout.arena);
  const normalized = readSceneManifest({ version: 1, scene });
  expect(normalized).toEqual(v12);
  return normalized;
}

it("keeps the actual v11 save intact and opens half the new entrance-annex roof footprint", () => {
  const previous = readSceneManifest({ version: 1, scene: structuredClone(v11) });
  expect(previous).toEqual(v11);
  const scene = composeCourt(),
    env = scene.layout.arena.environment!;
  expect(env.recipeVersion).toBe(12);
  const annex = env.structures.find((s) => s.id === "building_1")!;
  expect(annex.rect).toEqual({ x: 22, y: 6, width: 4, height: 4 });
  expect(annex.rect.width * annex.rect.height).toBe(16); // formerly 32 m²
  expect(env.entrances).toEqual(previous.layout.arena.environment!.entrances);
  expect(env.structures.filter((s) => s.id !== annex.id)).toEqual(
    previous.layout.arena.environment!.structures.filter((s) => s.id !== annex.id),
  );
  expect(annex.attachments![0]!.offset).toBe(0);
  expect(env.zones.find((z) => z.id === "housing-court-access")!.floorUse).toBe("entry");
  for (const seed of [0, 7, 9])
    expect(composeScene("intersection", seed).layout.arena.environment!.recipeVersion).toBe(10);
});

it("keeps the food-shop stalls while giving the repair corner parts and power equipment", () => {
  const arena = composeCourt().layout.arena,
    env = arena.environment!;
  expect(env.props.filter((p) => p.art === "shop-display").map((p) => p.clusterId)).toEqual([
    "street_market_west-walk_0",
    "street_market_west-walk_1",
  ]);
  expect(env.props.filter((p) => p.clusterId.startsWith("repair_")).map((p) => p.art)).toEqual([
    "cargo",
    "generator",
    "planter",
  ]);
  expect(env.props.some((p) => p.clusterId === "housing_court_garden")).toBe(true);
  for (const a of arena.cover!) {
    expect(env.structures.some((s) => rectsOverlap(s.rect, a.rect))).toBe(false);
    expect(arena.cover!.some((b) => a !== b && rectsOverlap(a.rect, b.rect))).toBe(false);
    expect(
      env.zones
        .filter((z) => ["aisle", "crosswalk"].includes(z.kind))
        .some((z) => rectsOverlap(z.rect, a.rect)),
    ).toBe(false);
  }
  expect(env.zones.find((z) => z.id === "junction")!.rect).toEqual({
    x: 12,
    y: 14,
    width: 6,
    height: 4,
  });
  expect(env.zones.find((z) => z.id === "travel-lane")!.rect.width).toBe(4);
});

it("retains access to the court, actors, doors and workspaces before and after destruction", () => {
  const scene = composeCourt(),
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
      const key = tileKey(tileOf(arena, p));
      expect(blocked.has(key)).toBe(false);
      expect(seen.has(key)).toBe(true);
    }
  }
  const saved = JSON.stringify(scene);
  openEntranceCourt(arena, scene.actors);
  expect(JSON.stringify(scene)).toBe(saved);
  expect(readSceneManifest({ version: 1, scene: JSON.parse(saved) })).toEqual(scene);
  expect(composeCourt()).toEqual(scene);
});
