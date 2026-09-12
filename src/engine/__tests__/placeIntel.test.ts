import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  INTEL_LADDER,
  INTEL_RUNGS,
  LOCAL_EXPERT_LADDER,
  PLACE_INTEL_IS_HOUSE_RULE,
  PLACE_TAGS,
  applyToPlace,
  describeFamiliarity,
  effectiveRungs,
  findMission,
  generateJob,
  getPlace,
  placeFamiliarity,
  placeIntel,
  placesWithTag,
  recordVisit,
  rungsFor,
  rungsFromLocalExpert,
  startingState,
  type PlaceState,
} from "@/engine";
import intelData from "@/data/atlas/place-intel.json";

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

  it("says nothing has happened when nothing has, however well you know it", () => {
    // The rung is "since you have been coming here", so it is measured against
    // how the place STARTED. This test used to assert the opposite and was
    // named for it: a market is flagged open from the moment the city is built,
    // and a player who had earned this rung was told that trade runs here as
    // usual — which they could see, and which had not happened.
    for (const place of placesWithTag("market")) {
      const known = placeIntel(place.key, visited(place.key, 6))!.known.join(" ");
      expect(known, `${place.name} reports its opening condition as news`).not.toContain(
        "Since you have been coming here",
      );
    }
    // And the same for ground written up as already held or already dark.
    for (const key of ["n6", "t2", "x2"]) {
      expect(placeIntel(key, visited(key, 6))!.known.join(" "), key).not.toContain(
        "Since you have been coming here",
      );
    }
  });

  it("mentions what has happened here, once something actually has", () => {
    let state = visited("x5", 6);
    for (let i = 0; i < 8; i += 1) state = applyToPlace(state, ["loud"]).state;
    const known = placeIntel("x5", state)!.known.join(" ");
    expect(known).toContain("Since you have been coming here");
    expect(known).toContain("The law has been through");
  });

  it("reports a flag the place has LOST, which is the whole point of the rung", () => {
    // A raid clears `market_open`, and a cleared flag simply vanishes from the
    // list. The one moment this system exists for — the market you have been
    // shopping at for six weeks is gone — used to produce no line at all.
    let state = visited("x5", 6);
    expect(state.flags).toContain("market_open");
    for (let i = 0; i < 8; i += 1) state = applyToPlace(state, ["loud"]).state;
    expect(state.flags).not.toContain("market_open");
    expect(placeIntel("x5", state)!.known.join(" ")).toContain(
      "The trade that ran here has stopped",
    );
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

// ---------------------------------------------------------------------------
// The second way up the ladder: being a local in the district.
// ---------------------------------------------------------------------------

/** The tags the local-knowledge rung may point at, read from the house rule itself. */
const LOCAL_KNOWLEDGE_TAGS: string[] = (
  intelData as unknown as { localKnowledge: { tag: string }[] }
).localKnowledge.map((entry) => entry.tag);

/** A district with something for a local to point at, and a place in it. */
const LOCAL_PLACE = "x1"; // The Motor Pool, Rancho Coronado
const QUIET_PLACE = "k1"; // Rancho Corona Cemetery, Reclamation Zone

describe("the ladders themselves", () => {
  it("say they are a house rule, because they are", () => {
    expect(PLACE_INTEL_IS_HOUSE_RULE).toBe(true);
  });

  it("only ever name rungs somebody wrote a builder for", () => {
    for (const step of INTEL_LADDER) expect(INTEL_RUNGS).toContain(step.rung);
    for (const step of LOCAL_EXPERT_LADDER) expect(INTEL_RUNGS).toContain(step.rung);
  });

  it("never let being a local earn the `state` rung", () => {
    // `state` reports what has changed HERE SINCE YOU STARTED COMING. That is a
    // log of the character's own weeks, not knowledge of a neighbourhood: being
    // a local cannot tell you the counter you have been using is gone, because
    // it is your habit that makes it news.
    expect(LOCAL_EXPERT_LADDER.some((step) => step.rung === "state")).toBe(false);
    expect(rungsFromLocalExpert(99)).not.toContain("state");
  });

  it("never let visits earn the `neighbourhood` rung", () => {
    // The mirror of the rule above: it is measured across the district, and no
    // number of visits to one building can teach it.
    expect(INTEL_LADDER.some((step) => step.rung === "neighbourhood")).toBe(false);
    expect(rungsFor(999)).not.toContain("neighbourhood");
  });
});

describe("rungsFromLocalExpert", () => {
  it("opens nothing for somebody who is not a local at all", () => {
    expect(rungsFromLocalExpert(0)).toEqual([]);
  });

  it("opens more the more of a local you are", () => {
    const at = (level: number) => new Set(rungsFromLocalExpert(level));
    expect(at(1).size).toBe(0);
    expect(at(2)).toContain("what");
    expect(at(4)).toContain("who");
    expect(at(4)).toContain("law");
    expect(at(6)).toContain("neighbourhood");
    // Monotonic: a higher Level never knows less.
    for (let level = 1; level < 10; level += 1) {
      for (const rung of rungsFromLocalExpert(level)) {
        expect(rungsFromLocalExpert(level + 1)).toContain(rung);
      }
    }
  });
});

describe("effectiveRungs", () => {
  it("is the union of both ways of knowing, in ladder order", () => {
    const rungs = effectiveRungs(6, 6);
    expect(rungs).toEqual(INTEL_RUNGS.filter((rung) => rungs.includes(rung)));
    expect(rungs).toContain("state"); // visited for
    expect(rungs).toContain("neighbourhood"); // local for
  });

  it("is exactly the visit ladder for somebody who is a local nowhere", () => {
    for (const visits of [0, 1, 2, 4, 6, 20]) {
      expect(effectiveRungs(visits, 0)).toEqual(rungsFor(visits));
    }
  });
});

describe("what a local knows about a building they have never entered", () => {
  it("knows what it is, who claims it, and who answers", () => {
    // The whole point of the Skill. A stranger gets nothing here.
    expect(placeIntel(LOCAL_PLACE)!.known).toEqual([]);
    const local = placeIntel(LOCAL_PLACE, undefined, 6)!;
    const joined = local.known.join(" ");
    expect(local.visits).toBe(0);
    expect(joined).toContain("What it is:");
    expect(joined).toContain("Who claims this ground:");
    expect(joined).toContain("If it goes loud:");
  });

  it("credits every line to being a local, because none of it was visited for", () => {
    const local = placeIntel(LOCAL_PLACE, undefined, 6)!;
    expect(local.asALocal).toEqual(local.known);
  });

  it("knows what noise costs on these streets, which no number of visits teaches", () => {
    const local = placeIntel(LOCAL_PLACE, undefined, 6)!.known.join(" ");
    expect(local).toContain("What noise costs here:");
    // Rancho Coronado is one of the districts the atlas itself files under
    // "NCPD (in theory)", and a local is the one who knows what that means.
    expect(local).toContain("Nobody is keeping score");
  });

  it("can point at the doors a stranger would have to hunt for, by name", () => {
    const local = placeIntel(LOCAL_PLACE, undefined, 6)!.known.join(" ");
    expect(local).toContain("What the locals know is around here:");
    // Named venues from the atlas, in this district, reached through the tags.
    expect(local).toContain("Minimallism"); // the district's fence
    expect(local).toContain("Albino Alligator Carwash"); // claimed ground
  });

  it("says nothing about a neighbourhood with nothing in it rather than inventing some", () => {
    // The Reclamation Zone has one address. A rung with no answer produces no
    // line, which is the honest outcome and not a gap.
    const lines = placeIntel(QUIET_PLACE, undefined, 6)!.known;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => line.trim().length > 0)).toBe(true);
  });

  it("never names a venue outside its own district", () => {
    for (const district of DISTRICTS) {
      const place = district.locations[0];
      if (!place) continue;
      const known = placeIntel(place.key, undefined, 6)!.known.join(" ");
      const doors = known.split("What the locals know is around here:")[1];
      if (!doors) continue;
      const inDistrict = new Set(district.locations.map((l) => l.name));
      for (const other of DISTRICTS) {
        if (other.key === district.key) continue;
        for (const elsewhere of other.locations) {
          if (inDistrict.has(elsewhere.name)) continue;
          expect(doors, `${district.name} names ${elsewhere.name}`).not.toContain(elsewhere.name);
        }
      }
    }
  });
});

describe("a local who also comes here all the time", () => {
  it("knows everything both ways, and credits only the extra to being a local", () => {
    const state = visited(LOCAL_PLACE, 6);
    const both = placeIntel(LOCAL_PLACE, state, 6)!;
    const visitedOnly = placeIntel(LOCAL_PLACE, state)!;
    // Every rung visits earned is still there, plus the district rung.
    for (const line of visitedOnly.known) expect(both.known).toContain(line);
    expect(both.known.length).toBeGreaterThan(visitedOnly.known.length);
    // Nothing they had already seen for themselves is credited to being local.
    for (const line of visitedOnly.known) expect(both.asALocal).not.toContain(line);
    expect(both.asALocal.length).toBeGreaterThan(0);
  });
});

describe("being a local pays in information, never in a modifier", () => {
  it("holds for every line the Skill opens, in every district", () => {
    // The invariant the whole module exists to keep. RED's DVs are printed and
    // a home-field bonus would be an invented rule.
    for (const district of DISTRICTS) {
      for (const place of district.locations) {
        for (const line of placeIntel(place.key, visited(place.key, 20), 10)!.known) {
          expect(line, line).not.toMatch(/[+-]\d/);
          expect(line.toLowerCase(), line).not.toContain("bonus");
          expect(line.toLowerCase(), line).not.toContain(" dv");
        }
      }
    }
  });
});

describe("the local-knowledge vocabulary", () => {
  it("only names tags the city actually uses", () => {
    // A tag nobody applied would be a promise the atlas cannot keep: the rung
    // would name a kind of door and then never find one anywhere.
    for (const entry of LOCAL_KNOWLEDGE_TAGS) {
      expect(PLACE_TAGS, entry).toContain(entry);
      expect(placesWithTag(entry).length, `nothing in the city is tagged ${entry}`).toBeGreaterThan(
        0,
      );
    }
  });

  it("reaches most of the city, and says nothing where the ground is bare", () => {
    const withDoors = DISTRICTS.filter((district) =>
      LOCAL_KNOWLEDGE_TAGS.some((tag) => placesWithTag(tag, district.key).length > 0),
    );
    // 22 of 24 at the time of writing. The two without are the Reclamation Zone
    // and the Exec Zone, which have one address and none between them.
    expect(withDoors.length).toBeGreaterThanOrEqual(20);
  });
});

describe("what the narrator is handed", () => {
  it("says how much of a local they are, and only when they are one", () => {
    expect(placeFamiliarity(LOCAL_PLACE, undefined, 1, 0)?.localExpert).toBeNull();
    const read = placeFamiliarity(LOCAL_PLACE, undefined, 1, 6);
    expect(read?.localExpert).toEqual({ level: 6, districtName: "Rancho Coronado" });
  });

  it("separates what they have seen from what they know as a local", () => {
    const read = placeFamiliarity(LOCAL_PLACE, visited(LOCAL_PLACE, 2), 3, 6)!;
    // Visiting twice earns `what` and `who`; being a local adds the rest.
    expect(read.known.length).toBeGreaterThan(read.asALocal.length);
    expect(read.asALocal.length).toBeGreaterThan(0);
    for (const line of read.asALocal) expect(read.known).toContain(line);
  });

  it("still calls a first visit a first visit, however local they are", () => {
    // `standing` is about whether to establish the BUILDING, which they have
    // genuinely never been inside. Knowing the street is the other list's job.
    expect(placeFamiliarity(LOCAL_PLACE, undefined, 1, 8)?.standing).toBe("first");
  });
});
