import { describe, expect, it } from "vitest";
import { composeScene, type SceneStructure } from "@/engine";
import { LIT_HOMES, buildingUse, litHomeWindows } from "../courtyard/buildingFaces";
import { lightOnFace, pointLights, type PointLight } from "../courtyard/wallLight";
import { INTERSECTION_NIGHT } from "../courtyard/nightLighting";
import { storefrontFor } from "../courtyard/storefront";

const block = (id: string, x: number, y: number, w: number, h: number): SceneStructure =>
  ({ id, rect: { x, y, width: w, height: h }, height: 6, style: "shop" }) as SceneStructure;
const lamp = (x: number, y: number): PointLight => ({
  at: { x, y },
  z: 4.4,
  radius: 3.4,
  color: [1, 0.8, 0.5],
  intensity: 0.5,
});

describe("light on walls", () => {
  const house = block("house", 0, 4, 10, 6);
  it("lights a face from in front, centred on the light's foot", () => {
    const hit = lightOnFace(house, "north", lamp(5, 2), [house]);
    expect(hit).toBeDefined();
    expect(hit!.s).toBeCloseTo(5);
    expect(hit!.z).toBeCloseTo(4.4);
    expect(hit!.peak).toBeGreaterThan(0);
  });
  it("never lights a face from behind or beyond its reach", () => {
    expect(lightOnFace(house, "north", lamp(5, 6), [house])).toBeUndefined();
    expect(lightOnFace(house, "north", lamp(5, -10), [house])).toBeUndefined();
    expect(lightOnFace(house, "east", lamp(5, 2), [house])).toBeUndefined();
  });
  it("is stopped by a building between the light and the wall", () => {
    const shed = block("shed", 3, 2.5, 4, 1);
    expect(lightOnFace(house, "north", lamp(5, 1), [house, shed])).toBeUndefined();
    // a fence does not stop it
    const fence = { ...shed, style: "mesh-fence" } as SceneStructure;
    expect(lightOnFace(house, "north", lamp(5, 1), [house, fence])).toBeDefined();
  });
  it("is weaker further from the wall", () => {
    const near = lightOnFace(house, "north", lamp(5, 3), [house])!;
    const far = lightOnFace(house, "north", lamp(5, 1), [house])!;
    expect(far.peak).toBeLessThan(near.peak);
  });
  it("takes every light from the scene's saved fixtures", () => {
    const arena = composeScene("intersection", 7).layout.arena;
    const env = arena.environment!;
    const sfs = env.structures.flatMap((s) => {
      const sf = storefrontFor(s, env, arena.cover ?? []);
      return sf ? [sf] : [];
    });
    const lights = pointLights(env, sfs, INTERSECTION_NIGHT);
    const fixtures = env.dressing.filter((d) => d.kind === "lamp" || d.kind === "sign");
    expect(lights.length).toBeGreaterThan(0);
    expect(lights.length).toBeLessThanOrEqual(fixtures.length + sfs.length);
  });
});

describe("lit homes", () => {
  for (const seed of [7, 0, 8]) {
    it(`seed ${seed}: a few windows, the same every time, the rest dark`, () => {
      const env = composeScene("intersection", seed).layout.arena.environment!;
      const homes = env.structures.filter((s) => buildingUse(s) === "residential");
      for (const s of homes) {
        const lit = litHomeWindows(s, env.entrances, env.structures);
        const again = litHomeWindows(s, env.entrances, env.structures);
        expect(again).toEqual(lit);
        expect(lit.length).toBeLessThanOrEqual(LIT_HOMES.max);
        for (const { opening } of lit) {
          expect(opening.kind).toBe("window");
          expect(["lamp", "curtains", "blind"]).toContain(opening.occupancy);
        }
      }
      if (seed === 7)
        expect(
          homes.reduce((n, s) => n + litHomeWindows(s, env.entrances, env.structures).length, 0),
        ).toBeGreaterThan(0);
    });
  }
  it("lights nothing that is not a home", () => {
    const env = composeScene("intersection", 7).layout.arena.environment!;
    for (const s of env.structures.filter((x) => x.style !== "residential"))
      expect(litHomeWindows(s, env.entrances, env.structures)).toEqual([]);
  });
});
