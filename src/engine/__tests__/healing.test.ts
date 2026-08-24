import { describe, expect, it } from "vitest";
import {
  applyStabilization,
  HEALING_SKILL_IDS,
  isHealingSkill,
  REST_RATE_STAT,
  rest,
  restHealing,
  stabilizationDvFor,
} from "../healing";
import { WOUND_STATES } from "../rulesData";

/** A character with 40 max HP; Seriously Wounded below 20. */
const sheet = { hpMax: 40, seriouslyWoundedThreshold: 20 };

describe("stabilizationDvFor", () => {
  it("reads the DV off the printed wound-state ladder", () => {
    const printed = (name: string) => WOUND_STATES.find((w) => w.state === name)?.stabilizationDV;
    expect(stabilizationDvFor("light")).toBe(printed("Lightly Wounded"));
    expect(stabilizationDvFor("serious")).toBe(printed("Seriously Wounded"));
    expect(stabilizationDvFor("mortal")).toBe(printed("Mortally Wounded"));
  });

  it("gets harder as the wound gets worse", () => {
    expect(stabilizationDvFor("serious")!).toBeGreaterThan(stabilizationDvFor("light")!);
    expect(stabilizationDvFor("mortal")!).toBeGreaterThan(stabilizationDvFor("serious")!);
  });

  it("has nothing to stabilize on an unwounded character", () => {
    expect(stabilizationDvFor("none")).toBeNull();
  });
});

describe("healing skills come from the rules data", () => {
  it("recognises First Aid and Paramedic, and nothing else", () => {
    expect(HEALING_SKILL_IDS).toContain("first_aid");
    expect(HEALING_SKILL_IDS).toContain("paramedic");
    expect(isHealingSkill("first_aid")).toBe(true);
    expect(isHealingSkill("paramedic")).toBe(true);
    expect(isHealingSkill("handgun")).toBe(false);
  });

  it("rests off BODY", () => {
    expect(REST_RATE_STAT).toBe("body");
  });
});

describe("applyStabilization", () => {
  it("brings a Mortally Wounded patient back to 1 HP, unconscious", () => {
    const out = applyStabilization({ ...sheet, hp: -6, success: true });
    expect(out).toMatchObject({
      stabilized: true,
      hp: 1,
      unconscious: true,
      woundState: "serious",
    });
    expect(out.restored).toBe(7); // -6 -> 1
  });

  it("restores no Hit Points at lighter wounds — only stops the bleeding", () => {
    for (const hp of [30, 12]) {
      const out = applyStabilization({ ...sheet, hp, success: true });
      expect(out.stabilized).toBe(true);
      expect(out.hp).toBe(hp);
      expect(out.restored).toBe(0);
      expect(out.unconscious).toBe(false);
    }
  });

  it("changes nothing on a failure, and never makes the patient worse", () => {
    const out = applyStabilization({ ...sheet, hp: -6, success: false });
    expect(out).toMatchObject({ stabilized: false, hp: -6, restored: 0, unconscious: false });
  });

  it("does nothing for someone who is not hurt", () => {
    const out = applyStabilization({ ...sheet, hp: 40, success: true });
    expect(out).toMatchObject({ stabilized: false, hp: 40, restored: 0 });
  });
});

describe("restHealing", () => {
  it("returns BODY per full day", () => {
    expect(restHealing(7, 1)).toBe(7);
    expect(restHealing(7, 3)).toBe(21);
  });

  it("pays nothing for a part-day", () => {
    expect(restHealing(7, 0)).toBe(0);
    expect(restHealing(7, 0.9)).toBe(0);
    expect(restHealing(7, 2.9)).toBe(14); // two full days
  });

  it("treats negative days as no rest", () => {
    expect(restHealing(7, -5)).toBe(0);
  });

  it("refuses a nonsensical BODY rather than inventing a rate", () => {
    expect(() => restHealing(-1, 1)).toThrow(/cannot set a healing rate/);
    expect(() => restHealing(Number.NaN, 1)).toThrow(/cannot set a healing rate/);
  });
});

describe("rest", () => {
  it("heals BODY per day and updates the wound state", () => {
    const out = rest({ ...sheet, hp: 10, bodyStat: 7, days: 1 });
    expect(out.hp).toBe(17);
    expect(out.restored).toBe(7);
    expect(out.woundState).toBe("serious"); // still below 20
  });

  it("climbs out of Seriously Wounded with enough days", () => {
    const out = rest({ ...sheet, hp: 10, bodyStat: 7, days: 2 });
    expect(out.hp).toBe(24);
    expect(out.woundState).toBe("light");
  });

  it("never heals above maximum, and reports what the cap allowed", () => {
    const out = rest({ ...sheet, hp: 38, bodyStat: 7, days: 5 });
    expect(out.hp).toBe(40);
    expect(out.restored).toBe(2); // not 35
    expect(out.woundState).toBe("none");
  });

  it("does not heal a Mortally Wounded character — they need stabilizing first", () => {
    const out = rest({ ...sheet, hp: -3, bodyStat: 7, days: 10 });
    expect(out.hp).toBe(-3);
    expect(out.restored).toBe(0);
    expect(out.woundState).toBe("mortal");
  });

  it("is a no-op for zero days", () => {
    const out = rest({ ...sheet, hp: 10, bodyStat: 7, days: 0 });
    expect(out).toMatchObject({ hp: 10, restored: 0, days: 0 });
  });

  it("stabilize-then-rest is the route back from the brink", () => {
    const stabilized = applyStabilization({ ...sheet, hp: -6, success: true });
    expect(stabilized.hp).toBe(1);
    const rested = rest({ ...sheet, hp: stabilized.hp, bodyStat: 7, days: 3 });
    expect(rested.hp).toBe(22);
    expect(rested.woundState).toBe("light");
  });
});
