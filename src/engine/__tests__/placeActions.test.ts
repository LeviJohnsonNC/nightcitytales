import { describe, expect, it } from "vitest";
import actionFile from "@/data/atlas/place-actions.json";
import {
  DISTRICTS,
  MAX_PLACE_ACTIONS,
  PLACE_ACTIONS_ARE_HOUSE_RULE,
  PLACE_ACTION_TEMPLATES,
  describePlaceAction,
  districtOfPlace,
  isPlaceTag,
  placeActions,
  placesWithTag,
} from "@/engine";

const FILE = actionFile as unknown as { costNote: string };

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
