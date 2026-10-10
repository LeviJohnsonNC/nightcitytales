import { describe, expect, it } from "vitest";
import {
  ARMOR,
  WEAPONS,
  gadgetId,
  getVendor,
  placeVendorId,
  readGadget,
  shopStock,
} from "@/engine";
import { stockedShelf } from "@/features/campaign/shopping";
import { ITEM_ART_SLUGS, itemArtSlug, itemArtUrl } from "../itemArt";
import { counterSections, findCard, restockLine, stockMark } from "../shopViewModel";

const TOGGLE = getVendor(placeVendorId("gun_shop", "d3"));

describe("laying out the counter", () => {
  const shelf = stockedShelf(
    shopStock({ vendor: TOGGLE, seed: "camp", day: 1, backRoomOpen: true }),
    1000,
  );
  const sections = counterSections(shelf, TOGGLE.deals);

  it("puts every item in exactly one place", () => {
    const placed = [
      ...sections.counter,
      ...sections.line,
      ...sections.backRoom,
      ...sections.shelves.flatMap((s) => s.items),
    ];
    expect(placed).toHaveLength(shelf.length);
    expect(new Set(placed.map((i) => `${i.kind}:${i.itemId}`)).size).toBe(shelf.length);
  });

  it("keeps the line and the back room off the shelves", () => {
    expect(sections.line.map((i) => i.itemId).sort()).toEqual([...TOGGLE.signature].sort());
    expect(sections.backRoom.map((i) => i.itemId).sort()).toEqual([...TOGGLE.backRoom].sort());
  });

  it("leads each shelf with what came in, and ends it with what is out", () => {
    for (const { items } of sections.shelves) {
      const firstOut = items.findIndex((i) => !i.available);
      if (firstOut >= 0) expect(items.slice(firstOut).every((i) => !i.available)).toBe(true);
      const firstStaple = items.findIndex((i) => i.layer === "staple");
      if (firstStaple >= 0) {
        expect(items.slice(0, firstStaple).every((i) => i.layer === "unusual")).toBe(true);
      }
    }
  });

  it("puts the held thing first on the counter, then what was set aside", () => {
    const find = (id: string, extra = {}) => ({
      ...shelf[0]!,
      kind: "gear" as const,
      itemId: id,
      layer: "find" as const,
      key: "find" as const,
      price: 10,
      ...extra,
    });
    const a = find(gadgetId("hush_wrap", "quiet", "none", 0));
    const b = find(gadgetId("sound_puck", "remote", "none", 0), { forYou: true });
    const held = { ...shelf[0]!, key: "held" as const, price: 1 };
    const { counter } = counterSections([a, b, held], TOGGLE.deals);
    expect(counter.map((i) => i.key === "held" || i.forYou === true)).toEqual([true, true, false]);
    expect(counter[0]!.key).toBe("held");
  });
});

describe("what a row says", () => {
  it("says nothing about staple stock and something about everything else", () => {
    const shelf = stockedShelf(shopStock({ vendor: TOGGLE, seed: "camp", day: 1 }), 1000);
    for (const item of shelf) {
      if (item.key === "ordinary") expect(stockMark(item)).toBeNull();
      else expect(stockMark(item)?.text).toBeTruthy();
    }
  });

  it("calls a hot find hot", () => {
    const id = `${gadgetId("lock_gun", "quiet", "none", 0)}.h-d3-arasaka`;
    const item = {
      ...stockedShelf(shopStock({ vendor: TOGGLE, seed: "c", day: 1 }), 0)[0]!,
      kind: "gear" as const,
      itemId: id,
      layer: "find" as const,
      key: "find" as const,
    };
    expect(stockMark(item)?.tone).toBe("hot");
    expect(findCard(id)?.hot).toBe(true);
    expect(findCard(id)?.contract).toBe(readGadget(id)!.contract);
    expect(findCard("rope_60m_yd")).toBeNull();
  });

  it("counts down to a restock", () => {
    expect(restockLine(1)).toBe("restocks tomorrow");
    expect(restockLine(4)).toBe("restocks in 4 days");
    expect(restockLine(null)).toBeNull();
  });
});

describe("item pictures", () => {
  it("has a slug for every weapon and armor, and only slugs it can name", () => {
    for (const w of WEAPONS) expect(ITEM_ART_SLUGS).toContain(itemArtSlug("weapon", w.id));
    for (const a of ARMOR) expect(ITEM_ART_SLUGS).toContain(itemArtSlug("armor", a.id));
    expect(itemArtSlug("ammunition", "basic_ammo")).toBe("ammo");
    expect(itemArtSlug("gear", "rope_60m_yd")).toBe("gear");
    expect(itemArtSlug("gear", gadgetId("crawler", "remote", "none", 0))).toBe("find-crawler");
  });

  it("asks for no picture until its file has landed", () => {
    expect(itemArtUrl("weapon", "heavy_pistol", true, [])).toBeNull();
    expect(itemArtUrl("weapon", "heavy_pistol", true, ["pistol"])).toBe(
      "/images/items/pistol-640.webp",
    );
    expect(itemArtUrl("weapon", "heavy_pistol", false, ["pistol"])).toBe(
      "/images/items/pistol.webp",
    );
  });
});
