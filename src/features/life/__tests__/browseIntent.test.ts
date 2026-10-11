import { describe, expect, it } from "vitest";
import {
  FIXER_VENDOR,
  LEDGER_EVENTS,
  nearestShops,
  readShopBrowsedEventData,
  shopBrowsedEventData,
  shopsAt,
} from "@/engine";
import { browseLinkFor, newestBrowse, planBrowse } from "../browseIntent";
import { normalizeLifeResponse } from "../lifeResponse";
import { describeTravelOutcome } from "../lifeModel";

const silent = { onWarn: () => {} };

describe("planBrowse", () => {
  it("opens the seller where they stand when they did not say which", () => {
    const plan = planBrowse({ placeKey: "o3", from: "o3", seller: "the vendor" });
    expect(plan).toMatchObject({ kind: "open", vendor: { id: "street@o3" } });
  });

  it("opens the one they named, at a place with two sellers", () => {
    const armorer = planBrowse({ placeKey: "t2", from: "t2", seller: "the plate racks" });
    expect(armorer).toMatchObject({ kind: "open", vendor: { id: "armorer@t2" } });
    const first = planBrowse({ placeKey: "t2", from: "t2" });
    expect(first).toMatchObject({ kind: "open", vendor: { id: shopsAt("t2")[0]!.id } });
  });

  it("calls the fixer from anywhere", () => {
    expect(planBrowse({ placeKey: null, from: "o3", seller: "my fixer" })).toEqual({
      kind: "open",
      vendor: FIXER_VENDOR,
    });
  });

  it("goes to a shop named somewhere else, even with a seller underfoot", () => {
    const plan = planBrowse({ placeKey: "d3", from: "d3", seller: "Ganymede" });
    expect(plan).toMatchObject({ kind: "go", placeKey: "o3", name: "Ganymede Street Market" });
  });

  it("goes to the nearest shop when nobody sells where they stand", () => {
    const from = "o3";
    const nearest = nearestShops(from, undefined, 1)[0]!;
    const plan = planBrowse({ placeKey: null, from });
    expect(plan).toEqual({ kind: "go", placeKey: nearest.placeKey, name: nearest.name });
  });
});

describe("the browse action", () => {
  it("survives normalizing as a seller only, whatever stock the model attached", () => {
    const result = normalizeLifeResponse(
      {
        proposedActions: [
          { kind: "browse", seller: "the market", items: ["Kiroshi optics"], price: 400 },
          { kind: "open_shop" },
        ],
      },
      silent,
    );
    expect(result.proposedActions).toEqual([
      { kind: "browse", seller: "the market" },
      { kind: "browse" },
    ]);
  });

  it("tells the arrival narration the counter is opening, and not to stock it", () => {
    const text = describeTravelOutcome({
      travelled: { from: "here", to: "there", minutes: 12, mode: "on foot" },
      browsing: "Ganymede Street Market",
    });
    expect(text).toContain("Ganymede Street Market's counter");
    expect(text).toMatch(/never name an item or a price/i);
  });
});

describe("the shop_browsed row", () => {
  it("round-trips through the ledger contract", () => {
    const data = shopBrowsedEventData({ vendorId: "street@o3", day: 4.7 });
    expect(readShopBrowsedEventData(data)).toEqual({ vendorId: "street@o3", day: 4 });
    expect(readShopBrowsedEventData({ day: 1 })).toBeNull();
  });

  it("is found newest first, so the screen opens the latest ask", () => {
    const row = (id: string, vendorId: string) => ({
      id,
      type: LEDGER_EVENTS.shopBrowsed,
      data: shopBrowsedEventData({ vendorId, day: 1 }),
    });
    expect(
      newestBrowse([row("a", "street@o3"), { id: "b", type: "life_narration" }, row("c", "fixer")]),
    ).toEqual({ eventId: "c", vendorId: "fixer" });
    expect(newestBrowse([{ id: "x", type: "travelled" }])).toBeNull();
  });

  it("offers the counter from the log only while they are still standing there", () => {
    const arrived = { type: "travelled", data: { to: "o3", minutes: 12 } };
    expect(browseLinkFor(arrived, "o3")).toBe("street@o3");
    expect(browseLinkFor(arrived, "d3")).toBeNull();
    expect(browseLinkFor({ type: "travelled", data: { to: "zz9" } }, "zz9")).toBeNull();
    const looked = {
      type: LEDGER_EVENTS.shopBrowsed,
      data: shopBrowsedEventData({ vendorId: "street@o3", day: 2 }),
    };
    expect(browseLinkFor(looked, "o3")).toBe("street@o3");
    expect(browseLinkFor(looked, null)).toBeNull();
    const called = {
      type: LEDGER_EVENTS.shopBrowsed,
      data: shopBrowsedEventData({ vendorId: "fixer", day: 2 }),
    };
    expect(browseLinkFor(called, null)).toBe("fixer");
  });
});
