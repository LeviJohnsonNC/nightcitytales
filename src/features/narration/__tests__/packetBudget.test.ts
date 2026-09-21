import { describe, expect, it } from "vitest";
import { NIGHT_AT_THE_OPERA, getBeat } from "@/engine";
import { PLACE_DOSSIERS, dossierForPrompt } from "@/features/atlas/placeDossiers";
import {
  buildGmContext,
  renderGmUserPrompt,
  type GmCharacterSummary,
} from "@/features/gm/gmContext";
import { renderLifeUserPrompt, type LifeContext } from "@/features/life/lifeContext";
import { PACKET_BUDGET, clipDossier, withinBudget } from "../packetBudget";

/**
 * The token accounting, such as it is.
 *
 * Nothing counted before this. The packet was whatever the renderers emitted,
 * several of its lists grew with play, and no test anywhere would have noticed
 * a section doubling. The ceiling below is that test: it builds a packet more
 * extreme than play should ever produce and asserts it still fits.
 *
 * When it fails, the fix is one of two things and never a third:
 *   - the new section is bigger than it needs to be, so trim it; or
 *   - it genuinely earns the room, so raise the number HERE, in one edit,
 *     having looked at what that costs per turn.
 * What it must not become is a number nudged up whenever it goes red.
 */

const character: GmCharacterSummary = {
  name: "Vela Ruiz",
  handle: "Ratchet",
  role: "solo",
  hp: 34,
  hpMax: 40,
  woundState: "light",
  eurobucks: 1030,
  stats: { ref: 8, body: 6 },
  // Forty skills is more than a character has; the point is that the cap holds
  // for a sheet fuller than play produces.
  keySkills: Array.from({ length: 40 }, (_, i) => ({
    skill: `Skill ${i}`,
    id: `skill_${i}`,
    base: 10,
  })),
};

const longest = Object.values(PLACE_DOSSIERS).sort((a, b) => b.text.length - a.text.length)[0]!;

/** Everything at once, each list past its cap. Play should never reach this. */
function worstCaseGmPacket(): string {
  const beat = getBeat(NIGHT_AT_THE_OPERA, "empty_office_hours");
  return renderGmUserPrompt(
    buildGmContext({
      mission: NIGHT_AT_THE_OPERA,
      beat,
      availableExits: beat.exits,
      character,
      objectives: Array.from({ length: 20 }, (_, i) => ({
        id: `o${i}`,
        text: `An objective that is still open, number ${i}`,
        status: "active" as const,
      })),
      npcsPresent: Array.from({ length: 20 }, (_, i) => ({
        name: `Person ${i}`,
        key: `person_${i}`,
        disposition: 0,
        status: "alive",
        notes: "Something about them that runs on for a while, as notes do",
        known: Array.from({ length: 10 }, (_, k) => `A fact the player worked out, ${k}`),
      })),
      recentEvents: Array.from({ length: 8 }, (_, i) => `Something that happened, ${i}`),
      chronicle: Array.from({ length: 16 }, (_, i) => `Campaign memory, line ${i}.`),
      capabilities: Array.from({ length: 60 }, (_, i) => `A weapon or a piece of kit, ${i}`),
      clock: "Day 2, 19:10",
      place: {
        where: "Mister Rice Guy",
        district: "Rancho Coronado",
        area: "Heywood",
        security: "NCPD (in theory)",
        blurb: "A conveyor-belt sushi place with a virtual mascot.",
        dossier: clipDossier(longest.text),
        gangs: ["6th Street"],
        combatZone: false,
        nearby: Array.from({ length: 20 }, (_, i) => `Nearby place ${i}`),
        neighbours: Array.from({ length: 20 }, (_, i) => `District ${i}, north, 20 minutes`),
        familiarity: {
          visits: 9,
          standing: "known",
          since: " over three weeks",
          known: Array.from({ length: 30 }, (_, i) => `Something standing here taught them, ${i}`),
        },
      },
    }),
    "I look around.",
  );
}

function worstCaseLifePacket(): string {
  const ctx: LifeContext = {
    clock: { day: 3, minute: 21 * 60 + 40 },
    character: {
      name: "Vela Ruiz",
      role: "Solo",
      hp: 34,
      hpMax: 40,
      woundState: "light",
      eurobucks: 1030,
      stats: { ref: 8, cool: 6 },
      skills: Array.from({ length: 40 }, (_, i) => ({
        skill: `Skill ${i}`,
        id: `skill_${i}`,
        base: 10,
      })),
    },
    situation: null,
    otherSituations: [],
    clocks: [],
    people: Array.from({ length: 20 }, (_, i) => ({
      name: `Person ${i}`,
      key: `person_${i}`,
      disposition: 0,
      status: "alive",
      notes: "Something about them that runs on for a while, as notes do",
      known: Array.from({ length: 10 }, (_, k) => `A fact the player worked out, ${k}`),
    })),
    recentEvents: Array.from({ length: 6 }, (_, i) => `Something that happened, ${i}`),
    chronicle: Array.from({ length: 16 }, (_, i) => `Campaign memory, line ${i}.`),
    capabilities: Array.from({ length: 60 }, (_, i) => `A weapon or a piece of kit, ${i}`),
  };
  return renderLifeUserPrompt(ctx, "I go out and find somewhere to eat.");
}

describe("the packet has a ceiling", () => {
  /**
   * Characters, not tokens. A tokenizer would be a dependency the repo does not
   * have, for a number that only has to be stable; four characters to the token
   * is close enough to reason about, so these are roughly 3,250 and 1,800
   * tokens of context on top of the system prompt.
   *
   * Set deliberately tight — the fixtures render to 12,450 and 7,270 today, so
   * there is about four percent of slack. That is the point. The fixtures are
   * deterministic, so any movement at all is a real change to what the model is
   * sent, and a change worth making is worth noticing.
   */
  const GM_CEILING = 13_000;
  const LIFE_CEILING = 7_600;

  it("holds for a Job turn with every list past its cap", () => {
    const packet = worstCaseGmPacket();
    expect(packet.length, `GM packet is ${packet.length} chars`).toBeLessThan(GM_CEILING);
  });

  it("holds for a Life turn with every list past its cap", () => {
    const packet = worstCaseLifePacket();
    expect(packet.length, `Life packet is ${packet.length} chars`).toBeLessThan(LIFE_CEILING);
  });

  it("is actually bounded, not merely small — the caps are what hold it", () => {
    // Without this, the ceilings above would pass just as happily on a renderer
    // that had quietly stopped capping anything, as long as the fixture stayed
    // small. Twenty people at ten facts each must not all arrive.
    const packet = worstCaseGmPacket();
    expect(packet).toContain("Person 0");
    expect(packet).not.toContain(`Person ${PACKET_BUDGET.npcsPresent}`);
    expect(packet).toContain("A weapon or a piece of kit, 0");
    expect(packet).not.toContain(`A weapon or a piece of kit, ${PACKET_BUDGET.capabilities}`);
  });
});

describe("clipping a dossier", () => {
  it("leaves one that already fits exactly alone", () => {
    const short = "One paragraph, and not a long one.";
    expect(clipDossier(short)).toBe(short);
  });

  it("cuts whole paragraphs off the end rather than mid-sentence", () => {
    const text = ["A".repeat(500), "B".repeat(500), "C".repeat(500)].join("\n\n");
    const clipped = clipDossier(text, 1100);
    expect(clipped).toBe(["A".repeat(500), "B".repeat(500)].join("\n\n"));
  });

  it("keeps the first paragraph however long it is", () => {
    // A place with nothing said about it is worse than one described at length:
    // the fault this canon exists to fix was a narrator inventing a greasy
    // noodle counter for an automated sushi place.
    const huge = "A".repeat(9000);
    expect(clipDossier(`${huge}\n\nmore`, 100)).toBe(huge);
  });

  it("fits every real dossier inside the budget, bar a long opening", () => {
    const overs = Object.entries(PLACE_DOSSIERS)
      .map(([key, entry]) => [key, clipDossier(entry.text).length] as const)
      .filter(([, len]) => len > PACKET_BUDGET.dossierChars);
    // Any over-budget entry must be a single paragraph that could not be cut
    // further, never a failure to cut.
    for (const [key] of overs) {
      const clipped = clipDossier(PLACE_DOSSIERS[key]!.text);
      expect(clipped.includes("\n\n"), `${key} is over budget with more than one paragraph`).toBe(
        false,
      );
    }
  });

  it("never reduces a real dossier to nothing", () => {
    for (const [key, entry] of Object.entries(PLACE_DOSSIERS)) {
      expect(clipDossier(entry.text).length, key).toBeGreaterThan(0);
    }
  });
});

describe("dossierForPrompt", () => {
  it("hands the narrator the clipped text, not the whole page", () => {
    // The atlas screen shows a reader the whole thing; the model gets what the
    // packet can afford.
    const key = Object.entries(PLACE_DOSSIERS).find(
      ([, e]) => e.text.length > PACKET_BUDGET.dossierChars,
    )?.[0];
    expect(key, "expected at least one dossier over budget").toBeDefined();
    const forPrompt = dossierForPrompt(key!, null);
    expect(forPrompt?.text.length).toBeLessThanOrEqual(PACKET_BUDGET.dossierChars);
    expect(forPrompt?.text.length).toBeLessThan(PLACE_DOSSIERS[key!]!.text.length);
  });
});

describe("withinBudget", () => {
  it("returns a short list unchanged and a long one cut to the cap", () => {
    expect(withinBudget([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(withinBudget([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
  });

  it("copies rather than aliasing, so a caller cannot mutate the source", () => {
    const source = [1, 2, 3];
    withinBudget(source, 5).push(4);
    expect(source).toEqual([1, 2, 3]);
  });
});
