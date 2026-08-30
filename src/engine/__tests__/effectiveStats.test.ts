import { describe, expect, it } from "vitest";
import { currentStats, wornArmorPenalty } from "../effectiveStats";

describe("current stats", () => {
  it("takes the worst worn armor penalty once", () => {
    expect(wornArmorPenalty(["medium_armorjack", "flak"])).toBe(-4);
    expect(
      currentStats({
        base: { ref: 8, dex: 6, move: 5, emp: 7 },
        wornArmorIds: ["medium_armorjack", "flak"],
      }),
    ).toMatchObject({ ref: 4, dex: 2, move: 1 });
  });

  it("derives EMP from live Humanity", () => {
    expect(currentStats({ base: { emp: 7 }, humanityCurrent: 29 }).emp).toBe(2);
    expect(currentStats({ base: { emp: 7 }, humanityCurrent: -2 }).emp).toBe(0);
  });
});
