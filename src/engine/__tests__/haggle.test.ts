/**
 * Arguing about the price.
 *
 * The Fixer's printed Haggle bands are parsed out of the Role's own rules text
 * rather than typed here, so the first thing worth testing is that the parse
 * actually found them — a silent parse failure would leave every Fixer on the
 * house-rule base and look like a design decision.
 */
import { describe, expect, it } from "vitest";
import { BASE_HAGGLE_PERCENT, HAGGLE_BANDS, haggledPrice, hagglePercent } from "../haggle";

describe("Haggle bands", () => {
  it("finds the printed ±10% and ±20% tiers in the Fixer's rules text", () => {
    expect(HAGGLE_BANDS.map((b) => [b.rank, b.percent])).toEqual([
      [1, 10],
      [9, 20],
    ]);
  });

  it("gives a Fixer their Rank's band, accumulating upward", () => {
    expect(hagglePercent({ isFixer: true, operatorRank: 1 })).toBe(10);
    expect(hagglePercent({ isFixer: true, operatorRank: 4 })).toBe(10);
    expect(hagglePercent({ isFixer: true, operatorRank: 9 })).toBe(20);
    expect(hagglePercent({ isFixer: true, operatorRank: 10 })).toBe(20);
  });

  it("gives everybody else the house-rule base, and never more than a Fixer", () => {
    expect(hagglePercent({ isFixer: false, operatorRank: 0 })).toBe(BASE_HAGGLE_PERCENT);
    // A non-Fixer cannot buy their way up by carrying a rank number.
    expect(hagglePercent({ isFixer: false, operatorRank: 10 })).toBe(BASE_HAGGLE_PERCENT);
    expect(BASE_HAGGLE_PERCENT).toBeLessThan(HAGGLE_BANDS[0]!.percent);
  });

  it("never leaves a Fixer worse off than not being one", () => {
    expect(hagglePercent({ isFixer: true, operatorRank: 0 })).toBe(BASE_HAGGLE_PERCENT);
  });
});

describe("haggledPrice", () => {
  it("takes the percentage off and rounds to whole eurobucks", () => {
    expect(haggledPrice(100, 10)).toBe(90);
    expect(haggledPrice(55, 20)).toBe(44);
    expect(haggledPrice(21, 5)).toBe(20);
  });

  it("is the list price when nothing was won, and never goes negative", () => {
    expect(haggledPrice(100, 0)).toBe(100);
    expect(haggledPrice(100, 200)).toBe(0);
    expect(haggledPrice(-5, 10)).toBe(0);
  });
});
