import { describe, expect, it } from "vitest";
import { NIGHT_AT_THE_OPERA, getBeat } from "@/engine";
import {
  buildGmContext,
  renderGmUserPrompt,
  DRY_STREAK_THRESHOLD,
  type GmCharacterSummary,
} from "../gmContext";

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

  it("says nothing about dice while the player is still rolling", () => {
    const warm = buildGmContext({
      mission,
      beat,
      availableExits: [],
      character,
      objectives: [],
      npcsPresent: [],
      recentEvents: [],
      turnsSinceLastRoll: DRY_STREAK_THRESHOLD - 1,
    });
    expect(renderGmUserPrompt(warm, "keep walking")).not.toContain("== DICE ==");
  });

  it("calls out a dry streak once it crosses the threshold", () => {
    const cold = buildGmContext({
      mission,
      beat,
      availableExits: [],
      character,
      objectives: [],
      npcsPresent: [],
      recentEvents: [],
      turnsSinceLastRoll: DRY_STREAK_THRESHOLD,
    });
    const prompt = renderGmUserPrompt(cold, "keep walking");
    expect(prompt).toContain("== DICE ==");
    expect(prompt).toContain(`not rolled in ${DRY_STREAK_THRESHOLD} turns`);
  });

  it("omits the dice section entirely when the streak is not supplied", () => {
    expect(renderGmUserPrompt(context, "look around")).not.toContain("== DICE ==");
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

  it("says nothing about options unless the player asked for them", () => {
    expect(renderGmUserPrompt(context, "I go in the side door")).not.toContain(
      "THEY ARE ASKING WHAT THEY COULD DO",
    );
    const asked = buildGmContext({ ...context, optionsRequested: true });
    const prompt = renderGmUserPrompt(asked, "(What are my options here?)");
    expect(prompt).toContain("THEY ARE ASKING WHAT THEY COULD DO");
    expect(prompt).toContain("Do not advance the fiction");
  });
});

describe("the secret the job was built around", () => {
  const mission = NIGHT_AT_THE_OPERA;
  const beat = getBeat(mission, "getting_tickets");
  const base = {
    mission,
    beat,
    availableExits: beat.exits,
    character,
    objectives: [],
    npcsPresent: [],
    recentEvents: [],
  };

  it("says nothing when no complication was rolled", () => {
    const prompt = renderGmUserPrompt(buildGmContext(base), "I look around");
    expect(prompt).not.toContain("WHAT THE BRIEF LEFT OUT");
  });

  it("hands the GM the complication as a fact it may not roll away", () => {
    const prompt = renderGmUserPrompt(
      buildGmContext({
        ...base,
        complication: "Another crew is working the same target, and they got there first.",
      }),
      "I look around",
    );
    expect(prompt).toContain("WHAT THE BRIEF LEFT OUT");
    expect(prompt).toContain("the player does not know this");
    expect(prompt).toContain("Another crew is working the same target");
    expect(prompt).toContain("Do not state it outright");
  });

  it("gives back the answer to a question the GM asked last turn", () => {
    const prompt = renderGmUserPrompt(
      buildGmContext({
        ...base,
        oracle: { question: "Is the side door already unlocked?", answer: "No." },
      }),
      "I try the side door",
    );
    expect(prompt).toContain("Is the side door already unlocked?");
    expect(prompt).toContain("The answer is: No.");
    expect(prompt).toContain("do not mention dice");
  });
});
