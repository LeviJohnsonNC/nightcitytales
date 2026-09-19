import { describe, expect, it } from "vitest";
import { STAT_SCALE, statBand, statColor, statFraction } from "../statBands";

describe("STAT presentation bands", () => {
  it.each([
    [2, "Very Bad"],
    [3, "Bad"],
    [4, "Neutral / Average"],
    [5, "Neutral / Average"],
    [6, "Good"],
    [7, "Very Good"],
    [8, "Very Good"],
  ] as const)("maps %i to %s", (value, label) => {
    expect(statBand(value).label).toBe(label);
  });
});

describe("the STAT ramp", () => {
  it("runs 2 to 8, the floor of a Role template to peak normal-human", () => {
    expect(STAT_SCALE).toEqual({ min: 2, max: 8 });
    expect(statFraction(2)).toBe(0);
    expect(statFraction(5)).toBe(0.5);
    expect(statFraction(8)).toBe(1);
  });

  it("pins anything off the scale to its ends rather than overflowing a bar", () => {
    expect(statFraction(1)).toBe(0);
    expect(statFraction(10)).toBe(1);
  });

  it("is red at the bottom and green at the top", () => {
    expect(statColor(2)).toBe("hsl(0 90% 58%)");
    expect(statColor(8)).toBe("hsl(150 90% 66%)");
  });

  it("climbs a shade at a time, so neighbours differ without changing category", () => {
    const hues = [2, 3, 4, 5, 6, 7, 8].map((v) => Number(statColor(v).match(/hsl\((\d+)/)![1]));
    for (let i = 1; i < hues.length; i++) expect(hues[i]!).toBeGreaterThan(hues[i - 1]!);
    expect(new Set(hues).size).toBe(hues.length);
  });
});
