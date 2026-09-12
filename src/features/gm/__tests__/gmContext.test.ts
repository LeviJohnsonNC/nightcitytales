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

/**
 * The same guarantee `placeCanon.test.ts` holds for a location, held for a job:
 * a beat's concealed half is not withheld from the narrator by instruction — it
 * is never sent. A model that can see the twist telegraphs it.
 */
describe("what the narrator is told about a beat's hidden truths", () => {
  const mission = NIGHT_AT_THE_OPERA;
  const beat = getBeat(mission, "empty_office_hours");
  const found =
    "A photograph of Network 54 anchor Barbara Dahl on Huntver's desk, kissed so often the print has worn through.";

  const jobPrompt = (discoveredBeatTruths?: string[]) =>
    renderGmUserPrompt(
      buildGmContext({
        mission,
        beat,
        availableExits: beat.exits,
        character,
        objectives: [],
        npcsPresent: [],
        recentEvents: [],
        ...(discoveredBeatTruths ? { discoveredBeatTruths } : {}),
      }),
      "I go through the desk",
    );

  it("names a fact the beat actually declares", () => {
    // The tests below mean nothing if `found` is a string the beat never held.
    expect((beat.truths ?? []).map((truth) => truth.fact)).toContain(found);
  });

  it("sends an uncovered truth, and says it is established", () => {
    const prompt = jobPrompt([found]);
    expect(prompt).toContain("WHAT THEY HAVE UNCOVERED IN THIS JOB");
    expect(prompt).toContain(found);
    expect(prompt).toMatch(/do not re-reveal one as though it were new/i);
  });

  it("forbids hinting at what is still hidden, and deciding what it is", () => {
    const prompt = jobPrompt([found]);
    expect(prompt).toMatch(/do not hint at it/i);
    expect(prompt).toMatch(/do not\s+decide what it is/i);
    expect(prompt).toMatch(/the engine's to say, on a check/i);
  });

  it("says nothing at all when they have uncovered nothing", () => {
    // Not an empty heading, and not a note that this beat is holding something
    // back — either tells the player there is a twist to look for.
    expect(jobPrompt()).not.toContain("WHAT THEY HAVE UNCOVERED IN THIS JOB");
  });

  it("carries no trace of the beat's undiscovered truths", () => {
    // The whole invariant. This beat declares four facts; one is found, and the
    // other three are absent from the prompt rather than mentioned as unfound.
    const prompt = jobPrompt([found]);
    const declared = beat.truths ?? [];
    expect(declared.length).toBeGreaterThan(1);
    for (const truth of declared) {
      if (truth.fact === found) continue;
      expect(prompt).not.toContain(truth.fact);
    }
  });
});
