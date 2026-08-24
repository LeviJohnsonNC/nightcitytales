import { describe, expect, it } from "vitest";
import {
  availableSkillRaises,
  describeSkillRaise,
  MAX_SKILL_LEVEL,
  skillRaiseCost,
  skillLineKey,
  skillRaiseTotal,
  spendOnSkill,
} from "../advancement";
import { getSkill, IP_COSTS } from "../rulesData";

// "autofire" is flagged x2 on the printed sheet; "athletics" is not.
const DOUBLE = "autofire";
const NORMAL = "athletics";

describe("skillRaiseCost", () => {
  it("charges the new Level times the per-level cost", () => {
    expect(skillRaiseCost(NORMAL, 1)).toBe(1 * IP_COSTS.skillCostPerLevel);
    expect(skillRaiseCost(NORMAL, 5)).toBe(5 * IP_COSTS.skillCostPerLevel);
  });

  it("doubles a Skill the sheet flags x2", () => {
    expect(getSkill(DOUBLE).doubleCost).toBe(true);
    expect(skillRaiseCost(DOUBLE, 5)).toBe(
      skillRaiseCost(NORMAL, 5) * IP_COSTS.doubleCostMultiplier,
    );
  });

  it("gets more expensive as the Skill climbs", () => {
    expect(skillRaiseCost(NORMAL, 6)).toBeGreaterThan(skillRaiseCost(NORMAL, 5));
  });

  it("refuses a Level that cannot exist", () => {
    expect(() => skillRaiseCost(NORMAL, 0)).toThrow(/outside the printed range/);
    expect(() => skillRaiseCost(NORMAL, MAX_SKILL_LEVEL + 1)).toThrow(/outside the printed range/);
    expect(() => skillRaiseCost(NORMAL, 2.5)).toThrow(/whole number/);
  });
});

describe("skillRaiseTotal", () => {
  it("sums each step rather than charging the destination once", () => {
    // 3 -> 5 is the cost of Level 4 plus Level 5, not the cost of Level 5.
    expect(skillRaiseTotal(NORMAL, 3, 5)).toBe(
      skillRaiseCost(NORMAL, 4) + skillRaiseCost(NORMAL, 5),
    );
  });

  it("is free to stay where you are, or to go backwards", () => {
    expect(skillRaiseTotal(NORMAL, 4, 4)).toBe(0);
    expect(skillRaiseTotal(NORMAL, 4, 2)).toBe(0);
  });
});

describe("describeSkillRaise", () => {
  it("prices the next Level and reports affordability", () => {
    const cost = skillRaiseCost(NORMAL, 4);
    expect(describeSkillRaise(NORMAL, 3, cost)).toMatchObject({
      currentLevel: 3,
      nextLevel: 4,
      cost,
      affordable: true,
      atMax: false,
    });
    expect(describeSkillRaise(NORMAL, 3, cost - 1).affordable).toBe(false);
  });

  it("marks a Skill at the ceiling as unraisable and free", () => {
    const raise = describeSkillRaise(NORMAL, MAX_SKILL_LEVEL, 10_000);
    expect(raise).toMatchObject({ atMax: true, cost: 0, affordable: false });
    expect(raise.nextLevel).toBe(MAX_SKILL_LEVEL);
  });

  it("treats an untrained Skill as Level 0 buying Level 1", () => {
    expect(describeSkillRaise(NORMAL, 0, 1000)).toMatchObject({ currentLevel: 0, nextLevel: 1 });
  });
});

describe("availableSkillRaises", () => {
  const skills = [
    { skillId: NORMAL, level: 6 },
    { skillId: "brawling", level: 2 },
    { skillId: "concentration", level: MAX_SKILL_LEVEL },
  ];

  it("lists the cheapest raise first and sinks maxed Skills to the bottom", () => {
    const raises = availableSkillRaises(skills, 1000);
    expect(raises[0]?.skillId).toBe("brawling"); // Level 3 is cheaper than Level 7
    expect(raises[raises.length - 1]?.skillId).toBe("concentration");
    expect(raises[raises.length - 1]?.atMax).toBe(true);
  });

  it("shows what a real pool actually buys", () => {
    const raises = availableSkillRaises(skills, skillRaiseCost("brawling", 3));
    expect(raises.filter((r) => r.affordable).map((r) => r.skillId)).toEqual(["brawling"]);
  });
});

describe("spendOnSkill", () => {
  const skills = [{ skillId: NORMAL, level: 3 }];

  it("returns the cost and what is left", () => {
    const cost = skillRaiseCost(NORMAL, 4);
    expect(spendOnSkill(skills, cost + 25, NORMAL)).toEqual({
      skillId: NORMAL,
      specialization: null,
      newLevel: 4,
      spent: cost,
      remaining: 25,
    });
  });

  it("buys Level 1 of a Skill the character has never trained", () => {
    expect(spendOnSkill(skills, 1000, "brawling")).toMatchObject({ newLevel: 1 });
  });

  it("refuses a raise the character cannot afford rather than shrinking it", () => {
    const cost = skillRaiseCost(NORMAL, 4);
    expect(() => spendOnSkill(skills, cost - 1, NORMAL)).toThrow(/only .* available/);
  });

  it("refuses to raise past the in-play ceiling", () => {
    const maxed = [{ skillId: NORMAL, level: MAX_SKILL_LEVEL }];
    expect(() => spendOnSkill(maxed, 10_000, NORMAL)).toThrow(/already at Level/);
  });

  it("refuses an unknown Skill id", () => {
    expect(() => spendOnSkill(skills, 1000, "not_a_skill")).toThrow();
  });
});

describe("repeatable skills with specializations", () => {
  // A character can hold several Language lines at different Levels. Keying by
  // skillId alone would treat them as one Skill and corrupt the wrong row.
  const skills = [
    { skillId: "language", level: 2, specialization: "Streetslang" },
    { skillId: "language", level: 5, specialization: "Mandarin" },
  ];

  it("keeps each specialization a separate line", () => {
    const raises = availableSkillRaises(skills, 1000);
    const languages = raises.filter((r) => r.skillId === "language");
    expect(languages).toHaveLength(2);
    expect(languages.map((r) => r.key)).toEqual([
      skillLineKey("language", "Streetslang"),
      skillLineKey("language", "Mandarin"),
    ]);
  });

  it("names the specialization so the two are told apart", () => {
    const raise = describeSkillRaise("language", 2, 1000, "Streetslang");
    expect(raise.skillName).toBe("Language (Streetslang)");
  });

  it("prices the raise off the matching line, not the first one found", () => {
    // Mandarin is at 5, so its next Level is 6 — not 3, which is Streetslang's.
    expect(spendOnSkill(skills, 1000, "language", "Mandarin")).toMatchObject({
      newLevel: 6,
      spent: skillRaiseCost("language", 6),
      specialization: "Mandarin",
    });
    expect(spendOnSkill(skills, 1000, "language", "Streetslang")).toMatchObject({ newLevel: 3 });
  });

  it("treats an unheld specialization as a new line at Level 1", () => {
    expect(spendOnSkill(skills, 1000, "language", "Japanese")).toMatchObject({
      newLevel: 1,
      specialization: "Japanese",
    });
  });
});
