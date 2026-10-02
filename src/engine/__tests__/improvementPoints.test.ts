import { describe, expect, it } from "vitest";
import {
  IP_PLAYSTYLES,
  IP_TIER_VALUES,
  awardImprovementPoints,
  daysUntilLifeAward,
  getIpTier,
  LIFE_AWARD_EVERY_DAYS,
  lifeAwardDue,
  ipDescriptor,
  isIpTierValue,
  snapToIpTier,
} from "../improvementPoints";

describe("I.P. award table", () => {
  it("has the eight printed tiers", () => {
    expect(IP_TIER_VALUES).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it("has the four playstyle columns", () => {
    expect(IP_PLAYSTYLES.map((p) => p.id)).toEqual([
      "warrior",
      "socializer",
      "explorer",
      "roleplayer",
    ]);
  });

  it("reads a descriptor from the table", () => {
    expect(ipDescriptor(10, "group")).toMatch(/did not succeed/i);
    expect(getIpTier(80).warrior).toMatch(/incredible/i);
    expect(isIpTierValue(35)).toBe(false);
  });

  it("snaps an off-table value down to a printed tier", () => {
    expect(snapToIpTier(35)).toBe(30);
    expect(snapToIpTier(5)).toBe(10);
    expect(snapToIpTier(999)).toBe(80);
  });
});

describe("awardImprovementPoints", () => {
  const base = {
    primary: "warrior" as const,
    secondary: "roleplayer" as const,
    groupIp: 50,
    primaryIp: 20,
    secondaryIp: 30,
  };

  it("uses the Group column when the mission finished", () => {
    const award = awardImprovementPoints({ ...base, missionFinished: true });
    expect(award).toMatchObject({ ip: 50, source: "group", fromStandout: false });
  });

  it("uses the better playstyle column when the mission did not finish", () => {
    const award = awardImprovementPoints({ ...base, missionFinished: false });
    expect(award).toMatchObject({ ip: 30, source: "roleplayer" });
  });

  it("takes a standout when it pays more", () => {
    const award = awardImprovementPoints({
      ...base,
      missionFinished: true,
      standout: { playstyle: "explorer", ip: 70 },
    });
    expect(award).toMatchObject({ ip: 70, source: "explorer", fromStandout: true });
    expect(award.descriptor).toBe(ipDescriptor(70, "explorer"));
  });

  it("ignores a standout worth less than the base award", () => {
    const award = awardImprovementPoints({
      ...base,
      missionFinished: true,
      standout: { playstyle: "explorer", ip: 20 },
    });
    expect(award).toMatchObject({ ip: 50, source: "group", fromStandout: false });
  });
});

describe("when a stretch of life is worth judging", () => {
  it("reads the period from the house rule", () => {
    expect(LIFE_AWARD_EVERY_DAYS).toBe(7);
  });

  it("counts a fresh campaign from day one", () => {
    expect(daysUntilLifeAward({ day: 1, lastAwardDay: null })).toBe(7);
    expect(lifeAwardDue({ day: 7, lastAwardDay: null })).toBe(false);
    expect(lifeAwardDue({ day: 8, lastAwardDay: null })).toBe(true);
  });

  it("counts from the last award, job or life", () => {
    expect(daysUntilLifeAward({ day: 20, lastAwardDay: 16 })).toBe(3);
    expect(lifeAwardDue({ day: 23, lastAwardDay: 16 })).toBe(true);
  });

  it("does not stack: a month without an award is one award, not four", () => {
    expect(daysUntilLifeAward({ day: 40, lastAwardDay: 10 })).toBe(0);
  });
});
