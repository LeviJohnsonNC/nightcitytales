import { describe, expect, it } from "vitest";
import type { CampaignInventoryItem, FullCharacter } from "@/lib/backend";
import { liveInventory } from "../liveInventory";
import { armorSp, weaponChoices } from "../encounterModel";
import { getArmor } from "@/engine";

/** A vest and a helmet that exist in the catalog, whatever it happens to hold. */
const BODY = getArmor("light_armorjack");
const HEAVY = getArmor("heavy_armorjack");

function invRow(patch: Partial<CampaignInventoryItem>): CampaignInventoryItem {
  return {
    id: "row",
    campaign_id: "c",
    kind: "gear",
    item_id: "flashlight",
    quantity: 1,
    equipped: false,
    slot: "gear",
    current_sp: null,
    ammo_loaded: null,
    condition: "ok",
    notes: null,
    ...patch,
  } as unknown as CampaignInventoryItem;
}

function sheet(gear: Record<string, unknown>[]): FullCharacter {
  return { gear } as unknown as FullCharacter;
}

describe("liveInventory", () => {
  it("uses the campaign's rows when it has any", () => {
    const rows = [invRow({ id: "live" })];
    const out = liveInventory(rows, sheet([{ id: "sheet" }]));
    expect(out.map((r) => r.id)).toEqual(["live"]);
  });

  it("leaves a row that is already in a real slot exactly as it is", () => {
    const rows = [invRow({ id: "live", item_id: "medium_pistol", slot: "weapon" })];
    expect(liveInventory(rows, sheet([]))[0]).toBe(rows[0]);
  });

  it("falls back to the sheet for a campaign that has none", () => {
    const out = liveInventory(
      [],
      sheet([{ id: "s1", item_id: "medium_pistol", quantity: 1, equipped: true, slot: "weapon" }]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ item_id: "medium_pistol", slot: "weapon", equipped: true });
  });

  it("gives the projected rows the fields every reader expects", () => {
    const [only] = liveInventory([], sheet([{ id: "s", item_id: "x", quantity: 2, slot: "gear" }]));
    expect(only).toHaveProperty("ammo_loaded", null);
    expect(only).toHaveProperty("condition", "ok");
  });

  it("says nothing about a character carrying nothing", () => {
    expect(liveInventory([], sheet([]))).toEqual([]);
  });
});

describe("armor bought during the campaign", () => {
  it("protects you, which reading the frozen sheet never allowed", () => {
    // The defect: armorSp read character.gear, so a vest bought mid-campaign
    // gave zero SP. These rows exist ONLY in campaign_inventory.
    const bought = [invRow({ id: "vest", item_id: BODY.id, slot: "body", equipped: true })];
    expect(armorSp(bought).body).toBe(BODY.sp);
  });

  it("uses the ablated SP once somebody has shot at it", () => {
    const chewed = [
      invRow({ id: "vest", item_id: BODY.id, slot: "body", equipped: true, current_sp: 3 }),
    ];
    // Armor repair writes current_sp; before this, nothing computing
    // protection ever read that column.
    expect(armorSp(chewed).body).toBe(3);
  });

  it("does not protect you while it is still in the bag", () => {
    const unworn = [invRow({ id: "vest", item_id: BODY.id, slot: "body", equipped: false })];
    expect(armorSp(unworn).body).toBe(0);
  });

  it("counts the best worn piece per location", () => {
    const both = [
      invRow({ id: "light", item_id: BODY.id, slot: "body", equipped: true }),
      invRow({ id: "heavy", item_id: HEAVY.id, slot: "body", equipped: true }),
    ];
    expect(armorSp(both).body).toBe(Math.max(BODY.sp ?? 0, HEAVY.sp ?? 0));
  });

  it("ignores anything that is not armor in an armor slot", () => {
    expect(armorSp([invRow({ slot: "gear", equipped: true })])).toEqual({ head: 0, body: 0 });
    expect(armorSp([])).toEqual({ head: 0, body: 0 });
  });

  it("ignores a row that has been spent to nothing", () => {
    const gone = [invRow({ item_id: BODY.id, slot: "body", equipped: true, quantity: 0 })];
    expect(armorSp(gone).body).toBe(0);
  });
});

describe("weapons bought during the campaign", () => {
  it("can actually be fired, which reading the frozen sheet never allowed", () => {
    const bought = [invRow({ id: "gun", item_id: "medium_pistol", slot: "weapon" })];
    expect(weaponChoices(bought).map((w) => w.itemId)).toEqual(["medium_pistol"]);
  });

  it("offers every weapon in the kit, not just the first", () => {
    const two = [
      invRow({ id: "a", item_id: "medium_pistol", slot: "weapon" }),
      invRow({ id: "b", item_id: "heavy_pistol", slot: "weapon" }),
    ];
    expect(weaponChoices(two)).toHaveLength(2);
  });

  it("skips anything that is not a catalog weapon rather than guessing", () => {
    const junk = [invRow({ id: "x", item_id: "a_sharpened_spoon", slot: "weapon" })];
    expect(weaponChoices(junk)).toEqual([]);
  });

  it("skips rows that are not weapons at all", () => {
    expect(weaponChoices([invRow({ slot: "gear", item_id: "medium_pistol" })])).toEqual([]);
  });
});

describe("Role package kit", () => {
  // saveCharacter files package gear under slot "package:weaponsArmor" with
  // equipped false. That is neither a weapon slot nor an armor location, so a
  // character created from a package had a rifle combat never offered and
  // armor that stopped nothing — before this, and regardless of the shop.
  const packaged = (itemId: string) =>
    invRow({ id: itemId, item_id: itemId, slot: "package:weaponsArmor" });

  it("puts a packaged weapon where combat can find it", () => {
    const rows = liveInventory([packaged("medium_pistol")], sheet([]));
    expect(rows[0]!.slot).toBe("weapon");
    expect(weaponChoices(rows).map((w) => w.itemId)).toEqual(["medium_pistol"]);
  });

  it("puts packaged armor on the body, and on the character", () => {
    const rows = liveInventory([packaged(BODY.id)], sheet([]));
    expect(rows[0]!.slot).toBe("body");
    expect(rows[0]!.equipped).toBe(true);
    expect(armorSp(rows).body).toBe(BODY.sp);
  });

  it("recovers the kind as well, so the catalog can be searched", () => {
    expect(liveInventory([packaged(BODY.id)], sheet([]))[0]!.kind).toBe("armor");
  });

  it("does the same for the sheet fallback", () => {
    const rows = liveInventory(
      [],
      sheet([
        { id: "p", item_id: "medium_pistol", quantity: 1, equipped: false, slot: "package:gear" },
      ]),
    );
    expect(weaponChoices(rows).map((w) => w.itemId)).toEqual(["medium_pistol"]);
  });

  it("leaves a packaged item the catalog cannot place alone", () => {
    const rows = liveInventory([packaged("something_invented")], sheet([]));
    expect(rows[0]!.slot).toBe("package:weaponsArmor");
  });

  it("does not mark packaged gear as worn — only armor gets put on", () => {
    const rows = liveInventory([packaged("flashlight")], sheet([]));
    expect(rows[0]!.equipped).toBe(false);
  });
});
