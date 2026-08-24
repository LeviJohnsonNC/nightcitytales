import { describe, expect, it } from "vitest";
import { resolveOpposedCheck, type RNG, type SkillCheckResult } from "@/engine";
import { opposedCheckEvent, opposedCheckSummary, skillCheckEvent } from "../skillCheckLog";

/** An RNG that returns the given d10 faces in order. */
function faces(...values: number[]): RNG {
  let i = 0;
  return () => {
    const value = values[i++];
    if (value === undefined) throw new Error("rng: out of scripted rolls");
    return (value - 1) / 10 + 0.001;
  };
}

const result: SkillCheckResult = {
  formula: "1d10(9) + REF(6) + Handgun(4) = 19 vs DV15 → SUCCESS by 4",
  rolls: [9],
  modifiers: [
    { label: "REF", value: 6 },
    { label: "Handgun", value: 4 },
  ],
  total: 19,
  dv: 15,
  success: true,
  timestamp: "2026-08-23T00:00:00.000Z",
  base: 9,
  critical: null,
  criticalDie: null,
  modifier: 10,
  margin: 4,
};

describe("skillCheckEvent", () => {
  it("builds an immutable skill_check ledger row with the full trace", () => {
    const event = skillCheckEvent("camp-1", result, {
      skillId: "handgun",
      skillName: "Handgun",
      intent: "shoot the guard",
      beatId: "c1",
    });
    expect(event.campaign_id).toBe("camp-1");
    expect(event.type).toBe("skill_check");
    expect(event.summary).toBe(result.formula);
    expect(event.beat_id).toBe("c1");
    expect(event.roll).toEqual(result);
    expect(event.data).toMatchObject({
      success: true,
      margin: 4,
      critical: null,
      skill_id: "handgun",
      skill_name: "Handgun",
      intent: "shoot the guard",
    });
  });

  it("omits beat_id and optional context when not provided", () => {
    const event = skillCheckEvent("camp-1", result);
    expect(event.beat_id).toBeUndefined();
    expect(event.data).toMatchObject({ success: true, margin: 4 });
    expect(event.data).not.toHaveProperty("skill_id");
  });
});

describe("opposedCheckEvent", () => {
  const opposed = resolveOpposedCheck(
    { name: "Red", statLabel: "COOL", statValue: 6, skillLabel: "Persuasion", skillValue: 4 },
    {
      name: "Trace Santiago",
      statLabel: "EMP",
      statValue: 5,
      skillLabel: "Human Perception",
      skillValue: 3,
    },
    faces(7, 4),
  );

  it("logs both sides as one skill_check row the ledger can read back", () => {
    const event = opposedCheckEvent("camp-1", opposed, {
      skillId: "persuasion",
      skillName: "Persuasion",
      intent: "talk her round",
      promptEventId: "prompt-1",
      npcKey: "trace-santiago",
      beatId: "b2",
    });
    expect(event.type).toBe("skill_check");
    expect(event.beat_id).toBe("b2");
    const data = event.data as Record<string, unknown>;
    expect(data["success"]).toBe(true);
    expect(data["margin"]).toBe(5);
    expect(data["tie"]).toBe(false);
    expect(data["prompt_event_id"]).toBe("prompt-1");
    expect(data["opposed"]).toMatchObject({
      npc_key: "trace-santiago",
      npc_name: "Trace Santiago",
      opposing_skill: "Human Perception",
      opposing_total: 12,
    });
  });

  it("names a tie in the summary rather than calling it a plain failure", () => {
    // COOL 6 + Persuasion 4 + 5 = 15 against EMP 5 + Human Perception 3 + 7 = 15.
    const tied = resolveOpposedCheck(
      { name: "Red", statLabel: "COOL", statValue: 6, skillLabel: "Persuasion", skillValue: 4 },
      {
        name: "Trace Santiago",
        statLabel: "EMP",
        statValue: 5,
        skillLabel: "Human Perception",
        skillValue: 3,
      },
      faces(5, 7),
    );
    expect(opposedCheckSummary(tied)).toContain("TIE — defender holds");
    expect(opposedCheckEvent("camp-1", tied).summary).not.toContain("SUCCESS");
  });

  it("puts both totals in the summary", () => {
    expect(opposedCheckSummary(opposed)).toContain("Red:");
    expect(opposedCheckSummary(opposed)).toContain("Trace Santiago:");
    expect(opposedCheckSummary(opposed)).toContain("SUCCESS by 5");
  });
});
