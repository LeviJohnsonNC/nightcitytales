import { describe, expect, it } from "vitest";
import { PRICE_CATEGORY_LADDER, priceCategoryContext } from "../priceCategory";

/**
 * priceCategory.ts derives its ladder and tables by parsing the prose in
 * roles.json (Tech Maker DV/time, Fixer Reach). These are canary tests: if
 * someone reformats that rules text, the parse silently degrades to null/empty
 * and these fail loudly instead of the feature vanishing without a trace.
 */
describe("price category ladder", () => {
  it("parses the full ladder from the Tech Maker table, cheapest first", () => {
    expect(PRICE_CATEGORY_LADDER).toEqual([
      "Cheap",
      "Everyday",
      "Costly",
      "Premium",
      "Expensive",
      "Very Expensive",
      "Luxury",
      "Super Luxury",
    ]);
  });
});

describe("price category context", () => {
  it("reads the Tech Maker DV and time for a category", () => {
    const everyday = priceCategoryContext("Everyday");
    expect(everyday?.techDV).toBe(9);
    expect(everyday?.techTime).toBe("1 hour");

    const premium = priceCategoryContext("Premium");
    expect(premium?.techDV).toBe(17);
    expect(premium?.techTime).toBe("1 day");
  });

  it("gives the lowest Fixer rank that can always source a category", () => {
    // Ranks 1-2 always source Everyday; Ranks 3-4 reach up to Expensive.
    expect(priceCategoryContext("Everyday")?.fixerRank).toBe(1);
    expect(priceCategoryContext("Expensive")?.fixerRank).toBe(3);
    // The Rank 5-6 Night Market line is excluded, so Very Expensive falls to 7.
    expect(priceCategoryContext("Very Expensive")?.fixerRank).toBe(7);
    expect(priceCategoryContext("Super Luxury")?.fixerRank).toBe(10);
  });

  it("normalizes the abbreviated 'V Expensive' spelling", () => {
    expect(priceCategoryContext("V Expensive")?.label).toBe("Very Expensive");
  });

  it("returns null rather than guessing for missing or unknown input", () => {
    expect(priceCategoryContext(null)).toBeNull();
    expect(priceCategoryContext(undefined)).toBeNull();
    expect(priceCategoryContext("Not A Category")).toBeNull();
  });
});
