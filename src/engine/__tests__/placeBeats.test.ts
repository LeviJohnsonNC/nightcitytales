import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  LIFE_CATEGORIES,
  MAX_PLACE_BEATS,
  PLACE_BEATS,
  PLACE_BEATS_ARE_HOUSE_RULE,
  beatFitsHour,
  beatIsLive,
  derivePlaceBeats,
  districtsForBeat,
  getPlace,
  isPlaceBeatKey,
  mergeSituations,
  placeBeatKey,
  tagsOf,
  type LifeSituation,
} from "@/engine";

const SEED = "campaign-1";
const MORNING = 9 * 60;
const EVENING = 21 * 60;

/** Every day a beat is live at a place, across a fortnight. */
function liveDays(beatKey: string, placeKey: string, days = 60): number[] {
  const beat = PLACE_BEATS.find((b) => b.key === beatKey)!;
  return Array.from({ length: days }, (_, day) => day).filter((day) =>
    beatIsLive(beat, placeKey, day, SEED),
  );
}

/** What the ground offers on a given day in a district. */
function beatsOn(districtKey: string, day: number, minute = EVENING): LifeSituation[] {
  return derivePlaceBeats({ districtKey, day, minute, seed: SEED });
}

describe("the beats themselves", () => {
  it("are a house rule, tunable in data", () => {
    expect(PLACE_BEATS_ARE_HOUSE_RULE).toBe(true);
    expect(PLACE_BEATS.length).toBeGreaterThan(0);
  });

  it("are anchored to somewhere real: a location key, or a tag something carries", () => {
    for (const beat of PLACE_BEATS) {
      expect(
        beat.places?.length || beat.tags?.length,
        `${beat.key} is anchored to nothing`,
      ).toBeTruthy();
      for (const key of beat.places ?? []) {
        expect(
          getPlace(key),
          `${beat.key} names ${key}, which the atlas does not have`,
        ).toBeDefined();
      }
      expect(
        districtsForBeat(beat).length,
        `${beat.key} can never happen anywhere`,
      ).toBeGreaterThan(0);
    }
  });

  it("uses categories the Life engine already scores", () => {
    for (const beat of PLACE_BEATS) {
      expect(LIFE_CATEGORIES, beat.key).toContain(beat.category);
      expect(beat.severity).toBeGreaterThanOrEqual(1);
      expect(beat.severity).toBeLessThanOrEqual(5);
      expect(beat.everyDays).toBeGreaterThan(1);
    }
  });

  it("keeps its keys unique", () => {
    const keys = PLACE_BEATS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("reads as prose, not as a quest log", () => {
    // These are handed to the model to dress. A summary of four words gives it
    // nothing to work with and it fills the gap by inventing.
    for (const beat of PLACE_BEATS) {
      expect(beat.title.length, beat.key).toBeGreaterThan(10);
      expect(beat.summary.length, beat.key).toBeGreaterThan(40);
    }
  });
});

describe("when a beat is true", () => {
  it("is true sometimes and not most of the time", () => {
    const days = liveDays("water_truck", "x1", 90);
    expect(days.length).toBeGreaterThan(4);
    expect(days.length).toBeLessThan(20);
  });

  it("answers the same for the same day, every time it is asked", () => {
    // What lets a situation survive a reload rather than flickering off the
    // board halfway through an evening.
    for (const day of [0, 1, 7, 31, 200]) {
      expect(beatsOn("rancho_coronado", day)).toEqual(beatsOn("rancho_coronado", day));
    }
  });

  it("gives two campaigns different weeks", () => {
    // Per calendar, not per beat. A beat on a nine-day period has nine possible
    // offsets, so two campaigns sharing one beat's days is expected and
    // harmless; what would be wrong is two campaigns living the same month.
    const month = (seed: string) =>
      Array.from({ length: 30 }, (_, day) =>
        derivePlaceBeats({ districtKey: "rancho_coronado", day, minute: EVENING, seed })
          .map((s) => s.key)
          .join(","),
      );
    expect(month("campaign-1")).not.toEqual(month("campaign-2"));
  });

  it("does not run every beat on the same calendar", () => {
    // Two beats sharing a period would fire together forever, which reads as a
    // scripted day rather than as a place.
    expect(liveDays("water_truck", "x1", 90)).not.toEqual(liveDays("night_market", "x5", 90));
  });

  it("keeps a night market out of the morning", () => {
    const market = PLACE_BEATS.find((b) => b.key === "night_market")!;
    expect(beatFitsHour(market, MORNING)).toBe(false);
    expect(beatFitsHour(market, EVENING)).toBe(true);
    const water = PLACE_BEATS.find((b) => b.key === "water_truck")!;
    expect(beatFitsHour(water, MORNING)).toBe(true);
  });
});

describe("what the ground offers", () => {
  it("never offers more than the cap, anywhere, on any day", () => {
    // The whole argument against a quest board. Checked across the whole city
    // rather than one district, because a district full of bars is where this
    // would break first.
    for (const district of DISTRICTS) {
      for (let day = 0; day < 120; day += 1) {
        for (const minute of [MORNING, EVENING]) {
          const beats = beatsOn(district.key, day, minute);
          expect(beats.length, `${district.key} day ${day}`).toBeLessThanOrEqual(MAX_PLACE_BEATS);
        }
      }
    }
  });

  it("leaves plenty of evenings with nothing on them", () => {
    // Quiet is a result, not a content gap. If this ever fails, the city has
    // started doing something to the player every night.
    let quiet = 0;
    for (let day = 0; day < 120; day += 1) {
      if (!beatsOn("rancho_coronado", day).length) quiet += 1;
    }
    expect(quiet).toBeGreaterThan(30);
  });

  it("says nothing at all about a district that is not on the map", () => {
    expect(beatsOn("atlantis", 3)).toEqual([]);
  });

  it("only ever names a place that is in the district it is offered in", () => {
    for (const district of DISTRICTS) {
      const keys = new Set(district.locations.map((l) => l.key));
      for (let day = 0; day < 60; day += 1) {
        for (const beat of beatsOn(district.key, day)) {
          expect(keys, `${district.key} day ${day}`).toContain(beat.data?.["placeKey"]);
        }
      }
    }
  });

  it("marks whether the character is standing in it", () => {
    // The difference between narrating a thing in front of somebody and telling
    // them it is happening four streets away.
    const day = liveDays("night_market", "x5", 200)[0]!;
    const nearby = derivePlaceBeats({
      districtKey: "rancho_coronado",
      day,
      minute: EVENING,
      seed: SEED,
    });
    const inside = derivePlaceBeats({
      districtKey: "rancho_coronado",
      placeKey: "x5",
      day,
      minute: EVENING,
      seed: SEED,
    });
    const market = (list: LifeSituation[]) =>
      list.find((s) => s.key === placeBeatKey("x5", "night_market"));
    expect(market(nearby)?.data?.["atPlace"]).toBe(false);
    expect(market(inside)?.data?.["atPlace"]).toBe(true);
  });

  it("only offers a tag beat where the ground actually carries the tag", () => {
    for (const district of DISTRICTS) {
      for (let day = 0; day < 60; day += 1) {
        for (const situation of beatsOn(district.key, day)) {
          const placeKey = situation.data?.["placeKey"] as string;
          const beatKey = situation.data?.["beat"] as string;
          const beat = PLACE_BEATS.find((b) => b.key === beatKey)!;
          const named = beat.places?.includes(placeKey) ?? false;
          const tagged = (beat.tags ?? []).some((t) => tagsOf(placeKey).includes(t));
          expect(named || tagged, `${beatKey} fired at ${placeKey}`).toBe(true);
        }
      }
    }
  });
});

describe("standing somewhere is what makes it true", () => {
  it("gives different districts different situations on the same day", () => {
    // The acceptance test for the whole step. Same character, same day, same
    // money: what is in front of them depends on where they are standing.
    const seen = new Map<string, string[]>();
    for (const district of DISTRICTS) {
      for (let day = 0; day < 40; day += 1) {
        const keys = beatsOn(district.key, day).map((b) => b.key);
        if (keys.length) seen.set(`${district.key}:${day}`, keys);
      }
    }
    const rancho = [...seen].filter(([k]) => k.startsWith("rancho_coronado:"));
    const exec = [...seen].filter(([k]) => k.startsWith("charter_hill:"));
    expect(rancho.length).toBeGreaterThan(0);
    // Whatever both offer, they do not offer the same thing on the same day.
    for (const [key, keys] of rancho) {
      const day = key.split(":")[1];
      const other = exec.find(([k]) => k.endsWith(`:${day}`))?.[1] ?? [];
      expect(keys).not.toEqual(other);
    }
  });

  it("stops being true when the character walks away, and comes back later", () => {
    // A local situation is local. The merge resolves it when it is no longer
    // derived, and revives the same row rather than growing a second one.
    const day = liveDays("water_truck", "x1", 200)[0]!;
    const here = beatsOn("rancho_coronado", day, MORNING);
    expect(here.length).toBeGreaterThan(0);

    const persisted = mergeSituations([], here);
    expect(persisted.every((s) => s.status === "live")).toBe(true);

    // They travel to another district: nothing here derives those beats.
    const away = mergeSituations(persisted, beatsOn("the_glen", day, MORNING));
    for (const key of here.map((s) => s.key)) {
      expect(away.find((s) => s.key === key)?.status, key).toBe("resolved");
    }

    // And back again on a day it is true: the same row, live once more.
    const back = mergeSituations(away, here);
    expect(back.filter((s) => isPlaceBeatKey(s.key)).length).toBe(here.length);
    for (const key of here.map((s) => s.key)) {
      expect(back.find((s) => s.key === key)?.status, key).toBe("live");
    }
  });
});

describe("the same thing does not happen twice at once", () => {
  it("offers a beat at one place at a time", () => {
    // Half of North Heywood is container housing. Without this, "the water
    // pressure has gone again" is true at two addresses on the same evening.
    for (const district of DISTRICTS) {
      for (let day = 0; day < 120; day += 1) {
        const keys = beatsOn(district.key, day).map((s) => s.data?.["beat"]);
        expect(new Set(keys).size, `${district.key} day ${day}`).toBe(keys.length);
      }
    }
  });
});
