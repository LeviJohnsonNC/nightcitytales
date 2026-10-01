import { describe, expect, it } from "vitest";
import {
  CUE_WINDOW_MS,
  HEARTBEATS,
  ONE_SHOTS,
  TICK_EVERY_MS,
  cuesBetween,
  droneLevel,
  dronePitch,
  glassAmount,
  rainLevel,
  ticksBetween,
} from "../descentSoundPlan";
import { CITY_END_MS, DIVE_END_MS, SEARCH_END_MS } from "../descentTimeline";

describe("the score", () => {
  it("puts each one-off at the moment its picture happens", () => {
    const at = (kind: string) => ONE_SHOTS.find((c) => c.kind === kind)!.at;
    expect(at("lock")).toBe(SEARCH_END_MS);
    expect(at("window")).toBe(DIVE_END_MS);
    expect(at("whoosh")).toBeGreaterThan(at("lock"));
    expect(at("thunder")).toBeGreaterThan(at("whoosh"));
    expect(at("thunder")).toBeLessThan(DIVE_END_MS);
  });

  it("has a heart that begins in the search, quickens, and stops at the window", () => {
    expect(HEARTBEATS[0]).toBeGreaterThanOrEqual(CITY_END_MS);
    expect(HEARTBEATS[HEARTBEATS.length - 1]!).toBeLessThan(DIVE_END_MS);
    const gaps = HEARTBEATS.slice(1).map((t, i) => t - HEARTBEATS[i]!);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThanOrEqual(gaps[i - 1]! + 1);
    expect(gaps[gaps.length - 1]!).toBeLessThan(gaps[0]!);
  });

  it("ticks only while the counter falls, climbing in pitch from the start of it to the end", () => {
    expect(ticksBetween(0, CITY_END_MS)).toEqual([]);
    expect(ticksBetween(SEARCH_END_MS, DIVE_END_MS)).toEqual([]);
    const ticks = ticksBetween(CITY_END_MS, SEARCH_END_MS);
    expect(ticks.length).toBeGreaterThan(30);
    expect(ticks[1]!.at - ticks[0]!.at).toBe(TICK_EVERY_MS);
    expect(ticks[0]!.along).toBeLessThan(0.1);
    expect(ticks[ticks.length - 1]!.along).toBeGreaterThan(0.9);
  });

  it("never plays a moment twice across two spans that join", () => {
    const a = cuesBetween(6000, 6600);
    const b = cuesBetween(6600, 7200);
    expect(a.oneShots.filter((k) => b.oneShots.includes(k))).toEqual([]);
    expect(a.heartbeats.filter((t) => b.heartbeats.includes(t))).toEqual([]);
  });

  it("leaves out what a skip or a stall has left in the past, rather than firing it all at once", () => {
    const jump = cuesBetween(2000, 8800);
    expect(jump.oneShots).not.toContain("lock");
    expect(jump.ticks).toEqual([]);
    expect(jump.heartbeats.every((t) => t > 8800 - CUE_WINDOW_MS)).toBe(true);
    expect(cuesBetween(8700, 9100).oneShots).toContain("window");
  });
});

describe("the levels", () => {
  it("brings the rain up, heavier through the glass, and shuts the world in", () => {
    expect(rainLevel(0)).toBe(0);
    expect(rainLevel(DIVE_END_MS)).toBeCloseTo(1);
    expect(glassAmount(CITY_END_MS)).toBe(0);
    expect(glassAmount(DIVE_END_MS + 5000)).toBe(1);
  });

  it("swells the drone to the lock and eases it to a hum", () => {
    expect(droneLevel(0)).toBe(0);
    expect(droneLevel(SEARCH_END_MS)).toBeCloseTo(1);
    expect(droneLevel(DIVE_END_MS + 5000)).toBeCloseTo(0.15);
    expect(dronePitch(CITY_END_MS)).toBe(55);
    expect(dronePitch(DIVE_END_MS)).toBeCloseTo(85);
  });
});
