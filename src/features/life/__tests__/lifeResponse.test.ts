import { describe, expect, it } from "vitest";
import { normalizeLifeResponse } from "../lifeResponse";

const silent = { onWarn: () => {} };

describe("normalizeLifeResponse", () => {
  it("keeps the situation and up to four actions, snapping unknown DVs", () => {
    const result = normalizeLifeResponse(
      {
        situation: { title: "Rent day", description: "The landlord's drone waits." },
        actions: [
          { label: "Call Dex", description: "Ask about work", minutes: 15 },
          { title: "Pawn the pistol", cost: "250", skill: "trading" },
        ],
        proposedActions: [{ kind: "skill_check", skillId: "persuasion", dv: 14, intent: "haggle" }],
      },
      silent,
    );
    expect(result.situation.title).toBe("Rent day");
    expect(result.actions).toHaveLength(2);
    expect(result.actions[1]?.knownCost).toBe(250);
    expect(result.proposedActions[0]).toMatchObject({ kind: "skill_check", dv: 13 });
  });

  it("drops job-shaped actions the Life phase cannot resolve", () => {
    const warnings: string[] = [];
    const result = normalizeLifeResponse(
      {
        proposedActions: [
          { kind: "start_encounter", name: "ambush" },
          { kind: "attack", targetId: "goon" },
          { kind: "advance_beat", to: "b2" },
        ],
      },
      { onWarn: (m) => warnings.push(m) },
    );
    expect(result.proposedActions).toEqual([]);
    expect(warnings).toHaveLength(3);
  });

  it("strips everything a hook offer claims about the job", () => {
    // The job on the wire was generated before the model spoke. Anything it
    // attaches here is its own invention and is discarded, not merged: that is
    // what keeps the offer and the mission it starts the same thing.
    const result = normalizeLifeResponse(
      {
        proposedActions: [
          {
            kind: "hook_offer",
            title: "Courier run",
            patron: "Dex",
            payout: 1200,
            summary: "Move a case across town.",
          },
        ],
      },
      silent,
    );
    expect(result.proposedActions).toEqual([{ kind: "hook_offer" }]);
  });

  it("reports the time an action took, clamped to one turn's worth", () => {
    expect(normalizeLifeResponse({ timeSpent: 45 }, silent).timeSpent).toBe(45);
    expect(normalizeLifeResponse({ timeSpent: 99999 }, silent).timeSpent).toBe(12 * 60);
    expect(normalizeLifeResponse({ timeSpent: -30 }, silent).timeSpent).toBe(0);
    // Nothing reported is no time spent, not a default nudge forward.
    expect(normalizeLifeResponse({}, silent).timeSpent).toBe(0);
  });

  it("offers no actions unless the turn produced some", () => {
    expect(normalizeLifeResponse({}, silent).actions).toEqual([]);
    expect(normalizeLifeResponse({ actions: [] }, silent).actions).toEqual([]);
  });

  it("normalizes loose deltas and a single new situation", () => {
    const result = normalizeLifeResponse(
      {
        deltas: [
          "The neighbour saw you come home bleeding.",
          { npcKey: "dex", delta: 2 },
          { kind: "clock", clockKey: "arasaka", label: "Arasaka sweep", delta: 9, segments: 6 },
        ],
        newSituation: { title: "A debt to the ripperdoc", category: "nonsense", severity: 99 },
      },
      silent,
    );
    expect(result.deltas[0]).toMatchObject({ kind: "note" });
    expect(result.deltas[1]).toMatchObject({ kind: "npc_disposition", delta: 2 });
    // A clock delta is no longer a thing the model may send. Pressure is
    // reported as observations and priced by the engine.
    expect(result.deltas).toHaveLength(2);
    expect(result.newSituation).toMatchObject({
      key: "a_debt_to_the_ripperdoc",
      category: "opportunity",
      severity: 5,
    });
  });

  it("takes observations as reported and leaves the pricing to the engine", () => {
    const result = normalizeLifeResponse(
      {
        observations: [
          { observation: "killed", factionId: "tyger_claws" },
          "loud",
          { kind: "seen", faction: "Arasaka" },
          { factionId: "arasaka" },
        ],
      },
      silent,
    );
    expect(result.observations).toEqual([
      { observation: "killed", factionId: "tyger_claws" },
      { observation: "loud", factionId: null },
      { observation: "seen", factionId: "Arasaka" },
    ]);
  });

  it("reports nothing when the turn noticed nothing", () => {
    expect(normalizeLifeResponse({}, silent).observations).toEqual([]);
    expect(normalizeLifeResponse({ observations: "lots" as never }, silent).observations).toEqual(
      [],
    );
  });
});

describe("the question the turn could not answer itself", () => {
  it("keeps a real yes/no question", () => {
    const result = normalizeLifeResponse(
      { question: "  Is Kiro already at the bar when they arrive?  " },
      silent,
    );
    expect(result.question).toBe("Is Kiro already at the bar when they arrive?");
  });

  it("asks nothing on an ordinary turn", () => {
    expect(normalizeLifeResponse({}, silent).question).toBeNull();
    expect(normalizeLifeResponse({ question: null }, silent).question).toBeNull();
    expect(normalizeLifeResponse({ question: "" }, silent).question).toBeNull();
  });

  it("drops a question no yes/no table could answer", () => {
    expect(
      normalizeLifeResponse({ question: "What is in the crate?" }, silent).question,
    ).toBeNull();
    expect(normalizeLifeResponse({ question: "Is it?" }, silent).question).toBeNull();
    expect(normalizeLifeResponse({ question: 42 as never }, silent).question).toBeNull();
  });

  it("reads a question the model nested in an object", () => {
    const result = normalizeLifeResponse(
      { question: { question: "Has the landlord been by already?" } as never },
      silent,
    );
    expect(result.question).toBe("Has the landlord been by already?");
  });
});
