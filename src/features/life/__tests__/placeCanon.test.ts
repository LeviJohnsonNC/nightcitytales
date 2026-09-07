import { describe, expect, it } from "vitest";
import { DISTRICTS, getPlace } from "@/engine";
import { PLACE_DOSSIERS, dossierForPrompt } from "@/features/atlas/placeDossiers";
import { NIGHT_AT_THE_OPERA, getBeat } from "@/engine";
import { buildGmContext, renderGmUserPrompt, type GmContext } from "@/features/gm/gmContext";
import { renderLifeUserPrompt, type LifeContext } from "../lifeContext";

/**
 * What the narrator is told about where the character is standing.
 *
 * The dossiers were written to be read and were never sent to the model, which
 * is why a visit to Mister Rice Guy — an ownerless automated conveyor-belt
 * sushi place with colour-coded price tiers and a virtual mascot — produced a
 * greasy noodle counter with a human line cook. Nothing was broken; the
 * narrator had simply never been told, and invented something plausible for a
 * `restaurant, food, crowd` venue in a poor coastal district.
 *
 * These hold the canon on the path to the prompt, on both screens.
 */

const BASE_CHARACTER = {
  name: "Nyx",
  role: "Solo",
  hp: 30,
  hpMax: 30,
  woundState: "Unharmed",
  eurobucks: 500,
  stats: { REF: 6 },
  skills: [{ skill: "Athletics", id: "athletics", base: 6 }],
};

/** A Life prompt for somebody standing at a named venue. */
function lifePrompt(place: Partial<NonNullable<LifeContext["place"]>>): string {
  const context = {
    clock: { day: 3, minute: 20 * 60 },
    character: BASE_CHARACTER,
    situation: null,
    otherSituations: [],
    clocks: [],
    people: [],
    recentEvents: [],
    place: {
      where: "Mister Rice Guy, Pacifica Playground (Southside)",
      district: "Pacifica Playground",
      area: "Southside",
      security: "Militech",
      gangs: [],
      combatZone: false,
      nearby: [],
      ...place,
    },
  } as unknown as LifeContext;
  return renderLifeUserPrompt(context, "I go in and look around.");
}

/**
 * A job prompt for the same, built through buildGmContext so this exercises the
 * real assembly rather than a hand-made object that happens to type-check.
 */
function gmPrompt(place: Partial<NonNullable<GmContext["place"]>>): string {
  const mission = NIGHT_AT_THE_OPERA;
  const beat = getBeat(mission, "getting_tickets");
  const context = buildGmContext({
    mission,
    beat,
    availableExits: beat.exits,
    character: {
      name: "Nyx",
      handle: "Ghost",
      role: "solo",
      hp: 30,
      hpMax: 30,
      woundState: "none",
      eurobucks: 500,
      stats: { ref: 6 },
      keySkills: [{ skill: "Athletics", id: "athletics", base: 6 }],
    },
    objectives: [],
    npcsPresent: [],
    recentEvents: [],
    clock: "Day 3, 20:00",
    place: {
      where: "Mister Rice Guy, Pacifica Playground (Southside)",
      district: "Pacifica Playground",
      area: "Southside",
      security: "Militech",
      gangs: [],
      combatZone: false,
      nearby: [],
      ...place,
    },
  });
  return renderGmUserPrompt(context, "I go in and look around.");
}

describe("the dossier for where the character is standing", () => {
  it("prefers the venue over the district it sits in", () => {
    // The room, not the borough. Standing in a named building, what the model
    // needs to describe is that building.
    const at = dossierForPrompt("w3", "pacifica_playground");
    expect(at?.name).toBe("w3");
    expect(at?.text).toContain("Hime Cat");
  });

  it("falls back to the district when there is no venue", () => {
    const between = dossierForPrompt(null, "pacifica_playground");
    expect(between?.name).toBe("pacifica_playground");
  });

  it("hands back nothing rather than something wrong", () => {
    expect(dossierForPrompt(null, null)).toBeUndefined();
    expect(dossierForPrompt("zz9", "atlantis")).toBeUndefined();
  });

  it("has something to say about every place a character can stand", () => {
    // A venue with no dossier and no district dossier would leave the narrator
    // exactly where it was before this existed.
    for (const district of DISTRICTS) {
      for (const place of district.locations) {
        expect(dossierForPrompt(place.key, district.key), place.name).toBeDefined();
      }
    }
  });
});

describe("the canon reaches the narrator", () => {
  it("puts the atlas's own line in the Life prompt", () => {
    // One sentence, already written for every location, and on its own enough
    // to have prevented the noodle counter.
    const blurb = getPlace("w3")!.blurb;
    expect(blurb).toContain("Hime Cat");
    expect(lifePrompt({ blurb })).toContain(blurb);
  });

  it("puts the written dossier in the Life prompt", () => {
    const dossier = PLACE_DOSSIERS["w3"]!.text;
    const prompt = lifePrompt({ dossier });
    expect(prompt).toContain("WHAT IS TRUE ABOUT THIS PLACE");
    expect(prompt).toContain("conveyor");
  });

  it("puts both in the job prompt too", () => {
    // Two prompt builders, one gap. A job at a named building should describe
    // that building rather than a plausible one.
    const blurb = getPlace("w3")!.blurb;
    const dossier = PLACE_DOSSIERS["w3"]!.text;
    const prompt = gmPrompt({ blurb, dossier });
    expect(prompt).toContain(blurb);
    expect(prompt).toContain("WHAT IS TRUE ABOUT THIS PLACE");
  });

  it("says the dossier is fact rather than prose to reuse", () => {
    // Nearly half the dossiers end in something written for a reader — "that
    // makes it ideal for runners; investigators come because...". Sent without
    // this, the model narrates that at the player or invents the investigator.
    const prompt = lifePrompt({ dossier: PLACE_DOSSIERS["w3"]!.text });
    expect(prompt).toMatch(/established fact/i);
    expect(prompt).toMatch(/not prose to reuse|NOT prose to reuse/i);
    expect(prompt).toMatch(/do not quote/i);
  });

  it("says nothing about a place when there is nothing to say", () => {
    const prompt = lifePrompt({});
    expect(prompt).not.toContain("WHAT IS TRUE ABOUT THIS PLACE");
  });

  it("sends one place's dossier and not the city's", () => {
    // 196 dossiers exist. Exactly one belongs in a turn.
    const prompt = lifePrompt({ dossier: PLACE_DOSSIERS["w3"]!.text });
    const others = ["Camden Court", "Eagle Rock Stadium", "Minimallism", "Zone Station"];
    for (const name of others) expect(prompt).not.toContain(name);
  });
});
