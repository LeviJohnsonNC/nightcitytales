import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  INTEL_LADDER,
  describeFamiliarity,
  findMission,
  generateJob,
  getPlace,
  placeIntel,
  recordVisit,
  rungsFor,
  startingState,
  type PlaceState,
} from "@/engine";

/** A place the character has been to this many times. */
function visited(placeKey: string, times: number): PlaceState {
  let state = startingState(placeKey);
  for (let i = 0; i < times; i += 1) state = recordVisit(state, i + 1);
  return state;
}

describe("what a job names", () => {
  it("names a building, not just a district", () => {
    // "A warehouse in Santo Domingo" is a set piece. "The Greenbox Storage
    // Units" is somewhere the player may already have been.
    const withPlaces = Array.from({ length: 40 }, (_, seed) => generateJob(seed).offer)
      .filter((offer) => !!offer)
      .filter((offer) => offer!.placeKey);
    expect(withPlaces.length).toBeGreaterThan(30);
    for (const offer of withPlaces) {
      const place = getPlace(offer!.placeKey!);
      expect(place, offer!.placeKey).toBeDefined();
      expect(offer!.placeName).toBe(place!.name);
    }
  });

  it("puts the work inside the district it advertises", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const offer = generateJob(seed).offer;
      if (!offer?.placeKey) continue;
      const district = DISTRICTS.find((d) => d.key === offer.districtKey);
      expect(
        district?.locations.some((l) => l.key === offer.placeKey),
        `seed ${seed}`,
      ).toBe(true);
    }
  });

  it("still generates the same job for the same seed", () => {
    // The venue draw was appended last on purpose: extending the stream leaves
    // every earlier draw untouched, so a stored id names the same job it always
    // did.
    for (let seed = 0; seed < 20; seed += 1) {
      expect(generateJob(seed)).toEqual(generateJob(seed));
    }
  });

  it("can be looked up without throwing", () => {
    // getMission throws for an unknown id, which is right for a play loop that
    // has lost its mission and wrong for a caller that only wants to know where
    // the job was.
    expect(findMission(null)).toBeNull();
    expect(findMission("no-such-mission")).toBeNull();
    expect(findMission(generateJob(7).id)?.id).toBe(generateJob(7).id);
  });
});

describe("knowing a place", () => {
  it("says nothing about somewhere never visited", () => {
    // An empty readout, not a readout saying nothing is known.
    const intel = placeIntel("x2");
    expect(intel?.known).toEqual([]);
    expect(intel?.visits).toBe(0);
    expect(describeFamiliarity(intel!)).toBeNull();
  });

  it("opens one rung at a time", () => {
    expect(rungsFor(0)).toEqual([]);
    expect(rungsFor(1)).toEqual(["what"]);
    expect(rungsFor(2)).toEqual(["what", "who"]);
    expect(rungsFor(99)).toEqual(INTEL_LADDER.map((step) => step.rung));
  });

  it("tells you more the more you have been", () => {
    const once = placeIntel("x2", visited("x2", 1))!;
    const often = placeIntel("x2", visited("x2", 6))!;
    expect(once.known.length).toBeGreaterThan(0);
    expect(often.known.length).toBeGreaterThan(once.known.length);
  });

  it("only ever repeats what the engine already knows", () => {
    // Every rung is read from the atlas, the tags, or the campaign's own row.
    // None of it is a fact this module invented.
    const intel = placeIntel("x1", visited("x1", 6))!;
    const joined = intel.known.join(" ");
    expect(joined).toContain("Albino Alligators"); // the atlas's own gang list
    expect(joined).toContain("NCPD (in theory)"); // the atlas's own security line
  });

  it("mentions what has happened here, once something has", () => {
    const quiet = placeIntel("x5", visited("x5", 6))!;
    expect(quiet.known.join(" ")).toContain("Trade runs here as usual");
  });

  it("counts the visits in words", () => {
    expect(describeFamiliarity(placeIntel("x4", visited("x4", 1))!)).toContain("once");
    expect(describeFamiliarity(placeIntel("x4", visited("x4", 3))!)).toContain("3 times");
  });

  it("says nothing at all about a place the atlas does not have", () => {
    expect(placeIntel("zz9")).toBeNull();
  });

  it("hands over information, never a modifier", () => {
    // The one thing this must not become. RED's DVs are printed, and a
    // home-field +1 would be an invented rule.
    const intel = placeIntel("x1", visited("x1", 20))!;
    for (const line of intel.known) {
      expect(line, line).not.toMatch(/[+-]\d/);
      expect(line.toLowerCase(), line).not.toContain("bonus");
      expect(line.toLowerCase(), line).not.toContain("dv");
    }
  });
});
