import { describe, expect, it } from "vitest";
import CONSUMABLES from "@/data/rules/consumables.json";
import { AMMUNITION, GEAR, isConsumable, planConsumption } from "..";

/**
 * Which things a use uses up.
 *
 * The bug this answers: a Life turn checked the Glow Paint, wrote "Used 5×
 * Glow Paint" to the ledger, and left all five cans on the sheet. Consumption
 * had no rule at all — so these tests pin both halves of the one it has now,
 * that a can of paint is spent and a guitar is not.
 */
describe("what a use uses up", () => {
  it("spends the things the catalog describes as one use", () => {
    for (const id of [
      "glow_paint",
      "food_stick",
      "kibble_pack",
      "mre",
      "road_flare",
      "glow_stick",
    ]) {
      expect(isConsumable(id)).toBe(true);
    }
  });

  it("leaves equipment alone", () => {
    for (const id of [
      "electric_guitar_other_instrument",
      "computer",
      "agent",
      "lock_picking_set",
      "medscanner",
      "rope_60m_yd",
      "duct_tape",
      "airhypo",
    ]) {
      expect(isConsumable(id)).toBe(false);
    }
  });

  it("spends every round in the catalog, without a list to maintain", () => {
    expect(AMMUNITION.length).toBeGreaterThan(0);
    for (const ammo of AMMUNITION) expect(isConsumable(ammo.id)).toBe(true);
  });

  it("keeps an unknown id: deleting something on a name nobody recognises is worse", () => {
    expect(isConsumable("not-in-any-catalog")).toBe(false);
    expect(isConsumable("")).toBe(false);
  });

  it("only names gear that actually exists", () => {
    const ids = new Set(GEAR.map((g) => g.id));
    for (const entry of CONSUMABLES.gear) expect(ids.has(entry.id)).toBe(true);
  });

  it("says why each one is spent, so the judgement can be argued with", () => {
    for (const entry of CONSUMABLES.gear) expect(entry.why.length).toBeGreaterThan(10);
  });
});

describe("taking it off the sheet", () => {
  const rows = [
    { id: "a", itemId: "glow_paint", quantity: 2 },
    { id: "b", itemId: "glow_paint", quantity: 3 },
    { id: "c", itemId: "food_stick", quantity: 1 },
  ];

  it("spends the smallest stack first, so one ragged row is left rather than two", () => {
    const plan = planConsumption(rows, "glow_paint", 3);
    expect(plan.spent).toBe(3);
    expect(plan.remaining).toBe(2);
    expect(plan.rows).toEqual([
      { id: "a", from: 2, to: 0 },
      { id: "b", from: 3, to: 2 },
    ]);
  });

  it("empties every row when the whole lot is used", () => {
    const plan = planConsumption(rows, "glow_paint", 5);
    expect(plan.spent).toBe(5);
    expect(plan.remaining).toBe(0);
    expect(plan.rows.every((row) => row.to === 0)).toBe(true);
  });

  it("takes what is there and reports it, rather than going negative", () => {
    const plan = planConsumption(rows, "glow_paint", 9);
    expect(plan.spent).toBe(5);
    expect(plan.remaining).toBe(0);
    expect(plan.rows.every((row) => row.to >= 0)).toBe(true);
  });

  it("touches only the item asked for", () => {
    const plan = planConsumption(rows, "food_stick", 1);
    expect(plan.rows).toEqual([{ id: "c", from: 1, to: 0 }]);
  });

  it("does nothing for an item that is not carried", () => {
    expect(planConsumption(rows, "road_flare", 1)).toEqual({ rows: [], spent: 0, remaining: 0 });
  });
});
