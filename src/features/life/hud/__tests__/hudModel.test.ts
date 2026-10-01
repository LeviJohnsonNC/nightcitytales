import { describe, expect, it } from "vitest";
import {
  MAX_PIPS,
  barTone,
  changeDirection,
  dispositionBand,
  fillFraction,
  luckPips,
  relevantPeople,
  tween,
  woundBadge,
} from "../hudModel";

describe("fillFraction", () => {
  it("stays within 0..1 and survives a missing max", () => {
    expect(fillFraction(20, 40)).toBe(0.5);
    expect(fillFraction(50, 40)).toBe(1);
    expect(fillFraction(-3, 40)).toBe(0);
    expect(fillFraction(5, 0)).toBe(0);
  });
});

describe("barTone", () => {
  it("goes from ok to warn to danger as the bar empties", () => {
    expect(barTone(1)).toBe("ok");
    expect(barTone(0.61)).toBe("ok");
    expect(barTone(0.6)).toBe("warn");
    expect(barTone(0.31)).toBe("warn");
    expect(barTone(0.3)).toBe("danger");
    expect(barTone(0)).toBe("danger");
  });
});

describe("luckPips", () => {
  it("fills from the left and spends from the right", () => {
    expect(luckPips(2, 4)).toEqual([true, true, false, false]);
  });
  it("draws nothing for no luck or a pool too big to draw", () => {
    expect(luckPips(0, 0)).toBeNull();
    expect(luckPips(5, MAX_PIPS + 1)).toBeNull();
  });
});

describe("woundBadge", () => {
  it("is quiet for an unhurt character", () => {
    expect(woundBadge("none")).toBeNull();
    expect(woundBadge("")).toBeNull();
    expect(woundBadge(undefined)).toBeNull();
  });
  it("names a wound and how bad it is", () => {
    expect(woundBadge("light")).toEqual({ label: "Wounded", tone: "warn" });
    expect(woundBadge("mortal")?.tone).toBe("danger");
  });
});

describe("dispositionBand", () => {
  it("keeps the old words and gives each a tone", () => {
    expect(dispositionBand(-2)).toEqual({ label: "hates you", tone: "hostile" });
    expect(dispositionBand(-5).tone).toBe("hostile");
    expect(dispositionBand(-1).tone).toBe("cold");
    expect(dispositionBand(0)).toEqual({ label: "neutral", tone: "neutral" });
    expect(dispositionBand(2)).toEqual({ label: "close", tone: "warm" });
    expect(dispositionBand(3).label).toBe("devoted");
  });
});

describe("relevantPeople", () => {
  const p = (key: string, disposition: number, lastSeenDay?: number) => ({
    key,
    disposition,
    lastSeenDay,
  });
  it("puts the recently seen first, then the strongest feelings, and cuts to five", () => {
    const all = [
      p("a", 0),
      p("b", 2, 4),
      p("c", -2, 9),
      p("d", 1, 9),
      p("e", 0, 1),
      p("f", 3),
      p("g", 0),
    ];
    expect(relevantPeople(all).map((x) => x.key)).toEqual(["c", "d", "b", "e", "f"]);
  });
  it("is stable when nothing separates two people", () => {
    const all = [p("a", 0), p("b", 0), p("c", 0)];
    expect(relevantPeople(all, 2).map((x) => x.key)).toEqual(["a", "b"]);
  });
});

describe("tween", () => {
  it("runs from start to end and stays inside them", () => {
    expect(tween(10, 20, 0)).toBe(10);
    expect(tween(10, 20, 1)).toBe(20);
    expect(tween(10, 20, 2)).toBe(20);
    expect(tween(10, 20, 0.5)).toBeGreaterThan(15);
  });
});

describe("changeDirection", () => {
  it("is quiet at first and when nothing moved", () => {
    expect(changeDirection(undefined, 5)).toBeNull();
    expect(changeDirection(5, 5)).toBeNull();
  });
  it("says which way", () => {
    expect(changeDirection(5, 9)).toBe("up");
    expect(changeDirection(9, 5)).toBe("down");
  });
});
