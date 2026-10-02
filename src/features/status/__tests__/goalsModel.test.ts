import { describe, expect, it } from "vitest";
import { goalProgress, type GoalState } from "@/engine";
import { goalChipFigure, goalFill, goalGapLabel, pinnedProgress } from "../goalsModel";

const state: GoalState = {
  ip: 50,
  eurobucks: 200,
  skills: [{ skillId: "handgun", level: 4, specialization: null }],
  roleId: "solo",
  rank: 4,
  installed: [],
  standings: [{ factionId: "ncpd", standing: -2 }],
};

describe("how a goal reads on the rail", () => {
  it("names the distance in the goal's own currency", () => {
    const skill = goalProgress(
      { kind: "skill", skillId: "handgun", specialization: null, level: 5 },
      state,
    );
    expect(goalGapLabel(skill)).toBe(`${skill.gap} IP to go`);
    expect(goalChipFigure(skill)).toBe(`${skill.have}/${skill.need} IP`);
    expect(goalFill(skill)).toBeCloseTo(50 / skill.need);

    const standing = goalProgress({ kind: "standing", factionId: "ncpd", atLeast: 0 }, state);
    expect(goalGapLabel(standing)).toBe("2 standing to go");
    expect(goalFill(standing)).toBeNull(); // not bought, so no meter
  });

  it("drops a pin the data no longer knows rather than breaking the rail", () => {
    const shown = pinnedProgress(
      [
        { kind: "rank", rank: 5 },
        { kind: "chrome", itemId: "no_such_implant", owned: 0 },
      ],
      state,
    );
    expect(shown.map((p) => p.label)).toEqual(["Combat Awareness Rank 5"]);
  });
});
