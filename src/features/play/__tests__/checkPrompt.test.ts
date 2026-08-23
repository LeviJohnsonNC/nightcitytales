import { describe, expect, it } from "vitest";
import type { CampaignEvent, FullCharacter } from "@/lib/backend";
import { pendingCheckFrom, pendingChecksFrom, snapToPublishedDv, dvBandName } from "../checkPrompt";

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

describe("pendingChecksFrom — more than one check on the table", () => {
  const twoSkilled = {
    character: { name: "Red", role: "Solo" },
    stats: { int: 6, tech: 5 },
    skills: [
      { skill_id: "perception", level: 4 },
      { skill_id: "pick_lock", level: 3 },
    ],
  } as unknown as FullCharacter;

  const prompt = (id: string, skillId: string) =>
    event({ id, type: "check_prompt", data: { skillId, dv: 15 } as never });

  it("keeps both prompts from one turn outstanding, oldest first", () => {
    const events = [prompt("p1", "pick_lock"), prompt("p2", "perception")];
    const pending = pendingChecksFrom(events, twoSkilled);
    expect(pending.map((p) => p.skillId)).toEqual(["pick_lock", "perception"]);
    expect(pendingCheckFrom(events, twoSkilled)?.skillId).toBe("pick_lock");
  });

  it("strikes off only the prompt the roll names, leaving the other live", () => {
    const events = [
      prompt("p1", "pick_lock"),
      prompt("p2", "perception"),
      event({ id: "r1", type: "skill_check", data: { prompt_event_id: "p1" } as never }),
    ];
    const pending = pendingChecksFrom(events, twoSkilled);
    expect(pending.map((p) => p.skillId)).toEqual(["perception"]);
  });

  it("clears the table once both prompts are answered", () => {
    const events = [
      prompt("p1", "pick_lock"),
      prompt("p2", "perception"),
      event({ id: "r1", type: "skill_check", data: { prompt_event_id: "p1" } as never }),
      event({ id: "r2", type: "skill_check", data: { prompt_event_id: "p2" } as never }),
    ];
    expect(pendingChecksFrom(events, twoSkilled)).toEqual([]);
  });

  it("resolves the roll out of order the prompts were posted in", () => {
    const events = [
      prompt("p1", "pick_lock"),
      prompt("p2", "perception"),
      event({ id: "r1", type: "skill_check", data: { prompt_event_id: "p2" } as never }),
    ];
    expect(pendingChecksFrom(events, twoSkilled).map((p) => p.skillId)).toEqual(["pick_lock"]);
  });

  it("falls back to matching an unlinked legacy roll by skill", () => {
    const events = [
      prompt("p1", "pick_lock"),
      prompt("p2", "perception"),
      event({ id: "r1", type: "skill_check", data: { skill_id: "pick_lock" } as never }),
    ];
    expect(pendingChecksFrom(events, twoSkilled).map((p) => p.skillId)).toEqual(["perception"]);
  });
});
