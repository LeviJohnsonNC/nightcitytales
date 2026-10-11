/**
 * The streetlight's arm, on hand-built geometry. storefront.test.ts holds it
 * on composed intersections; this holds the rule itself: the head hangs over
 * open ground, clear of buildings and of every cover piece's screen silhouette,
 * preferring straight out at 1.5 m, and says so when nothing clears.
 */
import { describe, expect, it } from "vitest";
import type { Rect, SceneStructure } from "@/engine";
import { lampArm } from "../courtyard/storefront";

const building = (rect: Rect, style: SceneStructure["style"] = "shop"): SceneStructure => ({
  id: `b-${rect.x}-${rect.y}`,
  label: "b",
  rect,
  height: 4,
  style,
  blocksMovement: true,
  blocksShots: true,
});
const inside = (p: { x: number; y: number }, r: Rect) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
const head = (base: { x: number; y: number }, arm: ReturnType<typeof lampArm>) => ({
  x: base.x + arm.dir.x * arm.length,
  y: base.y + arm.dir.y * arm.length,
});

const base = { x: 20, y: 20 };
const north = { x: 0, y: -1 };
// The shop the pole stands in front of: its north face is at y = 20.5.
const shop = building({ x: 10, y: 20.5, width: 20, height: 8 });

describe("lampArm", () => {
  it("reaches straight out at 1.5 m over open ground", () => {
    const arm = lampArm(base, north, [shop], [], 6);
    expect(arm.clear).toBe(true);
    expect(arm.length).toBe(1.5);
    expect(arm.dir.x).toBeCloseTo(0);
    expect(arm.dir.y).toBeCloseTo(-1);
  });

  it("swings off a parked car rather than hanging the lantern over it", () => {
    const car = { rect: { x: 18.5, y: 16, width: 3, height: 3 } };
    const arm = lampArm(base, north, [shop], [car], 6);
    expect(arm.clear).toBe(true);
    expect(inside(head(base, arm), car.rect)).toBe(false);
    // it no longer points straight out
    expect(Math.abs(arm.dir.x)).toBeGreaterThan(0.01);
  });

  it("never hangs the head over a building", () => {
    const across = building({ x: 15, y: 15, width: 10, height: 4.4 });
    const arm = lampArm(base, north, [shop, across], [], 6);
    expect(arm.clear).toBe(true);
    expect(inside(head(base, arm), across.rect)).toBe(false);
    expect(inside(head(base, arm), shop.rect)).toBe(false);
  });

  it("ignores fences and interior walls as obstacles", () => {
    const fence = building({ x: 15, y: 17, width: 10, height: 1 }, "mesh-fence");
    const wall = building({ x: 15, y: 17, width: 10, height: 1 }, "interior-wall");
    expect(lampArm(base, north, [shop, fence], [], 6)).toEqual(lampArm(base, north, [shop], [], 6));
    expect(lampArm(base, north, [shop, wall], [], 6)).toEqual(lampArm(base, north, [shop], [], 6));
  });

  it("falls back to straight out at 1.5 m, and says so, when nothing clears", () => {
    const boxed = building({ x: base.x - 5, y: base.y - 5, width: 10, height: 10 });
    const arm = lampArm(base, north, [boxed], [], 6);
    expect(arm).toEqual({ dir: north, length: 1.5, clear: false });
  });

  it("keeps every arm inside the printed mast range", () => {
    const cars = [
      { rect: { x: 18.5, y: 16, width: 3, height: 3 } },
      { rect: { x: 14, y: 17, width: 3, height: 2 } },
    ];
    const arm = lampArm(base, north, [shop], cars, 6);
    expect(arm.length).toBeGreaterThanOrEqual(1.2);
    expect(arm.length).toBeLessThanOrEqual(3);
    expect(Math.hypot(arm.dir.x, arm.dir.y)).toBeCloseTo(1);
  });

  it("is deterministic", () => {
    const car = { rect: { x: 18.5, y: 16, width: 3, height: 3 } };
    expect(lampArm(base, north, [shop], [car], 6)).toEqual(lampArm(base, north, [shop], [car], 6));
  });
});
