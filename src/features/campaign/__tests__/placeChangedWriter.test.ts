/**
 * The Screamsheet reads `place_changed` rows back through ledger.ts, so the
 * writer has to build them through it too, and has to say which morning it was:
 * an event row carries real time, and a newspaper is about an in-world day.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const appended: Record<string, unknown>[] = [];

vi.mock("@/lib/backend", () => ({
  appendCampaignEvent: vi.fn(async (event: Record<string, unknown>) => {
    appended.push(event);
  }),
  upsertCampaignPlace: vi.fn(async () => {}),
  listCampaignPlaces: vi.fn(async () => []),
}));

const { applyPlaceObservations } = await import("../placeState");
const { readPlaceChangedEventData, screamsheet, startingState } = await import("@/engine");

beforeEach(() => {
  appended.length = 0;
});

describe("writing a flag a place gained", () => {
  it("writes the day with it, through the ledger's own builder", async () => {
    // Two killings take a market's police attention to its threshold: the law
    // comes through, and the trade the raid stops is cleared with it.
    await applyPlaceObservations({
      campaignId: "c1",
      placeKey: "x5",
      observations: ["killed", "killed"],
      known: { x5: startingState("x5") },
      day: 12,
    });
    expect(appended.length).toBeGreaterThan(0);
    const changes = appended.map((e) => readPlaceChangedEventData(e["data"]));
    expect(changes.every((c) => c !== null)).toBe(true);
    expect(changes).toContainEqual({ placeKey: "x5", flag: "raided", set: true, day: 12 });
    expect(changes).toContainEqual({ placeKey: "x5", flag: "market_open", set: false, day: 12 });
  });

  it("still writes a row when the caller has no day, and the row reads back undated", async () => {
    await applyPlaceObservations({
      campaignId: "c1",
      placeKey: "x5",
      observations: ["killed", "killed"],
      known: { x5: startingState("x5") },
    });
    expect(readPlaceChangedEventData(appended[0]!["data"])?.day).toBeNull();
  });

  it("is what the Screamsheet is made of: the raid prints, the trade it stops does not", async () => {
    // Two killings in a market do two things the engine records: the law comes
    // through (and the trade stops), and the goodwill runs out. The sheet prints
    // what GAINED a flag, once each, and never the flag the raid cleared.
    await applyPlaceObservations({
      campaignId: "c1",
      placeKey: "x5",
      observations: ["killed", "killed"],
      known: { x5: startingState("x5") },
      day: 12,
    });
    const rows = appended.map((e, i) => ({
      id: `e${i}`,
      seq: i + 1,
      type: String(e["type"]),
      data: e["data"],
    }));
    const printed = screamsheet({ events: rows, handle: "Velvet" });
    expect(printed.map((p) => p.kicker).sort()).toEqual(["COLD SHOULDER", "RAID"]);
    expect(printed.every((p) => p.kind === "place" && p.day === 12)).toBe(true);
  });
});
