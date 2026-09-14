/**
 * What the character creator promises.
 *
 * The screen used to sell a Role with the printed rank table and a third-person
 * lore paragraph. What replaced it makes CONCRETE promises — a Fixer's Reach, a
 * Nomad's motorpool, what a week at the Tech's bench is worth — so the thing
 * these tests are really holding is that a promise the creator makes is a
 * promise the game keeps. Every figure has to be computed, which means it has
 * to MOVE when the Rank moves; a number that stays put at every Rank is a
 * sentence somebody typed.
 */
import { describe, expect, it } from "vitest";
import rolesData from "@/data/rules/roles.json";
import { ROLE_OPENING_IDS, roleOpening } from "../roleOpening";
import { SHARED_SCENE, roleAffordance, roleAnswer } from "../roleAffordance";

const ROLE_IDS = Object.keys((rolesData as unknown as { roles: Record<string, unknown> }).roles);
const STARTING_RANK = 4;

describe("every Role gets an opening", () => {
  it("speaks for every Role the rules data knows, and no others", () => {
    expect([...ROLE_OPENING_IDS].sort()).toEqual([...ROLE_IDS].sort());
  });

  it("says something concrete for each, with nothing blank", () => {
    for (const id of ROLE_IDS) {
      const opening = roleOpening(id, STARTING_RANK);
      expect(opening, id).not.toBeNull();
      expect(opening!.headline.length, id).toBeGreaterThan(10);
      expect(opening!.facts.length, id).toBeGreaterThan(0);
      for (const fact of opening!.facts) {
        expect(fact.label.trim().length, `${id}/${fact.label}`).toBeGreaterThan(0);
        expect(fact.detail.trim().length, `${id}/${fact.label}`).toBeGreaterThan(0);
      }
    }
  });

  it("is null for a Role nobody has written", () => {
    expect(roleOpening("bartender", 4)).toBeNull();
    expect(roleOpening(null, 4)).toBeNull();
    expect(roleOpening(undefined, 4)).toBeNull();
  });

  it("marks exactly one Role unbuilt, and says so plainly", () => {
    const unbuilt = ROLE_IDS.filter((id) => roleOpening(id, STARTING_RANK)?.unbuilt);
    expect(unbuilt).toEqual(["netrunner"]);
    // Saying it beats selling it as an equal and disappointing somebody later.
    expect(roleOpening("netrunner", 4)!.facts[0]!.detail).toMatch(/update/i);
  });
});

describe("the numbers are computed, not typed", () => {
  /** The whole text of an opening, for checking a figure actually reached it. */
  const textOf = (id: string, rank: number): string => {
    const opening = roleOpening(id, rank)!;
    return [opening.headline, ...opening.facts.flatMap((f) => [f.label, f.detail])].join(" ");
  };

  it("moves the Solo's pool with their Rank", () => {
    expect(textOf("solo", 4)).toContain("4 points");
    expect(textOf("solo", 9)).toContain("9 points");
  });

  it("widens the Fixer's Reach with their Rank", () => {
    expect(textOf("fixer", 1)).toContain("Everyday");
    expect(textOf("fixer", 10)).toContain("Super Luxury");
    // And the Haggle band is the printed one, which steps at Rank 9.
    expect(textOf("fixer", 4)).toContain("10%");
    expect(textOf("fixer", 10)).toContain("20%");
  });

  it("grows the Nomad's motorpool with their Rank", () => {
    expect(textOf("nomad", 4)).toContain("Compact Groundcar");
    expect(textOf("nomad", 4)).not.toContain("Helicopter");
    expect(textOf("nomad", 7)).toContain("Helicopter");
  });

  it("grows the Tech's Specialty ranks two to a Rank", () => {
    expect(textOf("tech", 4)).toContain("8 Specialty ranks");
    expect(textOf("tech", 5)).toContain("10 Specialty ranks");
  });

  it("sends better help to a higher-Rank Lawman", () => {
    expect(textOf("lawman", 4)).not.toBe(textOf("lawman", 9));
  });

  it("prices the Tech's bench off the real catalog", () => {
    // The example has to be a real item at its real price, or the creator is
    // promising something the bench will not do.
    expect(textOf("tech", 4)).toMatch(/100eb of Premium parts/);
    expect(textOf("tech", 4)).toMatch(/worth 500eb/);
  });

  it("never renders a raw placeholder or an empty figure", () => {
    for (const id of ROLE_IDS) {
      for (const rank of [0, 1, 4, 10]) {
        const text = textOf(id, rank);
        expect(text, `${id}@${rank}`).not.toMatch(/undefined|null|NaN|\[object/);
      }
    }
  });
});

describe("the alley", () => {
  it("is one scene, and every Role answers it", () => {
    expect(SHARED_SCENE.length).toBeGreaterThan(40);
    for (const id of ROLE_IDS) {
      const answer = roleAnswer(id);
      expect(answer, id).not.toBeNull();
      expect(answer!.player.length, id).toBeGreaterThan(10);
      expect(answer!.answers.length, id).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives each Role its own answers, not a shared list", () => {
    const seen = new Map<string, string>();
    for (const id of ROLE_IDS) {
      for (const line of roleAnswer(id)!.answers) {
        expect(seen.get(line), `${id} repeats ${seen.get(line)}`).toBeUndefined();
        seen.set(line, id);
      }
    }
  });

  it("does not echo the headline two centimetres above it", () => {
    // The headline and the player line sit within a screen of each other, so a
    // near-duplicate reads as a bug rather than as emphasis.
    for (const id of ROLE_IDS) {
      const opening = roleOpening(id, STARTING_RANK)!;
      expect(roleAnswer(id)!.player, id).not.toBe(opening.headline);
    }
  });

  it("keeps the narrator's third-person copy separate from the player's", () => {
    // Same file, two audiences. If these ever became the same string, one of
    // the two surfaces would be reading the wrong voice.
    for (const id of ROLE_IDS) {
      expect(roleAffordance(id)!.reach, id).not.toBe(roleAnswer(id)!.player);
    }
  });

  it("speaks to the player in the second person", () => {
    for (const id of ROLE_IDS) {
      const answer = roleAnswer(id)!;
      // "They read a room" is the narrator's copy; the player's says "you".
      expect(answer.player.toLowerCase(), id).toMatch(/\byou\b|\byour\b/);
    }
  });
});
