/**
 * Follow-through: the second half of what the player said still happens.
 *
 * Every case here is from one transcript. "Go find a bar and order a drink" was
 * refused because "a bar" is not a place on the map; the neighbour's directions
 * named a cellar the map had never heard of, so "go there" was refused too; and
 * each time, the arrival was asked for with an empty input, so the drink was
 * never ordered.
 */
import { describe, expect, it } from "vitest";
import type { CampaignEvent } from "@/lib/backend";
import { PACKET_BUDGET } from "@/features/narration/packetBudget";
import { normalizeLifeResponse } from "../lifeResponse";
import { renderLifeUserPrompt, type LifeContext } from "../lifeContext";
import { hasTag } from "@/engine";
import { saidBefore } from "@/features/narration/narratorRules";
import { kindOfTrip, placesToOffer, recentLifeLines } from "../lifeModel";

let seq = 0;
const event = (type: string, summary: string, id = `e${++seq}`): CampaignEvent =>
  ({
    id,
    seq,
    campaign_id: "c1",
    type,
    beat_id: null,
    summary,
    roll: null,
    data: {},
    created_at: "2026-09-27T00:00:00Z",
  }) as CampaignEvent;

describe("kindOfTrip — which kind of place a trip is asking for", () => {
  it("takes the kind the narrator asked for", () => {
    expect(kindOfTrip({ seek: "bar" }, "anything")).toBe("bar");
  });

  it('reads "a bar" as a kind rather than a missing place', () => {
    expect(kindOfTrip({ destination: "a bar" }, undefined)).toBe("bar");
  });

  it("reads a bar the narrator described but the map has never heard of", () => {
    expect(kindOfTrip({ destination: "the cellar bar three alleys down" }, undefined)).toBe("bar");
  });

  it("falls back on the player's own words when the proposal named nothing", () => {
    expect(kindOfTrip({}, "Go find a bar and order a drink")).toBe("bar");
  });

  it("leaves a real named place alone", () => {
    expect(kindOfTrip({ destination: "Forlorn Hope" }, "go find a bar")).toBeUndefined();
  });

  it("leaves a heading alone", () => {
    expect(kindOfTrip({ direction: "west" }, "head west to find a bar")).toBeUndefined();
  });

  it("does not choose between two kinds for the player", () => {
    expect(kindOfTrip({}, "a clinic or a bar, whichever")).toBeUndefined();
  });
});

describe("saidBefore — the words a dice result follows on from", () => {
  it("finds what they typed before the check was posted", () => {
    const events = [
      event("player_input", "earlier"),
      event("player_input", "slip past the bouncer and get a drink"),
      event("check_prompt", "Stealth check", "check"),
      event("player_input", "later"),
    ];
    expect(saidBefore(events, "check")).toEqual({ said: "slip past the bouncer and get a drink" });
  });

  it("says nothing when there is nothing to say", () => {
    expect(saidBefore([event("check_prompt", "x", "check")], "check")).toEqual({});
  });
});

describe("recentLifeLines — the narrator sees what the player said", () => {
  it("interleaves the player's words with what happened", () => {
    const lines = recentLifeLines([
      event("life_narration", "Six o'clock hits the corrugated iron."),
      event("player_input", "Go find a bar and order a drink"),
      event("life_narration", "You take the stairs down."),
    ]);
    expect(lines).toEqual([
      "Six o'clock hits the corrugated iron.",
      'The player said: "Go find a bar and order a drink"',
      "You take the stairs down.",
    ]);
  });

  it("bounds the player's lines separately from the world's", () => {
    const events = Array.from({ length: 10 }, (_, i) => event("player_input", `typed ${i}`));
    events.push(event("life_narration", "the world"));
    const lines = recentLifeLines(events);
    expect(lines.filter((l) => l.startsWith("The player said"))).toHaveLength(
      PACKET_BUDGET.playerLines,
    );
    expect(lines.at(-1)).toBe("the world");
  });
});

const BASE: LifeContext = {
  clock: { day: 3, minute: 20 * 60 + 47 },
  character: {
    name: "Vela Ruiz",
    role: "Solo",
    hp: 22,
    hpMax: 35,
    woundState: "serious",
    eurobucks: 140,
    stats: { ref: 7, cool: 6 },
    skills: [{ skill: "Trading", id: "trading", base: 6 }],
  },
  situation: null,
  otherSituations: [],
  clocks: [],
  people: [],
  recentEvents: [],
};

describe("the follow-up packet carries the rest of the request", () => {
  it("shows the player's words and asks for the rest of them", () => {
    const packet = renderLifeUserPrompt(
      { ...BASE, resolved: "The character has ARRIVED.", said: "walk to the bar and sit down" },
      "(open the moment)",
    );
    expect(packet).toContain("== WHAT THE PLAYER SAID ==");
    expect(packet).toContain('"walk to the bar and sit down"');
    expect(packet).toContain("carry out the rest of what they said");
    expect(packet).not.toContain("in 1-3 sentences");
  });

  it("stays a plain result when there are no words to carry", () => {
    const packet = renderLifeUserPrompt({ ...BASE, resolved: "Done." }, "(open the moment)");
    expect(packet).not.toContain("WHAT THE PLAYER SAID");
    expect(packet).toContain("in 1-3 sentences");
  });

  it("lists the nearest place of each kind, capped", () => {
    const nearestByKind = Array.from({ length: 12 }, (_, i) => `kind${i}: Place ${i}`);
    const packet = renderLifeUserPrompt(
      {
        ...BASE,
        place: {
          where: "Old Japantown",
          district: "Old Japantown",
          area: "Westbrook",
          security: "NCPD",
          gangs: [],
          combatZone: false,
          nearby: [],
          nearestByKind,
        },
      },
      "go find a bar",
    );
    expect(packet).toContain("THE NEAREST OF EACH KIND");
    expect(packet).toContain("kind0: Place 0");
    expect(packet).not.toContain(`kind${PACKET_BUDGET.nearestByKind}:`);
    expect(packet).toContain('"seek"');
  });
});

describe("a travel proposal can ask for a kind of place", () => {
  const travel = (extra: Record<string, unknown>) =>
    normalizeLifeResponse({
      situation: { title: "t", description: "d" },
      proposedActions: [{ kind: "travel", minutes: 20, ...extra }],
    }).proposedActions[0];

  it("keeps a tag from the closed list", () => {
    expect(travel({ seek: "bar" })).toMatchObject({ kind: "travel", seek: "bar" });
  });

  it("reads a kind written in words", () => {
    expect(travel({ seek: "a bar" })).toMatchObject({ seek: "bar" });
  });

  it("drops a kind the engine has no tag for", () => {
    expect(travel({ seek: "a vibe" })).not.toHaveProperty("seek");
  });
});

describe("placesToOffer — somewhere to press when a trip could not be placed", () => {
  it("offers the nearest few of the kind that was asked for", () => {
    const offer = placesToOffer("h5", "bar", []);
    expect(offer).toHaveLength(3);
    for (const { place } of offer) expect(hasTag(place.key, "bar")).toBe(true);
  });

  it('offers somewhere real for "go there" when there was never on the map', () => {
    const offer = placesToOffer("h5", undefined, []);
    expect(offer.length).toBeGreaterThan(0);
    expect(offer.length).toBeLessThanOrEqual(3);
    expect(new Set(offer.map((o) => o.place.key)).size).toBe(offer.length);
    // Not where they are already standing.
    expect(offer.map((o) => o.place.key)).not.toContain("h5");
  });
});

describe("the packet frames a scene in progress, and a friend coming over", () => {
  const jacket = {
    key: "armor_chewed",
    category: "need" as const,
    title: "The jacket is chewed",
    summary: "It needs patching.",
    status: "live" as const,
    severity: 3,
  };
  const place = {
    where: "Forlorn Hope",
    district: "Little China",
    area: "Watson",
    security: "NCPD",
    gangs: [],
    combatZone: false,
    nearby: [],
  };

  it("marks the situation as background while they are in a scene", () => {
    const packet = renderLifeUserPrompt({ ...BASE, situation: jacket, inScene: true }, "x");
    expect(packet).toContain("ON THEIR MIND");
    expect(packet).not.toContain("CURRENT SITUATION");
    expect(packet).toContain("do not steer them back to it");
  });

  it("marks it as arriving otherwise", () => {
    const packet = renderLifeUserPrompt({ ...BASE, situation: jacket }, "x");
    expect(packet).toContain("CURRENT SITUATION (what arrives now");
  });

  it("tells the narrator somebody is coming over, only when the engine said so", () => {
    const coming = renderLifeUserPrompt(
      { ...BASE, place: { ...place, whoIsHere: { name: "Kiro", key: "kiro", comingOver: true } } },
      "x",
    );
    expect(coming).toContain("COMING OVER");
    const sitting = renderLifeUserPrompt(
      { ...BASE, place: { ...place, whoIsHere: { name: "Kiro", key: "kiro" } } },
      "x",
    );
    expect(sitting).not.toContain("COMING OVER");
    expect(sitting).toContain("They are simply here");
    const already = renderLifeUserPrompt(
      { ...BASE, place: { ...place, whoIsHere: { name: "Kiro", key: "kiro", cameOver: true } } },
      "x",
    );
    expect(already).toContain("already came over");
  });
});

describe("the packet at their regular", () => {
  const place = {
    where: "The Paper Lantern",
    district: "Old Japantown",
    area: "The Island",
    security: "Kimen-Gumi",
    gangs: [],
    combatZone: false,
    nearby: [],
  };
  const familiarity = { visits: 9, standing: "known" as const, since: "", known: [] };

  it("tells the narrator the staff know them", () => {
    const packet = renderLifeUserPrompt(
      { ...BASE, place: { ...place, familiarity: { ...familiarity, regular: true } } },
      "x",
    );
    expect(packet).toContain("THEIR REGULAR");
  });

  it("says nothing of the kind anywhere else", () => {
    const packet = renderLifeUserPrompt({ ...BASE, place: { ...place, familiarity } }, "x");
    expect(packet).not.toContain("THEIR REGULAR");
  });
});
