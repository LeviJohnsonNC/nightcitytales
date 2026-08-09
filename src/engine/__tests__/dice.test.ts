import { describe, expect, it } from "vitest";
import { rollDice, rollDie, seededRng, statSkillCheck } from "../dice";

/** Returns fixed 0-1 values so die faces are exact. */
const scripted = (faces: number[], sides = 10) => {
  let i = 0;
  return () => (faces[i++]! - 1) / sides;
};

describe("dice", () => {
  it("rolls within bounds", () => {
    const rng = seededRng(42);
    for (let i = 0; i < 500; i++) {
      const value = rollDie(10, rng);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    }
  });

  it("rejects invalid dice", () => {
    expect(() => rollDie(0)).toThrow();
    expect(() => rollDice(-1, 6)).toThrow();
  });

  it("is deterministic for a given seed", () => {
    expect(rollDice(5, 6, seededRng(7))).toEqual(rollDice(5, 6, seededRng(7)));
  });

  it("explodes on a natural 10", () => {
    const result = statSkillCheck(4, scripted([10, 3]));
    expect(result.critical).toBe("success");
    expect(result.total).toBe(10 + 3 + 4);
  });

  it("implodes on a natural 1", () => {
    const result = statSkillCheck(4, scripted([1, 6]));
    expect(result.critical).toBe("failure");
    expect(result.total).toBe(1 - 6 + 4);
  });

  it("does not crit on ordinary rolls", () => {
    const result = statSkillCheck(2, scripted([5]));
    expect(result.critical).toBeNull();
    expect(result.total).toBe(7);
  });

  it("never chains a Critical Success", () => {
    const result = statSkillCheck(0, scripted([10, 10, 10]));
    expect(result.critical).toBe("success");
    expect(result.rolls).toEqual([10, 10]);
    expect(result.total).toBe(20);
  });

  it("never chains a Critical Failure", () => {
    const result = statSkillCheck(0, scripted([1, 1, 1]));
    expect(result.critical).toBe("failure");
    expect(result.rolls).toEqual([1, 1]);
    expect(result.total).toBe(0);
  });

  it("logs a traceable formula against a DV", () => {
    const modifiers = [
      { label: "REF", value: 6 },
      { label: "Athletics", value: 4 },
    ];
    const hit = statSkillCheck(modifiers, scripted([9]), { dv: 15 });
    expect(hit.total).toBe(19);
    expect(hit.success).toBe(true);
    expect(hit.formula).toBe("1d10(9) + REF(6) + Athletics(4) = 19 vs DV15 → SUCCESS by 4");

    const miss = statSkillCheck(modifiers, scripted([9]), { dv: 21 });
    expect(miss.success).toBe(false);
    expect(miss.formula).toBe("1d10(9) + REF(6) + Athletics(4) = 19 vs DV21 → FAILED by 2");
  });

  it("reproduces identical checks for a given seed", () => {
    const a = statSkillCheck(3, seededRng(99), { dv: 15, now: () => new Date(0) });
    const b = statSkillCheck(3, seededRng(99), { dv: 15, now: () => new Date(0) });
    expect(a).toEqual(b);
  });
});