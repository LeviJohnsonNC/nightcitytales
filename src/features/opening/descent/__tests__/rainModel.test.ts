import { describe, expect, it } from "vitest";
import { DIVE_END_MS, SEARCH_END_MS } from "../descentTimeline";
const THUNDER_AT_MS = SEARCH_END_MS + 1250;
import {
  LAYERS,
  MAX_RESIDUE,
  RAIN_EXIT_MS,
  TRAIL_SECONDS,
  absorb,
  cellLight,
  dropCount,
  exitFade,
  impactRate,
  landDrop,
  landingDrop,
  lightGridFrom,
  mergeDrops,
  sheetAt,
  stepResidue,
  streakLength,
  type Drop,
  type Residue,
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

describe("streakLength", () => {
  it("is a shorter streak for a slower rain, and never nothing", () => {
    for (const layer of LAYERS) {
      expect(streakLength(layer, 0.3)).toBeLessThan(streakLength(layer, 1));
      expect(streakLength(layer, 0)).toBeGreaterThan(0);
    }
  });

  it("grows with the depth: the near rain is the long rain", () => {
    for (let i = 1; i < LAYERS.length; i++) {
      expect(streakLength(LAYERS[i]!, 0.3)).toBeGreaterThan(streakLength(LAYERS[i - 1]!, 0.3));
    }
  });
});

describe("sheetAt", () => {
  it("thins and thickens the rain across the wind, and moves with time", () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let u = 0; u < 4000; u += 7) {
      const v = sheetAt(u, 0);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThan(0.35);
    expect(hi).toBeLessThan(1.3);
    expect(hi - lo).toBeGreaterThan(0.5);
    expect(sheetAt(500, 0)).not.toBeCloseTo(sheetAt(500, 1500), 2);
  });
});

describe("exitFade", () => {
  it("is all the rain until the scene goes, then none of it inside the exit", () => {
    expect(exitFade(-10)).toBe(1);
    expect(exitFade(0)).toBe(1);
    expect(exitFade(RAIN_EXIT_MS)).toBe(0);
    expect(exitFade(RAIN_EXIT_MS * 3)).toBe(0);
    expect(RAIN_EXIT_MS).toBeLessThanOrEqual(500);
  });

  it("only ever falls, and most of it is gone in the first half", () => {
    let last = 1;
    for (let ms = 0; ms <= RAIN_EXIT_MS; ms += 10) {
      const v = exitFade(ms);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    }
    expect(exitFade(RAIN_EXIT_MS / 2)).toBeLessThan(0.3);
  });
});

describe("the city lighting the rain", () => {
  /** A 3x1 picture: black, a magenta sign, white. */
  const pixels = [0, 0, 0, 255, 255, 40, 200, 255, 255, 255, 255, 255];

  it("is dark where the picture is dark and bright where it is lit", () => {
    const grid = lightGridFrom(pixels, 3, 1);
    expect(grid.lum[0]!).toBeLessThan(grid.lum[1]!);
    expect(grid.lum[1]!).toBeLessThan(grid.lum[2]!);
    expect(cellLight(grid, 0).bright).toBeLessThan(cellLight(grid, 2).bright);
  });

  it("keeps a little rain against black, and lends a sign its colour", () => {
    const grid = lightGridFrom(pixels, 3, 1);
    expect(cellLight(grid, 0).bright).toBeGreaterThan(0.05);
    const [r, g] = cellLight(grid, 1).rgb;
    expect(r).toBeGreaterThan(g);
    // Quantised, so the streaks share a handful of sprites.
    for (const c of cellLight(grid, 1).rgb) expect(c % 51).toBe(0);
  });
});

describe("water gathering on the glass", () => {
  const bead = (x: number, y: number, r: number, moving = false): Drop => ({
    x,
    y,
    r,
    runs: moving,
    moving,
    timer: 1,
    speed: moving ? 100 : 0,
    wobble: 0,
    trail: [],
    age: 1,
    dying: null,
  });

  it("strikes harder in a harder rain, and not at all in none", () => {
    expect(impactRate(1280, 800, 1, false)).toBeGreaterThan(impactRate(1280, 800, 0.3, false));
    expect(impactRate(1280, 800, 0, false)).toBe(0);
  });

  it("keeps its water when two beads become one, and a heavy one starts to run", () => {
    const a = bead(0, 0, 4);
    absorb(a, bead(0, 0, 4));
    expect(a.r).toBeCloseTo(Math.hypot(4, 4));
    expect(a.runs).toBe(true);
  });

  it("lets a running drop take in the beads in its path, and leaves the rest", () => {
    const drops = [bead(100, 100, 6, true), bead(102, 104, 2), bead(400, 400, 2)];
    expect(mergeDrops(drops)).toBe(1);
    expect(drops).toHaveLength(2);
    expect(drops[0]!.r).toBeGreaterThan(6);
  });

  it("joins a drop that lands on a bead to it, and dries one when the glass is full", () => {
    const rand = seeded(9);
    const drops = [bead(50, 50, 3)];
    expect(landDrop(drops, bead(51, 51, 2), 10, rand)).toBe(true);
    expect(drops).toHaveLength(1);
    const full = Array.from({ length: 4 }, (_, i) => bead(i * 100, 0, 2));
    expect(landDrop(full, landingDrop(800, 600, rand), 4, rand)).toBe(false);
    expect(full).toHaveLength(4);
    expect(full.some((d) => d.dying !== null)).toBe(true);
  });

  it("dries its residue, and never holds more than it can draw", () => {
    const specks: Residue[] = Array.from({ length: MAX_RESIDUE + 50 }, (_, i) => ({
      x: 0,
      y: 0,
      r: 1,
      age: 0,
      life: i < 10 ? 1 : 100,
    }));
    stepResidue(specks, 2);
    expect(specks.length).toBeLessThanOrEqual(MAX_RESIDUE);
    expect(specks.every((s) => s.age < s.life)).toBe(true);
  });
});
