import { expect, it } from "vitest";
import { recentLifeLines } from "../lifeModel";

it("gives the Life narrator the factual combat ending after the preceding scene", () => {
  const lines = recentLifeLines([
    { type: "life_narration", summary: "A rifleman watches the crosswalk." },
    {
      type: "encounter_ended",
      summary: "The rifleman is dead. The lookout has withdrawn. The cruiser door is destroyed.",
    },
  ] as never);
  expect(lines).toEqual([
    "A rifleman watches the crosswalk.",
    "The rifleman is dead. The lookout has withdrawn. The cruiser door is destroyed.",
  ]);
});
