/**
 * The inversion: who is in a room is settled before the narrator writes, and a
 * face it is TOLD about is never replaced by one it would have preferred.
 */
import { describe, expect, it } from "vitest";
import PLACES from "@/data/cast/walkon-places.json";
import GAMEPLAY from "@/data/atlas/places.gameplay.json";
import { shopsAt, tagsOf } from "@/engine";
import { MAX_ALSO_HERE, alsoHereLines, ambientPeople, ambientSubjectsAt } from "../ambientPeople";
import { FLAVOR_SUBJECTS, flavorGenders } from "../flavorArt";
import { resolveWalkOns } from "../walkOnMention";

const SELLERS = new Set<string>(PLACES.sellers);
const placeKeys = Object.keys(GAMEPLAY.places);
const barKey = placeKeys.find((k) => tagsOf(k).includes("bar") && shopsAt(k).length === 0)!;

describe("walkon-places.json", () => {
  it("only names tags that are real place tags", () => {
    for (const tag of Object.keys(PLACES.tags)) expect(GAMEPLAY.tags, tag).toHaveProperty(tag);
  });

  it("only names roles that have art", () => {
    const subjects = new Set(FLAVOR_SUBJECTS);
    for (const roles of Object.values(PLACES.tags))
      for (const role of roles) expect(subjects.has(role), role).toBe(true);
  });

  it("gives every role a noun a sentence would use for them", () => {
    const nouns = PLACES.nouns as Record<string, string[]>;
    for (const subject of FLAVOR_SUBJECTS)
      expect(nouns[subject]?.length, subject).toBeGreaterThan(0);
  });

  it("lets every role with art stand somewhere", () => {
    const reachable = new Set(Object.values(PLACES.tags).flat());
    for (const subject of FLAVOR_SUBJECTS) expect(reachable.has(subject), subject).toBe(true);
  });
});

describe("ambientPeople", () => {
  it("puts a bartender in a bar and tells the narrator how they read", () => {
    const people = ambientPeople(barKey, "c1:" + barKey, false);
    expect(people.map((p) => p.subject)).toContain("dive-bar-tender");
    const lines = alsoHereLines(people).join(" ");
    expect(lines).toMatch(/"dive-bar-tender" \(Dive Bar Tender\): (man|woman), /);
    expect(lines).not.toMatch(/\d/);
  });

  it("is the same people, with the same faces, every time", () => {
    const a = ambientPeople(barKey, "c1:x", false);
    expect(ambientPeople(barKey, "c1:x", false)).toEqual(a);
  });

  it("is never more than a room's worth", () => {
    for (const key of placeKeys) {
      expect(ambientSubjectsAt(key, `c:${key}`, false).length).toBeLessThanOrEqual(MAX_ALSO_HERE);
    }
  });

  it("leaves the counter to a named keeper rather than inventing a second clerk", () => {
    const shopKey = placeKeys.find((k) => tagsOf(k).includes("shop") && shopsAt(k).length > 0)!;
    for (const key of [shopKey]) {
      for (const s of ambientSubjectsAt(key, `c:${key}`, true))
        expect(SELLERS.has(s), s).toBe(false);
    }
  });

  it("offers a gender the art has, and never a role without art", () => {
    for (const key of placeKeys) {
      for (const p of ambientPeople(key, `c:${key}`, false))
        expect(flavorGenders(p.subject)).toContain(p.gender);
    }
  });

  it("says nothing for a place with none of the roles", () => {
    expect(ambientPeople("not-a-place", "c:x", false)).toEqual([]);
  });
});

describe("resolveWalkOns with a face already told", () => {
  const seed = "c1:" + barKey;
  const told = ambientSubjectsAt(barKey, seed, false);
  const bartender = ambientPeople(barKey, seed, false).find(
    (p) => p.subject === "dive-bar-tender",
  )!;
  const other = bartender.gender === "male" ? "female" : "male";

  it("ignores the gender the narrator asked for on somebody it was told about", () => {
    const out = resolveWalkOns([{ subject: "dive-bar-tender", gender: other }], seed, told);
    expect(out).toEqual([{ subject: "dive-bar-tender", gender: bartender.gender }]);
  });

  it("still honours a request for a role nobody told it about", () => {
    const out = resolveWalkOns([{ subject: "av-cab-driver", gender: "female" }], seed, told);
    expect(out).toEqual([{ subject: "av-cab-driver", gender: "female" }]);
  });

  it("is unchanged when nothing was told", () => {
    const out = resolveWalkOns([{ subject: "dive-bar-tender", gender: "female" }], seed);
    expect(out).toEqual([{ subject: "dive-bar-tender", gender: "female" }]);
  });
});
