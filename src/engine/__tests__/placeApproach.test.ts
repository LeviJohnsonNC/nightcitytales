import { describe, expect, it } from "vitest";
import actionFile from "@/data/atlas/place-actions.json";
import {
  DISTRICTS,
  MAX_PLACE_ACTIONS,
  MAX_PLACE_APPROACHES,
  PLACE_TAGS,
  SKILLS,
  describePlaceAction,
  placeActions,
  startingState,
  truthsAt,
  type PlaceState,
} from "@/engine";

const FILE = actionFile as unknown as {
  approaches: {
    key: string;
    anywhere?: boolean;
    tags?: string[];
    label: string;
    description: string;
    minutes: number;
    skill: string;
    needsConclusion?: boolean;
  }[];
};

const EVERY_PLACE = DISTRICTS.flatMap((d) => d.locations);

/** Somewhere with people in it, for the social approaches. */
const BAR = EVERY_PLACE.find((p) => truthsAt(p.key) && p.key === "afterlife") ?? EVERY_PLACE[0]!;

describe("the approach templates", () => {
  it("name printed Skills and real tags", () => {
    const skillIds = new Set(SKILLS.map((s) => s.id));
    for (const template of FILE.approaches) {
      expect(skillIds, template.key).toContain(template.skill);
      for (const tag of template.tags ?? []) expect(PLACE_TAGS, tag).toContain(tag);
      expect(template.anywhere === true || (template.tags ?? []).length > 0).toBe(true);
    }
  });

  /**
   * The line this whole slice walks. An approach may say how to look; the
   * moment it says what is there, the roll it is offering has already been
   * answered and the search was theatre.
   */
  it("offers a way of looking and never a finding", () => {
    for (const template of FILE.approaches) {
      const text = `${template.label} ${template.description}`.toLowerCase();
      for (const giveaway of [
        "hidden",
        "secret",
        "there is something",
        "somebody is",
        "you will find",
        "safe",
        "concealed",
      ]) {
        expect(text, `${template.key} says "${giveaway}"`).not.toContain(giveaway);
      }
    }
  });
});

describe("what a place lets you do with your attention", () => {
  const district = DISTRICTS.find((d) => d.locations.length > 3)!;
  const place = district.locations[0]!;

  const at = (over: Partial<Parameters<typeof placeActions>[0]> = {}) =>
    placeActions({ districtKey: district.key, placeKey: place.key, ...over });

  it("can always be looked at properly, anywhere in the city", () => {
    // Offered blind on purpose. "You searched and the place is what it appears
    // to be" is a real answer the engine gives, so the offer tells the player
    // nothing — which is exactly what makes it safe to put on every location.
    let missing = 0;
    for (const candidate of EVERY_PLACE) {
      const actions = placeActions({
        districtKey: DISTRICTS.find((d) => d.locations.includes(candidate))!.key,
        placeKey: candidate.key,
      });
      if (!actions.some((a) => a.action === "look_properly")) missing += 1;
    }
    expect(missing).toBe(0);
  });

  it("keeps the ways of looking off the business budget", () => {
    // They used to come out of the same five, which squeezed an entire district
    // out of the list at a place with three verbs of its own.
    const actions = at();
    const business = actions.filter((a) => !a.skillId);
    expect(business.length).toBeLessThanOrEqual(MAX_PLACE_ACTIONS);
    expect(actions.filter((a) => a.skillId).length).toBeLessThanOrEqual(MAX_PLACE_APPROACHES);
  });

  it("only offers a way of looking at where the character is standing", () => {
    // You cannot pay attention to a building three streets away.
    for (const action of at()) {
      if (action.skillId) expect(action.here).toBe(true);
    }
    expect(placeActions({ districtKey: district.key }).some((a) => a.skillId)).toBe(false);
  });

  it("does not offer a conclusion until the pieces are in hand", () => {
    expect(at().some((a) => a.action === "think_it_through")).toBe(false);
    expect(at({ conclusionAvailable: true }).some((a) => a.action === "think_it_through")).toBe(
      true,
    );
  });

  it("offers nothing at all somewhere that has been shut", () => {
    // A place the law closed is not open to being examined either: the same
    // silencing flag that stops it selling you a drink stops it offering itself
    // to be looked at.
    const shut: PlaceState = { ...startingState(place.key), flags: ["shut"] };
    const actions = placeActions({
      districtKey: district.key,
      placeKey: place.key,
      places: { [place.key]: shut },
      conclusionAvailable: true,
    });
    expect(actions.some((a) => a.skillId)).toBe(false);
  });

  it("hands the narrator the Skill and never a DV", () => {
    const approach = at({ conclusionAvailable: true }).find((a) => a.skillId)!;
    const line = describePlaceAction(approach);
    expect(line).toContain(approach.skillId!);
    expect(line).toMatch(/do not decide what they find/i);
    expect(line).not.toMatch(/DV ?\d/);
  });

  /**
   * A template the cap never reaches is dead content: it reads like a system
   * and fires for nobody. `get_talking` was exactly that — a fixed file order
   * left Conversation's card unreachable in all 172 locations — which is why
   * the list is priority-ordered and why this test exists.
   */
  it("reaches every approach it declares, somewhere in the city", () => {
    const fired = new Set<string>();
    for (const candidate of EVERY_PLACE) {
      const key = DISTRICTS.find((d) => d.locations.includes(candidate))!.key;
      for (const conclusion of [false, true]) {
        for (const action of placeActions({
          districtKey: key,
          placeKey: candidate.key,
          conclusionAvailable: conclusion,
        })) {
          if (action.skillId) fired.add(action.action);
        }
      }
    }
    for (const template of FILE.approaches) {
      expect(fired, `${template.key} fires nowhere`).toContain(template.key);
    }
  });

  it("does not read like a verb the place already had", () => {
    // "Have a look round" is the derelict tag's own business verb. Two cards
    // that read the same way in one list is a list nobody trusts.
    const labels = new Set(FILE.approaches.map((t) => t.label.toLowerCase()));
    expect(labels.has("have a look round")).toBe(false);
  });

  it("still names a venue, like every other action", () => {
    for (const action of at({ conclusionAvailable: true })) {
      expect(action.placeName.length).toBeGreaterThan(0);
      expect(describePlaceAction(action)).toContain(action.placeName);
    }
    expect(BAR.key.length).toBeGreaterThan(0);
  });
});
