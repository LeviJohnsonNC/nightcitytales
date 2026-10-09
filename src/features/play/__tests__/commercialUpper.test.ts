import { describe, expect, it } from "vitest";
import { composeScene, readBattlefieldSnapshot } from "@/engine";
import { commercialUpperWindows, paintCommercialUpper } from "../courtyard/commercialUpper";

describe("stepped commercial row", () => {
  it("saves the new heights, while loading v7 keeps its own envelope", () => {
    for (const seed of [0, 7, 8, 12]) {
      const scene = composeScene("intersection", seed);
      const env = scene.layout.arena.environment!;
      expect(env.recipeVersion).toBe(seed === 8 ? 13 : 10);
      const heights = Object.fromEntries(env.structures.map((s) => [s.id, s.height]));
      expect([
        heights["building_0"],
        heights["building_0_middle"],
        heights["building_0_rear"],
      ]).toEqual([7.2, 10.2, 7.8]);
      const saved = structuredClone(scene.layout);
      saved.arena.environment!.recipeVersion = 7;
      for (const s of saved.arena.environment!.structures)
        s.height =
          ({ building_0: 4, building_0_middle: 3.5, building_0_rear: 4 } as Record<string, number>)[
            s.id
          ] ?? s.height;
      const before = JSON.stringify(saved);
      expect(readBattlefieldSnapshot(saved)).toEqual(saved);
      expect(JSON.stringify(saved)).toBe(before);
    }
  });

  it("fits all windows within the saved elevation across orientations and leaves low buildings alone", () => {
    for (let seed = 0; seed < 41; seed++) {
      const env = composeScene("intersection", seed).layout.arena.environment!;
      for (const s of env.structures)
        for (const edge of ["north", "east"] as const) {
          const windows = commercialUpperWindows(s, edge);
          if (s.style !== "shop" || s.height < 6.8) expect(windows).toEqual([]);
          for (const w of windows) {
            expect(w.s0).toBeGreaterThan(0);
            expect(w.s1).toBeLessThan(edge === "north" ? s.rect.width : s.rect.height);
            expect(w.z0).toBeGreaterThan(3.85);
            expect(w.z1).toBeLessThan(s.height);
          }
        }
    }
  });

  it("clips upper finish on retained walls and does no work below the trading-floor cornice", () => {
    const s = composeScene("intersection", 0).layout.arena.environment!.structures.find(
      (s) => s.id === "building_0_middle",
    )!;
    const before = JSON.stringify(s);
    const project = (p: { x: number; y: number }) => ({ x: p.x * 15, y: p.y * 15 });
    let clipped = false,
      paints = 0,
      depth = 0;
    const ctx = new Proxy(
      {},
      {
        get: (_t, key) => {
          if (key === "save")
            return () => {
              depth++;
            };
          if (key === "restore")
            return () => {
              depth--;
            };
          if (key === "clip")
            return () => {
              clipped = true;
            };
          if (key === "fill" || key === "stroke")
            return () => {
              expect(clipped).toBe(true);
              paints++;
            };
          if (key === "createLinearGradient") return () => ({ addColorStop: () => undefined });
          return () => undefined;
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    paintCommercialUpper(ctx, s, "north", project, 15, {}, undefined, { s0: 0, s1: 4, zMax: 2.4 });
    expect(paints).toBe(0);
    paintCommercialUpper(ctx, s, "north", project, 15, {}, undefined, { s0: 0, s1: 4, zMax: 6 });
    expect(paints).toBeGreaterThan(0);
    expect(depth).toBe(0);
    expect(JSON.stringify(s)).toBe(before);
  });
});
