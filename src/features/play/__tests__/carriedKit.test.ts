import { describe, expect, it } from "vitest";
import type { CampaignInventoryItem } from "@/lib/backend";
import { carriedKit, detailFor, kindOf, nameFor } from "../carriedKit";
import { WEAPONS, weaponProfile } from "@/engine";

const GUN = WEAPONS.find((w) => w.magazine !== null && w.magazine >= 6)!;
const MAG = weaponProfile(GUN.id).magazine!;
const MELEE = WEAPONS.find((w) => w.category === "melee")!;

function row(patch: Partial<CampaignInventoryItem>): CampaignInventoryItem {
  return {
    id: "r",
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

describe("kindOf", () => {
  it("reads the kind when the row carries a correct one", () => {
    expect(kindOf(row({ kind: "weapon", slot: "weapon" }))).toBe("weapon");
    expect(kindOf(row({ kind: "cyberware", slot: "eyes" }))).toBe("cyberware");
    expect(kindOf(row({ kind: "gear", slot: "gear" }))).toBe("gear");
  });

  it("trusts the slot over a kind left wrong by the old copy", () => {
    // Every row start_campaign copied used to be filed as 'gear' whatever it
    // was. Reading slot first is what lets those campaigns group correctly
    // without having been migrated.
    expect(kindOf(row({ kind: "gear", slot: "weapon" }))).toBe("weapon");
    expect(kindOf(row({ kind: "gear", slot: "body" }))).toBe("armor");
    expect(kindOf(row({ kind: "gear", slot: "head" }))).toBe("armor");
    expect(kindOf(row({ kind: "gear", slot: "shield" }))).toBe("armor");
    expect(kindOf(row({ kind: "gear", slot: "ammunition" }))).toBe("ammunition");
  });

  it("files anything it cannot place as gear rather than dropping it", () => {
    expect(kindOf(row({ kind: "nonsense", slot: null } as Partial<CampaignInventoryItem>))).toBe(
      "gear",
    );
    expect(kindOf(row({ kind: "gear", slot: null }))).toBe("gear");
  });
});

describe("detailFor", () => {
  it("says what is in the gun", () => {
    expect(detailFor("weapon", row({ item_id: GUN.id, ammo_loaded: 3 }))).toBe(`3/${MAG} loaded`);
  });

  it("treats an untracked magazine as full, the same reading a reload uses", () => {
    expect(detailFor("weapon", row({ item_id: GUN.id, ammo_loaded: null }))).toBe(
      `${MAG}/${MAG} loaded`,
    );
  });

  it("never shows a negative round count", () => {
    expect(detailFor("weapon", row({ item_id: GUN.id, ammo_loaded: -4 }))).toBe(`0/${MAG} loaded`);
  });

  it("says nothing about rounds for a weapon that has none", () => {
    expect(detailFor("weapon", row({ item_id: MELEE.id }))).not.toContain("loaded");
  });

  it("survives a weapon the catalog does not know", () => {
    expect(detailFor("weapon", row({ item_id: "a_sharpened_spoon" }))).toBe("");
  });

  it("shows where armor is worn and what it is down to", () => {
    expect(detailFor("armor", row({ slot: "body", current_sp: 7 }))).toBe("body · SP 7");
    expect(detailFor("armor", row({ slot: "body", current_sp: null }))).toBe("body");
  });

  it("has nothing to add about ammunition or gear", () => {
    expect(detailFor("ammunition", row({}))).toBe("");
    expect(detailFor("gear", row({}))).toBe("");
  });
});

describe("nameFor", () => {
  it("gives the catalog's name", () => {
    expect(nameFor("weapon", GUN.id)).toBe(GUN.name);
  });

  it("falls back to the id rather than dropping something being carried", () => {
    expect(nameFor("gear", "mystery_object")).toBe("mystery_object");
  });
});

describe("carriedKit", () => {
  it("groups the kit in a fixed, readable order", () => {
    const groups = carriedKit([
      row({ id: "1", kind: "gear", slot: "gear", item_id: "flashlight" }),
      row({ id: "2", kind: "weapon", slot: "weapon", item_id: GUN.id }),
      row({ id: "3", kind: "ammunition", slot: "ammunition", item_id: "basic_ammo", quantity: 40 }),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["weapon", "ammunition", "gear"]);
  });

  it("leaves out a group with nothing in it", () => {
    const groups = carriedKit([row({ kind: "gear", slot: "gear" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.kind).toBe("gear");
  });

  it("leaves out rows that have been spent down to nothing", () => {
    const groups = carriedKit([
      row({ id: "spent", kind: "ammunition", slot: "ammunition", quantity: 0 }),
    ]);
    expect(groups).toHaveLength(0);
  });

  it("carries the quantity through for things that stack", () => {
    const [ammo] = carriedKit([
      row({ id: "a", kind: "ammunition", slot: "ammunition", item_id: "basic_ammo", quantity: 40 }),
    ]);
    expect(ammo!.lines[0]).toMatchObject({ quantity: 40 });
  });

  it("says nothing at all about an empty kit", () => {
    expect(carriedKit([])).toEqual([]);
  });

  it("shows a gun bought this campaign next to one carried in from creation", () => {
    // The bought row is what the old code could not see at all: no slot meant
    // no group, no name and no rounds.
    const groups = carriedKit([
      row({ id: "chargen", kind: "gear", slot: "weapon", item_id: GUN.id, ammo_loaded: 2 }),
      row({ id: "bought", kind: "weapon", slot: "weapon", item_id: GUN.id, ammo_loaded: null }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.lines.map((l) => l.id)).toEqual(["chargen", "bought"]);
    expect(groups[0]!.lines[0]!.detail).toBe(`2/${MAG} loaded`);
  });
});
