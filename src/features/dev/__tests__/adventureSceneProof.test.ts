import { expect, it } from "vitest";
import { SCENE_LOCATION_TYPES, readSceneManifest } from "@/engine";
import { adventureSceneProof } from "../adventureSceneProof";
it("binds contextual requests across every environment without proof hostiles", () => {
  for (const kind of SCENE_LOCATION_TYPES)
    for (const seed of [1, 2, 3]) {
      const scene = adventureSceneProof(kind, seed);
      expect(scene.context!.objects).toHaveLength(1);
      expect(scene.actors.filter((a) => a.side === "hostile").map((a) => a.name)).toEqual(["Mara"]);
      expect(readSceneManifest({ version: 1, scene })).toEqual(scene);
    }
});
