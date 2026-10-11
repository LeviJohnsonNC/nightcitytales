import { expect, it } from "vitest";
import v14 from "./fixtures/intersection-v14.json";
import { composeScene } from "../sceneComposer";
import { readSceneManifest } from "../persistentScene";
import { addStreetWorkClusters } from "../intersectionPrograms";
import { rectsOverlap } from "../sceneEnvironment";
import { blockedTiles, reachableTiles, tileKey, tileOf } from "../grid";
import { coverMaxHp } from "../cover";

const clusterIds = new Set([
  "market_restock",
  "street_repair_workbench",
  "street_service_collection",
]);

it("preserves v14 saves and adds only three canonical work props to new seed8 scenes", () => {
  expect(readSceneManifest({ version: 1, scene: structuredClone(v14) })).toEqual(v14);
  const scene = composeScene("intersection", 8),
    arena = scene.layout.arena,
    env = arena.environment!;
  expect(env.recipeVersion).toBe(15);
  const added = env.props.filter((p) => clusterIds.has(p.clusterId));
  expect(added.map((p) => p.art)).toEqual(["pallet", "workbench", "dumpster"]);
  expect(env.props.filter((p) => !added.includes(p))).toEqual(v14.layout.arena.environment.props);
  const ids = new Set(added.map((p) => p.coverId));
  const pieces = arena.cover!.filter((c) => ids.has(c.id));
  expect(pieces).toHaveLength(3);
  expect(arena.cover!.filter((c) => !ids.has(c.id))).toEqual(v14.layout.arena.cover);
  expect(env.structures).toEqual(v14.layout.arena.environment.structures);
  expect(scene.actors).toEqual(v14.actors);
  for (const piece of pieces) {
    expect(coverMaxHp(piece)).toBeGreaterThan(0);
    for (const d of env.dressing.filter((d) => d.kind === "lamp"))
      expect(
        rectsOverlap(piece.rect, {
          x: d.position.x - 0.35,
          y: d.position.y - 0.35,
          width: 0.7,
          height: 0.7,
        }),
      ).toBe(false);
    expect(env.structures.some((s) => rectsOverlap(s.rect, piece.rect))).toBe(false);
    expect(arena.cover!.some((c) => c !== piece && rectsOverlap(c.rect, piece.rect))).toBe(false);
    expect(
      env.zones
        .filter((z) => ["aisle", "crosswalk"].includes(z.kind))
        .some((z) => rectsOverlap(z.rect, piece.rect)),
    ).toBe(false);
  }
  const saved = JSON.stringify(scene);
  addStreetWorkClusters(arena, scene.actors);
  expect(JSON.stringify(scene)).toBe(saved);
  expect(composeScene("intersection", 8)).toEqual(scene);
  expect(readSceneManifest({ version: 1, scene: JSON.parse(saved) })).toEqual(scene);
});

it("keeps each working space reachable and releases its occupied tile after destruction", () => {
  const scene = composeScene("intersection", 8),
    arena = scene.layout.arena,
    env = arena.environment!;
  const ids = new Set(env.props.filter((p) => clusterIds.has(p.clusterId)).map((p) => p.coverId));
  const pieces = arena.cover!.filter((c) => ids.has(c.id));
  for (const cover of [{}, Object.fromEntries(pieces.map((c) => [c.id, coverMaxHp(c)]))]) {
    const blocked = blockedTiles(arena, cover);
    const reached = reachableTiles({
      arena,
      cover,
      from: tileOf(arena, arena.playerStart),
      allowance: 1000,
    });
    for (const z of env.zones.filter(
      (z) => z.kind === "aisle" && [...clusterIds].some((id) => z.id.startsWith(`${id}_access_`)),
    ))
      expect(reached.has(tileKey(tileOf(arena, { x: z.rect.x + 1, y: z.rect.y + 1 })))).toBe(true);
    for (const c of pieces) {
      const key = tileKey(tileOf(arena, { x: c.rect.x + 1, y: c.rect.y + 1 }));
      expect(blocked.has(key)).toBe(Object.keys(cover).length === 0);
    }
  }
});
