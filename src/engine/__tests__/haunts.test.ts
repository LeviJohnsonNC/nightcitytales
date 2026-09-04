import { describe, expect, it } from "vitest";
import {
  CAST_ROLES,
  DISTRICTS,
  HAUNT_PRESENCE,
  HAUNT_TAGS,
  MAX_HAUNTS,
  MAX_PERSON_SIGNALS,
  districtOfPlace,
  districtsHosting,
  getPlace,
  hauntsFor,
  isAtHaunt,
  isPlaceTag,
  peopleAtHaunts,
  placeSignals,
  tagsOf,
  whoIsAt,
  type CastRole,
  type HauntPerson,
} from "@/engine";

const SEED = "campaign-1";
const HOME = "little_europe";
const EVENING = 21 * 60;
const DAWN = 4 * 60;

function cast(seed = SEED, home = HOME): HauntPerson[] {
  return CAST_ROLES.map((role) => ({
    key: role,
    name: role.replace(/_/g, " "),
    role,
    haunts: hauntsFor(role, home, seed),
  }));
}

describe("where the six keep", () => {
  it("wants ground the city actually has", () => {
    for (const role of CAST_ROLES) {
      expect(HAUNT_TAGS[role].length, role).toBeGreaterThan(0);
      for (const tag of HAUNT_TAGS[role]) {
        expect(isPlaceTag(tag), `${role} wants "${tag}", which is not a tag`).toBe(true);
      }
      expect(districtsHosting(role).length, `nowhere in the city suits a ${role}`).toBeGreaterThan(
        0,
      );
    }
  });

  it("gives everybody somewhere, from anywhere they might start", () => {
    // A person with no address is a person you can never run into, which is the
    // whole thing this exists to prevent.
    for (const district of DISTRICTS) {
      if (!district.locations.length) continue;
      for (const role of CAST_ROLES) {
        const haunts = hauntsFor(role, district.key, SEED);
        expect(haunts.length, `${role} starting from ${district.key}`).toBeGreaterThan(0);
        expect(haunts.length).toBeLessThanOrEqual(MAX_HAUNTS);
        for (const key of haunts) expect(getPlace(key), key).toBeDefined();
      }
    }
  });

  it("keeps ground that suits the person", () => {
    for (const role of CAST_ROLES) {
      for (const key of hauntsFor(role, HOME, SEED)) {
        const tags = tagsOf(key);
        expect(
          HAUNT_TAGS[role].some((tag) => tags.includes(tag)),
          `${role} keeps ${key}, which is ${tags.join("/")}`,
        ).toBe(true);
      }
    }
  });

  it("puts people in the part of town the character lives in", () => {
    // A cast you can only meet by crossing the city is a cast you never meet.
    const local = cast().filter((p) => p.haunts.some((h) => districtOfPlace(h)?.key === HOME));
    expect(local.length).toBeGreaterThanOrEqual(CAST_ROLES.length - 1);
  });

  it("never doubles a place up for one person", () => {
    for (const person of cast()) {
      expect(new Set(person.haunts).size, person.role).toBe(person.haunts.length);
    }
  });

  it("gives two campaigns a different set", () => {
    expect(cast("campaign-1").map((p) => p.haunts.join())).not.toEqual(
      cast("campaign-2").map((p) => p.haunts.join()),
    );
  });

  it("answers the same way every time it is asked", () => {
    expect(hauntsFor("fixer", HOME, SEED)).toEqual(hauntsFor("fixer", HOME, SEED));
  });
});

describe("whether they are in", () => {
  it("says no for a place they do not keep", () => {
    const [fixer] = cast();
    expect(isAtHaunt({ person: fixer!, placeKey: "x5", day: 3, minute: EVENING, seed: SEED })).toBe(
      false,
    );
  });

  it("says no at an hour they are never there", () => {
    // A landlord is not in the lobby at four in the morning.
    const landlord = cast().find((p) => p.role === "landlord")!;
    expect(HAUNT_PRESENCE.landlord["night"]).toBeUndefined();
    for (let day = 0; day < 30; day += 1) {
      expect(
        isAtHaunt({
          person: landlord,
          placeKey: landlord.haunts[0]!,
          day,
          minute: DAWN,
          seed: SEED,
        }),
        `day ${day}`,
      ).toBe(false);
    }
  });

  it("is worth going to look, without being a certainty", () => {
    // The number that makes a haunt a haunt. Too low and the place is useless;
    // too high and the person is furniture.
    const fixer = cast().find((p) => p.role === "fixer")!;
    let inTonight = 0;
    for (let day = 0; day < 200; day += 1) {
      if (
        isAtHaunt({ person: fixer, placeKey: fixer.haunts[0]!, day, minute: EVENING, seed: SEED })
      ) {
        inTonight += 1;
      }
    }
    expect(inTonight).toBeGreaterThan(200 * 0.5);
    expect(inTonight).toBeLessThan(200 * 0.9);
  });

  it("gives the same answer across a whole part of the day", () => {
    // Asked at nine and again at ten, it is the same evening and the same
    // answer — otherwise somebody blinks in and out while the player reads.
    const fixer = cast().find((p) => p.role === "fixer")!;
    const at = (minute: number) =>
      isAtHaunt({ person: fixer, placeKey: fixer.haunts[0]!, day: 5, minute, seed: SEED });
    expect(at(19 * 60)).toBe(at(22 * 60));
  });
});

describe("running into somebody", () => {
  it("is one person, never a room full", () => {
    for (let day = 0; day < 120; day += 1) {
      for (const place of DISTRICTS.flatMap((d) => d.locations)) {
        const met = whoIsAt({
          placeKey: place.key,
          people: cast(),
          day,
          minute: EVENING,
          seed: SEED,
        });
        expect(met === null || typeof met.name === "string").toBe(true);
      }
    }
  });

  it("only ever names somebody who keeps the place", () => {
    for (let day = 0; day < 60; day += 1) {
      for (const place of DISTRICTS.flatMap((d) => d.locations)) {
        const met = whoIsAt({
          placeKey: place.key,
          people: cast(),
          day,
          minute: EVENING,
          seed: SEED,
        });
        if (met) expect(met.haunts).toContain(place.key);
      }
    }
  });

  it("agrees with itself about the same evening", () => {
    const people = cast();
    const once = whoIsAt({
      placeKey: people[0]!.haunts[0]!,
      people,
      day: 9,
      minute: EVENING,
      seed: SEED,
    });
    const twice = whoIsAt({
      placeKey: people[0]!.haunts[0]!,
      people,
      day: 9,
      minute: EVENING,
      seed: SEED,
    });
    expect(once).toEqual(twice);
  });
});

describe("what the map is allowed to say about people", () => {
  it("lists each person at one place at most", () => {
    for (let day = 0; day < 60; day += 1) {
      const out = peopleAtHaunts({ people: cast(), day, minute: EVENING, seed: SEED });
      const names = out.map((p) => p.name);
      expect(new Set(names).size, `day ${day}`).toBe(names.length);
    }
  });

  it("lights at most one face on the whole map", () => {
    // Presence is deliberately reliable, so six people with haunts means
    // somebody is findable almost every evening. One pin is a hint about where
    // a friend drinks. Six is a staff roster.
    for (let day = 0; day < 60; day += 1) {
      const signals = placeSignals({
        situations: [],
        peopleAt: peopleAtHaunts({ people: cast(), day, minute: EVENING, seed: SEED }),
      });
      expect(signals.filter((s) => s.kind === "person").length, `day ${day}`).toBeLessThanOrEqual(
        MAX_PERSON_SIGNALS,
      );
    }
  });

  it("loses to something actually happening", () => {
    // A face in a bar is a nice thing to know. A situation is a thing that
    // wants something from you, and it takes the pin.
    const signals = placeSignals({
      situations: [
        {
          key: "place_x5_night_market",
          category: "opportunity",
          title: "Night market tonight",
          summary: "…",
          status: "live",
          severity: 4,
          data: { placeKey: "x5" },
        },
      ],
      peopleAt: [{ name: "Razor", placeKey: "a2" }],
    });
    expect(signals[0]?.kind).not.toBe("person");
  });
});

describe("presence is not a summons", () => {
  it("carries nothing but a name and a place", () => {
    // The world tick owns people ACTING. This only ever says somebody is here,
    // so nothing here can become an errand, a warning or a favour asked.
    const out = peopleAtHaunts({ people: cast(), day: 4, minute: EVENING, seed: SEED });
    for (const entry of out) {
      expect(Object.keys(entry).sort()).toEqual(["name", "placeKey"]);
    }
  });

  it("says nothing about somebody with nowhere to be", () => {
    const nobody: HauntPerson[] = [
      { key: "ghost", name: "Ghost", role: "friend" as CastRole, haunts: [] },
    ];
    expect(peopleAtHaunts({ people: nobody, day: 1, minute: EVENING, seed: SEED })).toEqual([]);
    expect(
      whoIsAt({ placeKey: "a2", people: nobody, day: 1, minute: EVENING, seed: SEED }),
    ).toBeNull();
  });
});
