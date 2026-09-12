import { describe, expect, it } from "vitest";
import actionFile from "@/data/atlas/place-actions.json";
import {
  DISTRICTS,
  recordVisit,
  MAX_PLACE_ACTIONS,
  PLACE_ACTIONS_ARE_HOUSE_RULE,
  PLACE_ACTION_TEMPLATES,
  describePlaceAction,
  districtOfPlace,
  isPlaceTag,
  placeActions,
  placesWithTag,
  startingState,
  type PlaceState,
} from "@/engine";

const FILE = actionFile as unknown as {
  costNote: string;
  localNote: string;
  actions: { key: string; local?: boolean; localNote?: string }[];
};

/** The verbs a stranger has no way of finding, per the data. */
const QUIET_DOORS: string[] = FILE.actions.filter((a) => a.local).map((a) => a.key);

/** A place this character has been to before. */
function visited(placeKey: string, times = 1): PlaceState {
  let state = startingState(placeKey);
  for (let i = 0; i < times; i += 1) state = recordVisit(state, i + 1);
  return state;
}

/** The district-wide half of the offer: everything they are not standing in. */
function around(input: Parameters<typeof placeActions>[0]): string[] {
  return placeActions(input)
    .filter((a) => !a.here)
    .map((a) => a.action);
}

/** The published cost ladder the Night Market uses, and nothing between rungs. */
const LADDER = [10, 20, 50, 100];

describe("the verbs themselves", () => {
  it("are a house rule, tunable in data", () => {
    expect(PLACE_ACTIONS_ARE_HOUSE_RULE).toBe(true);
    expect(FILE.costNote).toContain("house-rule");
  });

  it("are triggered only by tags the city actually uses", () => {
    for (const template of PLACE_ACTION_TEMPLATES) {
      expect(template.tags.length, `${template.key} is triggered by nothing`).toBeGreaterThan(0);
      for (const tag of template.tags) {
        expect(isPlaceTag(tag), `${template.key} wants "${tag}", which is not a tag`).toBe(true);
        expect(placesWithTag(tag).length, `nowhere in the city carries ${tag}`).toBeGreaterThan(0);
      }
    }
  });

  it("prices on the published ladder, or not at all", () => {
    // RED prints no price for a bowl of noodles, so these are house rules — but
    // they are house rules that sit on the rungs the rules do print. A cost of
    // 37eb would be a number nobody can point at.
    for (const template of PLACE_ACTION_TEMPLATES) {
      if (template.cost === null) continue;
      expect(LADDER, `${template.key} costs ${template.cost}eb`).toContain(template.cost);
    }
  });

  it("leaves anything the engine already prices for the engine to price", () => {
    // A repair, a doctor's bill, a night's stock: all of those have a real
    // answer somewhere in the engine, and a second one here would be a second
    // source of truth.
    for (const key of ["repair", "ripperdoc", "patched_up", "browse"]) {
      const template = PLACE_ACTION_TEMPLATES.find((t) => t.key === key);
      expect(template?.cost, `${key} should not carry its own price`).toBeNull();
    }
  });

  it("costs plausible time and keeps its keys unique", () => {
    const keys = PLACE_ACTION_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const template of PLACE_ACTION_TEMPLATES) {
      expect(template.minutes, template.key).toBeGreaterThan(0);
      expect(template.minutes, template.key).toBeLessThanOrEqual(240);
      expect(template.label.length, template.key).toBeGreaterThan(3);
      expect(template.description.length, template.key).toBeGreaterThan(20);
    }
  });
});

describe("what a place offers", () => {
  it("names a venue for every single one", () => {
    // The whole difference between this and a Socialize button.
    for (const district of DISTRICTS) {
      for (const action of placeActions({ districtKey: district.key })) {
        expect(action.placeName, action.key).toBeTruthy();
        expect(districtOfPlace(action.placeKey)?.key, action.key).toBe(district.key);
      }
    }
  });

  it("never offers more than the cap", () => {
    for (const district of DISTRICTS) {
      expect(placeActions({ districtKey: district.key }).length, district.key).toBeLessThanOrEqual(
        MAX_PLACE_ACTIONS,
      );
    }
  });

  it("offers each verb once, however many bars a district has", () => {
    // Six bars is not six chances to have a drink. It is one drink and a choice
    // of bar, and choosing the bar is the map's job.
    for (const district of DISTRICTS) {
      const verbs = placeActions({ districtKey: district.key }).map((a) => a.action);
      expect(new Set(verbs).size, district.key).toBe(verbs.length);
    }
  });

  it("puts the counter you are standing at first", () => {
    const atTheFarm = placeActions({ districtKey: "rancho_coronado", placeKey: "x4" });
    expect(atTheFarm[0]?.placeKey).toBe("x4");
    expect(atTheFarm[0]?.here).toBe(true);
    // And the district around it still gets a look in.
    expect(atTheFarm.some((a) => !a.here)).toBe(true);
  });

  it("gives the quiet afternoon somewhere to go", () => {
    // The case this exists for: nothing is happening at Jack 'N' the Green and
    // that still has to be playable. Buy vegetables, lend a hand, leave.
    const offers = placeActions({ districtKey: "rancho_coronado", placeKey: "x4" }).map(
      (a) => a.label,
    );
    expect(offers).toContain("Buy vegetables");
    expect(offers).toContain("Lend a hand");
  });

  it("offers something in every district that has anywhere in it", () => {
    // A district you can stand in and do nothing at all is a dead end, and a
    // game with dead ends invents noise to avoid them.
    for (const district of DISTRICTS) {
      if (!district.locations.length) continue;
      expect(
        placeActions({ districtKey: district.key }).length,
        `${district.name} offers nothing`,
      ).toBeGreaterThan(0);
    }
  });

  it("gives every single location in the city something to do in it", () => {
    // Stronger than the district check above, and the one that matters: a
    // district can offer five things while the pin the player actually tapped
    // offers none. Every corporate lobby, precinct and city office in the game
    // was a dead pin until the verbs for that ground were written.
    for (const district of DISTRICTS) {
      for (const place of district.locations) {
        const here = placeActions({ districtKey: district.key, placeKey: place.key }).filter(
          (a) => a.here,
        );
        expect(here.length, `${place.name} (${place.key}) offers nothing`).toBeGreaterThan(0);
      }
    }
  });

  it("says nothing about a district that is not on the map", () => {
    expect(placeActions({ districtKey: "atlantis" })).toEqual([]);
  });

  it("is deterministic, so the strip does not reshuffle under the player", () => {
    const once = placeActions({ districtKey: "little_europe" });
    const twice = placeActions({ districtKey: "little_europe" });
    expect(once).toEqual(twice);
  });

  it("reads as something the character does, at somewhere they can name", () => {
    const [action] = placeActions({ districtKey: "rancho_coronado", placeKey: "x4" });
    expect(describePlaceAction(action!)).toBe("Get something to eat at Jack ‘N’ the Green.");
  });
});

describe("a shut place is shut", () => {
  it("offers nothing once the ground has been closed", () => {
    // The counter a beat closed should not still be offering to serve you: the
    // live half of the location page reads this, and an open-business panel on
    // a raided market would be the state saying one thing and the screen
    // another.
    const open = placeActions({ districtKey: "rancho_coronado", placeKey: "x5" });
    expect(open.some((a) => a.placeKey === "x5")).toBe(true);

    const shut: PlaceState = { ...startingState("x5"), flags: ["shut"] };
    const closed = placeActions({
      districtKey: "rancho_coronado",
      placeKey: "x5",
      places: { x5: shut },
    });
    expect(closed.some((a) => a.placeKey === "x5")).toBe(false);
    // And the rest of the district carries on regardless.
    expect(closed.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The doors you only find if you know the area.
// ---------------------------------------------------------------------------

/** A district with a fence, a derelict and claimed ground in it. */
const LOCAL_DISTRICT = "rancho_coronado";
/** Enough of a local for placeIntel's `neighbourhood` rung. */
const A_LOCAL = 6;

describe("the quiet doors", () => {
  it("are declared in the data, with a reason each", () => {
    expect(QUIET_DOORS.length).toBeGreaterThan(0);
    expect(FILE.localNote).toContain("know the area");
    for (const action of FILE.actions) {
      if (!action.local) continue;
      expect(PLACE_ACTION_TEMPLATES.map((t) => t.key)).toContain(action.key);
      expect(action.localNote, `${action.key} has no reason given`).toBeTruthy();
    }
  });

  it("are not offered across the district to somebody who does not know it", () => {
    const stranger = around({ districtKey: LOCAL_DISTRICT });
    for (const door of QUIET_DOORS) expect(stranger, door).not.toContain(door);
  });

  it("are offered across the district to a local", () => {
    const local = around({ districtKey: LOCAL_DISTRICT, localExpertLevel: A_LOCAL });
    expect(local.some((action) => QUIET_DOORS.includes(action))).toBe(true);
  });

  it("open up for most of the city once you are a local in it", () => {
    // Not a vestigial rule: being a local has to actually change the board.
    const differs = DISTRICTS.filter((district) => {
      if (!district.locations.length) return false;
      const stranger = around({ districtKey: district.key }).join("|");
      const local = around({ districtKey: district.key, localExpertLevel: A_LOCAL }).join("|");
      return stranger !== local;
    });
    expect(differs.length).toBeGreaterThanOrEqual(15);
  });

  it("come before the ordinary business, or the cap would silently undo the gate", () => {
    // Five slots. With the quiet doors last, a local's fence sat behind "fill
    // your bottles" and never made the list — being a local swapped one
    // ordinary verb for another and bought nothing.
    const local = around({ districtKey: LOCAL_DISTRICT, localExpertLevel: A_LOCAL });
    const firstOrdinary = local.findIndex((action) => !QUIET_DOORS.includes(action));
    const lastQuiet = local.reduce(
      (last, action, index) => (QUIET_DOORS.includes(action) ? index : last),
      -1,
    );
    if (firstOrdinary >= 0 && lastQuiet >= 0) expect(lastQuiet).toBeLessThan(firstOrdinary);
  });
});

describe("what being a stranger does NOT cost you", () => {
  it("never hides the business of the place you are standing in", () => {
    // The gate is about knowing WHERE the quiet doors are. Once you are at one,
    // there is nothing left to find out — and a building whose only business is
    // a quiet one would otherwise be a dead pin for every stranger.
    for (const district of DISTRICTS) {
      for (const place of district.locations) {
        const asStranger = placeActions({ districtKey: district.key, placeKey: place.key }).filter(
          (a) => a.here,
        );
        const asLocal = placeActions({
          districtKey: district.key,
          placeKey: place.key,
          localExpertLevel: A_LOCAL,
        }).filter((a) => a.here);
        expect(
          asStranger.map((a) => a.action),
          place.name,
        ).toEqual(asLocal.map((a) => a.action));
        expect(asStranger.length, `${place.name} (${place.key}) offers nothing`).toBeGreaterThan(0);
      }
    }
  });

  it("gives a stranger the door back once they have been through it", () => {
    // A fence you have already bought from is not a secret again next week.
    const fence = placesWithTag("fence", LOCAL_DISTRICT)[0];
    expect(fence, "this district needs a fence to test against").toBeDefined();
    const before = around({ districtKey: LOCAL_DISTRICT });
    const after = around({
      districtKey: LOCAL_DISTRICT,
      places: { [fence!.key]: visited(fence!.key) },
    });
    expect(before).not.toContain("fell_off_a_truck");
    expect(after).toContain("fell_off_a_truck");
  });

  it("leaves every other verb exactly where it was", () => {
    // The gate must not quietly reshuffle ordinary business for a stranger.
    for (const district of DISTRICTS) {
      const before = around({ districtKey: district.key }).filter(
        (action) => !QUIET_DOORS.includes(action),
      );
      const after = around({ districtKey: district.key, localExpertLevel: 0 }).filter(
        (action) => !QUIET_DOORS.includes(action),
      );
      expect(after, district.name).toEqual(before);
    }
  });
});
