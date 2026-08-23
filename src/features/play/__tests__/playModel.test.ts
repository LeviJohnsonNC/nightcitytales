import { describe, expect, it } from "vitest";
import type { CampaignEvent, CampaignNpc, CampaignVitals, FullCharacter } from "@/lib/backend";
import {
  actorFor,
  characterSummary,
  keySkills,
  npcSummaries,
  recentEventLines,
} from "../playModel";

const full = {
  character: { name: "Vincent Kang", handle: "Switchblade", role: "solo" },
  stats: { ref: 8, body: 6, dex: 5, cool: 4, int: 6, tech: 4, will: 6, luck: 5, move: 6, emp: 4 },
  skills: [
    { skill_id: "handgun", level: 6 },
    { skill_id: "athletics", level: 2 },
    { skill_id: "brawling", level: 0 },
  ],
} as unknown as FullCharacter;

const vitals = {
  hp_current: 32,
  hp_max: 40,
  wound_state: "light",
  humanity_current: 44,
  humanity_max: 60,
  eurobucks: 1030,
} as unknown as CampaignVitals;

describe("actorFor", () => {
  it("extracts stats and skill levels", () => {
    const actor = actorFor(full);
    expect(actor.stats.ref).toBe(8);
    expect(actor.skills).toContainEqual({ skillId: "handgun", level: 6 });
  });
});

describe("keySkills", () => {
  it("lists trained skills as Skill+base, highest first, dropping level-0", () => {
    const skills = keySkills(full);
    expect(skills[0]).toEqual({ skill: "Handgun", id: "handgun", base: 14 }); // REF 8 + 6
    expect(skills.some((s) => s.skill === "Brawling")).toBe(false); // level 0 dropped
  });
});

describe("characterSummary", () => {
  it("merges sheet and live vitals", () => {
    const s = characterSummary(full, vitals);
    expect(s).toMatchObject({
      name: "Vincent Kang",
      handle: "Switchblade",
      role: "solo",
      hp: 32,
      hpMax: 40,
      woundState: "light",
      humanity: 44,
      eurobucks: 1030,
    });
  });
});

describe("npcSummaries & recentEventLines", () => {
  it("maps NPCs and recent events to compact forms", () => {
    const npcs = npcSummaries([
      {
        name: "The Master",
        disposition: 1,
        status: "alive",
        location: "Symphony Hall",
      } as CampaignNpc,
    ]);
    expect(npcs[0]).toMatchObject({
      name: "The Master",
      disposition: 1,
      notes: "at Symphony Hall",
    });

    const lines = recentEventLines([
      { summary: "Campaign started in Night City.", type: "campaign_started" } as CampaignEvent,
      { summary: null, type: "beat_advanced" } as CampaignEvent,
    ]);
    expect(lines).toEqual(["Campaign started in Night City.", "beat_advanced"]);
  });
});
