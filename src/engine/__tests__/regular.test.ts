import { describe, expect, it } from "vitest";
import {
  REGULAR_PULL_MINUTES,
  nearestWithTag,
  recordVisit,
  regularOf,
  startingState,
  standingFor,
  type PlaceState,
} from "@/engine";

/** A place visited on `visits` different days. */
function visited(placeKey: string, visits: number, lastDay = visits): PlaceState {
  let state = startingState(placeKey);
  for (let day = lastDay - visits + 1; day <= lastDay; day++) state = recordVisit(state, day);
  return state;
}

/** The fewest visits the ladder calls knowing a place well. */
const WELL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((n) => standingFor(n) === "known")!;

describe("regularOf — the place of a kind they keep going back to", () => {
  it("is nobody's until they know it well", () => {
    expect(regularOf("bar", { h7: visited("h7", WELL - 1) })).toBeUndefined();
    expect(regularOf("bar", { h7: visited("h7", WELL) })).toBe("h7");
  });

  it("is the one they have been to most", () => {
    const places = { h7: visited("h7", WELL), e3: visited("e3", WELL + 2) };
    expect(regularOf("bar", places)).toBe("e3");
  });

  it("breaks a tie on the most recent visit", () => {
    const places = { h7: visited("h7", WELL, 40), e3: visited("e3", WELL, 20) };
    expect(regularOf("bar", places)).toBe("h7");
  });

  it("only counts places of that kind", () => {
    // The noodle counter is food, not a bar.
    expect(regularOf("bar", { h8: visited("h8", WELL + 5) })).toBeUndefined();
    expect(regularOf("food", { h8: visited("h8", WELL + 5) })).toBe("h8");
  });

  it("has nothing to say about no places at all", () => {
    expect(regularOf("bar", undefined)).toBeUndefined();
  });
});

describe("a trip for a kind goes to the regular", () => {
  it("prefers the regular over a nearer stranger, within reach", () => {
    const [nearest, second] = nearestWithTag("h5", "bar");
    expect(second!.minutes).toBeLessThanOrEqual(nearest!.minutes + REGULAR_PULL_MINUTES);
    expect(nearestWithTag("h5", "bar", { regular: second!.key })[0]!.key).toBe(second!.key);
  });

  it("does not cross the city for it", () => {
    const bars = nearestWithTag("h5", "bar");
    const far = bars[bars.length - 1]!;
    expect(far.minutes).toBeGreaterThan(bars[0]!.minutes + REGULAR_PULL_MINUTES);
    expect(nearestWithTag("h5", "bar", { regular: far.key })[0]!.key).toBe(bars[0]!.key);
  });
});
