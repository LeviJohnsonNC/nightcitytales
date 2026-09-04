import { describe, expect, it } from "vitest";
import { generateJob, seededRng } from "@/engine";
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
    // Not every time — six candidates cannot always find one — but far more
    // often than three districts out of twenty-four would give by chance.
    expect(familiar).toBeGreaterThan(30);
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
