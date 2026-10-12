/**
 * What the narrator is told about the faces the player will see.
 *
 * Every portrait is fixed, so every line here is a claim the narrator may not
 * contradict. The tests hold the two halves of that bargain: the packet carries
 * the look (people, sellers, walk-ons), and the walk-on resolved afterwards is
 * the face that was announced beforehand.
 */
import { describe, expect, it } from "vitest";
import content from "@/data/cast/cast-content.json";
import { NIGHT_AT_THE_OPERA, getBeat, shopsAt, tagsOf } from "@/engine";
import GAMEPLAY from "@/data/atlas/places.gameplay.json";
import { renderGmUserPrompt, buildGmContext } from "@/features/gm/gmContext";
import { npcSummaries } from "@/features/play/playModel";
import type { CampaignNpc } from "@/lib/backend";
import { alsoHereAt } from "../alsoHere";
import { renderLifeUserPrompt, type LifeContext } from "../lifeContext";
import { lifePeople } from "../lifeModel";

const row = (name: string): CampaignNpc =>
  ({ npc_id: name.toLowerCase(), name, disposition: 0, status: "alive", data: {} }) as never;

const BASE: LifeContext = {
  clock: { day: 3, minute: 20 * 60 },
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

const PLACE = {
  where: "somewhere",
  district: "Watson",
  area: "Watson",
  security: "NCPD",
  gangs: [],
  combatZone: false,
  nearby: [],
};

describe("people in the packet", () => {
  const names = Object.entries(content)
    .filter(([key]) => key !== "_about")
    .flatMap(([, pool]) => (pool as { names: string[] }).names);

  it("fixes a look for every one of the standing cast, as a band and never a number", () => {
    for (const person of lifePeople(names.map(row), 1)) {
      expect(person.seenAs, person.name).toBeTruthy();
      expect(person.seenAs, person.name).not.toMatch(/\d/);
    }
  });

  it("prints it under the name in a Life turn, before anything the narrator might lean on", () => {
    const prompt = renderLifeUserPrompt(
      { ...BASE, people: lifePeople([row("Ilsa Bräun")], 1) },
      "I call her.",
    );
    expect(prompt).toMatch(/- Ilsa Bräun \[[^\]]+\]/);
    expect(prompt).toContain("    Seen as: woman, middle-aged");
  });

  it("prints it in a job turn too", () => {
    const beat = getBeat(NIGHT_AT_THE_OPERA, "getting_tickets");
    const [npc] = npcSummaries([row('Marcus "Tally" Oyelaran')], 1);
    const prompt = renderGmUserPrompt(
      buildGmContext({
        mission: NIGHT_AT_THE_OPERA,
        beat,
        availableExits: beat.exits,
        character: {
          name: "Vincent Kang",
          role: "solo",
          hp: 40,
          hpMax: 40,
          woundState: "none",
          humanity: 44,
          humanityMax: 60,
          eurobucks: 1030,
          stats: { ref: 8, body: 6 },
          keySkills: [{ skill: "Handgun", id: "handgun", base: 14 }],
        },
        objectives: [],
        npcsPresent: [npc!],
        recentEvents: [],
      }),
      "I talk to him",
    );
    expect(prompt).toContain("Seen as: man, middle-aged");
  });

  it("says nothing for somebody it has no picture of", () => {
    const [person] = lifePeople([row("A Stranger Nobody Drew")], 1);
    expect(person!.seenAs).toBeUndefined();
  });
});

describe("the people already in the room", () => {
  const barKey = Object.keys(GAMEPLAY.places).find(
    (k) => tagsOf(k).includes("bar") && shopsAt(k).length === 0,
  )!;

  it("are named in the packet with the face the player will be shown", () => {
    const here = alsoHereAt("c1", barKey);
    const prompt = renderLifeUserPrompt({ ...BASE, place: { ...PLACE, alsoHere: here.lines } }, "");
    expect(prompt).toContain('Also here: "dive-bar-tender" (Dive Bar Tender): ');
    expect(prompt).toMatch(/the same sex for every pronoun/);
    expect(prompt).toContain("walkOns");
  });

  it("are the face that was announced, whatever the narrator asks for afterwards", async () => {
    const { resolveWalkOns } = await import("@/features/cast/walkOnMention");
    const here = alsoHereAt("c1", barKey);
    const told = here.people.find((p) => p.subject === "dive-bar-tender")!;
    const asked = told.gender === "male" ? "female" : "male";
    const [face] = resolveWalkOns(
      [{ subject: "dive-bar-tender", gender: asked }],
      here.seed,
      here.subjects,
    );
    expect(face!.gender).toBe(told.gender);
  });

  it("do not include a second clerk where a named keeper already runs the counter", () => {
    const shopKey = Object.keys(GAMEPLAY.places).find(
      (k) => tagsOf(k).includes("shop") && shopsAt(k).some((s) => s.keeper),
    )!;
    const subjects = alsoHereAt("c1", shopKey).subjects;
    expect(subjects).not.toContain("convenience-clerk");
    expect(subjects).not.toContain("street-vendor");
  });
});
