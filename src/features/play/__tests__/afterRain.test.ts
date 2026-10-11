import { describe, expect, it } from "vitest";
import { composeScene, type SceneEnvironment } from "@/engine";
import { rainField, rainWetness, roadEdges } from "../courtyard/afterRain";

describe("ground wetness topology", () => {
  it("keeps crosswalk overlaps from creating gutters across a carriageway", () => {
    const env = composeScene("intersection", 8).layout.arena.environment!;
    const road = { kind: "road", rect: { x: 0, y: 0, width: 12, height: 8 } };
    const base = { ...env, zones: [road] } as SceneEnvironment;
    const overlap = {
      ...base,
      zones: [
        ...base.zones,
        { kind: "crosswalk", rect: { x: 4, y: 0, width: 2, height: 8 } },
        { kind: "intersection", rect: { x: 3, y: 1, width: 6, height: 6 } },
      ],
    } as SceneEnvironment;
    const a = rainField(base),
      b = rainField(overlap);
    for (let x = -1; x <= 13; x += 0.5)
      for (let y = -1; y <= 9; y += 0.5) expect(b(x, y)).toBeCloseTo(a(x, y), 10);
    for (const edge of roadEdges(overlap)) {
      const { a, b } = edge;
      expect(
        (a.x === b.x && (a.x === 0 || a.x === 12)) || (a.y === b.y && (a.y === 0 || a.y === 8)),
      ).toBe(true);
    }
  });
  it("shares a bounded deterministic world field without altering the saved scene", () => {
    for (const seed of [8, 0, 7]) {
      const env = composeScene("intersection", seed).layout.arena.environment!;
      const saved = JSON.stringify(env),
        a = rainField(env),
        b = rainField(env);
      for (let x = -4; x < 36; x += 2.3)
        for (let y = -4; y < 36; y += 2.7) {
          expect(a(x, y)).toBe(b(x, y));
          expect(a(x, y)).toBeGreaterThanOrEqual(0);
          expect(a(x, y)).toBeLessThanOrEqual(1);
          expect(rainWetness(x, y, 1)).toBeGreaterThanOrEqual(rainWetness(x, y, 0));
        }
      expect(JSON.stringify(env)).toBe(saved);
    }
  });
});
