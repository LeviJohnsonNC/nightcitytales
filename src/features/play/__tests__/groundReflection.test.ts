import { describe, expect, it } from "vitest";
import {
  flippedBody,
  inFrontOf,
  mirrorMatrix,
  mirrorPoint,
  REFLECTION,
  response,
  SurfaceClass,
} from "../courtyard/groundReflection";

describe("ground reflection: where a picture lands", () => {
  // a ground line falling to the right, as a camera-facing north face does on screen
  const a = { x: 100, y: 200 };
  const b = { x: 300, y: 300 };

  it("puts a point z above the line z below it, straight down the screen", () => {
    // 40 px above the line at x = 200 (the line is at y = 250 there)
    expect(mirrorPoint({ x: 200, y: 210 }, a, b)).toEqual({ x: 200, y: 290 });
    // a point on the line is its own reflection
    expect(mirrorPoint({ x: 300, y: 300 }, a, b)).toEqual({ x: 300, y: 300 });
  });

  it("draws the same flip through the canvas transform", () => {
    const [ma, mb, mc, md, me, mf] = mirrorMatrix(a, b);
    const p = { x: 140, y: 150 };
    const q = mirrorPoint(p, a, b);
    expect(ma * p.x + mc * p.y + me).toBeCloseTo(q.x);
    expect(mb * p.x + md * p.y + mf).toBeCloseTo(q.y);
  });

  it("stretches a rough reflection from near the foot to past the mirror point", () => {
    const top = { x: 200, y: 210 }; // 40 px above the line
    const near = mirrorPoint(top, a, b, Math.min(...REFLECTION.stretch));
    const far = mirrorPoint(top, a, b, Math.max(...REFLECTION.stretch));
    const mirror = mirrorPoint(top, a, b);
    expect(near.y).toBeGreaterThan(250);
    expect(near.y).toBeLessThan(mirror.y);
    expect(far.y).toBeGreaterThan(mirror.y);
  });

  it("lets only what stands nearer the camera than a source hide its reflection", () => {
    expect(inFrontOf({ x: 200, y: 260 }, a, b)).toBe(true);
    expect(inFrontOf({ x: 200, y: 240 }, a, b)).toBe(false);
  });

  it("hides behind a prop by its body flipped below its foot, lower as a wreck", () => {
    const project = (p: { x: number; y: number }) => ({ x: p.x * 10, y: p.y * 10 });
    const body = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 1 },
    ];
    const standing = flippedBody(project, body, 1.4, 15);
    const wreck = flippedBody(project, body, 0.4, 15);
    const bottom = (pts: { y: number }[]) => Math.max(...pts.map((p) => p.y));
    expect(bottom(standing)).toBeCloseTo(10 + 1.4 * 15);
    expect(bottom(wreck)).toBeCloseTo(10 + 0.4 * 15);
    // never above the footprint: a reflection is under the ground line, not over it
    expect(Math.min(...standing.map((p) => p.y))).toBe(0);
  });
});

describe("ground reflection: what a surface gives back", () => {
  it("gives nothing from a building's footprint or a paving joint", () => {
    expect(response(SurfaceClass.none, 1, 1)).toEqual({ smooth: 0, rough: 0 });
    expect(response(SurfaceClass.joint, 1, 1)).toEqual({ smooth: 0, rough: 0 });
  });

  it("keeps rough asphalt subdued except on its proud grains", () => {
    const flat = response(SurfaceClass.asphalt, 0, 0);
    const grain = response(SurfaceClass.asphalt, 0, 1);
    expect(grain.rough).toBeGreaterThan(flat.rough * 10);
    expect(flat.smooth).toBeLessThan(0.1);
  });

  it("makes a marking smoother than the asphalt it is painted on, and a patch smoother still", () => {
    expect(response(SurfaceClass.marking, 0, 0).smooth).toBeGreaterThan(
      response(SurfaceClass.asphalt, 0, 0).smooth,
    );
    expect(response(SurfaceClass.asphalt, 1, 0).smooth).toBeGreaterThan(
      response(SurfaceClass.asphalt, 0, 0).smooth,
    );
  });
});
