/**
 * Using something out of the kit, and what the sheet says afterwards.
 *
 * This is the bug's own test. A Life turn used to check the Glow Paint, write
 * "Used 5× Glow Paint" to the ledger, and leave all five cans on the sheet:
 * the action was authorised against the true inventory and then never applied
 * to it. Both loops go through this planner now, so what it decides is what
 * the rows become.
 */
import { describe, expect, it } from "vitest";
import { EMPTY_TURN_ECONOMY, judgeAction, type CapabilitySnapshot } from "@/engine";
import type { CampaignInventoryItem } from "@/lib/backend";
import { applyItemUse, planItemUse } from "../itemUse";

function row(id: string, itemId: string, quantity: number): CampaignInventoryItem {
  return {
    id,
    campaign_id: "c",
    kind: "gear",
    item_id: itemId,
    quantity,
    equipped: false,
    slot: "gear",
    current_sp: null,
    ammo_loaded: null,
    condition: "ok",
    notes: null,
  } as unknown as CampaignInventoryItem;
}

const inventory = [
  row("paint", "glow_paint", 5),
  row("guitar", "electric_guitar_other_instrument", 1),
  row("ammo", "basic_ammo", 50),
];

const capability = {
  items: inventory.map((r) => ({
    itemId: r.item_id,
    name:
      r.item_id === "glow_paint"
        ? "Glow Paint"
        : r.item_id === "basic_ammo"
          ? "Basic Ammunition"
          : "Electric Guitar/Other Instrument",
    kind: "gear",
    quantity: r.quantity,
  })),
  weapons: [],
  cyberware: [],
  turn: EMPTY_TURN_ECONOMY,
  failedAttempts: [],
} as unknown as CapabilitySnapshot;

describe("five cans of Glow Paint, all of them", () => {
  const use = planItemUse({ capability, inventory, item: "Glow Paint", quantity: 5 });

  it("takes them off the sheet", () => {
    expect(use.consumed).toBe(true);
    expect(use.spent).toBe(5);
    expect(use.remaining).toBe(0);
    expect(use.writes).toEqual([{ id: "paint", quantity: 0 }]);
  });

  it("says in the ledger what the sheet now says", () => {
    expect(use.summary).toBe("Used 5× Glow Paint. None left.");
  });

  it("leaves a player who used one with four", () => {
    const one = planItemUse({ capability, inventory, item: "Glow Paint", quantity: 1 });
    expect(one.writes).toEqual([{ id: "paint", quantity: 4 }]);
    expect(one.summary).toBe("Used Glow Paint. 4 left.");
  });
});

describe("what a use does not take", () => {
  it("leaves the guitar alone, and says nothing about how many are left", () => {
    const use = planItemUse({
      capability,
      inventory,
      item: "Electric Guitar/Other Instrument",
      quantity: 1,
    });
    expect(use.consumed).toBe(false);
    expect(use.writes).toEqual([]);
    expect(use.summary).toBe("Used Electric Guitar/Other Instrument.");
  });

  it("keeps a row the catalog has never heard of rather than deleting it", () => {
    const odd = [row("mystery", "some-legacy-label", 3)];
    const snapshot = {
      items: [
        { itemId: "some-legacy-label", name: "some-legacy-label", kind: "gear", quantity: 3 },
      ],
      weapons: [],
      cyberware: [],
    } as unknown as CapabilitySnapshot;
    const use = planItemUse({
      capability: snapshot,
      inventory: odd,
      item: "some-legacy-label",
      quantity: 1,
    });
    expect(use.consumed).toBe(false);
    expect(use.writes).toEqual([]);
  });
});

describe("ammunition", () => {
  it("is spent by a use, the same as a can of paint", () => {
    const use = planItemUse({ capability, inventory, item: "Basic Ammunition", quantity: 2 });
    expect(use.consumed).toBe(true);
    expect(use.writes).toEqual([{ id: "ammo", quantity: 48 }]);
    expect(use.summary).toBe("Used 2× Basic Ammunition. 48 left.");
  });
});

describe("the rest of the same turn", () => {
  it("sees the kit as it now stands, so the last can cannot be used twice", () => {
    const first = planItemUse({ capability, inventory, item: "Glow Paint", quantity: 5 });
    const after = applyItemUse(inventory, first);
    expect(after.find((r) => r.id === "paint")?.quantity).toBe(0);

    // What legality is handed next: a snapshot built from the spent rows.
    const spent = {
      ...capability,
      items: after
        .filter((r) => r.quantity > 0)
        .map((r) => ({ itemId: r.item_id, name: r.item_id, kind: "gear", quantity: r.quantity })),
    } as unknown as CapabilitySnapshot;
    const verdict = judgeAction(spent, { kind: "use_item", item: "glow_paint", quantity: 1 });
    expect(verdict.ok).toBe(false);
  });

  it("returns the inventory untouched when nothing was spent", () => {
    const use = planItemUse({
      capability,
      inventory,
      item: "Electric Guitar/Other Instrument",
      quantity: 1,
    });
    expect(applyItemUse(inventory, use)).toBe(inventory);
  });
});

describe("the gate in front of it", () => {
  it("still refuses more than they carry, before any of this runs", () => {
    const verdict = judgeAction(capability, { kind: "use_item", item: "Glow Paint", quantity: 9 });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("5");
  });
});
