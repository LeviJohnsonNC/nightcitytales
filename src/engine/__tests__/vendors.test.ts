import { describe, expect, it } from "vitest";
import {
  STOCK,
  STOCK_REGULAR_BONUS,
  UNUSUAL_ABOVE,
  VENDORS,
  VENDOR_IDS,
  checkStock,
  getVendor,
  inStock,
  isVendorId,
  shelfFor,
  shelfTier,
  stockEntryFor,
  vendorDealsIn,
  vendorPrice,
  type ShelfItem,
} from "../vendors";
import { AMMUNITION, GEAR, WEAPONS, itemCost } from "../catalog";
import { effectiveSlot, isPackageSlot, resolveItemKind } from "../inventorySlot";
import { seededRng } from "../dice";

/** An RNG pinned to one face of a d6. */
function face(value: number): () => number {
  return () => (value - 0.5) / 6;
}

const STREET = getVendor("street");
const GUNS = getVendor("gun_shop");
const FIXER = getVendor("fixer");

describe("who sells what", () => {
  it("registers every vendor under its own id", () => {
    for (const id of VENDOR_IDS) expect(getVendor(id).id).toBe(id);
    expect(VENDORS).toHaveLength(VENDOR_IDS.length);
  });

  it("throws for somebody who does not exist", () => {
    expect(() => getVendor("arasaka_gift_shop")).toThrow(/arasaka_gift_shop/);
  });

  it("recognises a real vendor id and rejects anything else", () => {
    expect(isVendorId("street")).toBe(true);
    expect(isVendorId("nobody")).toBe(false);
    expect(isVendorId(null)).toBe(false);
    expect(isVendorId(7)).toBe(false);
  });

  it("gives every vendor something to sell, and a reason to say no", () => {
    for (const vendor of VENDORS) {
      expect(vendor.deals.length).toBeGreaterThan(0);
      expect(vendor.refusal.trim().length).toBeGreaterThan(10);
      expect(vendor.line.trim().length).toBeGreaterThan(10);
      expect(vendor.minutes).toBeGreaterThan(0);
      expect(vendor.markup).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps each of them out of somebody else's trade", () => {
    // A street pitch is not selling rifles, and the gun shop is not doing armor.
    expect(vendorDealsIn(STREET, "weapon")).toBe(false);
    expect(vendorDealsIn(GUNS, "armor")).toBe(false);
    expect(vendorDealsIn(getVendor("armorer"), "weapon")).toBe(false);
  });

  it("sells chrome nowhere — that is a surgery, not a purchase", () => {
    for (const vendor of VENDORS) {
      expect(vendorDealsIn(vendor, "cyberware")).toBe(false);
      expect(shelfFor(vendor).some((i) => i.kind === "cyberware")).toBe(false);
    }
  });

  it("lets the fixer reach anything the others can, and charges for it", () => {
    for (const vendor of VENDORS) {
      for (const kind of vendor.deals) expect(vendorDealsIn(FIXER, kind)).toBe(true);
    }
    expect(FIXER.markup).toBeGreaterThan(1);
  });
});

describe("what a thing costs here", () => {
  it("charges the printed price where there is no markup", () => {
    const ammo = AMMUNITION[0]!;
    expect(vendorPrice(STREET, "ammunition", ammo.id)).toBe(itemCost("ammunition", ammo.id));
  });

  it("charges the fixer's premium on top", () => {
    const rifle = WEAPONS.find((w) => w.cost >= 100)!;
    const printed = itemCost("weapon", rifle.id);
    expect(vendorPrice(FIXER, "weapon", rifle.id)).toBe(Math.round(printed * FIXER.markup));
    expect(vendorPrice(FIXER, "weapon", rifle.id)).toBeGreaterThan(printed);
  });

  it("never quotes a fractional eurobuck", () => {
    for (const vendor of VENDORS) {
      for (const item of shelfFor(vendor)) expect(Number.isInteger(item.price)).toBe(true);
    }
  });
});

describe("the shelf", () => {
  it("lists only what the vendor deals in", () => {
    for (const vendor of VENDORS) {
      for (const item of shelfFor(vendor)) expect(vendor.deals).toContain(item.kind);
    }
  });

  it("puts real catalog items on it, priced from the catalog", () => {
    const shelf = shelfFor(GUNS);
    expect(shelf.length).toBeGreaterThan(0);
    for (const item of shelf) {
      expect(item.name.trim().length).toBeGreaterThan(0);
      expect(item.price).toBe(vendorPrice(GUNS, item.kind, item.itemId));
    }
  });

  it("carries every weapon in the catalog at the gun shop", () => {
    const ids = new Set(
      shelfFor(GUNS)
        .filter((i) => i.kind === "weapon")
        .map((i) => i.itemId),
    );
    expect(ids.size).toBe(WEAPONS.length);
  });

  it("carries every piece of gear the street would plausibly have", () => {
    const ids = new Set(
      shelfFor(STREET)
        .filter((i) => i.kind === "gear")
        .map((i) => i.itemId),
    );
    expect(ids.size).toBe(GEAR.length);
  });

  it("sorts cheapest first, so what you can afford is what you see", () => {
    const shelf = shelfFor(FIXER);
    for (let i = 1; i < shelf.length; i += 1) {
      expect(shelf[i]!.price).toBeGreaterThanOrEqual(shelf[i - 1]!.price);
    }
  });

  it("never lists the same thing twice", () => {
    for (const vendor of VENDORS) {
      const keys = shelfFor(vendor).map((i) => `${i.kind}:${i.itemId}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("ordinary and unusual", () => {
  it("draws the line on a step the published ladder actually prints", () => {
    // Cheap 10, Everyday 20, Costly 50, Premium 100, Expensive 500, V.Exp 1000.
    expect(UNUSUAL_ABOVE).toBe(100);
    expect(shelfTier("gear", GEAR.find((g) => g.cost === 100)!.id)).toBe("ordinary");
    expect(shelfTier("gear", GEAR.find((g) => g.cost === 500)!.id)).toBe("unusual");
  });

  it("calls cheap things ordinary and expensive things unusual", () => {
    for (const vendor of VENDORS) {
      for (const item of shelfFor(vendor)) {
        const printed = itemCost(item.kind, item.itemId);
        expect(item.tier).toBe(printed > UNUSUAL_ABOVE ? "unusual" : "ordinary");
      }
    }
  });

  it("keeps plain bullets ordinary, because a merc who cannot reload is a chore", () => {
    // Basic and rubber rounds are 10eb a box and always on the counter. The
    // exotics — biotoxin, EMP, smart — are 500eb and have to be found, which is
    // the correct answer: those are not things a street pitch keeps in a crate.
    const basic = AMMUNITION.filter((a) => a.cost <= UNUSUAL_ABOVE);
    const exotic = AMMUNITION.filter((a) => a.cost > UNUSUAL_ABOVE);
    expect(basic.length).toBeGreaterThan(0);
    expect(exotic.length).toBeGreaterThan(0);
    for (const ammo of basic) expect(shelfTier("ammunition", ammo.id)).toBe("ordinary");
    for (const ammo of exotic) expect(shelfTier("ammunition", ammo.id)).toBe("unusual");
  });

  it("always keeps the round a reload actually needs on the shelf", () => {
    expect(shelfTier("ammunition", "basic_ammo")).toBe("ordinary");
  });
});

describe("is it in tonight?", () => {
  const unusual = (): ShelfItem => shelfFor(GUNS).find((i) => i.tier === "unusual")!;
  const ordinary = (): ShelfItem => shelfFor(GUNS).find((i) => i.tier === "ordinary")!;

  it("does not roll for the ordinary — it is simply there", () => {
    const check = checkStock(GUNS, ordinary(), { rng: face(1) });
    expect(check).toEqual({ available: true, roll: null, key: "ordinary" });
  });

  it("rolls for the unusual, and can come up empty", () => {
    const check = checkStock(GUNS, unusual(), { rng: face(1) });
    expect(check.available).toBe(false);
    expect(check.key).toBe("out");
    expect(check.roll?.roll.formula).toContain("1d6(1)");
  });

  it("sells it when the die says it is in", () => {
    expect(checkStock(GUNS, unusual(), { rng: face(6) }).available).toBe(true);
    expect(checkStock(GUNS, unusual(), { rng: face(3) })).toMatchObject({
      available: true,
      key: "last_one",
    });
  });

  it("rewards being known here, on the read rather than the die", () => {
    const cold = checkStock(GUNS, unusual(), { rng: face(2) });
    const known = checkStock(GUNS, unusual(), { rng: face(2), regular: true });
    expect(cold.available).toBe(false);
    expect(known.available).toBe(true);
    expect(known.roll?.roll.rolls).toEqual([2]);
    expect(known.roll?.roll.formula).toContain("Known here(1)");
  });

  it("refuses outright what this vendor does not deal in", () => {
    const armor = shelfFor(getVendor("armorer")).find((i) => i.kind === "armor")!;
    const check = checkStock(GUNS, armor, { rng: face(6) });
    expect(check).toEqual({ available: false, roll: null, key: "not_dealt" });
  });

  it("puts the item in stock more often than not, over a long run", () => {
    const rng = seededRng(4077);
    const item = unusual();
    let had = 0;
    const asks = 2000;
    for (let i = 0; i < asks; i += 1) {
      if (checkStock(GUNS, item, { rng }).available) had += 1;
    }
    // Four faces in six say yes; a shop that is usually empty is not a shop.
    expect(had / asks).toBeGreaterThan(0.6);
    expect(had / asks).toBeLessThan(0.73);
  });
});

describe("the stock table itself", () => {
  it("tiles the die with no gaps or overlaps", () => {
    const covered = new Set<number>();
    for (const entry of STOCK.entries) {
      for (let f = entry.from; f <= entry.to; f += 1) {
        expect(covered.has(f)).toBe(false);
        covered.add(f);
      }
    }
    expect(covered.size).toBe(STOCK.die);
  });

  it("is open, because watching the shop roll empty is the point", () => {
    expect(STOCK.visibility).toBe("open");
  });

  it("clamps when being known pushes the read off the top", () => {
    expect(stockEntryFor(STOCK.die + STOCK_REGULAR_BONUS).key).toBe("in");
    expect(stockEntryFor(0).key).toBe("out");
  });

  it("only calls a stock roll in stock", () => {
    for (const entry of STOCK.entries) {
      const roll = { tableId: STOCK.id, key: entry.key } as Parameters<typeof inStock>[0];
      expect(inStock(roll)).toBe(entry.key !== "out");
    }
    expect(inStock({ tableId: "street", key: "in" } as Parameters<typeof inStock>[0])).toBe(false);
  });
});

describe("resolveItemKind and effectiveSlot", () => {
  it("finds the namespace an id lives in", () => {
    expect(resolveItemKind(WEAPONS[0]!.id)).toBe("weapon");
    expect(resolveItemKind(AMMUNITION[0]!.id)).toBe("ammunition");
    expect(resolveItemKind(GEAR[0]!.id)).toBe("gear");
  });

  it("returns nothing for an id the catalog has never heard of", () => {
    expect(resolveItemKind("a_sharpened_spoon")).toBeNull();
  });

  it("prefers gear for the ids that exist as both gear and chrome", () => {
    // An audio recorder you carry, and one in your skull. A row that came out
    // of a gear package is the carried one.
    expect(resolveItemKind("audio_recorder")).toBe("gear");
  });

  it("resolves every id in the catalog to something", () => {
    for (const w of WEAPONS) expect(resolveItemKind(w.id)).toBe("weapon");
    for (const a of AMMUNITION) expect(resolveItemKind(a.id)).toBe("ammunition");
  });

  it("leaves a real slot alone and places a package one", () => {
    expect(effectiveSlot({ item_id: WEAPONS[0]!.id, slot: "weapon" })).toBe("weapon");
    expect(effectiveSlot({ item_id: WEAPONS[0]!.id, slot: "package:weaponsArmor" })).toBe("weapon");
    expect(effectiveSlot({ item_id: WEAPONS[0]!.id, slot: null })).toBe("weapon");
  });

  it("recognises a package bucket for what it is", () => {
    expect(isPackageSlot("package:gear")).toBe(true);
    expect(isPackageSlot("weapon")).toBe(false);
    expect(isPackageSlot(null)).toBe(false);
  });
});
