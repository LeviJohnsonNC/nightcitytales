import { describe, expect, it } from "vitest";
import { checkOdds, checkPercent, opposedOdds, opposedPercent } from "../checkOdds";
import { meetsDV } from "../checkDV";
import { statSkillCheck } from "../dice";
import { OPPOSED_CHECK_TIE_GOES_TO } from "../rulesData";
import { resolveOpposedCheck, type OpposedSide } from "../opposedCheck";

/** Returns fixed die faces, in order, so a roll is exactly the one named. */
const scripted = (faces: number[]) => {
  let i = 0;
  return () => (faces[i++]! - 1) / 10;
};

const side = (name: string, base: number): OpposedSide => ({
  name,
  statLabel: "STAT",
  statValue: base,
  skillLabel: "Skill",
  skillValue: 0,
});

/**
 * Every way one side's roll can fall, out of 100. A plain face is ten of the
 * hundred; a natural 1 or 10 draws a critical die, one hundredth per face of it.
 */
function outcomes(): { faces: number[]; weight: number }[] {
  const out: { faces: number[]; weight: number }[] = [];
  for (let die = 1; die <= 10; die += 1) {
    if (die === 1 || die === 10) {
      for (let crit = 1; crit <= 10; crit += 1) out.push({ faces: [die, crit], weight: 1 });
    } else {
      out.push({ faces: [die], weight: 10 });
    }
  }
  return out;
}

describe("checkOdds", () => {
  it("is the chance the real dice produce, for every base and DV", () => {
    // Not a restatement of the formula: this runs the actual roll for each of
    // the hundred (die, critical die) pairs and counts what meets the DV.
    for (const base of [-2, 0, 4, 9, 14, 19]) {
      for (const dv of [9, 13, 17, 21, 24, 29]) {
        let hits = 0;
        for (let die = 1; die <= 10; die += 1) {
          for (let crit = 1; crit <= 10; crit += 1) {
            const rolled = statSkillCheck(base, scripted([die, crit]));
            if (meetsDV(rolled.total, dv)) hits += 1;
          }
        }
        expect(checkOdds(base, dv)).toBe(hits / 100);
      }
    }
  });

  it("rounds to a whole percent for display", () => {
    expect(checkPercent(10, 15)).toBe(Math.round(checkOdds(10, 15) * 100));
  });
});

describe("opposedOdds", () => {
  it("is the chance the real opposed roll produces, ties as the rules data say", () => {
    for (const [mine, theirs] of [
      [8, 8],
      [12, 7],
      [5, 11],
      [16, 9],
      [3, 3],
    ] as const) {
      let wins = 0;
      for (const a of outcomes()) {
        for (const b of outcomes()) {
          const result = resolveOpposedCheck(
            side("me", mine),
            side("them", theirs),
            scripted([...a.faces, ...b.faces]),
          );
          if (result.success) wins += a.weight * b.weight;
        }
      }
      expect(opposedOdds(mine, theirs)).toBe(wins / 10_000);
    }
  });

  it("gives the tie to the side the rules data names", () => {
    // Evenly matched sides are not 50/50: a tie is the defender's, so the actor
    // wins strictly less than half and the two chances leave the ties between.
    expect(OPPOSED_CHECK_TIE_GOES_TO).toBe("defender");
    expect(opposedOdds(10, 10)).toBeLessThan(0.5);
    expect(opposedOdds(10, 10) + opposedOdds(10, 10)).toBeLessThan(1);
  });

  it("rises with the actor's base and falls with the opponent's", () => {
    expect(opposedOdds(12, 8)).toBeGreaterThan(opposedOdds(10, 8));
    expect(opposedOdds(10, 12)).toBeLessThan(opposedOdds(10, 8));
    expect(opposedPercent(60, 3)).toBe(100);
    expect(opposedPercent(3, 60)).toBe(0);
  });
});
