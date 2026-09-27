import { describe, expect, it } from "vitest";
import type { CampaignEvent } from "@/lib/backend";
import { readAutoRoll, skillCheckEvent } from "../skillCheckLog";
import type { SkillCheckResult } from "@/engine";

const result = {
  formula: "1d10(7) + COOL(6) + Streetwise(6) = 19 vs DV13 → SUCCESS by 6",
  rolls: [7],
  modifiers: [],
  total: 19,
  dv: 13,
  success: true,
  timestamp: "2077-01-01T00:00:00.000Z",
  base: 12,
  critical: null,
  criticalDie: null,
  modifier: 0,
  margin: 6,
} as unknown as SkillCheckResult;

const asEvent = (insert: ReturnType<typeof skillCheckEvent>): CampaignEvent =>
  ({ ...insert, id: "e1", seq: 1, created_at: "", beat_id: null }) as unknown as CampaignEvent;

describe("an automatic roll in the log", () => {
  it("is marked on the ledger row", () => {
    const row = skillCheckEvent("c1", result, { skillName: "Streetwise", auto: true });
    expect((row.data as { auto?: unknown }).auto).toBe(true);
  });

  it("reads as one short line with the whole trace behind it", () => {
    const row = skillCheckEvent("c1", result, { skillName: "Streetwise", auto: true });
    expect(readAutoRoll(asEvent(row))).toEqual({
      headline: "Streetwise 19 vs 13 · SUCCESS · auto",
      detail: result.formula,
    });
  });

  it("leaves a roll the player pressed alone", () => {
    const row = skillCheckEvent("c1", result, { skillName: "Streetwise" });
    expect((row.data as { auto?: unknown }).auto).toBeUndefined();
    expect(readAutoRoll(asEvent(row))).toBeNull();
  });
});
