import { describe, expect, it } from "vitest";
import { composeScene, type SceneEnvironment } from "@/engine";
import {
  INTERSECTION_NIGHT,
  lightAmount,
  lightAt,
  nightFor,
  poolFalloff,
  tintFor,
  type GroundLight,
} from "../courtyard/nightLighting";
import { REVIEW_KINDS } from "@/features/dev/sceneReviewQuery";

describe("night lighting", () => {
  it("applies to the intersection only: every other scene keeps its look", () => {
    for (const kind of REVIEW_KINDS) {
      const env = composeScene(kind as SceneEnvironment["recipe"], 7).layout.arena.environment!;
      expect(nightFor(env) !== undefined).toBe(kind === "intersection");
    }
  });

  it("is a tint, never black: the ambient keeps every surface readable", () => {
    for (const c of INTERSECTION_NIGHT.ambient) {
      expect(c).toBeGreaterThanOrEqual(0.45);
      expect(c).toBeLessThan(1);
    }
    // cooler than it is warm
    expect(INTERSECTION_NIGHT.ambient[2]).toBeGreaterThan(INTERSECTION_NIGHT.ambient[0]);
  });

  it("caps a tint at the art's own colour, and multiplies an existing tint", () => {
    expect(tintFor([1, 1, 1], [1, 1, 1])).toBe(0xffffff);
    expect(tintFor([0.5, 0.5, 0.5])).toBe(0x808080);
    expect(tintFor([1, 1, 1], [0, 0, 0], 0x879aa5)).toBe(0x879aa5);
  });

  it("fades a pool smoothly to nothing at its radius", () => {
    expect(poolFalloff(0)).toBe(1);
    expect(poolFalloff(1)).toBe(0);
    expect(poolFalloff(0.5)).toBeGreaterThan(poolFalloff(0.8));
    const pool: GroundLight = {
      kind: "pool",
      centre: { x: 0, y: 0 },
      radius: 2,
      color: [1, 1, 1],
      intensity: 0.5,
    };
    expect(lightAmount(pool, { x: 0, y: 0 })).toBe(0.5);
    expect(lightAmount(pool, { x: 3, y: 0 })).toBe(0);
  });

  it("spills a window's light in front of its wall only", () => {
    const spill: GroundLight = {
      kind: "spill",
      origin: { x: 0, y: 0 },
      along: { x: 1, y: 0 },
      out: { x: 0, y: -1 },
      s0: 0,
      s1: 2,
      reach: 3,
      spread: 1,
      color: [1, 1, 1],
      intensity: 1,
    };
    expect(lightAmount(spill, { x: 1, y: -0.5 })).toBeGreaterThan(0.5);
    expect(lightAmount(spill, { x: 1, y: 0.5 })).toBe(0);
    expect(lightAmount(spill, { x: 1, y: -3.5 })).toBe(0);
    expect(lightAmount(spill, { x: 6, y: -1 })).toBe(0);
  });

  it("stops at walls: no light reaches a point inside a building", () => {
    const env = composeScene("intersection", 7).layout.arena.environment!;
    const shop = env.structures.find((s) => s.id === "building_0")!;
    const pool: GroundLight = {
      kind: "pool",
      centre: { x: shop.rect.x, y: shop.rect.y },
      radius: 4,
      color: [1, 1, 1],
      intensity: 1,
    };
    expect(lightAt([pool], env.structures, { x: shop.rect.x + 1, y: shop.rect.y + 1 })).toEqual([
      0, 0, 0,
    ]);
    expect(
      lightAt([pool], env.structures, { x: shop.rect.x - 1, y: shop.rect.y - 1 })[0],
    ).toBeGreaterThan(0);
  });
});
