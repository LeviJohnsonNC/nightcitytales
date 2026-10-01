import { describe, expect, it } from "vitest";
import { DIVE_END_MS, SEARCH_END_MS } from "../descentTimeline";
const THUNDER_AT_MS = SEARCH_END_MS + 1250;
import {
  LAYERS,
  TRAIL_SECONDS,
  dropCount,
  glassWetness,
  leanDegrees,
  lightningAt,
  makeDrop,
  makeStreaks,
  rainIntensity,
  stepDrop,
  stepStreak,
  streakCount,
} from "../rainModel";

/** A small seeded random so the physics tests are repeatable. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("rainIntensity", () => {
  it("stays in range, never stops, and only ever builds", () => {
    let last = 0;
    for (let ms = 0; ms <= DIVE_END_MS + 5000; ms += 50) {
      const v = rainIntensity(ms);
      expect(v).toBeGreaterThan(0.1);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      last = v;
    }
  });
});

describe("leanDegrees", () => {
  it("always leans the same way, and is never still", () => {
    const seen = new Set<number>();
    for (let ms = 0; ms < 20000; ms += 250) {
      const d = leanDegrees(ms);
      expect(d).toBeGreaterThan(5);
      expect(d).toBeLessThan(18);
      seen.add(Math.round(d * 10));
    }
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe("lightningAt", () => {
  it("is dark between bolts and never leaves 0..1", () => {
    for (let ms = 0; ms < 12000; ms += 10) {
      const v = lightningAt(ms);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(lightningAt(1000)).toBe(0);
    expect(lightningAt(6000)).toBe(0);
    expect(lightningAt(9000)).toBe(0);
  });

  it("strikes full a beat before the thunder is heard", () => {
    expect(lightningAt(7600)).toBe(1);
    expect(lightningAt(THUNDER_AT_MS)).toBeLessThan(1);
    expect(THUNDER_AT_MS).toBeGreaterThan(7600);
  });
});

describe("glassWetness", () => {
  it("is dry through the fall and wet at the window", () => {
    expect(glassWetness(2000)).toBe(0);
    expect(glassWetness(DIVE_END_MS + 1000)).toBe(1);
  });
});

describe("streaks", () => {
  it("are the same for the same seed and fewer on a weak device", () => {
    const a = makeStreaks(50, 800, 600, seeded(1));
    const b = makeStreaks(50, 800, 600, seeded(1));
    expect(a).toEqual(b);
    for (const layer of LAYERS) {
      expect(streakCount(layer, 1280, 800, true)).toBeLessThan(
        streakCount(layer, 1280, 800, false),
      );
    }
  });

  it("fall, and start again at the top after leaving the bottom", () => {
    const rand = seeded(2);
    const layer = LAYERS[1]!;
    const s = { x: 400, y: 100, pace: 1, tint: 0 as const };
    stepStreak(s, layer, 0.016, 11, 800, 600, rand);
    expect(s.y).toBeGreaterThan(100);
    expect(s.x).toBeLessThan(400);
    s.y = 600 + layer.length * 3;
    stepStreak(s, layer, 0.016, 11, 800, 600, rand);
    expect(s.y).toBeLessThan(0);
  });
});

describe("drops on the glass", () => {
  it("scale with the window and halve on a weak device", () => {
    expect(dropCount(1280, 800, false)).toBeGreaterThan(dropCount(640, 400, false));
    expect(dropCount(1280, 800, true)).toBeLessThan(dropCount(1280, 800, false));
  });

  it("never run up the glass, lose water as they go, and keep a bounded trail", () => {
    const rand = seeded(3);
    let ran = 0;
    for (let i = 0; i < 60; i++) {
      const d = makeDrop(800, 600, rand);
      d.runs = true;
      const startR = d.r;
      let y = d.y;
      for (let f = 0; f < 60 * 30; f++) {
        const gone = stepDrop(d, 1 / 60, rand, 600);
        expect(d.y).toBeGreaterThanOrEqual(y);
        y = d.y;
        expect(d.trail.length).toBeLessThanOrEqual(80);
        if (gone) break;
      }
      if (d.y > d.r) ran++;
      expect(d.r).toBeLessThanOrEqual(startR);
    }
    expect(ran).toBeGreaterThan(0);
  });

  it("let a trail fade away once the drop has stopped", () => {
    const rand = seeded(4);
    const d = makeDrop(800, 600, rand);
    d.trail.push({ x: 1, y: 1, r: 2, age: 0 });
    d.runs = false;
    stepDrop(d, TRAIL_SECONDS + 1, rand, 600);
    expect(d.trail).toHaveLength(0);
  });
});
