import { describe, expect, it } from "vitest";
import { placeHistory } from "../placeState";
import type { CampaignEvent } from "@/lib/backend";

function event(summary: string, placeKey?: string): CampaignEvent {
  return {
    id: summary,
    campaign_id: "c",
    type: "place_changed",
    summary,
    data: placeKey ? { placeKey } : {},
    beat_id: null,
    created_at: "",
  } as unknown as CampaignEvent;
}

describe("what the ledger says happened here", () => {
  it("reads only lines about this place", () => {
    const events = [
      event("the law came through", "x5"),
      event("something elsewhere", "x1"),
      event("an event about nowhere"),
      event("the reclaimers held on", "x5"),
    ];
    expect(placeHistory(events, "x5")).toEqual(["the law came through", "the reclaimers held on"]);
  });

  it("keeps the most recent, not the first", () => {
    // A place forty hours into a campaign has a long history and a short panel.
    const many = Array.from({ length: 10 }, (_, i) => event(`thing ${i}`, "x5"));
    expect(placeHistory(many, "x5", 3)).toEqual(["thing 7", "thing 8", "thing 9"]);
  });

  it("says nothing about a place nothing has happened at", () => {
    expect(placeHistory([event("elsewhere", "x1")], "x5")).toEqual([]);
    expect(placeHistory([], "x5")).toEqual([]);
  });
});
