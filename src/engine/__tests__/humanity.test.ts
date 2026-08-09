import { describe, expect, it } from "vitest";
import { applyCyberwareHumanityLoss, CYBERPSYCHOSIS_THRESHOLD } from "../humanity";

describe("cyberware humanity loss", () => {
  it("subtracts every loss roll and re-derives EMP", () => {
    const result = applyCyberwareHumanityLoss(50, [4, 3, 4]);
    expect(result.humanityLost).toBe(11);
    expect(result.humanityCurrent).toBe(39);
    expect(result.emp).toBe(3);
  });

  it("never drops Humanity below zero", () => {
    expect(applyCyberwareHumanityLoss(5, [10]).humanityCurrent).toBe(0);
  });

  it("reports the cyberpsychosis threshold as unavailable until the rules data defines it", () => {
    const result = applyCyberwareHumanityLoss(50, [2]);
    if (CYBERPSYCHOSIS_THRESHOLD === null) {
      expect(result.cyberpsychosisRisk).toBeNull();
      expect(result.missingRule).toContain("cyberpsychosisThreshold");
    } else {
      expect(typeof result.cyberpsychosisRisk).toBe("boolean");
      expect(result.missingRule).toBeNull();
    }
  });
});