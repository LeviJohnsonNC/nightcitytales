import { describe, expect, it } from "vitest";
import { seededRng } from "../dice";
import {
  rollEdgerunnerStats,
  rollStreetratStats,
  validateCompletePackageStats,
} from "../statGeneration";
import { STAT_ORDER, getStatTemplateRow } from "../rulesData";
import type { StatBlock } from "../types";

/** Eight 6s and two 7s = 62. */
const valid62: StatBlock = {
  int: 6,
  ref: 6,
  dex: 6,
  tech: 6,
  cool: 6,
  will: 6,
  luck: 6,
  move: 6,
  body: 7,
  emp: 7,
};

describe("streetrat stats", () => {
  it("takes an entire template row unmodified", () => {
    const result = rollStreetratStats("solo", seededRng(3));
    expect(result.stats).toEqual(getStatTemplateRow("solo", result.row));
    expect(result.roll.rolls).toEqual([result.row]);
  });
});

describe("edgerunner stats", () => {
  it("reads each STAT against its own column", () => {
    const result = rollEdgerunnerStats("solo", seededRng(11));
    for (const stat of STAT_ORDER) {
      expect(result.stats[stat]).toBe(getStatTemplateRow("solo", result.rows[stat])[stat]);
    }
  });

  it("is reproducible for a given seed", () => {
    expect(rollEdgerunnerStats("solo", seededRng(5)).stats).toEqual(
      rollEdgerunnerStats("solo", seededRng(5)).stats,
    );
  });
});

describe("complete package stats", () => {
  it("accepts a 62 point allocation inside the STAT range", () => {
    const result = validateCompletePackageStats(valid62);
    expect(result.pointsSpent).toBe(62);
    expect(result.pointsRemaining).toBe(0);
    expect(result.valid).toBe(true);
  });

  it("rejects a STAT of 9", () => {
    const result = validateCompletePackageStats({ ...valid62, int: 9, body: 4 });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("INT is 9"))).toBe(true);
  });

  it("rejects a STAT of 1", () => {
    const result = validateCompletePackageStats({ ...valid62, int: 1, body: 8, emp: 8, luck: 8 });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("INT is 1"))).toBe(true);
  });
});
