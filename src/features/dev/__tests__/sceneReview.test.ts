import { expect, it } from "vitest";
import { composeScene, coverMaxHp, readBattlefieldPositions } from "@/engine";
import { readSceneReview, sceneReviewEncounter } from "../sceneReviewModel";

it.each(["intersection", "alley"] as const)(
  "preserves %s geometry, rotated damage and entrance positions through saved review",
  (kind) => {
    for (const seed of [1, 2, 3]) {
      const scene = composeScene(kind, seed);
      for (const entrancePose of [false, true]) {
        const live = sceneReviewEncounter(scene, entrancePose);
        const positions = live.state.order.map((id) => live.data[id]!.position);
        expect(readBattlefieldPositions(scene.layout, positions, {})).toEqual(positions);
        const piece = scene.layout.arena.cover![0]!;
        const cover = { [piece.id]: coverMaxHp(piece) };
        const read = readSceneReview(JSON.parse(JSON.stringify({ scene, cover, positions })));
        expect(read.scene).toEqual(scene);
        expect(read.live.cover).toEqual(cover);
        expect(read.live.state.order.map((id) => read.live.data[id]!.position)).toEqual(positions);
      }
    }
  },
);
it("rejects corrupted review positions without replacing the saved scene", () => {
  const scene = composeScene("intersection");
  expect(() => readSceneReview({ scene, positions: [] })).toThrow("Invalid review positions");
});
