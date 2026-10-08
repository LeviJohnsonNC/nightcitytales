import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import {
  blockOpenings,
  cityRoofUnits,
  paintCityBlockFace,
  wallFittings,
} from "../courtyard/cityBlock";

describe("inhabited block decoration", () => {
  it("keeps fittings on solid wall and equipment inside saved roofs across recipes and orientations", () => {
    let fittingCount = 0;
    for (let seed = 0; seed < 41; seed++) {
      const env = composeScene("intersection", seed).layout.arena.environment!;
      const before = JSON.stringify(env);
      for (const s of env.structures) {
        const units = cityRoofUnits(s);
        expect(cityRoofUnits(s)).toEqual(units);
        for (const u of units) {
          expect(u.x).toBeGreaterThanOrEqual(s.rect.x);
          expect(u.y).toBeGreaterThanOrEqual(s.rect.y);
          expect(u.x + u.width).toBeLessThanOrEqual(s.rect.x + s.rect.width);
          expect(u.y + u.height).toBeLessThanOrEqual(s.rect.y + s.rect.height);
        }
        for (const edge of ["north", "east"] as const) {
          const openings = blockOpenings(s, edge, env.entrances);
          const fs = wallFittings(s, edge, env.entrances);
          fittingCount += fs.length;
          for (const f of fs) {
            expect(f.s0).toBeGreaterThan(0);
            expect(f.s1).toBeLessThan(edge === "north" ? s.rect.width : s.rect.height);
            expect(f.z0).toBeGreaterThan(0);
            expect(f.z1).toBeLessThan(s.height);
            expect(
              openings.some((o) => f.s0 < o.s1 && f.s1 > o.s0 && f.z0 < o.z1 && f.z1 > o.z0),
            ).toBe(false);
          }
          expect(wallFittings(s, edge, env.entrances, true).every((f) => f.z0 > 2.65)).toBe(true);
        }
      }
      expect(JSON.stringify(env)).toBe(before);
    }
    expect(fittingCount).toBeGreaterThan(50);
  });
  it("clips full and retained decoration to the same wall plane and restores the canvas state", () => {
    const env = composeScene("intersection", 8).layout.arena.environment!;
    const s = env.structures.find((s) => s.style === "residential")!;
    let depth = 0,
      clips = 0,
      painted = 0;
    const ctx = new Proxy(
      {},
      {
        get: (_t, key) => {
          if (key === "save") return () => depth++;
          if (key === "restore") return () => depth--;
          if (key === "clip") return () => clips++;
          if (key === "fill" || key === "stroke")
            return () => {
              expect(clips).toBeGreaterThan(0);
              painted++;
            };
          if (key === "createLinearGradient") return () => ({ addColorStop: () => undefined });
          return () => undefined;
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    const p = (v: { x: number; y: number }) => ({ x: v.x * 15, y: v.y * 15 });
    for (const clip of [undefined, { s0: 0, s1: 4, zMax: 2.4 }]) {
      clips = 0;
      paintCityBlockFace(ctx, s, "north", env.entrances, p, 15, {}, undefined, clip);
      expect(depth).toBe(0);
      expect(clips).toBeGreaterThan(0);
    }
    expect(painted).toBeGreaterThan(0);
  });
});
