import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  getPlace,
  placeFamiliarity,
  standingFor,
  startingState,
  recordVisit,
} from "@/engine";
import { PLACE_DOSSIERS, dossierForPrompt } from "@/features/atlas/placeDossiers";
import { NIGHT_AT_THE_OPERA, getBeat } from "@/engine";
import { buildGmContext, renderGmUserPrompt, type GmContext } from "@/features/gm/gmContext";
import { CYBERPUNK_STYLE_GUIDE } from "@/lib/prose-style";
import { GM_SYSTEM_PROMPT } from "@/features/gm/gmSystemPrompt";
import { LIFE_SYSTEM_PROMPT } from "../lifeSystemPrompt";
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

describe("how well the character knows where they are standing", () => {
  it("bands by the ladder the engine already uses, not by new numbers", () => {
    expect(standingFor(0)).toBe("first");
    expect(standingFor(1)).toBe("first");
    expect(standingFor(2)).toBe("returning");
    expect(standingFor(5)).toBe("returning");
    // Six is the intel ladder's own top rung, and the number a character starts
    // with for the building they live in.
    expect(standingFor(6)).toBe("known");
    expect(standingFor(40)).toBe("known");
  });

  it("counts the visits the campaign actually recorded", () => {
    let state = startingState("w3");
    for (let day = 1; day <= 4; day += 1) state = recordVisit(state, day);
    const read = placeFamiliarity("w3", state, 4)!;
    expect(read.visits).toBe(4);
    expect(read.standing).toBe("returning");
    expect(read.daysSince).toBe(0);
  });

  it("knows how long it has been", () => {
    let state = startingState("w3");
    state = recordVisit(state, 2);
    expect(placeFamiliarity("w3", state, 9)!.daysSince).toBe(7);
  });

  it("treats somewhere never visited as never visited", () => {
    const read = placeFamiliarity("w3", undefined, 5)!;
    expect(read.visits).toBe(0);
    expect(read.standing).toBe("first");
    expect(read.daysSince).toBeNull();
  });

  it("says nothing about a place the atlas does not have", () => {
    expect(placeFamiliarity("zz9", undefined, 1)).toBeNull();
  });
});

describe("the narrator is told what to do about it", () => {
  const known = ["What it is: a market."];

  it("establishes a place on the first visit", () => {
    const prompt = lifePrompt({
      familiarity: { visits: 1, standing: "first", since: "", known: [] },
    });
    expect(prompt).toContain("HOW WELL THEY KNOW THIS PLACE");
    expect(prompt).toMatch(/never been here before/i);
    expect(prompt).toMatch(/full picture/i);
  });

  it("forbids establishing it again on a return", () => {
    // The whole feature. Before this, every arrival read as a first arrival.
    const prompt = lifePrompt({
      familiarity: { visits: 3, standing: "returning", since: ", last here yesterday", known },
    });
    expect(prompt).toContain("DO NOT ESTABLISH IT AGAIN");
    expect(prompt).toContain("last here yesterday");
    expect(prompt).not.toMatch(/never been here before/i);
  });

  it("makes somewhere they know cold read as furniture", () => {
    const prompt = lifePrompt({
      familiarity: { visits: 40, standing: "known", since: "", known },
    });
    expect(prompt).toMatch(/know this place cold/i);
    expect(prompt).toMatch(/furniture/i);
    expect(prompt).not.toContain("DO NOT ESTABLISH IT AGAIN");
  });

  it("gives a first visit and a fortieth different instructions", () => {
    const first = lifePrompt({
      familiarity: { visits: 1, standing: "first", since: "", known: [] },
    });
    const fortieth = lifePrompt({
      familiarity: { visits: 40, standing: "known", since: "", known },
    });
    expect(first).not.toBe(fortieth);
  });

  it("tells the job screen too", () => {
    const prompt = gmPrompt({
      familiarity: { visits: 3, standing: "returning", since: "", known },
    });
    expect(prompt).toContain("DO NOT ESTABLISH IT AGAIN");
  });

  it("stops the dossier being recited on every visit", () => {
    // The canon reaching the model made repetition MORE likely, not less: with a
    // fixed body of facts to reach for it would list the same ones every time.
    const prompt = lifePrompt({
      dossier: PLACE_DOSSIERS["w3"]!.text,
      familiarity: { visits: 9, standing: "known", since: "", known },
    });
    expect(prompt).toMatch(/do not get DESCRIBED on every visit/i);
  });

  it("says nothing when the character is nowhere in particular", () => {
    expect(lifePrompt({})).not.toContain("HOW WELL THEY KNOW THIS PLACE");
  });
});

describe("which specifics belong to the narrator", () => {
  it("no longer invites it to invent a price", () => {
    // "Reach for specifics (a manufacturer, a neighborhood, A PRICE...)" sat
    // beside "do not invent numbers", and the model resolved that tension by
    // pricing a bowl of noodles at 5eb.
    expect(CYBERPUNK_STYLE_GUIDE).not.toMatch(/specifics \([^)]*a price/i);
    expect(CYBERPUNK_STYLE_GUIDE).toMatch(/A NUMBER IS NOT YOURS/);
    expect(CYBERPUNK_STYLE_GUIDE).toMatch(/Never price it yourself/);
  });

  it("still wants the specifics that are the narrator's", () => {
    expect(CYBERPUNK_STYLE_GUIDE).toMatch(/brand, a street, a face/i);
  });

  it("gives the job screen the same voice as the rest of the game", () => {
    // gmSystemPrompt never imported the house style, so the main play loop ran
    // on three generic bullets while the between-jobs mode had the whole guide.
    expect(GM_SYSTEM_PROMPT).toContain(CYBERPUNK_STYLE_GUIDE);
    expect(LIFE_SYSTEM_PROMPT).toContain(CYBERPUNK_STYLE_GUIDE);
  });
});

/**
 * Being a local is the one kind of knowledge that can be true on a FIRST visit,
 * and the prompt has to say so before the standing lines are acted on —
 * otherwise the narrator reads "never been here" and introduces the character
 * to their own neighbourhood.
 */
describe("the narrator is told when the ground is the character's own", () => {
  const own = ["Who claims this ground: the Albino Alligators."];
  const localFamiliarity = {
    visits: 0,
    standing: "first" as const,
    since: "",
    known: own,
    asALocal: own,
    localExpert: { level: 6, districtName: "Rancho Coronado" },
  };

  it("names the neighbourhood and the Level, on both screens", () => {
    for (const prompt of [
      lifePrompt({ familiarity: localFamiliarity }),
      gmPrompt({ familiarity: localFamiliarity }),
    ]) {
      expect(prompt).toContain("Rancho Coronado");
      expect(prompt).toContain("Local Expert 6");
    }
  });

  it("says not to write them as a stranger even on a first visit", () => {
    const prompt = lifePrompt({ familiarity: localFamiliarity });
    // The standing line still says they have not been inside this building...
    expect(prompt).toMatch(/never been here before/i);
    // ...and the local line stops that being read as a stranger to the area.
    expect(prompt).toMatch(/do not write them as a stranger/i);
  });

  it("does not brief a runner on their own neighbourhood", () => {
    expect(gmPrompt({ familiarity: localFamiliarity })).toMatch(
      /do not brief them on their own neighbourhood/i,
    );
  });

  it("separates what they have seen from what they know as a local", () => {
    const seen = ["What it is: a market."];
    const asLocal = ["What noise costs here: nothing."];
    const prompt = lifePrompt({
      familiarity: {
        visits: 3,
        standing: "returning",
        since: "",
        known: [...seen, ...asLocal],
        asALocal: asLocal,
        localExpert: { level: 4, districtName: "Kabuki" },
      },
    });
    expect(prompt).toContain("What their own time here has taught them:");
    expect(prompt).toContain(
      "What they know because they are a local here, not because they have been in:",
    );
    // Each fact appears under exactly one heading.
    const ownIndex = prompt.indexOf(seen[0]!);
    const localIndex = prompt.indexOf(asLocal[0]!);
    expect(ownIndex).toBeGreaterThan(-1);
    expect(localIndex).toBeGreaterThan(ownIndex);
  });

  it("says nothing about being a local for somebody who is not one", () => {
    const visitedFact = "What it is: a market.";
    const prompt = lifePrompt({
      familiarity: { visits: 3, standing: "returning", since: "", known: [visitedFact] },
    });
    expect(prompt).not.toContain("Local Expert");
    expect(prompt).not.toMatch(/this is their NEIGHBOURHOOD/i);
    // And the visited facts still reach the model under their own heading.
    expect(prompt).toContain("What their own time here has taught them:");
    expect(prompt).toContain(visitedFact);
  });

  it("forbids an NPC explaining to them what they already know", () => {
    for (const prompt of [
      lifePrompt({ familiarity: localFamiliarity }),
      gmPrompt({ familiarity: localFamiliarity }),
    ]) {
      expect(prompt).toMatch(/never have (a passer-by or a bartender|an NPC) explain/i);
    }
  });
});

/**
 * The guarantee the truth system exists for: a hidden fact the character has
 * not found is not withheld from the narrator by instruction — it is never sent.
 * A model that can see a secret will telegraph it.
 */
describe("what the narrator is told about hidden truths", () => {
  const found = "There is a way into the Motor Pool that is not the front door.";

  it("sends a discovered truth, and says it is established", () => {
    const prompt = lifePrompt({ discovered: [found] });
    expect(prompt).toContain("WHAT THEY HAVE FOUND HERE");
    expect(prompt).toContain(found);
    expect(prompt).toMatch(/do not re-reveal one as though it were new/i);
  });

  it("forbids the narrator inventing a discovery of its own", () => {
    const prompt = lifePrompt({ discovered: [found] });
    expect(prompt).toMatch(/never invent a discovery of your own/i);
    expect(prompt).toMatch(/the engine's to say, on a check/i);
  });

  it("says nothing at all when they have found nothing", () => {
    // Not an empty heading, and not a note that something is hidden here —
    // either would tell the player there is something to look for.
    const prompt = lifePrompt({});
    expect(prompt).not.toContain("WHAT THEY HAVE FOUND HERE");
  });

  it("carries no trace of an undiscovered truth", () => {
    // The whole invariant, stated as a test: an unfound fact is absent from the
    // prompt, not mentioned as unfound.
    const secret = "The stock is somewhere else, and somebody walks there and back.";
    const prompt = lifePrompt({ discovered: [found] });
    expect(prompt).not.toContain(secret);
  });
});

/** The Life side of the deduction offer: that there is one, and the DV. */
describe("a conclusion on offer in Life", () => {
  it("says there is something to work out, and never what", () => {
    const prompt = lifePrompt({ deduction: { dv: 15, count: 1 } });
    expect(prompt).toContain("THERE IS SOMETHING TO BE WORKED OUT HERE");
    expect(prompt).toContain("Deduction check at DV 15");
    expect(prompt).toMatch(/you do not know what it is/i);
    expect(prompt).toMatch(/must not guess at it, hint at it/i);
  });

  it("says nothing when there is nothing to work out", () => {
    expect(lifePrompt({})).not.toContain("THERE IS SOMETHING TO BE WORKED OUT");
  });
});
