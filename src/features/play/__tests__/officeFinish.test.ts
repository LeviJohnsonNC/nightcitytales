import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import { officeLights } from "../courtyard/officeFinish";
import { lightAmount, lightAt } from "../courtyard/nightLighting";

describe("office ceiling lights", () => {
  it.each([1, 4, 5, 8, 11, 23])("keeps seed %i light and actor tint inside saved rooms", (seed) => {
    const env = composeScene("office", seed).layout.arena.environment!;
    const saved = JSON.stringify(env);
    const lights = officeLights(env);
    expect(lights.length).toBeGreaterThan(3);
    expect(new Set(lights.map((l) => l.id)).size).toBe(lights.length);
    expect(lights.some((l) => l.color[0] > l.color[2])).toBe(true);
    expect(lights.some((l) => l.color[2] > l.color[0])).toBe(true);
    for (const light of lights) {
      expect(lightAmount(light, light.centre)).toBeGreaterThan(0);
      const outside = { x: light.bounds.x - 0.01, y: light.centre.y };
      expect(lightAmount(light, outside)).toBe(0);
      expect(lightAt([light], env.structures, outside)).toEqual([0, 0, 0]);
      expect(light.sourceZ).toBeGreaterThan(2);
    }
    expect(JSON.stringify(env)).toBe(saved);
  });
  it("leaves other environments' sources alone", () => {
    for (const kind of ["warehouse", "garage", "alley", "intersection", "nightclub"] as const)
      expect(officeLights(composeScene(kind, 4).layout.arena.environment!)).toEqual([]);
  });
});
