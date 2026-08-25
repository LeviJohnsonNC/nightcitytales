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

  it("reads a hook offer as an offer, never as a started job", () => {
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
    expect(result.proposedActions[0]).toMatchObject({
      kind: "hook_offer",
      title: "Courier run",
      npcKey: "dex",
      payout: 1200,
    });
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
    expect(result.deltas[2]).toMatchObject({ kind: "clock", delta: 6 });
    expect(result.newSituation).toMatchObject({
      key: "a_debt_to_the_ripperdoc",
      category: "opportunity",
      severity: 5,
    });
  });
});
