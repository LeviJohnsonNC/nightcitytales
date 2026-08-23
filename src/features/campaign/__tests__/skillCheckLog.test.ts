import { describe, expect, it } from "vitest";
import type { SkillCheckResult } from "@/engine";
import { skillCheckEvent } from "../skillCheckLog";

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
