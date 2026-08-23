import { describe, expect, it } from "vitest";
import {
  actorFromSheet,
  resolveSkillCheck,
  skillCheckForCharacter,
  type SkillCheckActor,
} from "../skillCheck";

/** Returns fixed 0-1 values so die faces are exact (mirrors dice.test.ts). */
const scripted = (faces: number[]) => {
  let i = 0;
  return () => (faces[i++]! - 1) / 10;
};

describe("resolveSkillCheck", () => {
  it("adds d10 + STAT + Skill and compares to the DV (success)", () => {
    const r = resolveSkillCheck(
      { statLabel: "REF", statValue: 6, skillLabel: "Handgun", skillValue: 4, dv: 15 },
      scripted([9]),
    );
    expect(r.total).toBe(19);
    expect(r.success).toBe(true);
    expect(r.margin).toBe(4);
    expect(r.critical).toBeNull();
    expect(r.formula).toBe("1d10(9) + REF(6) + Handgun(4) = 19 vs DV15 → SUCCESS by 4");
  });

  it("reports failure and a negative margin", () => {
    const r = resolveSkillCheck(
      { statLabel: "REF", statValue: 6, skillLabel: "Handgun", skillValue: 4, dv: 17 },
      scripted([3]),
    );
    expect(r.total).toBe(13);
    expect(r.success).toBe(false);
    expect(r.margin).toBe(-4);
  });

  it("applies situational modifiers (cover)", () => {
    const r = resolveSkillCheck(
      {
        statLabel: "REF",
        statValue: 6,
        skillLabel: "Stealth",
        skillValue: 2,
        dv: 15,
        modifiers: [{ label: "Cover", value: -2 }],
      },
      scripted([7]),
    );
    // 7 + 6 + 2 - 2 = 13, DV15 -> fail by 2
    expect(r.total).toBe(13);
    expect(r.margin).toBe(-2);
    expect(r.formula).toContain("- Cover(2)");
  });

  it("explodes on a natural 10 (single step) as a critical success", () => {
    const r = resolveSkillCheck(
      { statLabel: "REF", statValue: 6, skillLabel: "Handgun", skillValue: 4, dv: 21 },
      scripted([10, 5]),
    );
    // 10 (+5 crit) + 6 + 4 = 25
    expect(r.total).toBe(25);
    expect(r.critical).toBe("success");
    expect(r.margin).toBe(4);
  });

  it("implodes on a natural 1 as a critical failure", () => {
    const r = resolveSkillCheck(
      { statLabel: "REF", statValue: 6, skillLabel: "Handgun", skillValue: 4, dv: 13 },
      scripted([1, 6]),
    );
    // 1 (-6 crit) + 6 + 4 = 5
    expect(r.total).toBe(5);
    expect(r.critical).toBe("failure");
    expect(r.success).toBe(false);
  });
});

describe("skillCheckForCharacter", () => {
  const actor: SkillCheckActor = {
    stats: { ref: 6, dex: 5, body: 6, will: 6 },
    skills: [{ skillId: "handgun", level: 4 }],
  };

  it("looks up the governing STAT and skill level from the actor", () => {
    const r = skillCheckForCharacter(actor, "handgun", 15, scripted([9]));
    expect(r.total).toBe(19);
    expect(r.formula).toBe("1d10(9) + REF(6) + Handgun(4) = 19 vs DV15 → SUCCESS by 4");
  });

  it("rolls an untrained skill at Level 0", () => {
    const bare: SkillCheckActor = { stats: { ref: 6 }, skills: [] };
    const r = skillCheckForCharacter(bare, "handgun", 13, scripted([8]));
    // 8 + 6 + 0 = 14 vs DV13 -> success by 1
    expect(r.total).toBe(14);
    expect(r.margin).toBe(1);
    expect(r.formula).toContain("Handgun(0)");
  });

  it("throws when the character has no value for the governing STAT", () => {
    const noRef: SkillCheckActor = { stats: { body: 6 }, skills: [] };
    expect(() => skillCheckForCharacter(noRef, "handgun", 13, scripted([5]))).toThrow(/REF/);
  });

  it("actorFromSheet reduces a sheet to stats + skill levels", () => {
    const actorFrom = actorFromSheet({
      stats: { ref: 7 },
      skills: [{ skillId: "handgun", name: "Handgun", stat: "ref", statValue: 7, level: 3 }],
    } as unknown as Parameters<typeof actorFromSheet>[0]);
    expect(actorFrom.stats).toEqual({ ref: 7 });
    expect(actorFrom.skills).toEqual([{ skillId: "handgun", level: 3 }]);
  });
});
