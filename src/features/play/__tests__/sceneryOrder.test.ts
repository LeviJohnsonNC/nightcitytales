import { describe, expect, it } from "vitest";
import { sceneReviewEncounter } from "@/features/dev/sceneReviewModel";
import { composeScene } from "@/engine";
import { activityGroundPoints, activityOccluders } from "../courtyard/activityReveal";
import { cutawayWalls } from "../courtyard/cutawayGeometry";
import { sceneryOrder } from "../courtyard/sceneryOrder";
import { battlefieldProjection } from "../battlefieldProjection";

const cases = [
  ["intersection", [1, 4, 2, 12, 3, 13]],
  ["office", [1, 4, 2, 8, 3, 0]],
  ["alley", [1, 4, 2, 11, 3, 5]],
  ["residential", [1, 0, 2, 19, 3, 4]],
  ["warehouse", [1, 4, 2, 5, 3, 7]],
  ["garage", [1, 0, 2, 33, 3, 14]],
  ["nightclub", [1, 7, 2, 8, 3, 0]],
] as const;

describe("scenery footprint ordering", () => {
  it("puts a nearby car in front of a long wall even when centre depth disagrees", () => {
    const result = sceneryOrder([
      { rect: { x: 0, y: 4, width: 20, height: 0.24 }, groundY: 100 },
      { rect: { x: 1, y: 1, width: 2, height: 2 }, groundY: 50 },
    ]);
    expect(result).toEqual({ ordered: [0, 1], cycles: 0 });
  });

  for (const [place, seeds] of cases)
    for (const seed of seeds)
      it(`${place}/${seed} has acyclic full and cutaway structure/cover ordering`, () => {
        const scene = composeScene(place, seed);
        const arena = scene.layout.arena;
        const before = JSON.stringify(arena);
        const env = arena.environment!;
        const occluders = activityOccluders(arena);
        const activity = activityGroundPoints(arena);
        const { project } = battlefieldProjection(arena.extent.width, arena.extent.height);
        for (const reveal of [false, true]) {
          const rects = [
            ...env.structures.flatMap((s) =>
              reveal && occluders.has(s.id)
                ? cutawayWalls(s, env.entrances, activity).map((w) => w.rect)
                : [s.rect],
            ),
            ...(arena.cover ?? []).map((c) => c.rect),
            ...[false, true].flatMap((access) => {
              const live = sceneReviewEncounter(scene, access);
              return live.state.order.map((id) => ({
                ...live.data[id]!.position,
                width: 0,
                height: 0,
              }));
            }),
          ];
          const result = sceneryOrder(
            rects.map((rect) => ({
              rect,
              groundY: project({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }).y,
            })),
          );
          expect(result.cycles).toBe(0);
          expect(new Set(result.ordered).size).toBe(rects.length);
        }
        expect(JSON.stringify(arena)).toBe(before);
      });
});
