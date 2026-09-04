import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  OBSERVATIONS,
  PLACE_DIALS,
  PLACE_FLAGS,
  PLACE_OBSERVATION_EFFECTS,
  PLACE_STATE_IS_HOUSE_RULE,
  applyToPlace,
  beatAllowedAt,
  derivePlaceBeats,
  dialClocks,
  dialMeaning,
  dialsOf,
  flagMeaning,
  hasFlag,
  isPlaceDial,
  isPlaceFlag,
  recordVisit,
  segmentsOf,
  startingState,
  tagsOf,
  type Observation,
  type PlaceState,
} from "@/engine";

const SEED = "campaign-1";
const EVENING = 21 * 60;

/** Hit a place with the same observation until something gives. */
function hammer(state: PlaceState, observation: Observation, times: number): PlaceState {
  let current = state;
  for (let i = 0; i < times; i += 1) current = applyToPlace(current, [observation]).state;
  return current;
}

describe("what a place can be", () => {
  it("is a house rule, tunable in data", () => {
    expect(PLACE_STATE_IS_HOUSE_RULE).toBe(true);
  });

  it("explains every dial and every flag it defines", () => {
    for (const dial of PLACE_DIALS) {
      expect(isPlaceDial(dial)).toBe(true);
      expect(dialMeaning(dial), dial).toBeTruthy();
      expect(segmentsOf(dial), dial).toBeGreaterThan(0);
    }
    for (const flag of PLACE_FLAGS) {
      expect(isPlaceFlag(flag)).toBe(true);
      expect(flagMeaning(flag), flag).toBeTruthy();
    }
    expect(isPlaceFlag("on_fire")).toBe(false);
    expect(isPlaceDial("vibes")).toBe(false);
  });

  it("only moves dials from the closed observation vocabulary", () => {
    for (const observation of Object.keys(PLACE_OBSERVATION_EFFECTS)) {
      expect(OBSERVATIONS, observation).toContain(observation);
    }
    for (const effects of Object.values(PLACE_OBSERVATION_EFFECTS)) {
      for (const dial of Object.keys(effects ?? {})) {
        expect(isPlaceDial(dial), `${dial} is not a dial`).toBe(true);
      }
    }
  });

  it("gives a place only the dials its ground could have", () => {
    // A bar has never had reclaimer control and a rooftop farm has no gang
    // pressure until somebody gives it some.
    expect(dialsOf("x4")).toContain("reclaimer_control");
    expect(dialsOf("b1")).not.toContain("reclaimer_control");
    for (const place of DISTRICTS.flatMap((d) => d.locations)) {
      for (const dial of dialsOf(place.key)) {
        expect(isPlaceDial(dial), `${place.key} has ${dial}`).toBe(true);
      }
    }
  });

  it("says nothing about a place the atlas does not have", () => {
    expect(startingState("zz9").dials).toEqual({});
    expect(startingState("zz9").flags).toEqual([]);
  });
});

describe("where a place starts", () => {
  it("reads what was written about it, when something was", () => {
    // The lore is the starting condition. Minimallism opens with a market
    // running and the reclaimers still holding most of it.
    const market = startingState("x5");
    expect(market.flags).toContain("market_open");
    expect(market.dials["reclaimer_control"]).toBe(6);
    expect(market.dials["gang_pressure"]).toBe(5);
    expect(market.dials["police_attention"]).toBe(2);
  });

  it("falls back to what the ground says when nobody wrote it up", () => {
    const somewhere = startingState("b1");
    expect(Object.keys(somewhere.dials).length).toBeGreaterThan(0);
    expect(somewhere.visits).toBe(0);
    expect(somewhere.lastVisitDay).toBeNull();
  });

  it("keeps its dials off the pressure rail", () => {
    // Local pressure is felt, not read: the player learns the market has gone
    // quiet by finding it gone quiet.
    for (const clock of dialClocks(startingState("x5"))) {
      expect(clock.hidden, clock.key).toBe(true);
    }
  });
});

describe("what happens to a place", () => {
  it("moves only the dials that place has", () => {
    const farm = startingState("x4");
    const after = applyToPlace(farm, ["favour"]).state;
    expect(after.dials["reclaimer_control"]).toBeGreaterThan(farm.dials["reclaimer_control"]!);
    expect(after.dials["gang_pressure"]).toBeUndefined();
  });

  it("reports what moved, for the ledger", () => {
    const change = applyToPlace(startingState("x5"), ["loud"]);
    expect(change.moved.some((m) => m.dial === "police_attention")).toBe(true);
    for (const move of change.moved) expect(move.from).not.toBe(move.to);
  });

  it("does nothing at all for an observation with no local meaning", () => {
    const before = startingState("x5");
    const change = applyToPlace(before, []);
    expect(change.moved).toEqual([]);
    expect(change.flagged).toEqual([]);
    expect(change.state).toEqual(before);
  });

  it("never runs a dial past its own segments", () => {
    const hot = hammer(startingState("x5"), "killed", 20);
    for (const [dial, value] of Object.entries(hot.dials)) {
      expect(value, dial).toBeGreaterThanOrEqual(0);
      expect(value, dial).toBeLessThanOrEqual(segmentsOf(dial));
    }
  });

  it("counts a visit once and remembers the first", () => {
    const first = recordVisit(startingState("x5"), 4);
    const second = recordVisit(first, 11);
    expect(second.visits).toBe(2);
    expect(second.firstVisitDay).toBe(4);
    expect(second.lastVisitDay).toBe(11);
  });
});

describe("a place stops being what was written about it", () => {
  it("closes the market when the law has been through", () => {
    // The acceptance test for the whole step, and the thing the design is for:
    // bring the law down on the night market often enough and it is not a
    // night market any more.
    const before = startingState("x5");
    expect(hasFlag(before, "market_open")).toBe(true);

    const after = hammer(before, "loud", 4);
    expect(hasFlag(after, "raided")).toBe(true);
    expect(hasFlag(after, "market_open")).toBe(false);
  });

  it("does not leave the dial full and ringing", () => {
    // A raid is an event in the life of a market, not a permanent condition of
    // it — the same discipline the pressure clocks use when they fire.
    const after = hammer(startingState("x5"), "loud", 4);
    expect(after.dials["police_attention"]).toBeLessThan(segmentsOf("police_attention"));
    expect(after.dials["police_attention"]).toBeGreaterThan(0);
  });

  it("fires a threshold once, not on every look", () => {
    const raided = hammer(startingState("x5"), "loud", 4);
    const again = applyToPlace(raided, ["seen"]);
    expect(again.flagged).toEqual([]);
  });

  it("stops the beat that ran there", () => {
    // Without this the state would be a number nobody could feel. The night
    // market keeps appearing on the board of a place that no longer has one.
    expect(beatAllowedAt("night_market", "x5")).toBe(true);
    const raided = hammer(startingState("x5"), "loud", 4);
    expect(beatAllowedAt("night_market", "x5", raided)).toBe(false);

    const day = Array.from({ length: 200 }, (_, d) => d).find((d) =>
      derivePlaceBeats({
        districtKey: "rancho_coronado",
        day: d,
        minute: EVENING,
        seed: SEED,
      }).some((b) => b.data?.["beat"] === "night_market"),
    );
    expect(day, "the market should run at some point").toBeDefined();
    const closed = derivePlaceBeats({
      districtKey: "rancho_coronado",
      day: day!,
      minute: EVENING,
      seed: SEED,
      places: { x5: raided },
    });
    expect(closed.some((b) => b.data?.["beat"] === "night_market")).toBe(false);
  });

  it("silences a place entirely when it is shut", () => {
    const shut: PlaceState = { ...startingState("x4"), flags: ["shut"] };
    for (const beat of ["short_handed", "wrecked_beds"]) {
      expect(beatAllowedAt(beat, "x4", shut), beat).toBe(false);
    }
  });

  it("leaves everywhere else alone", () => {
    // Closing Minimallism is a fact about Minimallism.
    const raided = hammer(startingState("x5"), "loud", 4);
    expect(beatAllowedAt("night_market", "x5", raided)).toBe(false);
    expect(beatAllowedAt("water_truck", "x1")).toBe(true);
    expect(beatAllowedAt("wrecked_beds", "x4")).toBe(true);
  });
});

describe("the model cannot reach any of this", () => {
  it("prices only what the engine's own vocabulary reports", () => {
    // There is no place_delta in the Life response schema, and the effects
    // table is keyed on observations rather than on anything the model names.
    const keys = Object.keys(PLACE_OBSERVATION_EFFECTS);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(OBSERVATIONS).toContain(key);
  });

  it("ignores a dial a place does not have, however hard it is pushed", () => {
    const bar = startingState("b1");
    expect(dialsOf("b1")).not.toContain("reclaimer_control");
    const after = hammer(bar, "favour", 10);
    expect(after.dials["reclaimer_control"]).toBeUndefined();
  });

  it("only ever attaches a dial to ground that carries its tag", () => {
    for (const place of DISTRICTS.flatMap((d) => d.locations)) {
      const tags = tagsOf(place.key);
      expect(tags.length, place.key).toBeGreaterThan(0);
      for (const dial of dialsOf(place.key)) {
        expect(isPlaceDial(dial), `${place.key}/${dial}`).toBe(true);
      }
    }
  });
});
