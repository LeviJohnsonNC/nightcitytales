import { describe, expect, it } from "vitest";
import {
  findFactionIn,
  generateJob,
  JOB_TIERS,
  missionFitsTier,
  seededRng,
  type FactionId,
} from "@/engine";
import { SEED_CANDIDATES, pickJobSeed } from "../hookOffer";

describe("the wire prefers ground you know", () => {
  it("picks a job in a district the character has walked, when one is on offer", () => {
    // Done by choosing among SEEDS rather than steering the generator: every
    // draw inside generateJob is deterministic from its seed, and biasing the
    // district there would change every job every stored id names.
    const rng = seededRng(99);
    const known = new Set(["rancho_coronado", "santo_domingo", "kabuki"]);
    let familiar = 0;
    for (let i = 0; i < 60; i += 1) {
      const seed = pickJobSeed(known, rng);
      const district = generateJob(seed).offer?.districtKey;
      if (district && known.has(district)) familiar += 1;
    }
    // Not every time — a run of candidates cannot always find one — but far
    // more often than three districts out of twenty-four would give by chance,
    // which is about eight of these sixty. The bar is what the preference felt
    // like when the generator only drew from eight districts, and it is here so
    // that widening the pool again silently weakens it into a failure rather
    // than into a shrug.
    expect(familiar).toBeGreaterThan(48);
  });

  it("still finds work for somebody who has been nowhere", () => {
    const rng = seededRng(7);
    const seed = pickJobSeed(new Set(), rng);
    expect(generateJob(seed).offer?.districtKey).toBeTruthy();
  });

  it("looks at more than one candidate", () => {
    expect(SEED_CANDIDATES).toBeGreaterThan(1);
  });
});

describe("the wire offers the work a crew has earned", () => {
  it.each(JOB_TIERS.map((t) => [t.id, t] as const))(
    "finds %s work almost every time it looks",
    (_id, tier) => {
      const rng = seededRng(2026);
      let fits = 0;
      const draws = 200;
      for (let i = 0; i < draws; i += 1) {
        const seed = pickJobSeed(new Set(), rng, { tier, hostile: new Set() });
        if (missionFitsTier(generateJob(seed), tier)) fits += 1;
      }
      // The rarest tier is about one seed in ten; sixty-four looks miss it about
      // one time in a thousand, so 195 of 200 is a generous floor.
      expect(fits).toBeGreaterThanOrEqual(195);
    },
  );

  it("does not put the character to work for a faction that wants them dead", () => {
    const rng = seededRng(41);
    const hostile = new Set<FactionId>(["arasaka", "militech", "trauma_team"]);
    for (let i = 0; i < 100; i += 1) {
      const seed = pickJobSeed(new Set(), rng, { tier: JOB_TIERS[0]!, hostile });
      const employer = findFactionIn(generateJob(seed).offer?.patronOrg ?? null);
      expect(employer === null || !hostile.has(employer)).toBe(true);
    }
  });
});
