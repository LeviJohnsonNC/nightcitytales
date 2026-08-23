import { describe, expect, it } from "vitest";
import { NIGHT_AT_THE_OPERA, getBeat } from "@/engine";
import { buildGmContext, renderGmUserPrompt, type GmCharacterSummary } from "../gmContext";

const character: GmCharacterSummary = {
  name: "Vincent Kang",
  handle: "Switchblade",
  role: "solo",
  hp: 40,
  hpMax: 40,
  woundState: "none",
  humanity: 44,
  humanityMax: 60,
  eurobucks: 1030,
  stats: { ref: 8, body: 6 },
  keySkills: [{ skill: "Handgun", id: "handgun", base: 14 }],
};

describe("renderGmUserPrompt", () => {
  const mission = NIGHT_AT_THE_OPERA;
  const beat = getBeat(mission, "getting_tickets");
  const context = buildGmContext({
    mission,
    beat,
    availableExits: beat.exits,
    character,
    objectives: [{ id: "background.0", text: "Recover Lucy Rhinemeyer", status: "active" }],
    npcsPresent: [{ name: "Gossiping student", disposition: 0, status: "alive" }],
    recentEvents: ["Took the job from Rhinemeyer's rep"],
    clock: "Day 1, 18:00",
  });

  it("renders the scene, the sheet numbers, choices, and the player input", () => {
    const prompt = renderGmUserPrompt(context, "I ask the students about the missing women");
    expect(prompt).toContain("A Night at the Opera — Beat: Getting Tickets (dev)");
    expect(prompt).toContain("Recover Lucy Rhinemeyer");
    expect(prompt).toContain("HP 40/40 (none)");
    expect(prompt).toContain("Humanity 44/60");
    expect(prompt).toContain("[night_at_opera]");
    expect(prompt).toContain("[empty_office_hours]");
    expect(prompt).toContain("== PLAYER INPUT ==");
    expect(prompt).toContain("the missing women");
  });

  it("omits sections that are empty", () => {
    const bare = buildGmContext({
      mission,
      beat,
      availableExits: [],
      character: { ...character, keySkills: [] },
      objectives: [],
      npcsPresent: [],
      recentEvents: [],
    });
    const prompt = renderGmUserPrompt(bare, "look around");
    expect(prompt).not.toContain("== NPCS PRESENT ==");
    expect(prompt).not.toContain("== RECENT ==");
    expect(prompt).not.toContain("Key skills");
  });
});
