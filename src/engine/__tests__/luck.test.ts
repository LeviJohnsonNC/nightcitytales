/**
 * Luck: the pool, what a spend is worth, and what it cannot do. The rules that
 * matter here are that a spend is worth exactly +1 a point, that the pool can
 * never be overdrawn, and that a pool nobody has recorded yet reads as full
 * rather than as empty.
 */
import { describe, expect, it } from "vitest";
import {
  LUCK_MODIFIER_LABEL,
  LUCK_RULES,
  clampLuckSpend,
  luckAfterSpend,
  luckModifier,
  luckPoolMax,
  luckRemaining,
} from "../luck";
import { skillCheckForCharacter } from "../skillCheck";
import type { RNG } from "../types";

const face =
  (value: number): RNG =>
  () =>
    (value - 1) / 10 + 0.001;

describe("the pool", () => {
  it("holds points equal to the LUCK STAT", () => {
    expect(luckPoolMax({ luck: 6 })).toBe(6);
    expect(LUCK_RULES.pool).toContain("LUCK");
  });

  it("is nothing for a character with no LUCK recorded", () => {
    expect(luckPoolMax({})).toBe(0);
    expect(luckPoolMax(null)).toBe(0);
  });

  it("reads an unrecorded pool as full, not as empty", () => {
    // A campaign that predates the Luck column must not silently lose its Luck.
    expect(luckRemaining(null, { luck: 6 })).toBe(6);
    expect(luckRemaining(undefined, { luck: 6 })).toBe(6);
  });

  it("reads a recorded pool as what it says", () => {
    expect(luckRemaining(2, { luck: 6 })).toBe(2);
    expect(luckRemaining(0, { luck: 6 })).toBe(0);
  });

  it("never reads back more than the character's LUCK", () => {
    // A stale row from before a LUCK drop cannot hand out points the sheet
    // no longer supports.
    expect(luckRemaining(9, { luck: 6 })).toBe(6);
  });
});

describe("spending", () => {
  it("cannot overdraw the pool", () => {
    expect(clampLuckSpend(8, 3)).toBe(3);
    expect(clampLuckSpend(3, 3)).toBe(3);
  });

  it("refuses negative and fractional spends", () => {
    expect(clampLuckSpend(-2, 5)).toBe(0);
    expect(clampLuckSpend(2.7, 5)).toBe(2);
    expect(clampLuckSpend(Number.NaN, 5)).toBe(0);
  });

  it("is worth exactly +1 a point, labelled in the trace", () => {
    expect(luckModifier(3)).toEqual({ label: LUCK_MODIFIER_LABEL, value: 3 });
  });

  it("adds no modifier at all when nothing was dedicated", () => {
    expect(luckModifier(0)).toBeNull();
    expect(luckModifier(-1)).toBeNull();
  });

  it("leaves the pool short by what was spent, never below zero", () => {
    expect(luckAfterSpend(6, 4)).toBe(2);
    expect(luckAfterSpend(2, 2)).toBe(0);
    expect(luckAfterSpend(2, 99)).toBe(0);
  });
});

describe("a Luck spend on a real check", () => {
  const actor = { stats: { cool: 6 }, skills: [{ skillId: "persuasion", level: 2 }] };

  it("turns a miss into a hit and says so in the formula", () => {
    // COOL 6 + Persuasion 2 + d10(4) = 12 against DV 15: three short.
    const without = skillCheckForCharacter(actor, "persuasion", 15, face(4));
    expect(without.total).toBe(12);
    expect(without.success).toBe(false);

    const spend = luckModifier(3)!;
    const with3 = skillCheckForCharacter(actor, "persuasion", 15, face(4), {
      modifiers: [spend],
    });
    expect(with3.total).toBe(15);
    expect(with3.success).toBe(true); // a check meets or beats its DV
    expect(with3.formula).toContain("Luck(3)");
  });
});
