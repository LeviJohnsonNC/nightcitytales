import { describe, expect, it } from "vitest";
import jobContent from "@/data/missions/job-content.json";
import { FORCE_SIZES } from "../threats";
import type { JobSettledEventData } from "../ledger";
import {
  deedLevel,
  JOB_TIERS,
  jobTierFor,
  REPUTATION_JOB_CAP,
  reputationFrom,
} from "../reputation";
import { REPUTATION } from "../rulesData";

const job = (noticed: JobSettledEventData["noticed"], agreed = 500): JobSettledEventData => ({
  noticed,
  agreed,
});

describe("what a job is worth as a deed", () => {
  it("is nothing at all when it was clean", () => {
    expect(deedLevel(job({ clean: 1, loud: 1, witness: 2 }, 5000))).toBe(0);
  });

  it("is the base for a job nobody in particular noticed", () => {
    expect(deedLevel(job({}))).toBe(1);
  });

  it("climbs with who saw it, up to a point", () => {
    expect(deedLevel(job({ seen: 1 }))).toBe(2);
    expect(deedLevel(job({ seen: 1, named: 1, witness: 3 }))).toBe(3); // capped at two steps
  });

  it("climbs for noise, bodies and a fee worth talking about", () => {
    expect(deedLevel(job({ loud: 1 }))).toBe(2);
    expect(deedLevel(job({ killed: 2 }))).toBe(1);
    expect(deedLevel(job({ killed: 3 }))).toBe(2);
    expect(deedLevel(job({}, 1500))).toBe(2);
    expect(deedLevel(job({}, 3000))).toBe(3);
  });

  it("never reaches the news on a job alone", () => {
    const everything = job({ seen: 1, named: 1, loud: 1, killed: 9 }, 50_000);
    expect(deedLevel(everything)).toBe(REPUTATION_JOB_CAP);
  });
});

describe("Reputation", () => {
  it("starts where the book starts a character", () => {
    expect(reputationFrom([])).toMatchObject({
      level: REPUTATION.startingValue,
      deeds: 0,
      whoKnows: null,
    });
  });

  it("is the best deed so far, and a smaller one never lowers it", () => {
    const rep = reputationFrom([job({ seen: 1, loud: 1 }), job({}), job({ clean: 1 })]);
    expect(rep.level).toBe(3);
    expect(rep.deeds).toBe(2);
    expect(rep.whoKnows).toBe(REPUTATION.levels.find((l) => l.level === 3)!.whoKnows);
  });
});

describe("the work a crew is offered", () => {
  it("starts on the street", () => {
    const standing = jobTierFor({ reputation: 0, jobsFinished: 0, fixerDisposition: 1 });
    expect(standing.tier.id).toBe(JOB_TIERS[0]!.id);
    expect(standing.next?.id).toBe(JOB_TIERS[1]!.id);
  });

  it("needs both the name and the record", () => {
    const steady = JOB_TIERS[1]!;
    expect(
      jobTierFor({ reputation: 9, jobsFinished: steady.minJobsFinished - 1, fixerDisposition: 1 })
        .tier.id,
    ).toBe(JOB_TIERS[0]!.id);
    expect(
      jobTierFor({
        reputation: steady.minReputation,
        jobsFinished: steady.minJobsFinished,
        fixerDisposition: 1,
      }).tier.id,
    ).toBe(steady.id);
  });

  it("is a tier lower when the fixer has gone cold, and says so", () => {
    const top = JOB_TIERS.at(-1)!;
    const cold = jobTierFor({
      reputation: top.minReputation,
      jobsFinished: top.minJobsFinished,
      fixerDisposition: -1,
    });
    expect(cold.tier.id).toBe(JOB_TIERS.at(-2)!.id);
    expect(cold.heldBack).toBe(true);
    expect(cold.next).toBeNull();
  });
});

describe("the tier data asks only for work the generator can make", () => {
  const bands = jobContent.rewardBands.map((b) => b.eurobucksPerHead);
  // rollForceSize never draws "overwhelming"; a tier that asked for it could
  // never be filled.
  const sizes = FORCE_SIZES.filter((s) => s !== "overwhelming");

  it.each(JOB_TIERS.map((t) => [t.id, t] as const))("%s", (_id, tier) => {
    for (const fee of tier.perHead) expect(bands).toContain(fee);
    for (const size of tier.forceSizes) expect(sizes).toContain(size);
  });

  it("pays more, and fights harder, the higher the tier", () => {
    for (let i = 1; i < JOB_TIERS.length; i += 1) {
      expect(Math.min(...JOB_TIERS[i]!.perHead)).toBeGreaterThanOrEqual(
        Math.min(...JOB_TIERS[i - 1]!.perHead),
      );
      const rank = (s: string) => FORCE_SIZES.indexOf(s as (typeof FORCE_SIZES)[number]);
      expect(Math.max(...JOB_TIERS[i]!.forceSizes.map(rank))).toBeGreaterThanOrEqual(
        Math.max(...JOB_TIERS[i - 1]!.forceSizes.map(rank)),
      );
    }
  });
});
