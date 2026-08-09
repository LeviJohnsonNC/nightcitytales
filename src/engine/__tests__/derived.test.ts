import { describe, expect, it } from "vitest";
import { deriveStats, empFromHumanity, hitPointsMax } from "../derived";
import type { StatBlock } from "../types";

const stats: StatBlock = {
  int: 6,
  ref: 7,
  dex: 6,
  tech: 4,
  cool: 5,
  will: 6,
  luck: 5,
  move: 6,
  body: 7,
  emp: 6,
};

describe("derived stats", () => {
  it("computes HP from BODY and WILL", () => {
    expect(hitPointsMax(7, 6)).toBe(45);
    expect(hitPointsMax(2, 2)).toBe(20);
  });

  it("derives the whole block", () => {
    expect(deriveStats(stats)).toEqual({
      hpMax: 45,
      seriouslyWoundedThreshold: 23,
      deathSave: 7,
      humanityMax: 60,
    });
  });

  it("floors EMP from remaining Humanity", () => {
    expect(empFromHumanity(59)).toBe(5);
    expect(empFromHumanity(60)).toBe(6);
  });
});