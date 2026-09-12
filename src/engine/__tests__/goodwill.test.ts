import { describe, expect, it } from "vitest";
import stateFile from "@/data/atlas/place-state.json";
import truthFile from "@/data/atlas/place-truths.json";
import { PLACE_OBSERVATION_EFFECTS, applyToPlace, hasFlag, isPlaceFlag } from "../placeState";
import type { PlaceState } from "../placeState";

/**
 * The favour loop.
 *
 * `goodwill` moved for months and no threshold read it, so doing somebody a
 * good turn accumulated in a column nothing consulted — the failure PRODUCT.md
 * names outright: "A dial that changes nothing the player meets is decoration;
 * every dial should reach something."
 *
 * It reaches something now, and what it reaches is INFORMATION. That is the
 * ruling the city layer already runs on — "familiarity pays in information,
 * never in dice", and "location changes access, never printed price" — so
 * being welcome at a place does not discount anything or add to a roll. It
 * changes what people are willing to say in front of you, through the truth
 * system that already gates facts on flags.
 */

const THRESHOLDS = (stateFile as { thresholds: ThresholdRow[] }).thresholds;
const DIALS = (stateFile as { dials: Record<string, unknown> }).dials;
const FROM_FLAGS = (truthFile as { fromFlags: { flag: string }[] }).fromFlags;

type ThresholdRow = {
  dial: string;
  at: number;
  sets: string[];
  clears: string[];
  resets: number;
};

function place(dials: Record<string, number>, flags: string[] = []): PlaceState {
  return { placeKey: "x1", dials, flags, visits: 0, lastVisitDay: null } as PlaceState;
}

describe("every dial reaches something", () => {
  it("has a threshold for each one", () => {
    // The invariant goodwill used to be the single exception to. Stated here so
    // that adding a dial without a consequence fails rather than passes.
    const withThreshold = new Set(THRESHOLDS.map((t) => t.dial));
    const orphans = Object.keys(DIALS).filter((d) => !withThreshold.has(d));
    expect(orphans, `dials nothing reads: ${orphans.join(", ")}`).toEqual([]);
  });

  it("only ever sets a flag the vocabulary knows", () => {
    const unknown = THRESHOLDS.flatMap((t) => [...t.sets, ...t.clears]).filter(
      (f) => !isPlaceFlag(f),
    );
    expect(unknown).toEqual([]);
  });
});

describe("goodwill", () => {
  const high = THRESHOLDS.find((t) => t.dial === "goodwill" && t.at === 8);
  const low = THRESHOLDS.find((t) => t.dial === "goodwill" && t.at === 0);

  it("has an end at each end of the scale", () => {
    expect(high).toBeDefined();
    expect(low).toBeDefined();
  });

  it("makes the two ends exclusive, because they are opposites", () => {
    expect(high?.sets).toEqual(["welcome"]);
    expect(high?.clears).toEqual(["unwelcome"]);
    expect(low?.sets).toEqual(["unwelcome"]);
    expect(low?.clears).toEqual(["welcome"]);
  });

  it("resets off the rail at both ends, so a place is somewhere you can come back from", () => {
    // Pinned at 8 or 0 the dial would have nowhere left to travel, and the
    // other end could never be reached again.
    expect(high?.resets).toBeLessThan(8);
    expect(low?.resets).toBeGreaterThan(0);
  });

  it("pays in information rather than in dice or in price", () => {
    // Both flags are read by a truth — something somebody tells you — and by
    // nothing that touches a DV or a cost. This is the whole design.
    const read = new Set(FROM_FLAGS.map((t) => t.flag));
    expect(read.has("welcome")).toBe(true);
    expect(read.has("unwelcome")).toBe(true);
  });
});

describe("the loop, end to end", () => {
  it("a favour moves the dial up", () => {
    expect(PLACE_OBSERVATION_EFFECTS["favour"]?.["goodwill"]).toBeGreaterThan(0);
  });

  it("enough favours make you welcome", () => {
    let state = place({ goodwill: 4 });
    for (let i = 0; i < 4; i++) state = applyToPlace(state, ["favour"]).state;
    expect(hasFlag(state, "welcome")).toBe(true);
  });

  it("does not fire on the way up, only on arrival", () => {
    const state = applyToPlace(place({ goodwill: 4 }), ["favour"]).state;
    expect(hasFlag(state, "welcome")).toBe(false);
  });

  it("costing people enough makes you unwelcome, and takes the welcome back", () => {
    let state = place({ goodwill: 8 }, ["welcome"]);
    // Loud, then worse: shooting the place up is what spends a good name.
    for (let i = 0; i < 8; i++) state = applyToPlace(state, ["property", "wounded"]).state;
    expect(hasFlag(state, "unwelcome")).toBe(true);
    expect(hasFlag(state, "welcome")).toBe(false);
  });

  it("is a place you can climb back from", () => {
    // The low end resets off the floor rather than pinning there, so favours
    // after a bad night are not spent against an immovable zero.
    let state = place({ goodwill: 0 }, ["unwelcome"]);
    state = applyToPlace(state, ["favour"]).state;
    expect(state.dials["goodwill"]).toBeGreaterThan(0);
  });

  it("fires and steps back in the same breath, and says so", () => {
    // A threshold does not leave the dial full and ringing: reaching 8 sets the
    // flag and drops the dial to its reset in the same call. So the caller sees
    // the flag in `flagged` and a dial below the rail — which is what lets the
    // receipt say what happened rather than only what the number is now.
    const change = applyToPlace(place({ goodwill: 6 }), ["favour"]);
    expect(change.flagged.some((f) => f.flag === "welcome" && f.set)).toBe(true);
    expect(change.state.dials["goodwill"]).toBeLessThan(8);
    expect(hasFlag(change.state, "welcome")).toBe(true);
  });
});
