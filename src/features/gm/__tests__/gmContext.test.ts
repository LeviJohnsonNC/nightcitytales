import { describe, expect, it } from "vitest";
import { NIGHT_AT_THE_OPERA, deductionOffer, getBeat, truthsInMission } from "@/engine";
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

/**
 * The one place the system volunteers that something hidden exists. It is
 * principled: a conclusion's prerequisites are other discoveries, so an offer
 * is the pay-off for legwork already done. It still must not say WHAT.
 */
describe("what the narrator is told about a conclusion on offer", () => {
  const mission = NIGHT_AT_THE_OPERA;
  const beat = getBeat(mission, "monster_hunt");
  const conclusion = truthsInMission({ missionId: mission.id, beats: mission.beats }).find(
    (truth) => truth.key.endsWith("::huntver_is_ruthven"),
  )!;

  const prompt = (deduction?: { dv: number; count: number }) =>
    renderGmUserPrompt(
      buildGmContext({
        mission,
        beat,
        availableExits: beat.exits,
        character,
        objectives: [],
        npcsPresent: [],
        recentEvents: [],
        ...(deduction ? { deduction } : {}),
      }),
      "I go over what we have",
    );

  it("says there is something to work out, and the engine's DV", () => {
    const text = prompt(
      deductionOffer(
        truthsInMission({ missionId: mission.id, beats: mission.beats }),
        conclusion.needs,
      )!,
    );
    expect(text).toContain("THERE IS SOMETHING TO BE WORKED OUT");
    expect(text).toContain(`Deduction check at DV ${conclusion.found.dv}`);
    expect(text).toMatch(/you do not know what it is/i);
    expect(text).toMatch(/must not guess at it, hint at it/i);
  });

  it("never says what the conclusion is", () => {
    const text = prompt({ dv: conclusion.found.dv, count: 1 });
    expect(text).not.toContain(conclusion.fact);

    // Scoped to the offer itself — the heading and the paragraph under it.
    // This beat's own brief and opposition list are allowed to name Ruthven,
    // because by the time the crew are hunting him they know.
    const lines = text.split("\n");
    const at = lines.findIndex((l) => l.includes("THERE IS SOMETHING TO BE WORKED OUT"));
    const offer = lines.slice(at, at + 2).join("\n");
    expect(offer).toMatch(/Deduction check at DV/);
    expect(offer).not.toMatch(/ruthven|huntver|the master/i);
    // Nor how many there are: "two things to work out" is itself information.
    expect(offer).not.toMatch(/\b(one|two|three|1|2|3) (thing|conclusion)/i);
  });

  it("says nothing at all when there is nothing to work out", () => {
    // An empty heading would tell the player to go looking for a leap they
    // have not earned the pieces for.
    expect(prompt()).not.toContain("THERE IS SOMETHING TO BE WORKED OUT");
  });
});

/** The prompt side of the same thing: what the job narrator is handed. */
describe("the people block in a job prompt", () => {
  const mission = NIGHT_AT_THE_OPERA;
  const beat = getBeat(mission, "getting_tickets");

  const withNpc = (npc: Record<string, unknown>) =>
    renderGmUserPrompt(
      buildGmContext({
        mission,
        beat,
        availableExits: beat.exits,
        character,
        objectives: [],
        npcsPresent: [{ name: "Wakako Okada", disposition: 1, status: "alive", ...npc }],
        recentEvents: [],
      }),
      "I talk to her",
    );

  it("hands over what the player has worked out, and forbids inventing more", () => {
    const prompt = withNpc({
      standing: "The fixer who answers your calls.",
      known: ["What Wakako is actually after: a clean exit."],
    });
    expect(prompt).toContain("The fixer who answers your calls.");
    expect(prompt).toContain("The player has worked out: What Wakako is actually after");
    expect(prompt).toMatch(/never invent a want, a fear or a secret/i);
    expect(prompt).toMatch(
      /never have one explain to the character something the character already worked out/i,
    );
  });

  it("says when somebody has closed up", () => {
    expect(withNpc({ guarded: true })).toContain("GUARDED");
    expect(withNpc({})).not.toContain("GUARDED");
  });
});
