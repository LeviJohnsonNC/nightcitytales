import { describe, expect, it } from "vitest";
import {
  EMPTY_LOADOUT,
  FASHION_SLOTS,
  STARTING_HOUSING,
  STARTING_LIFESTYLE,
  STARTING_LOCATIONS,
  addPurchase,
  budgetStates,
  canPurchase,
  fashionItemId,
  getFashion,
  isFashionItem,
  readLifestyle,
  validateLifestyle,
} from "../index";

describe("fashion", () => {
  it("prices a piece from catalog.json", () => {
    const piece = getFashion(fashionItemId("leisurewear", "Jacket"));
    expect(piece.name).toBe("Leisurewear Jacket");
    expect(piece.cost).toBe(100);
  });

  it("exposes the printed garment slots", () => {
    expect(FASHION_SLOTS).toContain("Mirrorshades");
  });

  it("counts fashion against the fashion budget only", () => {
    const id = fashionItemId("leisurewear", "Jacket");
    expect(isFashionItem("fashion", id)).toBe(true);
    const loadout = addPurchase("complete_package", EMPTY_LOADOUT, {
      kind: "fashion",
      itemId: id,
      budget: "fashion",
    });
    const fashion = budgetStates("complete_package", loadout).find((b) => b.id === "fashion")!;
    expect(fashion.spent).toBe(100);
    expect(fashion.unspentKept).toBe(false);
  });

  it("refuses a piece the fashion budget cannot cover", () => {
    const check = canPurchase("complete_package", EMPTY_LOADOUT, {
      kind: "fashion",
      itemId: fashionItemId("high_fashion", "Jewelry"),
      budget: "fashion",
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("eb left");
  });
});

describe("starting lifestyle", () => {
  it("reads housing, lifestyle and locations from creation-rules.json", () => {
    expect(STARTING_HOUSING).toBe("Rented Cargo Container");
    expect(STARTING_LIFESTYLE).toBe("Kibble");
    expect(STARTING_LOCATIONS).toEqual(["Overcrowded Suburbs", "Combat Zone"]);
  });

  it("requires a location and rejects anything off the list", () => {
    expect(validateLifestyle({ location: null })).toHaveLength(1);
    expect(readLifestyle({ location: "Corpo Plaza" }).location).toBeNull();
    expect(validateLifestyle(readLifestyle({ location: "Combat Zone" }))).toHaveLength(0);
  });
});