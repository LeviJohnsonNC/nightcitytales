import { describe, expect, it } from "vitest";
import { seededRng } from "../dice";
import {
  adjustCompletePackageStat,
  normalizeCompletePackageStats,
  startingCompletePackageStats,
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

describe("Complete Package point-buy", () => {
  it("starts every STAT at the floor with the rest of the budget in the pool", () => {
    const start = startingCompletePackageStats();
    expect(STAT_ORDER.every((stat) => start[stat] === 2)).toBe(true);
    expect(validateCompletePackageStats(start).pointsRemaining).toBe(42);
  });

  it("moves one STAT a point at a time", () => {
    const start = startingCompletePackageStats();
    const up = adjustCompletePackageStat(start, "ref", 1);
    expect(up.ref).toBe(3);
    expect(adjustCompletePackageStat(up, "ref", -1).ref).toBe(2);
  });

  it("refuses to go under the minimum or over the maximum, and says so by returning the same object", () => {
    const start = startingCompletePackageStats();
    expect(adjustCompletePackageStat(start, "ref", -1)).toBe(start);
    let stats: Partial<StatBlock> = start;
    for (let i = 0; i < 10; i += 1) stats = adjustCompletePackageStat(stats, "ref", 1);
    expect(stats.ref).toBe(8);
    expect(adjustCompletePackageStat(stats, "ref", 1)).toBe(stats);
  });

  it("never lets the spend pass the budget, however many times it is asked", () => {
    let stats: Partial<StatBlock> = startingCompletePackageStats();
    for (let round = 0; round < 10; round += 1) {
      for (const stat of STAT_ORDER) stats = adjustCompletePackageStat(stats, stat, 1);
    }
    const result = validateCompletePackageStats(stats);
    expect(result.pointsRemaining).toBe(0);
    expect(result.valid).toBe(true);
    // Spent to the last point: another "+" anywhere is refused, a "-" is not.
    expect(adjustCompletePackageStat(stats, "luck", 1)).toBe(stats);
    const freed = adjustCompletePackageStat(stats, "luck", -1);
    expect(validateCompletePackageStats(freed).pointsRemaining).toBe(1);
  });

  it("treats a STAT that is not set as the floor", () => {
    const partial = adjustCompletePackageStat({}, "int", 1);
    expect(partial.int).toBe(3);
  });
});

describe("making an old draft safe for the point-buy controls", () => {
  it("fills what is missing, clamps what is out of range, and rounds", () => {
    const fixed = normalizeCompletePackageStats({ int: 10, ref: 0, dex: 5.6, tech: 4 });
    expect(fixed.int).toBe(8);
    expect(fixed.ref).toBe(2);
    expect(fixed.dex).toBe(6);
    expect(fixed.tech).toBe(4);
    expect(fixed.luck).toBe(2);
  });

  it("trims an overspend from the highest STAT first", () => {
    const fixed = normalizeCompletePackageStats({
      int: 8,
      ref: 8,
      dex: 8,
      tech: 8,
      cool: 8,
      will: 8,
      luck: 8,
      move: 8,
      body: 8,
      emp: 2,
    });
    expect(validateCompletePackageStats(fixed).pointsRemaining).toBe(0);
    // Trimmed evenly off the top, not zeroed out of one STAT.
    expect(Math.max(...STAT_ORDER.map((s) => fixed[s]))).toBeLessThanOrEqual(8);
    expect(
      Math.min(...STAT_ORDER.filter((s) => s !== "emp").map((s) => fixed[s])),
    ).toBeGreaterThanOrEqual(6);
  });

  it("leaves a legal allocation exactly as it was", () => {
    expect(normalizeCompletePackageStats(valid62)).toEqual(valid62);
  });
});
