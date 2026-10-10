import { describe, expect, it } from "vitest";
import {
  LEDGER_EVENTS,
  RESALE_WEEKS,
  SHOP_SUPPLY_IS_HOUSE_RULE,
  SUPPLY_MAX_LEAN,
  SUPPLY_WINDOW_DAYS,
  districtOfPlace,
  gadgetFinds,
  gadgetId,
  getVendor,
  placeChangedEventData,
  placeVendorId,
  readGadget,
  readProvenance,
  sellPrice,
  shopStock,
  supplyFrom,
  supplyProvenance,
  supplyReaching,
  PLACE_SHOPS,
} from "@/engine";

const settled = (day: number, placeKey: string, factions: string[]) => ({
  type: LEDGER_EVENTS.jobSettled,
  data: {
    day,
    placeKey,
    missionId: "m",
    pressure: factions.map((key) => ({ kind: "standing", key, label: key, before: 0, after: -1 })),
  },
});
const changed = (day: number, placeKey: string, flag: string, set = true) => ({
  type: LEDGER_EVENTS.placeChanged,
  data: placeChangedEventData({ placeKey, flag, set, day }),
});

// Toggle's Temple and a fence elsewhere.
const TOGGLE = getVendor(placeVendorId("gun_shop", "d3"));
const SWAP = getVendor(placeVendorId("street", "k3"));
const TOGGLE_DISTRICT = districtOfPlace("d3")!.key;
const ELSEWHERE = PLACE_SHOPS.map((s) => s.place).find(
  (p) =>
    districtOfPlace(p)!.key !== TOGGLE_DISTRICT &&
    districtOfPlace(p)!.key !== districtOfPlace("k3")!.key,
)!;

describe("what the city sends onto the street", () => {
  it("is a house rule", () => {
    expect(SHOP_SUPPLY_IS_HOUSE_RULE).toBe(true);
  });

  it("reads salvage off a place that gained a salvage flag, and nothing else", () => {
    const supply = supplyFrom([
      changed(3, "d3", "raided"),
      changed(4, "d3", "raided", false), // lost it: not a source
      changed(5, "d3", "welcome"), // not salvage
      { type: LEDGER_EVENTS.placeChanged, data: { placeKey: "d3", flag: "raided", set: true } }, // undated
    ]);
    expect(supply).toEqual([{ kind: "salvage", placeKey: "d3", flag: "raided", day: 3 }]);
  });

  it("reads a job that crossed somebody as hot, and a job that crossed nobody as nothing", () => {
    expect(supplyFrom([settled(6, "d3", ["arasaka"])])).toEqual([
      { kind: "hot", placeKey: "d3", factionId: "arasaka", day: 6 },
    ]);
    expect(supplyFrom([settled(6, "d3", [])])).toEqual([]);
    expect(supplyFrom([settled(6, "d3", ["nobody_real"])])).toEqual([]);
  });

  it("reaches the district for a while, and a fence from anywhere", () => {
    const supply = supplyFrom([changed(10, ELSEWHERE, "shut")]);
    expect(supplyReaching({ supply, vendor: TOGGLE, day: 12 })).toEqual([]);
    expect(supplyReaching({ supply, vendor: SWAP, day: 12 })).toHaveLength(1);
    expect(supplyReaching({ supply, vendor: SWAP, day: 10 + SUPPLY_WINDOW_DAYS })).toEqual([]);
    expect(supplyReaching({ supply, vendor: SWAP, day: 9 })).toEqual([]); // not yet
    const local = supplyFrom([changed(10, "d3", "shut")]);
    expect(supplyReaching({ supply: local, vendor: TOGGLE, day: 12 })).toHaveLength(1);
    expect(supplyReaching({ supply: local, vendor: getVendor("fixer"), day: 12 })).toEqual([]);
  });

  it("leans the die at most so far, newest first", () => {
    const supply = supplyFrom([1, 2, 3, 4].map((d) => changed(d, "d3", "power_out")));
    const reaching = supplyReaching({ supply, vendor: TOGGLE, day: 5 });
    expect(reaching).toHaveLength(SUPPLY_MAX_LEAN);
    expect(reaching[0]!.day).toBe(4);
  });

  it("makes more finds turn up, carrying where they came from", () => {
    const supply = supplyFrom([settled(1, "k3", ["tyger_claws"]), changed(2, "k3", "raided")]);
    let found = false;
    for (let week = 0; week < 40 && !found; week += 1) {
      const day = 1 + week * 7;
      const items = shopStock({
        vendor: SWAP,
        seed: "camp",
        day,
        supply: supply.map((e) => ({ ...e, day })),
      }).filter((i) => i.layer === "find");
      const withOrigin = items.map((i) => readGadget(i.itemId)!).filter((g) => g.provenance);
      if (withOrigin.length) {
        found = true;
        for (const g of withOrigin) expect(g.origin).toBeTruthy();
      }
    }
    expect(found).toBe(true);
  });
});

describe("where a find came from", () => {
  it("is checked against the atlas and the factions every time it is read", () => {
    expect(readProvenance("s-d3-raided")).toEqual({
      kind: "salvage",
      placeKey: "d3",
      flag: "raided",
    });
    expect(readProvenance("h-d3-arasaka")).toEqual({
      kind: "hot",
      placeKey: "d3",
      factionId: "arasaka",
    });
    for (const bad of ["s-d3-welcome", "s-zz99-raided", "h-d3-nobody", "x-d3-raided", "s-d3"]) {
      expect(readProvenance(bad)).toBeNull();
    }
    const base = gadgetId("sound_puck", "remote", "none", 0);
    expect(readGadget(`${base}.s-zz99-raided`)).toBeNull();
  });

  it("makes a hot thing a step cheaper and says who wants it back", () => {
    const base = gadgetId("sound_puck", "remote", "none", 0);
    const plain = readGadget(base)!;
    const hot = readGadget(`${base}.h-d3-arasaka`)!;
    expect(hot.cost).toBeLessThan(plain.cost);
    expect(hot.origin).toContain("Arasaka");
    expect(readGadget(`${base}.s-d3-raided`)!.cost).toBe(plain.cost);
  });

  it("lends finds their supply's provenance in order", () => {
    const provenance = supplyProvenance([
      { kind: "salvage", placeKey: "k3", flag: "raided", day: 1 },
    ]);
    for (let period = 0; period < 50; period += 1) {
      const finds = gadgetFinds({
        seed: "c",
        vendorId: SWAP.id,
        archetype: "street",
        period,
        lean: 3,
        provenance,
      });
      if (finds.length) expect(finds[0]!.provenance?.kind).toBe("salvage");
      for (const f of finds.slice(1)) expect(f.provenance).toBeNull();
    }
  });
});

describe("selling", () => {
  it("pays half the printed price, less a markup's cut, for what the seller deals in", () => {
    const guns = getVendor("gun_shop");
    expect(sellPrice(guns, "weapon", "assault_rifle")).toBe(250);
    expect(sellPrice(getVendor("fixer"), "weapon", "assault_rifle")).toBe(200);
    expect(sellPrice(guns, "armor", "kevlar")).toBeNull();
    expect(sellPrice(guns, "ammunition", "basic_ammo")).toBeNull();
    expect(sellPrice(guns, "cyberware", "biomonitor")).toBeNull();
  });

  it("lets a fence buy a find whatever it deals in, and nobody buy a find nobody can read", () => {
    const find = gadgetId("sound_puck", "remote", "none", 0);
    const fenceGuns = getVendor(placeVendorId("gun_shop", "e7"));
    expect(fenceGuns.finds).toBeGreaterThan(0);
    expect(sellPrice(fenceGuns, "gear", find)).toBe(readGadget(find)!.cost / 2);
    expect(sellPrice(TOGGLE, "gear", find)).toBeNull();
    expect(sellPrice(SWAP, "gear", "gadget.nope.quiet.none.0")).toBeNull();
  });

  it("keeps a resold find a stated number of weeks", () => {
    expect(RESALE_WEEKS).toBeGreaterThan(0);
  });
});
