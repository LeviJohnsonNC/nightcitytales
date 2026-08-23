import { describe, expect, it } from "vitest";
import type { CampaignEvent, FullCharacter } from "@/lib/backend";
import { pendingCheckFrom, snapToPublishedDv, dvBandName } from "../checkPrompt";

const event = (over: Partial<CampaignEvent>): CampaignEvent =>
  ({
    id: "e1",
    seq: 1,
    campaign_id: "c1",
    type: "gm_narration",
    beat_id: "b1",
    summary: "",
    roll: null,
    data: {},
    created_at: new Date().toISOString(),
    ...over,
  }) as CampaignEvent;

const character = {
  character: { name: "Red", role: "Solo" },
  stats: { int: 6 },
  skills: [{ skill_id: "perception", level: 4 }],
} as unknown as FullCharacter;

describe("checkPrompt", () => {
  it("snaps an off-table DV to the nearest published band", () => {
    expect(snapToPublishedDv(14)).toBe(13);
    expect(snapToPublishedDv(16)).toBe(15);
    expect(dvBandName(15)).toBe("Difficult");
  });

  it("finds an unresolved check prompt", () => {
    const events = [
      event({ id: "a", type: "gm_narration" }),
      event({
        id: "b",
        type: "check_prompt",
        data: { skillId: "perception", dv: 15, intent: "spot the tail" } as never,
      }),
    ];
    const pending = pendingCheckFrom(events, character);
    expect(pending?.skillName).toBe("Perception");
    expect(pending?.base).toBe(10);
    expect(pending?.dv).toBe(15);
    expect(pending?.needed).toBe(5);
  });

  it("treats a prompt followed by a roll as resolved", () => {
    const events = [
      event({
        id: "b",
        type: "check_prompt",
        data: { skillId: "perception", dv: 15 } as never,
      }),
      event({ id: "c", type: "skill_check" }),
    ];
    expect(pendingCheckFrom(events, character)).toBeNull();
  });
});
