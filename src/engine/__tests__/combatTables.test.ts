import { describe, expect, it } from "vitest";
import { AUTOFIRE_MAX_MULTIPLIER, autofireDV, rangeBandIndex, singleShotDV } from "../combatTables";

describe("rangeBandIndex", () => {
  it("maps distances to the 8 range bands (CP:R pg. 173)", () => {
    expect(rangeBandIndex(0)).toBe(0);
    expect(rangeBandIndex(6)).toBe(0);
    expect(rangeBandIndex(7)).toBe(1);
    expect(rangeBandIndex(12)).toBe(1);
    expect(rangeBandIndex(13)).toBe(2);
    expect(rangeBandIndex(25)).toBe(2);
    expect(rangeBandIndex(800)).toBe(7);
  });

  it("is out of range beyond 800 m/yds, and rejects negatives", () => {
    expect(rangeBandIndex(801)).toBeNull();
    expect(() => rangeBandIndex(-1)).toThrow();
  });
});

describe("singleShotDV", () => {
  it("matches the printed table", () => {
    expect(singleShotDV("pistol", 5)).toBe(13);
    expect(singleShotDV("pistol", 8)).toBe(15);
    // Royal's assault rifle at 24 m/yds needs DV15 (CP:R pg. 170 example).
    expect(singleShotDV("assault_rifle", 24)).toBe(15);
    expect(singleShotDV("sniper_rifle", 5)).toBe(30);
    expect(singleShotDV("shotgun_slug", 150)).toBe(35);
  });

  it("returns null where the weapon has no listed range", () => {
    expect(singleShotDV("pistol", 300)).toBeNull(); // 201-400 band is N/A for pistols
    expect(singleShotDV("pistol", 900)).toBeNull(); // beyond 800
  });
});

describe("autofireDV", () => {
  it("uses the separate Autofire range table", () => {
    // Royal's assault rifle Autofire at 14 m/yds needs DV15 (CP:R pg. 173 example).
    expect(autofireDV("assault_rifle", 14)).toBe(15);
    expect(autofireDV("smg", 5)).toBe(15);
    expect(autofireDV("smg", 8)).toBe(13);
  });

  it("has no Autofire band beyond 100 m/yds", () => {
    expect(autofireDV("assault_rifle", 150)).toBeNull();
  });
});

describe("AUTOFIRE_MAX_MULTIPLIER", () => {
  it("caps at SMG 3 and Assault Rifle 4", () => {
    expect(AUTOFIRE_MAX_MULTIPLIER.smg).toBe(3);
    expect(AUTOFIRE_MAX_MULTIPLIER.assault_rifle).toBe(4);
  });
});
