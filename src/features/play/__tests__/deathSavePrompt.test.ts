import { describe, expect, it } from "vitest";
import type { CampaignEvent } from "@/lib/backend";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { deathSaveOwed, pendingDeathSaveFrom } from "../deathSavePrompt";
import { newestPrompt } from "../usePlay";

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

function encounter(over: { wound?: string; status?: string; activeIndex?: number } = {}) {
  const live = {
    id: "enc1",
    state: {
      round: 2,
      order: ["p", "h"],
      activeIndex: over.activeIndex ?? 0,
      status: over.status ?? "active",
      combatants: {
        p: {
          id: "p",
          name: "Red",
          side: "friendly",
          isPlayer: true,
          ref: 7,
          body: 6,
          hpMax: 40,
          hp: -3,
          seriouslyWoundedThreshold: 20,
          woundState: over.wound ?? "mortal",
          deathSavePenalty: 1,
          spHead: 7,
          spBody: 9,
          defeated: false,
          initiative: 14,
        },
        h: {
          id: "h",
          name: "Scav",
          side: "hostile",
          isPlayer: false,
          ref: 5,
          body: 5,
          hpMax: 30,
          hp: 30,
          seriouslyWoundedThreshold: 15,
          woundState: "none",
          deathSavePenalty: 0,
          spHead: 7,
          spBody: 7,
          defeated: false,
          initiative: 9,
        },
      },
    },
    data: {},
  } as unknown as LiveEncounter;
  return live;
}

describe("deathSavePrompt", () => {
  it("owes a save when the mortally wounded player's turn is up", () => {
    expect(deathSaveOwed(encounter())?.name).toBe("Red");
  });

  it("owes nothing when the player is not mortal, not active, or the fight is over", () => {
    expect(deathSaveOwed(encounter({ wound: "serious" }))).toBeNull();
    expect(deathSaveOwed(encounter({ activeIndex: 1 }))).toBeNull();
    expect(deathSaveOwed(encounter({ status: "friendlies_lost" }))).toBeNull();
    expect(deathSaveOwed(null)).toBeNull();
  });

  it("reads the pending prompt with the engine's BODY and penalty", () => {
    const events = [event({ id: "p1", type: "death_save_prompt" })];
    const pending = pendingDeathSaveFrom(events, encounter());
    expect(pending?.body).toBe(6);
    expect(pending?.penalty).toBe(1);
  });

  it("treats a rolled save as no longer pending", () => {
    const events = [
      event({ id: "p1", type: "death_save_prompt" }),
      event({ id: "r1", type: "death_save" }),
    ];
    expect(pendingDeathSaveFrom(events, encounter())).toBeNull();
  });
});

describe("newestPrompt", () => {
  const events = [event({ id: "chk" }), event({ id: "atk" })];

  it("shows only the newest prompt when both are unresolved", () => {
    expect(newestPrompt(events, { eventId: "chk" }, { eventId: "atk" })).toBe("attack");
    expect(newestPrompt(events, { eventId: "atk" }, { eventId: "chk" })).toBe("check");
  });

  it("passes a lone prompt through", () => {
    expect(newestPrompt(events, { eventId: "chk" }, null)).toBe("check");
    expect(newestPrompt(events, null, { eventId: "atk" })).toBe("attack");
    expect(newestPrompt(events, null, null)).toBeNull();
  });
});
