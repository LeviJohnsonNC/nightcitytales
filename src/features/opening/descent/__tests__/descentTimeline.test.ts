import { describe, expect, it } from "vitest";
import {
  BLACK_END_MS,
  CITY_END_MS,
  DIVE_END_MS,
  SEARCH_END_MS,
  SKIP_TO_MS,
  ZOOM_DEEP,
  ZOOM_SEARCH,
  beatAt,
  beatProgress,
  populationAt,
  virtualTime,
  zoomAt,
} from "../descentTimeline";
import { scrambled, typed } from "../descentText";

describe("the shape of the descent", () => {
  it("runs black, city, search, dive, then holds", () => {
    expect(beatAt(0)).toBe("black");
    expect(beatAt(BLACK_END_MS)).toBe("city");
    expect(beatAt(CITY_END_MS)).toBe("search");
    expect(beatAt(SEARCH_END_MS)).toBe("dive");
    expect(beatAt(DIVE_END_MS)).toBe("hold");
    expect(beatAt(60_000)).toBe("hold");
  });

  it("is about ten seconds to the window, and a skip still lands in the dive", () => {
    expect(DIVE_END_MS).toBeGreaterThanOrEqual(8000);
    expect(DIVE_END_MS).toBeLessThanOrEqual(10_000);
    expect(beatAt(SKIP_TO_MS)).toBe("dive");
  });

  it("measures progress through a beat, and a hold never finishes", () => {
    expect(beatProgress(0)).toBe(0);
    expect(beatProgress((BLACK_END_MS + CITY_END_MS) / 2)).toBeCloseTo(0.5);
    expect(beatProgress(DIVE_END_MS + 5000)).toBe(1);
  });

  it("waits at the end of the city for the player's facts, and not otherwise", () => {
    expect(virtualTime(8000, false)).toBe(CITY_END_MS);
    expect(virtualTime(2000, false)).toBe(2000);
    expect(virtualTime(8000, true)).toBe(8000);
  });
});

describe("the camera", () => {
  it("only ever moves in, and falls the furthest in the dive", () => {
    let last = 0;
    for (let ms = 0; ms <= DIVE_END_MS + 1000; ms += 100) {
      const z = zoomAt(ms);
      expect(z).toBeGreaterThanOrEqual(last);
      last = z;
    }
    expect(zoomAt(SEARCH_END_MS)).toBeCloseTo(ZOOM_SEARCH);
    expect(zoomAt(DIVE_END_MS)).toBeCloseTo(ZOOM_DEEP);
    expect(zoomAt(0)).toBe(1);
  });
});

describe("the population counter", () => {
  const counts = [1_400_000, 180_000, 9_000, 600, 1];

  it("holds at the whole city, then falls through every step to one", () => {
    expect(populationAt(0, 7_000_000, counts)).toBe(7_000_000);
    expect(populationAt(CITY_END_MS - 1, 7_000_000, counts)).toBe(7_000_000);
    let last = 7_000_000;
    for (let ms = CITY_END_MS; ms <= SEARCH_END_MS; ms += 50) {
      const n = populationAt(ms, 7_000_000, counts);
      expect(n).toBeLessThanOrEqual(last);
      last = n;
    }
    expect(populationAt(SEARCH_END_MS, 7_000_000, counts)).toBe(1);
    expect(populationAt(DIVE_END_MS, 7_000_000, counts)).toBe(1);
  });
});

describe("the text it writes", () => {
  it("types at a rate and stops at the end", () => {
    expect(typed("abcdef", 0, 100)).toBe("");
    expect(typed("abcdef", 1100, 100, 4)).toBe("abcd");
    expect(typed("abcdef", 99_999, 100)).toBe("abcdef");
  });

  it("decodes a name into place, leaving spaces alone", () => {
    expect(scrambled("KIT MWANGI", 1, 3)).toBe("KIT MWANGI");
    const half = scrambled("KIT MWANGI", 0.5, 3);
    expect(half.slice(0, 5)).toBe("KIT M");
    expect(half[3]).toBe(" ");
    expect(half).toHaveLength(10);
    expect(scrambled("KIT", 0, 3)).not.toBe("KIT");
  });
});
