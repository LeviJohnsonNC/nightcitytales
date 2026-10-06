import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import {
  boxShadow,
  CASTER_HEIGHT,
  hull,
  LAMP_SHADOW,
  shadowCasters,
  sourceFor,
  type ShadowCaster,
} from "../courtyard/lampShadow";
import type { GroundLight } from "../courtyard/nightLighting";

const square = (x: number, y: number, size = 1.76) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
];
const area = (poly: { x: number; y: number }[]) =>
  Math.abs(
    poly.reduce((s, p, i) => {
      const q = poly[(i + 1) % poly.length]!;
      return s + p.x * q.y - q.x * p.y;
    }, 0) / 2,
  );
const furthest = (poly: { x: number; y: number }[], from: { x: number; y: number }) =>
  Math.max(...poly.map((p) => Math.hypot(p.x - from.x, p.y - from.y)));

const pool = (x: number, y: number, radius = 5): GroundLight => ({
  kind: "pool",
  centre: { x, y },
  radius,
  color: [1, 1, 1],
  intensity: 1,
});
const caster = (x: number, y: number, height = 1.2, wreck = 0.4): ShadowCaster => ({
  coverId: "c",
  art: "cargo",
  body: square(x, y),
  height,
  wreck,
});

describe("lamp shadows: the geometry", () => {
  it("projects a box away from the light, longer the lower the light", () => {
    const body = square(3, 0);
    const high = boxShadow(body, 1.2, { at: { x: 0, y: 1 }, z: 5.45 });
    const low = boxShadow(body, 1.2, { at: { x: 0, y: 1 }, z: 2.6 });
    // it covers the footprint and reaches beyond it, on the side away from the light
    expect(area(high)).toBeGreaterThan(area(hull(body)));
    expect(furthest(low, { x: 0, y: 1 })).toBeGreaterThan(furthest(high, { x: 0, y: 1 }));
    expect(Math.min(...high.map((p) => p.x))).toBeCloseTo(3);
  });

  it("casts a wreck's shadow shorter than the intact object's", () => {
    const body = square(3, 0);
    const source = { at: { x: 0, y: 1 }, z: 5.45 };
    expect(area(boxShadow(body, 0.4, source))).toBeLessThan(area(boxShadow(body, 1.3, source)));
  });

  it("never runs to infinity under a light no higher than the box", () => {
    const s = boxShadow(square(3, 0), 1.6, { at: { x: 0, y: 1 }, z: 1.5 });
    expect(furthest(s, { x: 0, y: 1 })).toBeLessThan(5 * (LAMP_SHADOW.stretch + 1));
  });
});

describe("lamp shadows: which light casts", () => {
  it("only a light that reaches the caster, and never one overhead it", () => {
    expect(sourceFor(pool(0, 1), caster(3, 0), 5.45)).toEqual({ at: { x: 0, y: 1 }, z: 5.45 });
    expect(sourceFor(pool(-10, 1), caster(3, 0), 5.45)).toBeNull();
    expect(sourceFor(pool(3.8, 0.8), caster(3, 0), 5.45)).toBeNull();
  });

  it("takes a window's light from the bay's nearest point, at the bay's height", () => {
    const spill: GroundLight = {
      kind: "spill",
      origin: { x: 0, y: 0 },
      along: { x: 1, y: 0 },
      out: { x: 0, y: 1 },
      s0: 2,
      s1: 4.2,
      reach: 3.4,
      spread: 1,
      color: [1, 1, 1],
      intensity: 1,
    };
    // a planter in front of the bay, and one beyond its end
    expect(sourceFor(spill, caster(2.5, 1))).toEqual({
      at: { x: 3.38, y: 0 },
      z: LAMP_SHADOW.windowZ,
    });
    expect(sourceFor(spill, caster(4.2, 0.5))?.at).toEqual({ x: 4.2, y: 0 });
    expect(sourceFor(spill, caster(12, 1))).toBeNull();
  });
});

describe("lamp shadows: the intersection's casters", () => {
  for (const seed of [7, 0, 8]) {
    it(`seed ${seed}: every prop that stands casts, from its own saved footprint`, () => {
      const arena = composeScene("intersection", seed).layout.arena;
      const casters = shadowCasters(arena);
      const props = arena.environment!.props.filter((p) => CASTER_HEIGHT[p.art]);
      expect(casters.map((c) => c.coverId).sort()).toEqual(props.map((p) => p.coverId).sort());
      for (const c of casters) {
        const rect = arena.cover!.find((p) => p.id === c.coverId)!.rect;
        // inside its saved 2 m piece, so a shadow never starts where nothing stands
        for (const p of c.body) {
          expect(p.x).toBeGreaterThanOrEqual(rect.x - 1e-9);
          expect(p.x).toBeLessThanOrEqual(rect.x + rect.width + 1e-9);
          expect(p.y).toBeGreaterThanOrEqual(rect.y - 1e-9);
          expect(p.y).toBeLessThanOrEqual(rect.y + rect.height + 1e-9);
        }
        expect(c.wreck).toBeLessThan(c.height);
      }
    });
  }
});
