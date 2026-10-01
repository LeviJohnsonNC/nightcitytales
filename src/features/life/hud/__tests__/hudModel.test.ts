import { describe, expect, it } from "vitest";
import { MAX_PIPS, barTone, fillFraction, luckPips, woundBadge } from "../hudModel";

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
