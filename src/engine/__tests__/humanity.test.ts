import { describe, expect, it } from "vitest";
import {
  applyCyberwareHumanityLoss,
  CYBERPSYCHOSIS_COMPARISON,
  CYBERPSYCHOSIS_THRESHOLD,
} from "../humanity";

describe("cyberware humanity loss", () => {
  it("subtracts every loss roll and re-derives EMP", () => {
    const result = applyCyberwareHumanityLoss(50, [4, 3, 4]);
    expect(result.humanityLost).toBe(11);
    expect(result.humanityCurrent).toBe(39);
    expect(result.emp).toBe(3);
  });

  it("keeps overshoot below zero so the cyberpsychosis comparison can fire", () => {
    const result = applyCyberwareHumanityLoss(5, [10]);
    expect(result.humanityCurrent).toBe(-5);
  });

  it("floors the sheet value and EMP at zero", () => {
    const result = applyCyberwareHumanityLoss(5, [10]);
    expect(result.humanitySheet).toBe(0);
    expect(result.emp).toBe(0);
  });
});

describe("cyberpsychosis threshold", () => {
  it("is fully defined by the rules data", () => {
    expect(CYBERPSYCHOSIS_THRESHOLD).toBe(0);
    expect(CYBERPSYCHOSIS_COMPARISON).toBe("below");
    expect(applyCyberwareHumanityLoss(50, [2]).missingRule).toBeNull();
  });

  it("does not flag cyberpsychosis at exactly zero Humanity", () => {
    // CPR RED p.230: cyberpsychosis triggers BELOW zero. Exactly 0 is not yet
    // cyberpsychosis, which is why humanityCurrent must not be clamped to 0.
    const result = applyCyberwareHumanityLoss(10, [10]);
    expect(result.humanityCurrent).toBe(0);
    expect(result.cyberpsychosisRisk).toBe(false);
  });

  it("flags cyberpsychosis once Humanity drops below zero", () => {
    const result = applyCyberwareHumanityLoss(10, [11]);
    expect(result.humanityCurrent).toBe(-1);
    expect(result.cyberpsychosisRisk).toBe(true);
  });

  it("reports a boolean, never null, while the rules data is complete", () => {
    for (const humanity of [50, 10, 1, 0]) {
      const result = applyCyberwareHumanityLoss(humanity, [5]);
      expect(typeof result.cyberpsychosisRisk).toBe("boolean");
      expect(result.missingRule).toBeNull();
    }
  });
});
