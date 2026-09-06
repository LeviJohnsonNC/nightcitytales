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
  EMPTY_LIFESTYLE,
  readLifestyle,
  startingLifestylePlan,
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

  it("carries rent, lifestyle cost and the free first month", () => {
    const plan = startingLifestylePlan("solo");
    expect(plan.rent).toBe(1000);
    expect(plan.lifestyleCost).toBe(100);
    expect(plan.firstMonthFree).toBe(true);
    expect(plan.requiresLocation).toBe(true);
  });

  it("gives an Exec granted Corporate Housing at no rent but still charges Lifestyle", () => {
    const plan = startingLifestylePlan("exec");
    expect(plan.housingName).toBe("Corporate Conapt");
    expect(plan.rent).toBe(0);
    expect(plan.requiresLocation).toBe(false);
    expect(plan.lifestyleCost).toBe(100);
    // The Exec is not asked for a category, because they are given housing
    // rather than renting it — but they are still asked WHERE, so the campaign
    // has an address to open at.
    expect(validateLifestyle(EMPTY_LIFESTYLE, "exec")).toHaveLength(2);
    expect(
      validateLifestyle(
        { location: null, districtKey: "norcal_military_base", placeKey: "m1" },
        "exec",
      ),
    ).toHaveLength(0);
  });

  it("requires a category and rejects anything off the printed list", () => {
    expect(validateLifestyle(EMPTY_LIFESTYLE)).toHaveLength(3);
    expect(readLifestyle({ location: "Corpo Plaza" }).location).toBeNull();
    const complete = readLifestyle({
      location: "Combat Zone",
      districtKey: "south_night_city",
      placeKey: "i6",
    });
    expect(validateLifestyle(complete)).toHaveLength(0);
  });

  it("reads a choice saved before there was an address to save", () => {
    // Characters and half-finished drafts were stored as a lone category. They
    // come back as exactly that — a category with no address — so the player is
    // asked to finish rather than being reset or having one invented.
    const old = readLifestyle({ location: "Combat Zone" });
    expect(old.location).toBe("Combat Zone");
    expect(old.districtKey).toBeNull();
    expect(old.placeKey).toBeNull();
    expect(validateLifestyle(old)).toHaveLength(2);
  });
});
