import { describe, expect, it } from "vitest";
import { normalizeGmResponse } from "@/features/gm/gmResponse";
import { normalizeLifeResponse } from "@/features/life/lifeResponse";
import { isLowStakes } from "../narratorRules";

describe("reading a check marked low-stakes", () => {
  it("accepts the words a model drifts between, and nothing else", () => {
    for (const word of ["low", "LOW", "trivial", "minor"]) expect(isLowStakes(word)).toBe(true);
    for (const word of ["high", "", "none", 1, null, undefined]) {
      expect(isLowStakes(word)).toBe(false);
    }
  });

  it("carries the mark through the Life normalizer", () => {
    const life = normalizeLifeResponse({
      situation: { title: "t", description: "d" },
      proposedActions: [
        { kind: "skill_check", skillId: "perception", dv: 13, intent: "x", stakes: "low" },
        { kind: "skill_check", skillId: "streetwise", dv: 13, intent: "y" },
      ],
    });
    expect(life.proposedActions[0]).toMatchObject({ stakes: "low" });
    expect(life.proposedActions[1]).not.toHaveProperty("stakes");
  });

  it("carries the mark through the Job normalizer", () => {
    const gm = normalizeGmResponse({
      narration: "n",
      proposedActions: [
        { kind: "skill_check", skillId: "perception", dv: 9, intent: "x", stakes: "trivial" },
      ],
    });
    expect(gm.proposedActions[0]).toMatchObject({ stakes: "low" });
  });
});
