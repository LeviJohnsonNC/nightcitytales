import { describe, expect, it } from "vitest";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";
import { OPENING_CHOICES } from "@/engine";
import { buildOpeningFacts, hourWords, moneyBand, renderOpeningPrompt } from "../openingContext";
import { OPENING_SYSTEM_PROMPT } from "../openingPrompt";

/**
 * What the model is told, and what it is deliberately not told.
 *
 * The style guide's hardest rule is that numbers belong to the engine: "if you
 * have not been given a number, do not reach for one". The surest way to stop
 * the cold open pricing the rent is never to hand it the rent, so money travels
 * as a BAND. These tests pin that, because it is the kind of thing a later
 * "let's give it more context" change would quietly undo.
 */

const campaign = (over: Partial<Campaign> = {}): Campaign =>
  ({
    id: "c1",
    day: 1,
    minute: 1080,
    bills_paid_through_day: 0,
    location_key: null,
    ...over,
  }) as Campaign;

const vitals = (over: Partial<CampaignVitals> = {}): CampaignVitals =>
  ({ eurobucks: 500, hp_current: 30, hp_max: 30, ...over }) as CampaignVitals;

const character = (over: Record<string, unknown> = {}): FullCharacter =>
  ({
    character: { id: "ch1", name: "Mara Vance", handle: "Sundown", role: "solo" },
    stats: { body: 6 },
    skills: [],
    roleAbility: { ability_id: "combat_awareness", rank: 4 },
    gear: [],
    cyberware: [],
    lifepath: {
      general: {
        entries: { cultural_origin: { value: "North American" } },
        friends: [{ value: "An old running mate" }],
        enemies: [
          {
            who: { value: "A Maelstrom lieutenant" },
            cause: { value: "You took their eye" },
            throwAtYou: { value: "A gang" },
          },
        ],
        tragicLove: [{ value: "They vanished without a word" }],
        language: { value: "Streetslang" },
      },
    },
    finance: { improvement_points: 0, home_place_key: null, home_district_key: null },
    ...over,
  }) as unknown as FullCharacter;

const facts = (over: { campaign?: Campaign; vitals?: CampaignVitals } = {}) =>
  buildOpeningFacts({
    campaign: over.campaign ?? campaign(),
    vitals: over.vitals ?? vitals(),
    character: character(),
    cast: [],
  });

describe("money reaches the model as a feeling, never as a figure", () => {
  it("never puts the balance, the rent or the lifestyle cost in the prompt", () => {
    const prompt = renderOpeningPrompt(facts({ vitals: vitals({ eurobucks: 4350 }) }));
    // If any of these appear, the model will restate them, and pricing the
    // world is the engine's job.
    expect(prompt).not.toContain("4350");
    expect(prompt).not.toContain('eurobucks": 4350');
    expect(prompt).not.toMatch(/\b\d{3,}\b/);
  });

  it("bands the money by how many months of living it covers", () => {
    expect(moneyBand(100, 1000)).toBe("desperate");
    expect(moneyBand(1000, 1000)).toBe("thin");
    expect(moneyBand(3000, 1000)).toBe("comfortable");
    expect(moneyBand(9000, 1000)).toBe("flush");
  });

  it("does not call somebody desperate just because nobody charges them rent", () => {
    // An Exec whose Role ability houses them has no monthly costs at all.
    expect(moneyBand(600, 0)).toBe("comfortable");
    expect(moneyBand(100, 0)).toBe("thin");
  });

  it("says plainly when they are already behind", () => {
    const behind = facts({ campaign: campaign({ day: 400 }) });
    expect(behind.money.behind).toBe(true);
    expect(facts().money.behind).toBe(false);
  });
});

describe("the material the prose is written from", () => {
  it("carries the Lifepath as facts rather than as a story", () => {
    const f = facts();
    expect(f.lifepath.enemies[0]?.who).toBe("A Maelstrom lieutenant");
    expect(f.lifepath.friends).toEqual(["An old running mate"]);
    expect(f.lifepath.tragicLove).toBe("They vanished without a word");
  });

  it("only mentions a wound when there is one", () => {
    expect(facts().condition).toBeNull();
    expect(facts({ vitals: vitals({ hp_current: 12 }) }).condition).not.toBeNull();
  });

  it("carries the character's Role reach, for the role_action door", () => {
    expect(facts().roleReach?.reach).toMatch(/exits, angles/);
    expect(facts().roleReach?.options.length).toBeGreaterThan(0);
  });

  it("is null for a Role the affordance data does not know", () => {
    const f = buildOpeningFacts({
      campaign: campaign(),
      vitals: vitals(),
      character: character({ character: { id: "ch1", name: "Mara Vance", role: "nobody" } }),
      cast: [],
    });
    expect(f.roleReach).toBeNull();
  });

  it("gives the hour in words, because the clock is the engine's", () => {
    expect(hourWords(0)).toBe("the small hours");
    expect(hourWords(9 * 60)).toBe("morning");
    expect(hourWords(19 * 60)).toBe("evening");
    expect(hourWords(23 * 60)).toBe("late evening");
    // Minutes past the end of a day wrap rather than throwing.
    expect(hourWords(25 * 60)).toBe("the small hours");
  });
});

describe("the system prompt", () => {
  it("names every door the engine knows, so the two cannot drift", () => {
    for (const choice of OPENING_CHOICES) {
      expect(OPENING_SYSTEM_PROMPT).toContain(`"${choice}"`);
    }
  });

  it("forbids the things that would make the first screen a lie", () => {
    // Each of these is a way the cold open could contradict state the engine
    // owns, or spend a campaign's whole escalation budget in paragraph one.
    expect(OPENING_SYSTEM_PROMPT).toMatch(/Do not invent an emergency/);
    expect(OPENING_SYSTEM_PROMPT).toMatch(/Do not start a job/);
    expect(OPENING_SYSTEM_PROMPT).toMatch(/Do not move time/);
    expect(OPENING_SYSTEM_PROMPT).toMatch(/Do not summarize their life/);
  });

  it("carries the house voice", () => {
    expect(OPENING_SYSTEM_PROMPT).toContain("VOICE AND STYLE");
  });
});
