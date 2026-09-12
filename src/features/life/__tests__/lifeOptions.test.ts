import { describe, expect, it } from "vitest";
import { getDistrict, placeActions } from "@/engine";
import { MAX_LIFE_OPTIONS, mergeOptions, venueOptions } from "../lifeOptions";
import type { LifeActionCard } from "../lifeResponse";

/** A card of the shape the model returns. */
function card(
  label: string,
  description = "Something happens.",
  over: Partial<LifeActionCard> = {},
) {
  return { label, description, timeMinutes: 30, knownCost: null, skillId: null, ...over };
}

/** Rancho Coronado: five locations, a carwash, a farm and a dead mall. */
const DISTRICT = "rancho_coronado";
const NAMES = getDistrict(DISTRICT)!.locations.map((l) => l.name);

describe("the standing business of a place, as options", () => {
  it("offers what the engine says is there, and nothing else", () => {
    const offered = venueOptions({ districtKey: DISTRICT });
    expect(offered.length).toBeGreaterThan(0);
    const engine = placeActions({ districtKey: DISTRICT });
    expect(offered.map((c) => c.label)).toEqual(engine.map((a) => a.label));
  });

  it("carries the engine's own minutes and price onto the card", () => {
    // The whole point of the engine writing these rather than the model. A card
    // that printed a number the engine did not produce is the thing this
    // codebase calls its worst smell.
    const engine = placeActions({ districtKey: DISTRICT });
    for (const [i, offered] of venueOptions({ districtKey: DISTRICT }).entries()) {
      expect(offered.timeMinutes).toBe(engine[i]!.minutes);
      expect(offered.knownCost).toBe(engine[i]!.cost);
    }
  });

  it("names the venue in the description, so it does not read as a menu row", () => {
    for (const offered of venueOptions({ districtKey: DISTRICT, placeKey: "x4" })) {
      expect(offered.description.length).toBeGreaterThan(20);
    }
    const here = venueOptions({ districtKey: DISTRICT, placeKey: "x4" })[0]!;
    expect(here.description).toContain("Here.");
  });

  it("says nothing about a district that is not on the map", () => {
    expect(venueOptions({ districtKey: "atlantis" })).toEqual([]);
  });
});

describe("mixing what is live with what is always there", () => {
  it("puts the model's options first, then fills with the engine's", () => {
    const model = [card("Fix the inverter for the kid")];
    const merged = mergeOptions(model, venueOptions({ districtKey: DISTRICT }), NAMES);
    expect(merged[0]!.label).toBe("Fix the inverter for the kid");
    expect(merged.length).toBeGreaterThan(1);
  });

  it("never offers more than the cap", () => {
    // Six. The board is not a quest log, which is the argument the engine
    // already makes for capping district actions at five and beats at two.
    const model = Array.from({ length: 5 }, (_, i) => card(`Live thing ${i}`));
    const merged = mergeOptions(model, venueOptions({ districtKey: DISTRICT }), NAMES);
    expect(merged.length).toBe(MAX_LIFE_OPTIONS);
  });

  it("keeps every one of the model's options even when it fills the board", () => {
    const model = Array.from({ length: MAX_LIFE_OPTIONS }, (_, i) => card(`Live thing ${i}`));
    const merged = mergeOptions(model, venueOptions({ districtKey: DISTRICT }), NAMES);
    expect(merged.map((c) => c.label)).toEqual(model.map((c) => c.label));
  });

  it("yields the venue the model has already written about", () => {
    // The bug this module exists for. "Head down to Mister Rice Guy" and "Get
    // something to eat · MISTER RICE GUY" were the same action drawn twice,
    // because the model was handed the engine's list as context and read it
    // back. Whichever of the two survives, it must not be both.
    const venue = venueOptions({ districtKey: DISTRICT });
    const spoken = venue.find((c) => c.description.includes("Albino Alligator Carwash"));
    expect(spoken, "no carwash action to collide with").toBeDefined();

    const model = [card("Swing by the Albino Alligator Carwash", "See who is on the pumps.")];
    const merged = mergeOptions(model, venue, NAMES);
    const mentions = merged.filter((c) =>
      `${c.label} ${c.description}`.includes("Albino Alligator Carwash"),
    );
    expect(mentions).toHaveLength(1);
    expect(mentions[0]!.label).toBe("Swing by the Albino Alligator Carwash");
  });

  it("still offers the other venues when the model has claimed one", () => {
    const model = [card("Swing by the Albino Alligator Carwash", "See who is on the pumps.")];
    const merged = mergeOptions(model, venueOptions({ districtKey: DISTRICT }), NAMES);
    expect(merged.length).toBeGreaterThan(1);
  });

  it("drops an engine option the model happened to word identically", () => {
    const venue = venueOptions({ districtKey: DISTRICT });
    const model = [card(venue[0]!.label, "Written by the model this time.")];
    const merged = mergeOptions(model, venue, NAMES);
    const same = merged.filter((c) => c.label === venue[0]!.label);
    expect(same).toHaveLength(1);
    expect(same[0]!.description).toBe("Written by the model this time.");
  });

  it("offers nothing at all when the model offered nothing", () => {
    // Options exist only when they were asked for. An ordinary turn returns
    // none, and the standing business of the district must not quietly
    // reinstate the strip on its own — which is the thing this change removed.
    expect(mergeOptions([], venueOptions({ districtKey: DISTRICT }), NAMES)).toEqual([]);
  });

  it("holds the venue cards to the same rule the model's cards follow", () => {
    // Whichever card is picked charges what it printed, so an engine card with
    // a price must carry one the engine actually set rather than a rounded
    // guess. placeActions prices on the published ladder or leaves it null.
    const LADDER = [10, 20, 50, 100];
    for (const offered of venueOptions({ districtKey: DISTRICT })) {
      if (offered.knownCost === null) continue;
      expect(LADDER, `${offered.label} costs ${offered.knownCost}eb`).toContain(offered.knownCost);
    }
  });
});

describe("what a local is offered that a stranger is not", () => {
  it("carries the quiet doors of the district onto the option cards", () => {
    // The first point in the loop where being a local changes what the player
    // can DO rather than only what they know.
    const stranger = venueOptions({ districtKey: DISTRICT }).map((c) => c.label);
    const local = venueOptions({ districtKey: DISTRICT, localExpertLevel: 6 }).map((c) => c.label);
    expect(local).not.toEqual(stranger);
    expect(local.some((label) => !stranger.includes(label))).toBe(true);
  });

  it("still prints the engine's own minutes and price on them", () => {
    // A quiet door is an ordinary card in every other respect: whichever card is
    // picked, the turn costs the minutes it printed.
    const cards = venueOptions({ districtKey: DISTRICT, localExpertLevel: 6 });
    const engine = placeActions({ districtKey: DISTRICT, localExpertLevel: 6 });
    expect(cards.map((c) => c.timeMinutes)).toEqual(engine.map((a) => a.minutes));
    expect(cards.map((c) => c.knownCost)).toEqual(engine.map((a) => a.cost));
  });
});
