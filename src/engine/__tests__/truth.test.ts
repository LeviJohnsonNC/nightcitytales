import { describe, expect, it } from "vitest";
import truthFile from "@/data/atlas/place-truths.json";
import {
  DIFFICULTY_VALUES,
  DISTRICTS,
  PLACE_FLAGS,
  PLACE_TAGS,
  PLACE_TRUTHS_ARE_HOUSE_RULE,
  SKILLS,
  applyToPlace,
  findableBy,
  isSearchSkill,
  knownTruths,
  searchWith,
  startingState,
  truthKey,
  truthsAt,
  unknownTruths,
} from "@/engine";

const FILE = truthFile as unknown as {
  fromTags: { key: string; tags: string[]; skill: string; difficulty: string; fact: string }[];
  fromFlags: { key: string; flag: string; skill: string; difficulty: string; fact: string }[];
  fromNeeds: { key: string; needs: string[]; skill: string; difficulty: string; fact: string }[];
};

/** Every place in the city, so an invariant can be swept rather than sampled. */
const EVERY_PLACE = DISTRICTS.flatMap((d) => d.locations);

describe("the truth templates", () => {
  it("are a house rule, tunable in data", () => {
    expect(PLACE_TRUTHS_ARE_HOUSE_RULE).toBe(true);
  });

  it("only hang off tags and flags the city actually has", () => {
    // A template keyed to something nobody applied is a promise the atlas
    // cannot keep: it would silently never fire.
    for (const template of FILE.fromTags) {
      for (const tag of template.tags) expect(PLACE_TAGS, tag).toContain(tag);
    }
    for (const template of FILE.fromFlags) {
      expect(PLACE_FLAGS, template.flag).toContain(template.flag);
    }
  });

  it("name printed Skills and published difficulties, never invented ones", () => {
    const skillIds = new Set(SKILLS.map((s) => s.id));
    const bands = new Set(DIFFICULTY_VALUES.map((d) => d.name));
    for (const template of [...FILE.fromTags, ...FILE.fromFlags, ...FILE.fromNeeds]) {
      expect(skillIds, template.key).toContain(template.skill);
      expect(bands, template.key).toContain(template.difficulty);
    }
  });

  it("has a unique key per template", () => {
    const keys = [...FILE.fromTags, ...FILE.fromFlags, ...FILE.fromNeeds].map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("what is true at a place", () => {
  it("says nothing about somewhere the atlas does not have", () => {
    expect(truthsAt("zz9")).toEqual([]);
  });

  it("derives from tags, so a good part of the city has something to find", () => {
    const withSomething = EVERY_PLACE.filter((p) => truthsAt(p.key).length > 0);
    // Nothing is authored per location: this is 8 templates reaching the city.
    expect(withSomething.length).toBeGreaterThan(50);
    // And plenty has nothing, which is the point — see the "nothing" outcome.
    expect(withSomething.length).toBeLessThan(EVERY_PLACE.length);
  });

  it("never leaves a template placeholder in a fact", () => {
    for (const place of EVERY_PLACE) {
      for (const truth of truthsAt(place.key)) {
        expect(truth.fact, truth.key).not.toContain("{place}");
        expect(truth.fact, truth.key).toContain(place.name);
      }
    }
  });

  it("gives every truth a stable, unique key", () => {
    for (const place of EVERY_PLACE) {
      const truths = truthsAt(place.key);
      const keys = truths.map((t) => t.key);
      expect(new Set(keys).size, place.name).toBe(keys.length);
      // Stable across calls: a stored discovery must still name this truth.
      expect(truthsAt(place.key).map((t) => t.key)).toEqual(keys);
    }
  });

  it("prices every truth at a published Difficulty Value", () => {
    const printed = new Set(DIFFICULTY_VALUES.map((d) => d.dv));
    for (const place of EVERY_PLACE) {
      for (const truth of truthsAt(place.key)) {
        expect(printed, `${truth.key} DV ${truth.found.dv}`).toContain(truth.found.dv);
      }
    }
  });

  it("adds a flag truth only once the campaign has caused it", () => {
    // x5 is a market. Nobody is taking a cut until somebody is.
    const before = truthsAt("x5").map((t) => t.key);
    expect(before.some((k) => k.endsWith("paying_someone"))).toBe(false);

    let state = startingState("x5");
    for (let i = 0; i < 8; i += 1) state = applyToPlace(state, ["burned"]).state;
    expect(state.flags).toContain("gang_extortion");

    const after = truthsAt("x5", state).map((t) => t.key);
    expect(after).toContain(truthKey({ kind: "place", key: "x5" }, "paying_someone"));
    // The tag-derived ones are still there: a flag adds, it does not replace.
    for (const key of before) expect(after).toContain(key);
  });
});

describe("what the character knows", () => {
  const truths = truthsAt(
    "x5",
    (() => {
      let state = startingState("x5");
      for (let i = 0; i < 8; i += 1) state = applyToPlace(state, ["burned"]).state;
      return state;
    })(),
  );

  it("is nothing at all before they have looked", () => {
    // The invariant the whole module exists for: with no discoveries, there is
    // nothing a prompt could be given.
    expect(knownTruths(truths, [])).toEqual([]);
    expect(unknownTruths(truths, [])).toEqual(truths);
  });

  it("partitions cleanly once they have found one", () => {
    const first = truths[0]!;
    expect(knownTruths(truths, [first.key])).toEqual([first]);
    expect(unknownTruths(truths, [first.key])).not.toContain(first);
    expect(
      knownTruths(truths, [first.key]).length + unknownTruths(truths, [first.key]).length,
    ).toBe(truths.length);
  });
});

describe("which Skills search at all", () => {
  it("is read off the templates, not a list kept beside them", () => {
    expect(isSearchSkill("perception")).toBe(true);
  });

  it("excludes a Skill that finds nothing anywhere", () => {
    // The guard that keeps a search outcome off a check that was not a search:
    // a successful Athletics roll must not report an empty room.
    for (const skillId of ["athletics", "brawling", "persuasion", "drive_land_vehicle"]) {
      expect(isSearchSkill(skillId), skillId).toBe(false);
    }
  });
});

describe("searching", () => {
  const truths = truthsAt(
    "x5",
    (() => {
      let state = startingState("x5");
      for (let i = 0; i < 8; i += 1) state = applyToPlace(state, ["burned"]).state;
      return state;
    })(),
  );
  const search = (total: number, discovered: string[] = [], skillId = "perception") =>
    searchWith({ truths, skillId, discovered, total });

  it("finds nothing for a Skill that finds nothing here", () => {
    expect(search(30, [], "brawling").outcome).toBe("nothing");
  });

  it("finds nothing once everything here has been found", () => {
    // And crucially this is "nothing", not "missed": there is no second safe.
    expect(
      search(
        30,
        truths.map((t) => t.key),
      ).outcome,
    ).toBe("nothing");
  });

  it("misses when there is something here the roll did not reach", () => {
    const result = search(1);
    expect(result.outcome).toBe("missed");
  });

  it("hands over the hardest truth the total actually beat", () => {
    // So a great roll is worth more than a bare pass, rather than handing over
    // whatever happened to be first in the file.
    const hardest = [...truths].sort((a, b) => b.found.dv - a.found.dv)[0]!;
    const result = search(hardest.found.dv);
    expect(result.outcome).toBe("found");
    if (result.outcome === "found") expect(result.truth.key).toBe(hardest.key);
  });

  it("never hands back something already discovered", () => {
    const first = search(30);
    expect(first.outcome).toBe("found");
    if (first.outcome !== "found") return;
    const second = search(30, [first.truth.key]);
    if (second.outcome === "found") expect(second.truth.key).not.toBe(first.truth.key);
  });

  it("holds a truth back until its prerequisites are discovered", () => {
    // Nothing declares `needs` today; the gate is the mechanism Deduction will
    // run on, so it is tested now rather than discovered to be missing later.
    const gated = [
      { ...truths[0]!, key: "place:x5::conclusion", needs: ["place:x5::not-found-yet"] },
    ];
    expect(findableBy(gated, "perception", [])).toEqual([]);
    expect(findableBy(gated, "perception", ["place:x5::not-found-yet"])).toHaveLength(1);
  });
});

/**
 * A conclusion about a place: what two facts already found here add up to. It
 * declares no tag of its own — what decides whether it exists here is whether
 * its prerequisites do, which is why it can never turn up somewhere its
 * evidence could not.
 */
describe("conclusions about a place", () => {
  it("only ever names prerequisites the templates actually have", () => {
    // The quiet failure this guards: a `needs` entry naming a template that
    // does not exist means the conclusion never appears anywhere, and nothing
    // in play shows why.
    const keys = new Set([...FILE.fromTags, ...FILE.fromFlags].map((t) => t.key));
    for (const template of FILE.fromNeeds) {
      expect(template.needs.length, template.key).toBeGreaterThan(1);
      for (const need of template.needs)
        expect(keys, `${template.key} needs ${need}`).toContain(need);
    }
  });

  /**
   * A template whose prerequisites never co-occur anywhere in the city is dead
   * content: it reads like a system and fires for nobody. Two of my first three
   * were exactly that (a fence that is also `secure` does not exist in this
   * atlas), which is why this is a test and not a code comment.
   */
  it("earns its keep somewhere in the city", () => {
    const reach: Record<string, number> = {};
    for (const place of EVERY_PLACE) {
      for (const truth of truthsAt(place.key)) {
        if (truth.found.skillId !== "deduction") continue;
        const id = truth.key.slice(truth.key.lastIndexOf("::") + 2);
        reach[id] = (reach[id] ?? 0) + 1;
      }
    }
    // Flag-driven conclusions cannot appear until a campaign has done
    // something to a place, so they are exempt from the tag-only sweep.
    const flagKeys = new Set(FILE.fromFlags.map((t) => t.key));
    for (const template of FILE.fromNeeds) {
      if (template.needs.some((need) => flagKeys.has(need))) continue;
      expect(reach[template.key] ?? 0, `${template.key} fires nowhere`).toBeGreaterThan(0);
    }
  });

  it("exists only where everything it rests on exists", () => {
    for (const place of EVERY_PLACE) {
      const truths = truthsAt(place.key);
      const keys = new Set(truths.map((t) => t.key));
      for (const truth of truths) {
        for (const need of truth.needs) expect(keys, `${place.key}: ${truth.key}`).toContain(need);
      }
    }
  });

  it("is shut until the pieces are in hand, then reachable", () => {
    // A transfer point: the quiet way in AND the stock that is not on the
    // paperwork. One of the two is not enough, at any total.
    const place = EVERY_PLACE.find((p) =>
      truthsAt(p.key).some((t) => t.key.endsWith("::transfer_point")),
    )!;
    const truths = truthsAt(place.key);
    const conclusion = truths.find((t) => t.key.endsWith("::transfer_point"))!;
    expect(conclusion.needs).toHaveLength(2);

    expect(findableBy(truths, "deduction", [])).toHaveLength(0);
    expect(findableBy(truths, "deduction", conclusion.needs.slice(0, 1))).toHaveLength(0);
    expect(searchWith({ truths, skillId: "deduction", discovered: [], total: 99 })).toEqual({
      outcome: "nothing",
    });

    const ready = [...conclusion.needs];
    expect(findableBy(truths, "deduction", ready).map((t) => t.key)).toEqual([conclusion.key]);
    expect(
      searchWith({ truths, skillId: "deduction", discovered: ready, total: conclusion.found.dv }),
    ).toMatchObject({ outcome: "found", truth: { key: conclusion.key } });
    expect(
      searchWith({
        truths,
        skillId: "deduction",
        discovered: ready,
        total: conclusion.found.dv - 1,
      }),
    ).toEqual({ outcome: "missed" });
  });

  it("makes Deduction a Skill that searches, without widening the others", () => {
    expect(isSearchSkill("deduction")).toBe(true);
    expect(isSearchSkill("athletics")).toBe(false);
  });
});
