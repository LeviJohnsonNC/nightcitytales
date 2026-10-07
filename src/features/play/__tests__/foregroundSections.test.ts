import { expect, it } from "vitest";
import { composeScene, blockedTiles, shotObstacles, type SceneStructure } from "@/engine";
import {
  foregroundObstructs,
  foregroundRoute,
  retainForegroundSection,
} from "../courtyard/foregroundSections";

const building: SceneStructure = {
  id: "building",
  label: "Building",
  style: "warehouse",
  rect: { x: 10, y: 10, width: 8, height: 8 },
  height: 8,
  blocksMovement: true,
  blocksShots: true,
};
it("keeps unrelated buildings solid and protects a silhouette at the wall edge", () => {
  expect(foregroundObstructs(building, [{ x: 9, y: 19 }])).toBe(true);
  expect(foregroundObstructs(building, [{ x: 19, y: 9 }])).toBe(false);
  expect(foregroundObstructs(building, [{ x: 9, y: 9 }])).toBe(false);
  expect(foregroundObstructs(building, [])).toBe(false);
  expect(foregroundObstructs(building, [{ x: 9.8, y: 9.8 }])).toBe(true);
});
it("lowers only the wall sections crossing the protected ground", () => {
  const points = [{ x: 9, y: 17 }];
  expect(retainForegroundSection(building, { x: 10, y: 10, width: 2, height: 0.24 }, points)).toBe(
    true,
  );
  expect(retainForegroundSection(building, { x: 16, y: 10, width: 2, height: 0.24 }, points)).toBe(
    false,
  );
});
it("protects the middle of long route segments without editing the route", () => {
  const path = [
    { x: 0, y: 20 },
    { x: 20, y: 20 },
  ];
  const before = JSON.stringify(path);
  expect(foregroundObstructs(building, path)).toBe(false);
  expect(foregroundObstructs(building, foregroundRoute(path))).toBe(true);
  expect(JSON.stringify(path)).toBe(before);
  expect(foregroundRoute([])).toEqual([]);
  expect(foregroundRoute([path[0]!, path[0]!])).toEqual([path[0], path[0]]);
});
it("reads frozen intersection geometry without altering saves, movement or shots", () => {
  for (const seed of [0, 1, 7, 8]) {
    const scene = composeScene("intersection", seed);
    const arena = scene.layout.arena;
    const before = JSON.stringify(scene);
    const blocked = blockedTiles(arena, {});
    const shots = shotObstacles(arena, arena.playerStart, scene.actors[0]!.position, {});
    for (const s of arena.environment!.structures) {
      const points = foregroundRoute([arena.playerStart, scene.actors[0]!.position]);
      expect(foregroundObstructs(JSON.parse(JSON.stringify(s)), points)).toBe(
        foregroundObstructs(s, points),
      );
    }
    expect(JSON.stringify(scene)).toBe(before);
    expect(blockedTiles(arena, {})).toEqual(blocked);
    expect(shotObstacles(arena, arena.playerStart, scene.actors[0]!.position, {})).toEqual(shots);
  }
});
