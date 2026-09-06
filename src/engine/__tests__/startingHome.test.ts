import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  EMPTY_LIFESTYLE,
  HOME_CATEGORIES,
  HOME_SUGGESTIONS_ARE_HOUSE_RULE,
  STARTING_LOCATIONS,
  districtOfPlace,
  districtsInCategory,
  everyStartingHome,
  execHomes,
  getDistrict,
  getPlace,
  hasTag,
  homeIsInCategory,
  homePreview,
  homesIn,
  isCombatZone,
  startingLifestylePlan,
  startingPositionFor,
  suggestedHome,
  suggestedHomeIn,
  validateStartingHome,
  type LifestyleChoice,
} from "@/engine";
import lifepath from "@/data/rules/lifepath-general.json";
import suggestionFile from "@/data/atlas/home-suggestions.json";

const CHILDHOOD: string[] = (
  lifepath as unknown as {
    tables: { childhood_environment: { entries: { value: string }[] } };
  }
).tables.childhood_environment.entries.map((e) => e.value);

const SUGGESTIONS = (
  suggestionFile as unknown as { suggestions: { startsWith: string; districts: string[] }[] }
).suggestions;

/** A complete, valid choice, so a test can vary one field at a time. */
function choiceAt(placeKey: string, category: string | null): LifestyleChoice {
  return {
    location: category,
    districtKey: districtOfPlace(placeKey)?.key ?? null,
    placeKey,
  };
}

describe("the printed choice is still the printed choice", () => {
  it("offers exactly the categories the rules file prints, and no others", () => {
    // The whole point of the module is that it adds an address, not an option.
    // If this ever diverges from lifestyle.ts, somebody has invented a place to
    // live that Cyberpunk RED does not print.
    expect(HOME_CATEGORIES).toEqual(STARTING_LOCATIONS);
    expect(HOME_CATEGORIES).toHaveLength(2);
  });

  it("never charges a different rent for a different address", () => {
    // There is one printed number for a Cargo Container. An address that cost
    // more would be a house rule wearing a location's clothes.
    const plan = startingLifestylePlan(null);
    for (const home of everyStartingHome()) {
      expect(startingLifestylePlan(null).rent, home.name).toBe(plan.rent);
    }
  });
});

describe("which ground each category offers", () => {
  it("gives both categories somewhere to live", () => {
    for (const category of HOME_CATEGORIES) {
      expect(districtsInCategory(category).length, category).toBeGreaterThan(0);
    }
  });

  it("only ever offers a district that has somewhere to put a container", () => {
    // The filter that means nobody has to maintain a list of places a thousand
    // eurobucks does not reach. The Executive Zone and Charter Hill are in the
    // suburbs by area and have no container housing, so they are not offered.
    for (const category of HOME_CATEGORIES) {
      for (const district of districtsInCategory(category)) {
        expect(homesIn(district.key).length, `${district.name} in ${category}`).toBeGreaterThan(0);
      }
    }
    const suburbs = districtsInCategory("Overcrowded Suburbs").map((d) => d.key);
    expect(suburbs).not.toContain("exec_zone");
    expect(suburbs).not.toContain("charter_hill");
  });

  it("only ever offers a building that is actually container housing", () => {
    for (const home of everyStartingHome()) {
      expect(hasTag(home.key, "container_housing"), home.name).toBe(true);
    }
  });

  it("keeps the Combat Zone to districts the engine calls one", () => {
    // Read off isCombatZone rather than a list here, so the two cannot drift.
    for (const district of districtsInCategory("Combat Zone")) {
      expect(isCombatZone(district.key), district.name).toBe(true);
    }
  });

  it("lets a district belong to both, because some do", () => {
    // New Westbrook is a combat zone AND mainland sprawl. A place that had to
    // be one or the other would have to lie about one of them.
    const both = DISTRICTS.filter(
      (d) =>
        districtsInCategory("Combat Zone").some((x) => x.key === d.key) &&
        districtsInCategory("Overcrowded Suburbs").some((x) => x.key === d.key),
    );
    expect(both.length).toBeGreaterThan(0);
    for (const d of both) {
      for (const home of homesIn(d.key)) {
        expect(homeIsInCategory(home.key, "Combat Zone")).toBe(true);
        expect(homeIsInCategory(home.key, "Overcrowded Suburbs")).toBe(true);
      }
    }
  });

  it("does not offer an address under a category it does not belong to", () => {
    const suburbOnly = districtsInCategory("Overcrowded Suburbs")
      .filter((d) => !isCombatZone(d.key))
      .flatMap((d) => homesIn(d.key));
    expect(suburbOnly.length).toBeGreaterThan(0);
    for (const home of suburbOnly) {
      expect(homeIsInCategory(home.key, "Combat Zone"), home.name).toBe(false);
    }
  });

  it("says nothing at all for a category the rules do not print", () => {
    expect(districtsInCategory("Corpo Plaza")).toEqual([]);
    expect(homeIsInCategory("x3", "Corpo Plaza")).toBe(false);
  });
});

describe("the Exec, who is given somewhere", () => {
  it("has somewhere to be given, or that Role cannot finish creation", () => {
    // The address is required of everybody. An Exec is not asked for a printed
    // category — so if this list were ever empty, the one Role that gets free
    // housing would be the one Role that could not be created.
    expect(execHomes().length).toBeGreaterThan(0);
    expect(startingLifestylePlan("exec").requiresLocation).toBe(false);
  });

  it("is only offered housing a corporation actually owns", () => {
    for (const home of execHomes()) {
      expect(hasTag(home.key, "corp_housing"), home.name).toBe(true);
    }
  });

  it("is not offered housing above the rank they start at", () => {
    // Teamwork Rank 2 grants a Corporate Conapt. The gated duplexes and the
    // Beaverville houses arrive at Rank 7, and every character starts at 4.
    for (const home of execHomes()) {
      expect(hasTag(home.key, "luxury_housing"), `${home.name} is above a conapt`).toBe(false);
    }
  });
});

describe("what an address would mean", () => {
  it("previews every address the step can offer", () => {
    for (const home of [...everyStartingHome(), ...execHomes()]) {
      const preview = homePreview(home.key);
      expect(preview, home.name).not.toBeNull();
      expect(preview!.districtName, home.name).toBeTruthy();
      expect(preview!.ifItGoesLoud, home.name).toBeTruthy();
      expect(preview!.nearby.length, `${home.name} has nothing to do near it`).toBeGreaterThan(0);
    }
  });

  it("only ever names venues in the district the home is in", () => {
    for (const home of everyStartingHome()) {
      const preview = homePreview(home.key)!;
      for (const near of preview.nearby) {
        const place = DISTRICTS.find((d) => d.key === preview.districtKey)!.locations.find(
          (l) => l.name === near.placeName,
        );
        expect(place, `${near.placeName} is not in ${preview.districtName}`).toBeDefined();
      }
    }
  });

  it("describes the neighbourhood rather than the building you are standing in", () => {
    // placeActions puts wherever you are standing first and in full, which is
    // right when you are standing in it and wrong here: the first cut of this
    // panel told a player living in Eagle Rock Stadium that within walking
    // distance they could ask around at Eagle Rock Stadium, look in on the
    // neighbours at Eagle Rock Stadium, and see what's on at Eagle Rock Stadium.
    for (const home of [...everyStartingHome(), ...execHomes()]) {
      const preview = homePreview(home.key)!;
      const venues = preview.nearby.map((n) => n.placeName);
      expect(venues, `${home.name} lists itself`).not.toContain(preview.placeName);
      expect(new Set(venues).size, `${home.name} names one venue twice`).toBe(venues.length);
      expect(venues.length, `${home.name} has nothing around it`).toBeGreaterThan(0);
    }
  });

  it("gives the choice something to actually be a choice about", () => {
    // The container costs the same everywhere, so if every address answered the
    // same way there would be no decision here at all. Rancho Coronado is
    // unpoliced; New Westbrook has NCPD on it before you finish.
    const quiet = homePreview("x3")!;
    const watched = homePreview("p8")!;
    expect(quiet.ifItGoesLoud).not.toBe(watched.ifItGoesLoud);
    const answers = new Set(everyStartingHome().map((h) => homePreview(h.key)!.ifItGoesLoud));
    expect(answers.size).toBeGreaterThan(1);
  });

  it("says nothing about somewhere the atlas does not have", () => {
    expect(homePreview("zz9")).toBeNull();
  });
});

describe("what the Lifepath already said", () => {
  it("is a house rule, and says it may not restrict anything", () => {
    expect(HOME_SUGGESTIONS_ARE_HOUSE_RULE).toBe(true);
  });

  it("has an answer for every printed Childhood Environment", () => {
    // The table is ten entries. A new one added to the rules data without a
    // line here would quietly stop suggesting anything.
    for (const entry of CHILDHOOD) {
      expect(suggestedHome(entry), entry.slice(0, 40)).not.toBeNull();
    }
  });

  it("names only districts that are really on the map", () => {
    for (const row of SUGGESTIONS) {
      for (const key of row.districts) {
        expect(getDistrict(key), `${row.startsWith} names ${key}`).toBeDefined();
      }
    }
  });

  it("matches each printed entry exactly once", () => {
    // Matched on opening words, so two rows that both matched an entry would
    // make which suggestion appears depend on file order.
    for (const entry of CHILDHOOD) {
      const hits = SUGGESTIONS.filter((s) => entry.startsWith(s.startsWith));
      expect(hits.length, entry.slice(0, 40)).toBe(1);
    }
  });

  it("suggests and never restricts", () => {
    // The load-bearing test for the whole feature. Whatever a character's
    // childhood was, every address stays exactly as choosable as it was.
    for (const entry of CHILDHOOD) {
      for (const category of HOME_CATEGORIES) {
        const offered = districtsInCategory(category);
        expect(offered.length, category).toBeGreaterThan(0);
        const suggestion = suggestedHomeIn(entry, category);
        if (!suggestion) continue;
        for (const key of suggestion.districts) {
          expect(
            offered.some((d) => d.key === key),
            `${key} suggested but not offered`,
          ).toBe(true);
        }
      }
    }
  });

  it("stays quiet rather than pointing somewhere you cannot go", () => {
    // A childhood in a corporate starscraper points at Charter Hill, which has
    // nowhere to put a container. Saying nothing beats highlighting a district
    // the player cannot pick.
    const starscraper = CHILDHOOD.find((e) => e.includes("starscraper"))!;
    expect(suggestedHome(starscraper)!.districts).toContain("charter_hill");
    for (const category of HOME_CATEGORIES) {
      const narrowed = suggestedHomeIn(starscraper, category);
      expect(narrowed?.districts ?? []).not.toContain("charter_hill");
    }
  });

  it("says nothing for a character who has not answered", () => {
    expect(suggestedHome(null)).toBeNull();
    expect(suggestedHome("")).toBeNull();
    expect(suggestedHome("Raised by wolves.")).toBeNull();
  });
});

describe("holding a saved choice to the map", () => {
  it("accepts a complete, real choice", () => {
    expect(validateStartingHome(choiceAt("x3", "Overcrowded Suburbs"))).toEqual([]);
    expect(validateStartingHome(choiceAt("m1", null), "exec")).toEqual([]);
  });

  it("rejects an address that is not in the category it was filed under", () => {
    // Eagle Rock Stadium is a suburb, not a combat zone.
    expect(validateStartingHome(choiceAt("x3", "Combat Zone"))).not.toEqual([]);
  });

  it("rejects a district and a building that disagree", () => {
    const wrong: LifestyleChoice = {
      location: "Overcrowded Suburbs",
      districtKey: "santo_domingo",
      placeKey: "x3",
    };
    expect(validateStartingHome(wrong)).not.toEqual([]);
  });

  it("rejects ground the atlas does not have", () => {
    expect(
      validateStartingHome({
        location: "Combat Zone",
        districtKey: "atlantis",
        placeKey: "zz9",
      }),
    ).not.toEqual([]);
  });

  it("does not let an Exec be housed by nobody", () => {
    // Chopper's is a bar. No corporation is putting its people up there.
    expect(validateStartingHome(choiceAt("a2", null), "exec")).not.toEqual([]);
  });
});

describe("where the campaign opens", () => {
  it("opens at the address the character chose", () => {
    // The fix this module exists for. The choice used to reach the character
    // sheet and the portrait prompt and nowhere else, so a player who picked
    // the Combat Zone woke up in Little Europe.
    expect(startingPositionFor(choiceAt("x3", "Overcrowded Suburbs"))).toBe("x3");
    expect(startingPositionFor(choiceAt("i6", "Combat Zone"))).toBe("i6");
    expect(startingPositionFor(choiceAt("m1", null), "exec")).toBe("m1");
  });

  it("resolves to somewhere the atlas can actually put a character", () => {
    for (const home of [...everyStartingHome(), ...execHomes()]) {
      const category = HOME_CATEGORIES.find((c) => homeIsInCategory(home.key, c)) ?? null;
      const roleId = category ? null : "exec";
      const key = startingPositionFor(choiceAt(home.key, category), roleId);
      expect(key, home.name).toBe(home.key);
      expect(getPlace(key!), home.name).toBeDefined();
    }
  });

  it("hands back nothing for a choice that is not finished or not real", () => {
    // The caller keeps its own default, which is what every character saved
    // before the address existed will go on using.
    expect(startingPositionFor(EMPTY_LIFESTYLE)).toBeNull();
    expect(
      startingPositionFor({ location: "Combat Zone", districtKey: null, placeKey: null }),
    ).toBeNull();
    expect(startingPositionFor(choiceAt("x3", "Combat Zone"))).toBeNull();
  });
});
