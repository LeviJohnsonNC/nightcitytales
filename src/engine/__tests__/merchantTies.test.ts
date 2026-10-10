import { describe, expect, it } from "vitest";
import {
  HOLD_DAYS,
  HOLD_DEPOSIT_FRACTION,
  MAX_SHOP_INTERESTS,
  SHOP_INTEREST_IDS,
  activeHold,
  answersInterest,
  checkPercent,
  cleanInterests,
  describeItemRecord,
  gadgetId,
  heldBalance,
  holdDeposit,
  holdPlacedEventData,
  interestsFrom,
  itemRecord,
  rangeTrial,
  singleShotDV,
  weaponProfile,
} from "@/engine";

const hold = (day: number) => ({
  type: "hold_placed",
  data: holdPlacedEventData({
    vendorId: "gun_shop@d3",
    vendorLabel: "Toggle's Temple",
    kind: "weapon",
    itemId: "sniper_rifle",
    name: "Sniper Rifle",
    price: 500,
    deposit: holdDeposit(500),
    day,
  }),
});

describe("interests", () => {
  it("are the finds' own capabilities, and nothing a player can invent", () => {
    expect(SHOP_INTEREST_IDS).toEqual(expect.arrayContaining(["quiet", "remote", "quick"]));
    expect(cleanInterests(["quiet", "quiet", "invisible", 7, "remote", "quick"])).toEqual(
      ["quiet", "remote", "quick"].slice(0, MAX_SHOP_INTERESTS),
    );
    expect(cleanInterests("quiet")).toEqual([]);
  });

  it("are whatever the newest list says", () => {
    const events = [
      { type: "shop_interests", data: { needs: ["quiet"] } },
      { type: "purchase", data: {} },
      { type: "shop_interests", data: { needs: ["remote"] } },
    ];
    expect(interestsFrom(events)).toEqual(["remote"]);
    expect(interestsFrom([])).toEqual([]);
  });

  it("match a find by its capability, and never a catalog line", () => {
    expect(answersInterest(gadgetId("hush_wrap", "quiet", "none", 0), ["quiet"])).toBe(true);
    expect(answersInterest(gadgetId("hush_wrap", "quiet", "none", 0), ["remote"])).toBe(false);
    expect(answersInterest("rope_60m_yd", ["quiet"])).toBe(false);
  });
});

describe("a hold", () => {
  it("costs a stated share of the price up front and the rest at the till", () => {
    expect(holdDeposit(500)).toBe(Math.ceil(500 * HOLD_DEPOSIT_FRACTION));
    expect(holdDeposit(0)).toBe(1);
    const h = activeHold([hold(3)], 3)!;
    expect(h.until).toBe(3 + HOLD_DAYS);
    expect(heldBalance(h) + h.deposit).toBe(500);
  });

  it("stands until its last day, a call-off or a collection, and lapses on its own", () => {
    expect(activeHold([hold(3)], 3 + HOLD_DAYS)).not.toBeNull();
    expect(activeHold([hold(3)], 4 + HOLD_DAYS)).toBeNull();
    expect(activeHold([hold(3), { type: "hold_ended", data: {} }], 4)).toBeNull();
    expect(activeHold([hold(3), { type: "hold_ended", data: {} }, hold(5)], 6)?.day).toBe(5);
    expect(activeHold([{ type: "hold_placed", data: { vendorId: "x" } }], 1)).toBeNull();
  });
});

describe("the range", () => {
  it("reads the odds off the tables the shot is rolled on", () => {
    const bands = rangeTrial("assault_rifle", 14);
    const profile = weaponProfile("assault_rifle");
    expect(bands.length).toBeGreaterThan(0);
    for (const b of bands) {
      expect(b.dv).toBe(singleShotDV(profile.rangeType!, b.max));
      expect(b.percent).toBe(checkPercent(14, b.dv));
    }
  });

  it("has nothing to say about a knife or an unknown gun", () => {
    expect(rangeTrial("light_melee", 14)).toEqual([]);
    expect(rangeTrial("nope", 14)).toEqual([]);
  });
});

describe("a thing's record", () => {
  const events = [
    { type: "purchase", data: { vendorId: "gun_shop@d3", itemId: "heavy_pistol", day: 12 } },
    { type: "attack", data: { weapon: "Heavy Pistol", hit: true } },
    { type: "attack", data: { weapon: "Heavy Pistol", hit: false } },
    { type: "attack", data: { weapon: "x", hit: true, ammo: { inventoryId: "row-1" } } },
    { type: "life_action", data: { item: "heavy_pistol" } },
  ];
  it("is computed from where it came from and what it has been through", () => {
    const record = itemRecord(
      events,
      { itemId: "heavy_pistol", rowId: "row-1", name: "Heavy Pistol" },
      () => "Toggle's Temple",
    );
    expect(record).toEqual({
      bought: { vendorLabel: "Toggle's Temple", day: 12 },
      uses: 1,
      shots: 3,
      hits: 2,
    });
    expect(describeItemRecord(record)).toBe(
      "Bought at Toggle's Temple, day 12 · 3 shots, 2 hit · used 1 time.",
    );
  });

  it("says nothing about starting kit that has done nothing", () => {
    const record = itemRecord([], { itemId: "rope_60m_yd" }, (id) => id);
    expect(describeItemRecord(record)).toBeNull();
  });
});
