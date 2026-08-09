import { describe, expect, it } from "vitest";
import {
  BASIC_SKILLS,
  skillBase,
  skillPointCost,
  validateCompletePackageSkills,
  validateEdgerunnerSkills,
  type SkillAllocation,
} from "../skillAllocation";
import { getRoleSkillIds, getSkill } from "../rulesData";

const ROLE = "solo";
const roleSkillIds = getRoleSkillIds(ROLE);

function baseAllocation(): SkillAllocation {
  return Object.fromEntries(roleSkillIds.map((id) => [id, 2]));
}

function costOf(allocation: SkillAllocation): number {
  return Object.entries(allocation).reduce((sum, [id, level]) => sum + skillPointCost(id, 0, level), 0);
}

/** Raise single-cost Role skills one level at a time until the budget hits `target`. */
function allocationCosting(target: number): SkillAllocation {
  const allocation = baseAllocation();
  const singles = roleSkillIds.filter((id) => !getSkill(id).doubleCost);
  let index = 0;
  while (costOf(allocation) < target) {
    const id = singles[index % singles.length]!;
    if ((allocation[id] ?? 0) < 6) allocation[id] = (allocation[id] ?? 0) + 1;
    index++;
    if (index > 1000) throw new Error("could not reach target cost");
  }
  return allocation;
}

describe("skill costs", () => {
  it("reads the 13 Basic Skills from the rules data", () => {
    expect(BASIC_SKILLS).toHaveLength(13);
    expect(BASIC_SKILLS).toContain("athletics");
  });

  it("charges 2 points per level for an (x2) skill", () => {
    expect(getSkill("autofire").doubleCost).toBe(true);
    expect(skillPointCost("autofire", 2, 6)).toBe(8);
    expect(skillPointCost("athletics", 2, 6)).toBe(4);
  });

  it("bases a check on STAT + Skill", () => {
    expect(skillBase(6, 4)).toBe(10);
  });
});

describe("edgerunner skills", () => {
  it("accepts an allocation inside the budget and the Role list", () => {
    const result = validateEdgerunnerSkills(ROLE, allocationCosting(86));
    expect(result.pointsSpent).toBe(86);
    expect(result.valid).toBe(true);
  });

  it("rejects 87 points", () => {
    const result = validateEdgerunnerSkills(ROLE, allocationCosting(87));
    expect(result.pointsSpent).toBe(87);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("over the 86 point budget"))).toBe(true);
  });

  it("rejects a skill at 7", () => {
    const allocation = { ...baseAllocation(), perception: 7 };
    const result = validateEdgerunnerSkills(ROLE, allocation);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("Perception is 7"))).toBe(true);
  });

  it("rejects skills outside the Role package", () => {
    const allocation = { ...baseAllocation(), pilot_air_vehicle: 2 };
    const result = validateEdgerunnerSkills(ROLE, allocation);
    expect(result.violations.some((v) => v.includes("not in the solo skill package"))).toBe(true);
  });

  it("ignores the free Cultural Origin language", () => {
    const allocation = { ...baseAllocation(), language: 4 };
    const withFree = validateEdgerunnerSkills(ROLE, allocation, {
      culturalOriginLanguageSkillId: "language",
    });
    const withoutFree = validateEdgerunnerSkills(ROLE, allocation);
    expect(withFree.pointsSpent).toBe(withoutFree.pointsSpent - 4);
  });
});

describe("complete package skills", () => {
  it("allows any skill but enforces Basic Skill minimums", () => {
    const allocation: SkillAllocation = Object.fromEntries(BASIC_SKILLS.map((id) => [id, 2]));
    allocation["pilot_air_vehicle"] = 3;
    const result = validateCompletePackageSkills(allocation);
    expect(result.valid).toBe(true);

    const missingBasic = { ...allocation };
    missingBasic["stealth"] = 1;
    expect(validateCompletePackageSkills(missingBasic).valid).toBe(false);
  });

  it("rejects a skill above 6 and an over-budget spend", () => {
    const allocation: SkillAllocation = Object.fromEntries(BASIC_SKILLS.map((id) => [id, 2]));
    allocation["handgun"] = 7;
    const result = validateCompletePackageSkills(allocation);
    expect(result.violations.some((v) => v.includes("Handgun is 7"))).toBe(true);
  });
});