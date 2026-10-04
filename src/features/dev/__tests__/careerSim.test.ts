/**
 * The career soak, as a gate. It plays a few hundred short careers through the
 * engine's own functions and fails if any of them breaks a rule the rest of the
 * game relies on — money that is not a number, a Reputation that goes down,
 * work that gets worse, an I.P. balance below zero — which a rule change can do
 * without any single unit test noticing, because the break is in how the pieces
 * compose over a hundred days, not in any one of them.
 *
 * It is not a balance test: the playstyles are assumptions (see the sim's
 * header), so nothing here asserts that the climb is the right length. The
 * report, `bun run tools/pacing/soak.ts`, is for reading that.
 */
import { describe, expect, it } from "vitest";
import { JOB_TIERS, ROLE_OPENING_IDS } from "@/engine";
import { PLAYSTYLES, median, playCareer, roleFor, sweep, type Playstyle } from "../careerSim";

const base = {
  playstyle: PLAYSTYLES[1]!,
  daysBetweenJobs: 7,
  horizon: 120,
  startingEb: 500,
  spend: "rank" as const,
};

describe("a career", () => {
  it("is the same career for the same seed, and a different one for another", () => {
    const a = playCareer({ ...base, seed: 7, roleId: "solo" });
    const b = playCareer({ ...base, seed: 7, roleId: "solo" });
    const c = playCareer({ ...base, seed: 8, roleId: "solo" });
    expect(b.days).toEqual(a.days);
    expect(b.receipts).toEqual(a.receipts);
    expect(c.days).not.toEqual(a.days);
  });

  it("runs a day at a time, for as long as it was asked to", () => {
    const career = playCareer({ ...base, seed: 1, roleId: "tech", horizon: 90 });
    expect(career.days).toHaveLength(90);
    expect(career.days.map((d) => d.day)).toEqual(Array.from({ length: 90 }, (_, i) => i + 1));
  });

  it("takes a job on the cadence it was given, and no more", () => {
    const career = playCareer({ ...base, seed: 3, roleId: "nomad", daysBetweenJobs: 10 });
    expect(career.days[career.days.length - 1]!.jobs).toBe(Math.floor(120 / 10));
  });
});

describe("the soak", () => {
  for (const style of PLAYSTYLES) {
    it(`breaks no rule over 30 ${style.id} careers, half saving for the Rank and half for Skills`, () => {
      const broken: string[] = [];
      for (const spend of ["rank", "skills"] as const) {
        const { careers } = sweep({
          ...base,
          playstyle: style,
          spend,
          careers: 15,
          horizon: 100,
          // A different set of careers per playstyle, so the gate is not the same fifteen each time.
          seed: PLAYSTYLES.indexOf(style) + 11,
        });
        for (const c of careers) {
          for (const v of c.violations) broken.push(`${c.params.roleId}/${c.params.seed}: ${v}`);
        }
      }
      expect(broken).toEqual([]);
    });
  }

  it("covers every Role", () => {
    const seen = new Set(Array.from({ length: ROLE_OPENING_IDS.length }, (_, n) => roleFor(n)));
    expect(seen.size).toBe(ROLE_OPENING_IDS.length);
  });
});

describe("what the climb is made of", () => {
  const pure = (over: Partial<Playstyle>): Playstyle => ({
    ...PLAYSTYLES[0]!,
    id: "test",
    ...over,
  });

  it("never gives a crew that always works clean a name, or better work than street", () => {
    // The trade the Reputation rules state: getting away without a trace is also
    // what keeps your name out of the story. Pinned so it stays a decision.
    const { careers } = sweep({
      ...base,
      playstyle: pure({ clean: 1 }),
      careers: 10,
      horizon: 120,
    });
    for (const c of careers) {
      expect(c.days[c.days.length - 1]!.reputation).toBe(0);
      expect(c.first.steady).toBeNull();
    }
  });

  it("lets a loud crew reach the best work the rules offer", () => {
    const { careers } = sweep({
      ...base,
      playstyle: PLAYSTYLES[2]!,
      careers: 10,
      horizon: 120,
      daysBetweenJobs: 5,
    });
    for (const c of careers) expect(c.first.serious, `${c.params.roleId}`).not.toBeNull();
    expect(JOB_TIERS).toHaveLength(3);
  });

  it("charges the Role Rank its printed price: the first Rank takes more I.P. than a Skill Level", () => {
    const saver = sweep({ ...base, careers: 10, spend: "rank" }).row;
    const spender = sweep({ ...base, careers: 10, spend: "skills" }).row;
    expect(saver.endSkillLevels).toBe(0);
    expect(spender.endRank).toBe(4);
    expect(saver.endRank).toBeGreaterThan(4);
  });

  it("does not let the rent catch a character who works", () => {
    const { row } = sweep({ ...base, careers: 20, daysBetweenJobs: 14, horizon: 100 });
    expect(row.everBehind).toBe(0);
  });
});

describe("the arithmetic around it", () => {
  it("takes a median the usual way", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
