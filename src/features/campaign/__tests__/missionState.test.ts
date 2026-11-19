import { describe, expect, it } from "vitest";
import { NIGHT_AT_THE_OPERA, advance, availableExits, getBeat, startMission } from "@/engine";
import {
  OPERA_OPENING_BEAT,
  operaActionFromText,
  operaApproaches,
  operaEntryRoute,
  operaFirstLead,
  operaKnownFacts,
} from "@/engine/missions/nightAtTheOpera";
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
    // The saved row still calls it "background.0", from before the objective
    // was given a stable key. The board is derived from the beats this runtime
    // has stood on, so it comes back under the id the content declares now.
    expect(rt.objectives).toEqual([
      { id: "recover_lucy", text: "Recover Lucy Rhinemeyer", status: "active" },
    ]);
  });

  it("falls back to the start beat when the row has no current beat", () => {
    const rt = progressToRuntime(NIGHT_AT_THE_OPERA, row({ current_beat_id: null }));
    expect(rt.currentBeatId).toBe(NIGHT_AT_THE_OPERA.startBeatId);
  });

  it("keeps what happened to an objective across a content change", () => {
    // The id moved; the fact that it was FAILED must not move with it. This is
    // the half that makes deriving the board safe rather than lossy.
    const rt = progressToRuntime(
      NIGHT_AT_THE_OPERA,
      row({
        objectives: [{ id: "recover_lucy", text: "Recover Lucy Rhinemeyer", status: "failed" }],
      }),
    );
    expect(rt.objectives).toEqual([
      { id: "recover_lucy", text: "Recover Lucy Rhinemeyer", status: "failed" },
    ]);
  });

  it("takes the objective's wording from the mission, not the saved row", () => {
    const rt = progressToRuntime(
      NIGHT_AT_THE_OPERA,
      row({ objectives: [{ id: "recover_lucy", text: "a typo nobody fixed", status: "active" }] }),
    );
    expect(rt.objectives[0]?.text).toBe("Recover Lucy Rhinemeyer");
  });

  it("drops an objective the mission no longer declares at all", () => {
    const rt = progressToRuntime(
      NIGHT_AT_THE_OPERA,
      row({
        objectives: [
          { id: "recover_lucy", text: "Recover Lucy Rhinemeyer", status: "active" },
          { id: "cut_from_the_script", text: "Something deleted", status: "active" },
        ],
      }),
    );
    // An orphan can never be closed by any exit, so leaving it would park a
    // permanently-active objective on the board and a count that never finishes.
    expect(rt.objectives.map((o) => o.id)).toEqual(["recover_lucy"]);
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

  it.each(operaApproaches)("restores the lead from $label and its follow-up", (approach) => {
    const mission = NIGHT_AT_THE_OPERA;
    const hook = advance(mission, startMission(mission), OPERA_OPENING_BEAT);
    expect(operaFirstLead(hook)).toBeUndefined();
    expect(operaKnownFacts(hook)).toEqual([]);
    const clicked = operaActionFromText(hook, approach.label);
    expect(clicked).toMatchObject({
      from: OPERA_OPENING_BEAT,
      to: approach.to,
      minutes: approach.minutes,
    });
    expect(operaActionFromText(hook, `I ${approach.aliases[0]}.`)).toEqual(clicked);
    expect(operaActionFromText(hook, `${approach.label}, then check for cameras`)).toBeUndefined();
    expect(operaActionFromText(hook, `Don't ${approach.label}`)).toBeUndefined();
    const choice = advance(mission, hook, approach.to);
    const reloaded = progressToRuntime(mission, row(runtimeToUpsert("camp-1", choice)));
    expect(operaFirstLead(reloaded)).toBe(approach);
    expect(reloaded.objectives[0]?.id).toBe("recover_lucy");
    expect(availableExits(mission, reloaded)).toEqual([
      { to: approach.route.to, label: approach.route.label },
    ]);
    expect(operaKnownFacts(reloaded)).toEqual([approach.fact]);
    expect(operaActionFromText(reloaded, approach.route.label)).toMatchObject({
      to: approach.route.to,
    });
    const followUp = advance(mission, reloaded, approach.route.to);
    const routeReloaded = progressToRuntime(mission, row(runtimeToUpsert("camp-1", followUp)));
    expect(operaEntryRoute(routeReloaded)).toBe(approach.route);
    expect(operaKnownFacts(routeReloaded)).toEqual([approach.fact, approach.route.fact]);
    expect(availableExits(mission, routeReloaded)).toContainEqual({
      to: "night_at_opera",
      label: approach.route.entry,
    });
    const inside = advance(mission, routeReloaded, "night_at_opera");
    expect(operaKnownFacts(inside)[1]).toContain("The player chose to enter using this route.");
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
