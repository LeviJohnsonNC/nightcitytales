import { describe, expect, it } from "vitest";
import { STAT_ORDER } from "@/engine";
import { STAT_SCALE, statBand, statColor, statFraction, statHighlights } from "../statBands";

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

describe("naming an edge and a weak spot", () => {
  const all = (value: number) => Object.fromEntries(STAT_ORDER.map((s) => [s, value]));

  it("names neither for a character with nothing at the extremes", () => {
    expect(statHighlights(all(6), STAT_ORDER)).toEqual({ edge: null, weak: null });
    // Nine sixes and a 5: the old strip called INT the weak spot on a 6.
    expect(statHighlights({ ...all(6), int: 5 }, STAT_ORDER)).toEqual({ edge: null, weak: null });
    expect(statHighlights({ ...all(6), int: 4, ref: 7 }, STAT_ORDER).weak).toBeNull();
  });

  it("names an edge from the top band and a weak spot from the bottom two", () => {
    expect(statHighlights({ ...all(6), ref: 7 }, STAT_ORDER)).toEqual({ edge: "ref", weak: null });
    expect(statHighlights({ ...all(6), emp: 3 }, STAT_ORDER)).toEqual({ edge: null, weak: "emp" });
    expect(statHighlights({ ...all(6), dex: 8, emp: 2 }, STAT_ORDER)).toEqual({
      edge: "dex",
      weak: "emp",
    });
  });

  it("breaks a tie in the printed order", () => {
    const both = statHighlights({ ...all(6), tech: 8, dex: 8 }, STAT_ORDER);
    expect(both.edge).toBe(STAT_ORDER.indexOf("dex") < STAT_ORDER.indexOf("tech") ? "dex" : "tech");
  });

  it("says nothing until every STAT is in", () => {
    expect(statHighlights({ int: 8, emp: 2 }, STAT_ORDER)).toEqual({ edge: null, weak: null });
  });
});
