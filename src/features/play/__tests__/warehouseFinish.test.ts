import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import { warehouseLights } from "../courtyard/warehouseFinish";
import { lightAmount, lightAt } from "../courtyard/nightLighting";

describe("warehouse room lighting", () => {
  it.each([1, 4, 5, 7, 11, 23])("lights saved rooms without changing seed %i geometry", (seed) => {
    const env = composeScene("warehouse", seed).layout.arena.environment!;
    const saved = JSON.stringify(env);
    const lights = warehouseLights(env);
    expect(lights.length).toBeGreaterThan(2);
    expect(new Set(lights.map((l) => l.id)).size).toBe(lights.length);
    expect(lights.some((l) => l.color[0] > l.color[2])).toBe(true);
    expect(lights.some((l) => l.color[2] > l.color[0])).toBe(true);
    for (const light of lights) {
      expect(lightAmount(light, light.centre)).toBeGreaterThan(0);
      // The emitter can be close enough to reach a neighbouring room, but its
      // closed partition must stop both the ground light and the actor tint.
      const p = { x: light.bounds.x - 0.01, y: light.centre.y };
      expect(lightAmount(light, p)).toBe(0);
      expect(lightAt([light], env.structures, p)).toEqual([0, 0, 0]);
      expect(light.sourceZ).toBeGreaterThan(2);
    }
    expect(JSON.stringify(env)).toBe(saved);
  });
  it("does not supply indoor fixtures to other environments", () => {
    for (const kind of ["intersection", "alley", "office", "nightclub"] as const)
      expect(warehouseLights(composeScene(kind, 4).layout.arena.environment!)).toEqual([]);
  });
});
