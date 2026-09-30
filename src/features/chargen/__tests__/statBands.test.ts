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

describe("naming edges and weak spots", () => {
  const all = (value: number) => Object.fromEntries(STAT_ORDER.map((s) => [s, value]));

  it("names none for a character with nothing at the extremes", () => {
    expect(statHighlights(all(6), STAT_ORDER)).toEqual({ edges: [], weak: [] });
    // Nine sixes and a 5: the old strip called INT the weak spot on a 6.
    expect(statHighlights({ ...all(6), int: 5 }, STAT_ORDER)).toEqual({ edges: [], weak: [] });
    expect(statHighlights({ ...all(6), int: 4, ref: 6 }, STAT_ORDER).weak).toEqual([]);
  });

  it("names an edge from the top band and a weak spot from the bottom two", () => {
    expect(statHighlights({ ...all(6), ref: 7 }, STAT_ORDER)).toEqual({ edges: ["ref"], weak: [] });
    expect(statHighlights({ ...all(6), emp: 3 }, STAT_ORDER)).toEqual({ edges: [], weak: ["emp"] });
  });

  it("names every STAT in the band, not just the best or the worst", () => {
    const both = statHighlights(
      { ...all(6), int: 8, dex: 8, luck: 7, ref: 2, emp: 3, tech: 3 },
      STAT_ORDER,
    );
    expect(both.edges.sort()).toEqual(["dex", "int", "luck"]);
    expect(both.weak.sort()).toEqual(["emp", "ref", "tech"]);
  });

  it("puts the strongest edge first and the weakest weak spot first, ties in printed order", () => {
    const order = statHighlights(
      { ...all(6), luck: 7, dex: 8, int: 8, emp: 3, ref: 2 },
      STAT_ORDER,
    );
    const printed = (a: string, b: string) =>
      STAT_ORDER.indexOf(a as never) < STAT_ORDER.indexOf(b as never);
    expect(order.edges[order.edges.length - 1]).toBe("luck");
    expect(printed(order.edges[0]!, order.edges[1]!)).toBe(true);
    expect(order.weak).toEqual(["ref", "emp"]);
  });

  it("says nothing until every STAT is in", () => {
    expect(statHighlights({ int: 8, emp: 2 }, STAT_ORDER)).toEqual({ edges: [], weak: [] });
  });
});
