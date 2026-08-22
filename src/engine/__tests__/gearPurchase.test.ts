import { describe, expect, it } from "vitest";
import { catalogItem, getGear } from "../catalog";
import { EMPTY_LOADOUT, addPurchase, budgetStates, canPurchase, eurobucksKept } from "../loadout";

/**
 * General gear became a shoppable ItemKind. These cover the purchase path that
 * flows through the generic catalog/loadout helpers, so a regression in the
 * "gear" case surfaces here rather than in the UI.
 */
describe("gear catalog lookup", () => {
  it("resolves a gear row through the generic catalogItem dispatch", () => {
    expect(catalogItem("gear", "agent").name).toBe("Agent");
    expect(getGear("agent").cost).toBe(catalogItem("gear", "agent").cost);
  });

  it("throws a sourced error for an unknown gear id", () => {
    expect(() => getGear("no_such_gear")).toThrow(/gear/i);
  });
});

describe("buying gear", () => {
  it("spends gear money and keeps the remainder", () => {
    const unit = getGear("agent").cost;
    const loadout = addPurchase("complete_package", EMPTY_LOADOUT, {
      kind: "gear",
      itemId: "agent",
      qty: 2,
      budget: "gear",
    });

    const gearBudget = budgetStates("complete_package", loadout).find((b) => b.id === "gear")!;
    expect(gearBudget.spent).toBe(unit * 2);
    expect(eurobucksKept("complete_package", loadout)).toBe(gearBudget.limit - unit * 2);
  });

  it("refuses to buy gear with fashion money", () => {
    const check = canPurchase("complete_package", EMPTY_LOADOUT, {
      kind: "gear",
      itemId: "agent",
      budget: "fashion",
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/fashion/i);
  });

  it("blocks a gear purchase that exceeds the budget", () => {
    // Kibble is cheap, but a huge quantity still overruns the 2550eb gear budget.
    const check = canPurchase("complete_package", EMPTY_LOADOUT, {
      kind: "gear",
      itemId: "agent",
      qty: 100,
      budget: "gear",
    });
    expect(check.ok).toBe(false);
  });
});
