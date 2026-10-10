import { describe, expect, it } from "vitest";
import {
  PLACE_SHOPS,
  STOCK_BACK_ROOM_COUNT,
  STOCK_IN_COUNT,
  STOCK_LINE_COUNT,
  STOCK_PERIOD_DAYS,
  daysToRestock,
  getVendor,
  newSinceLastVisit,
  placeVendorId,
  shelfFor,
  shopStock,
  stockItemKey,
  stockPeriod,
  unusualOnShelf,
  type ShelfStock,
} from "@/engine";

const TOGGLE = getVendor(placeVendorId("gun_shop", "d3"));
const SKIV = getVendor(placeVendorId("gun_shop", "s4"));
const GUNS = getVendor("gun_shop");

const keyed = (stock: ShelfStock[]) =>
  stock.map((i) => `${stockItemKey(i)}=${i.key}/${i.left ?? "∞"}`).join(",");

describe("the stock week", () => {
  it("runs a week at a time, from day 1", () => {
    expect(stockPeriod(1)).toBe(0);
    expect(stockPeriod(STOCK_PERIOD_DAYS)).toBe(0);
    expect(stockPeriod(STOCK_PERIOD_DAYS + 1)).toBe(1);
    expect(daysToRestock(1)).toBe(STOCK_PERIOD_DAYS);
    expect(daysToRestock(STOCK_PERIOD_DAYS)).toBe(1);
    expect(daysToRestock(STOCK_PERIOD_DAYS + 1)).toBe(STOCK_PERIOD_DAYS);
  });
});

describe("a shelf is a fact about the week, not about the moment", () => {
  it("is identical every time anybody looks in the same week", () => {
    const first = keyed(shopStock({ vendor: GUNS, seed: "camp", day: 2 }));
    for (const day of [2, 3, 7]) {
      expect(keyed(shopStock({ vendor: GUNS, seed: "camp", day }))).toBe(first);
    }
  });

  it("can change when the week turns", () => {
    const weeks = new Set(
      Array.from({ length: 8 }, (_, w) =>
        keyed(shopStock({ vendor: GUNS, seed: "camp", day: 1 + w * STOCK_PERIOD_DAYS })),
      ),
    );
    expect(weeks.size).toBeGreaterThan(1);
  });

  it("differs between campaigns and between two shops of the same kind", () => {
    const a = keyed(shopStock({ vendor: TOGGLE, seed: "camp", day: 1 }));
    expect(keyed(shopStock({ vendor: TOGGLE, seed: "other", day: 1 }))).not.toBe(a);
    const unusual = (stock: ShelfStock[]) =>
      stock
        .filter((i) => i.layer === "unusual")
        .map((i) => `${i.itemId}=${i.key}`)
        .join(",");
    const differs = Array.from({ length: 8 }, (_, w) => 1 + w * STOCK_PERIOD_DAYS).some(
      (day) =>
        unusual(shopStock({ vendor: GUNS, seed: "camp", day })) !==
        unusual(shopStock({ vendor: SKIV, seed: "camp", day })),
    );
    expect(differs).toBe(true);
  });

  it("never rolls for staple stock and never counts it", () => {
    for (const item of shopStock({ vendor: GUNS, seed: "camp", day: 1 })) {
      if (item.tier !== "ordinary") continue;
      expect(item.layer).toBe("staple");
      expect(item.available).toBe(true);
      expect(item.left).toBeNull();
      expect(item.roll).toBeNull();
    }
  });

  it("reads the printed stock die for the unusual, with how many that buys", () => {
    const unusual = shopStock({ vendor: GUNS, seed: "camp", day: 1 }).filter(
      (i) => i.layer === "unusual",
    );
    expect(unusual.length).toBeGreaterThan(0);
    for (const item of unusual) {
      expect(item.roll?.tableId).toBe("stock");
      if (item.key === "in") expect(item.left).toBe(STOCK_IN_COUNT);
      if (item.key === "last_one") expect(item.left).toBe(1);
      if (item.key === "out") expect(item.available).toBe(false);
    }
  });

  it("lets being known shift the read, never the face", () => {
    const stranger = shopStock({ vendor: GUNS, seed: "camp", day: 1 });
    const regular = shopStock({ vendor: GUNS, seed: "camp", day: 1, regular: true });
    for (const [i, item] of stranger.entries()) {
      const known = regular[i]!;
      if (!item.roll) continue;
      expect(known.roll!.face).toBe(item.roll.face);
      expect(known.roll!.read).toBe(item.roll.read + 1);
    }
  });

  it("takes what was bought this week off the shelf", () => {
    const shelf = shopStock({ vendor: GUNS, seed: "camp", day: 1 });
    const item = shelf.find((i) => i.key === "in")!;
    const after = shopStock({
      vendor: GUNS,
      seed: "camp",
      day: 1,
      bought: { [stockItemKey(item)]: STOCK_IN_COUNT - 1 },
    }).find((i) => i.itemId === item.itemId)!;
    expect(after.left).toBe(1);
    const gone = shopStock({
      vendor: GUNS,
      seed: "camp",
      day: 1,
      bought: { [stockItemKey(item)]: STOCK_IN_COUNT },
    }).find((i) => i.itemId === item.itemId)!;
    expect(gone.key).toBe("sold_out");
    expect(gone.available).toBe(false);
  });

  it("sources inside a Fixer's Reach without a die or a count", () => {
    const fixer = getVendor("fixer");
    for (const item of shopStock({ vendor: fixer, seed: "camp", day: 1, operatorRank: 10 })) {
      if (item.layer !== "unusual") continue;
      if (item.key === "reach") {
        expect(item.roll).toBeNull();
        expect(item.left).toBeNull();
      }
    }
    expect(
      shopStock({ vendor: fixer, seed: "camp", day: 1, operatorRank: 10 }).some(
        (i) => i.key === "reach",
      ),
    ).toBe(true);
  });
});

describe("what a shop is for", () => {
  it("always carries its line, a few a week", () => {
    const shelf = shopStock({ vendor: TOGGLE, seed: "camp", day: 1 });
    for (const id of TOGGLE.signature) {
      const item = shelf.find((i) => i.itemId === id)!;
      expect(item.layer).toBe("line");
      expect(item.available).toBe(true);
      expect(item.left).toBe(STOCK_LINE_COUNT);
    }
  });

  it("keeps the back room off the shelf for a stranger, and opens it for a friend", () => {
    const stranger = shopStock({ vendor: TOGGLE, seed: "camp", day: 1 });
    const friend = shopStock({ vendor: TOGGLE, seed: "camp", day: 1, backRoomOpen: true });
    for (const id of TOGGLE.backRoom) {
      expect(stranger.some((i) => i.itemId === id)).toBe(false);
      const item = friend.find((i) => i.itemId === id)!;
      expect(item.layer).toBe("back_room");
      expect(item.left).toBe(STOCK_BACK_ROOM_COUNT);
    }
  });

  it("names a line and a back room only from what the seller deals in, and only the unusual", () => {
    for (const shop of PLACE_SHOPS) {
      const vendor = getVendor(placeVendorId(shop.vendor, shop.place));
      const sells = new Map(shelfFor(vendor).map((i) => [i.itemId, i]));
      for (const id of [...vendor.signature, ...vendor.backRoom]) {
        expect(sells.has(id), `${vendor.label} cannot sell ${id}`).toBe(true);
        expect(sells.get(id)!.tier, `${vendor.label}: ${id} is staple stock anyway`).toBe(
          "unusual",
        );
      }
      for (const id of vendor.signature) {
        expect(vendor.backRoom.includes(id), `${vendor.label}: ${id} in both`).toBe(false);
      }
    }
  });
});

describe("coming back", () => {
  it("shows what is in now that was not the last time", () => {
    // Find a pair of weeks where something unusual came in.
    let found = false;
    for (let w = 1; w < 12 && !found; w += 1) {
      const before = shopStock({ vendor: GUNS, seed: "camp", day: 1 + (w - 1) * 7 });
      const now = shopStock({ vendor: GUNS, seed: "camp", day: 1 + w * 7 });
      const fresh = newSinceLastVisit(now, before);
      for (const item of fresh) {
        found = true;
        expect(item.layer).not.toBe("staple");
        expect(item.available).toBe(true);
        expect(before.find((i) => i.itemId === item.itemId)?.available).not.toBe(true);
      }
    }
    expect(found).toBe(true);
  });

  it("counts the back room as new the first visit it is open", () => {
    const before = shopStock({ vendor: TOGGLE, seed: "camp", day: 1 });
    const now = shopStock({ vendor: TOGGLE, seed: "camp", day: 8, backRoomOpen: true });
    const fresh = newSinceLastVisit(now, before).map((i) => i.itemId);
    for (const id of TOGGLE.backRoom) expect(fresh).toContain(id);
  });

  it("answers 'what's unusual' with the back room first, then the dearest", () => {
    const list = unusualOnShelf(
      shopStock({ vendor: TOGGLE, seed: "camp", day: 1, backRoomOpen: true }),
    );
    expect(list[0]!.layer).toBe("back_room");
    expect(list.every((i) => i.available && i.layer !== "staple")).toBe(true);
  });
});
