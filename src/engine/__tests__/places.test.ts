import { describe, expect, it } from "vitest";
import gameplay from "@/data/atlas/places.gameplay.json";
import {
  ARENA_KEYS,
  DEFAULT_ARENA_KEY,
  DISTRICTS,
  PLACES_ARE_HOUSE_RULE,
  PLACE_TAGS,
  RESPONSE_TIERS,
  arenaForPlace,
  districtProfile,
  districtsWithTag,
  hasTag,
  isCombatZone,
  heatMultiplier,
  isPlaceTag,
  isResponseTier,
  placeProfile,
  placesWithTag,
  tagMeaning,
  tagsOf,
} from "@/engine";

const FILE = gameplay as unknown as {
  districts: Record<string, unknown>;
  places: Record<string, { tags: string[] }>;
  arenaByTag: [string, string][];
  responseTiers: Record<string, { heat: number; minutes: number }>;
};

const ATLAS_PLACES = DISTRICTS.flatMap((d) => d.locations);

describe("place gameplay data", () => {
  it("is declared a house rule, like the travel times beside it", () => {
    // The atlas is what the publisher printed. Everything in this file is what
    // the game made of it, and the flag is what keeps the two distinguishable.
    expect(PLACES_ARE_HOUSE_RULE).toBe(true);
  });

  it("profiles every district in the atlas and no district that is not", () => {
    expect(Object.keys(FILE.districts).sort()).toEqual(DISTRICTS.map((d) => d.key).sort());
  });

  it("profiles every location in the atlas and no location that is not", () => {
    // A key invented here would be a place the game believes in and the city
    // does not; a key missing would be somewhere the player can stand and the
    // engine has nothing to say about.
    expect(Object.keys(FILE.places).sort()).toEqual(ATLAS_PLACES.map((p) => p.key).sort());
  });

  it("gives every location at least one tag", () => {
    for (const place of ATLAS_PLACES) {
      expect(tagsOf(place.key).length, `${place.key} ${place.name} has no tags`).toBeGreaterThan(0);
    }
  });

  it("uses no tag outside the closed list", () => {
    for (const [key, row] of Object.entries(FILE.places)) {
      for (const tag of row.tags) {
        expect(isPlaceTag(tag), `${key} carries "${tag}", which is not a tag`).toBe(true);
      }
    }
  });

  it("uses every tag it defines", () => {
    // A tag nothing carries is vocabulary nobody can write a beat against, and
    // it is usually a tag that was renamed everywhere except its own definition.
    const used = new Set(Object.values(FILE.places).flatMap((p) => p.tags));
    expect(PLACE_TAGS.filter((t) => !used.has(t))).toEqual([]);
  });

  it("explains every tag", () => {
    for (const tag of PLACE_TAGS) {
      expect(tagMeaning(tag), tag).toBeTruthy();
    }
  });

  it("keeps tags free of duplicates", () => {
    for (const [key, row] of Object.entries(FILE.places)) {
      expect(new Set(row.tags).size, `${key} repeats a tag`).toBe(row.tags.length);
    }
  });
});

describe("district profiles", () => {
  it("names who actually comes, in the atlas's own words", () => {
    // Not invented: every district prints its own security provider, and the
    // joke in Rancho Coronado's is the publisher's rather than ours.
    expect(districtProfile("exec_zone")?.response.who).toBe("Lazarus");
    expect(districtProfile("rancho_coronado")?.response.who).toBe("NCPD (in theory)");
    expect(districtProfile("santo_domingo")?.response.who).toBe("Aldecaldo Peacekeepers");
  });

  it("resolves by printed code as well as by key", () => {
    expect(districtProfile("X")?.key).toBe("rancho_coronado");
    expect(districtProfile("rancho_coronado")?.key).toBe("rancho_coronado");
  });

  it("uses a response tier from the closed list, with sane numbers", () => {
    for (const district of DISTRICTS) {
      const profile = districtProfile(district.key);
      expect(profile, district.key).toBeDefined();
      expect(isResponseTier(profile!.response.tier), district.key).toBe(true);
      expect(profile!.response.heat).toBeGreaterThanOrEqual(0);
      expect(profile!.response.minutes).toBeGreaterThanOrEqual(0);
    }
    expect(Object.keys(FILE.responseTiers).sort()).toEqual([...RESPONSE_TIERS].sort());
  });

  it("makes noise cost different amounts in different districts", () => {
    // The whole point of the tier. If these ever converge, being somewhere has
    // stopped meaning anything for pressure.
    expect(heatMultiplier("exec_zone")).toBeGreaterThan(heatMultiplier("rancho_coronado"));
    expect(heatMultiplier("rancho_coronado")).toBe(0);
    expect(heatMultiplier("little_europe")).toBe(1);
  });

  it("falls back to the ordinary city for somewhere it has never heard of", () => {
    expect(districtProfile("atlantis")).toBeUndefined();
    expect(heatMultiplier("atlantis")).toBe(1);
  });

  it("carries the atlas's gangs and combat zones through unchanged", () => {
    // Deliberately compared against isCombatZone rather than against a list of
    // districts: there is one source of truth for what a combat zone is, and it
    // is not this file. (That predicate currently disagrees with the atlas in
    // both directions — see the note in the pull request — and this profile is
    // meant to inherit the fix rather than to route around it.)
    for (const district of DISTRICTS) {
      expect(districtProfile(district.key)?.combatZone, district.key).toBe(
        isCombatZone(district.key),
      );
    }
    expect(districtProfile("rancho_coronado")?.gangs).toContain("Albino Alligators");
  });
});

describe("finding ground by what is on it", () => {
  it("files each location under the district it is in", () => {
    expect(placeProfile("x5")?.districtKey).toBe("rancho_coronado");
    expect(placeProfile("a1")?.districtKey).toBe("little_europe");
  });

  it("answers what is here without anybody authoring a venue for it", () => {
    // The lookup the rest of the feature is built on: a beat asks for ground,
    // not for a location key.
    const bars = placesWithTag("bar");
    expect(bars.length).toBeGreaterThan(10);
    expect(bars.every((p) => p.tags.includes("bar"))).toBe(true);
  });

  it("narrows to one district when asked", () => {
    const local = placesWithTag("market", "rancho_coronado");
    expect(local.map((p) => p.key)).toEqual(["x5"]);
    expect(placesWithTag("market", "atlantis")).toEqual([]);
  });

  it("knows which districts have a kind of place at all", () => {
    const keys = districtsWithTag("ripperdoc").map((d) => d.key);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("says nothing about a place the atlas does not have", () => {
    expect(placeProfile("zz9")).toBeUndefined();
    expect(tagsOf("zz9")).toEqual([]);
    expect(hasTag("zz9", "bar")).toBe(false);
  });
});

describe("where a fight would happen", () => {
  it("only ever names an arena the battlefield has", () => {
    for (const place of ATLAS_PLACES) {
      expect(ARENA_KEYS, `${place.key} ${place.name}`).toContain(arenaForPlace(place.key));
    }
    for (const [, arena] of FILE.arenaByTag) {
      expect(ARENA_KEYS, `${arena} is mapped but does not exist`).toContain(arena);
    }
  });

  it("picks the ground a place actually is", () => {
    expect(arenaForPlace("x1")).toBe("parking_structure"); // the carwash
    expect(arenaForPlace("x5")).toBe("street"); // the market in the dead mall
    expect(arenaForPlace("b1")).toBe("club_interior"); // the Afterlife
  });

  it("falls back to open ground rather than guessing", () => {
    expect(arenaForPlace("zz9")).toBe(DEFAULT_ARENA_KEY);
  });
});
