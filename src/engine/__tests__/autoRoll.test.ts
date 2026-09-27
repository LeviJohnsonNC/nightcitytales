import { describe, expect, it } from "vitest";
import { AUTO_ROLL_MAX_DV, getDV, mayRollItself } from "@/engine";

const small = { lowStakes: true, dv: 13, opposed: false, inCombat: false };

describe("mayRollItself — when a check rolls without the player pressing it", () => {
  it("caps at the printed Everyday rung", () => {
    expect(AUTO_ROLL_MAX_DV).toBe(getDV("Everyday"));
  });

  it("rolls a small, easy check the narrator marked low-stakes", () => {
    expect(mayRollItself(small)).toBe(true);
    expect(mayRollItself({ ...small, dv: getDV("Simple") })).toBe(true);
  });

  it("never rolls one the narrator did not mark", () => {
    expect(mayRollItself({ ...small, lowStakes: false })).toBe(false);
  });

  it("never rolls a hard one, however it was marked", () => {
    expect(mayRollItself({ ...small, dv: getDV("Difficult") })).toBe(false);
  });

  it("never rolls a contest with a person", () => {
    expect(mayRollItself({ ...small, dv: null, opposed: true })).toBe(false);
    expect(mayRollItself({ ...small, dv: null })).toBe(false);
  });

  it("never rolls in a fight", () => {
    expect(mayRollItself({ ...small, inCombat: true })).toBe(false);
  });
});
