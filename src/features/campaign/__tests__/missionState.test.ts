import { describe, expect, it } from "vitest";
import { NIGHT_AT_THE_OPERA, getBeat, startMission } from "@/engine";
import type { MissionProgress } from "@/lib/backend";
import { progressToRuntime, runtimeToUpsert } from "../missionState";
import { beatAdvancedEvent } from "../missionLog";

const row = (over: Partial<MissionProgress> = {}): MissionProgress => ({
  id: "mp-1",
  campaign_id: "camp-1",
  mission_id: "night-at-the-opera",
  status: "active",
  current_beat_id: "empty_office_hours",
  completed_beats: ["background", "hook", "getting_tickets"],
  branch_choices: { getting_tickets: "empty_office_hours" },
  objectives: [{ id: "background.0", text: "Recover Lucy Rhinemeyer", status: "active" }],
  created_at: "2026-08-23T00:00:00.000Z",
  updated_at: "2026-08-23T00:00:00.000Z",
  ...over,
});

describe("progressToRuntime", () => {
  it("rebuilds a runtime and reconstructs flags from the branch history", () => {
    const rt = progressToRuntime(NIGHT_AT_THE_OPERA, row());
    expect(rt.currentBeatId).toBe("empty_office_hours");
    expect(rt.completedBeats).toContain("getting_tickets");
    // The getting_tickets -> empty_office_hours exit sets this flag.
    expect(rt.flags).toContain("investigated_professor");
    expect(rt.objectives).toEqual([
      { id: "background.0", text: "Recover Lucy Rhinemeyer", status: "active" },
    ]);
  });

  it("falls back to the start beat when the row has no current beat", () => {
    const rt = progressToRuntime(NIGHT_AT_THE_OPERA, row({ current_beat_id: null }));
    expect(rt.currentBeatId).toBe(NIGHT_AT_THE_OPERA.startBeatId);
  });
});

describe("runtimeToUpsert", () => {
  it("maps a runtime onto a mission_progress upsert payload", () => {
    const upsert = runtimeToUpsert("camp-1", startMission(NIGHT_AT_THE_OPERA));
    expect(upsert.campaign_id).toBe("camp-1");
    expect(upsert.mission_id).toBe("night-at-the-opera");
    expect(upsert.current_beat_id).toBe("background");
    expect(upsert.status).toBe("active");
  });
});

describe("beatAdvancedEvent", () => {
  it("records a beat transition with its choice", () => {
    const e = beatAdvancedEvent("camp-1", {
      mission: NIGHT_AT_THE_OPERA,
      fromBeatId: "getting_tickets",
      toBeat: getBeat(NIGHT_AT_THE_OPERA, "night_at_opera"),
      choiceLabel: "Buy tickets and attend the show",
    });
    expect(e.type).toBe("beat_advanced");
    expect(e.beat_id).toBe("night_at_opera");
    expect(e.summary).toBe("A Night at the Opera: Night at the Opera");
    expect(e.data).toMatchObject({
      mission_id: "night-at-the-opera",
      from_beat: "getting_tickets",
      to_beat: "night_at_opera",
      beat_type: "cliff",
      choice: "Buy tickets and attend the show",
    });
  });
});
