import { expect, it } from "vitest";
import { composeScene, blockedTiles, shotObstacles, type SceneStructure } from "@/engine";
import { activityOccluders, buildingHidesGround } from "../courtyard/activityReveal";
import { COMPOSITION_REVIEW_SEEDS } from "@/features/dev/sceneReviewQuery";

it("reveals ground behind a building silhouette, not its bounding-box corners or ground in front", () => {
  const building: SceneStructure = {
    id: "building",
    label: "Building",
    rect: { x: 10, y: 10, width: 4, height: 4 },
    height: 6,
    style: "warehouse",
    blocksMovement: true,
    blocksShots: true,
  };
  expect(buildingHidesGround(building, { x: 9, y: 15 })).toBe(true);
  expect(buildingHidesGround(building, { x: 15, y: 9 })).toBe(false);
  expect(buildingHidesGround(building, { x: 0, y: 24 })).toBe(false);
  expect(buildingHidesGround(building, { x: 9, y: 9 })).toBe(false);
  expect(buildingHidesGround(building, { x: 12, y: 12 })).toBe(false);
  expect(buildingHidesGround({ ...building, height: 0.5 }, { x: 9, y: 15 })).toBe(false);
  for (const style of ["interior-wall", "mesh-fence"] as const)
    expect(buildingHidesGround({ ...building, style }, { x: 9, y: 15 })).toBe(false);
});

it("finds the obscured exterior activity in all curated families without changing saved or tactical truth", () => {
  for (const [kind, seeds] of Object.entries(COMPOSITION_REVIEW_SEEDS)) {
    for (const seed of seeds) {
      const scene = composeScene(kind as Parameters<typeof composeScene>[0], seed);
      const arena = scene.layout.arena;
      const before = JSON.stringify(scene);
      const blocked = blockedTiles(arena, {});
      const shots = shotObstacles(arena, arena.playerStart, scene.actors[0]!.position, {});
      const reveal = activityOccluders(arena);
      if (arena.environment!.interior) expect(reveal.size).toBe(0);
      else {
        expect(reveal.size).toBeGreaterThan(0);
        expect(reveal.size).toBeLessThan(arena.environment!.structures.length);
      }
      expect(JSON.stringify(scene)).toBe(before);
      expect(blockedTiles(arena, {})).toEqual(blocked);
      expect(shotObstacles(arena, arena.playerStart, scene.actors[0]!.position, {})).toEqual(shots);
      const saved = JSON.parse(before);
      expect(activityOccluders(saved.layout.arena)).toEqual(reveal);
    }
  }
});

it("leaves legacy arenas without semantic scenery alone", () => {
  const arena = { ...composeScene("alley", 4).layout.arena };
  delete arena.environment;
  expect(activityOccluders(arena).size).toBe(0);
});
