import { describe, expect, it } from "vitest";
import { ARENAS } from "@/engine";
import { battlefieldProjection } from "../battlefieldProjection";
import { raisedWeapon } from "../encounterModel";
import type { CapabilitySnapshot, WeaponCapability } from "@/engine";

describe("angled battlefield camera", () => {
  for (const arena of ARENAS) {
    it(`maps clicks back to the same continuous position in ${arena.key}`, () => {
      const camera = battlefieldProjection(arena.extent.width, arena.extent.height);
      for (const point of [
        arena.playerStart,
        ...arena.hostileSlots,
        { x: 0.173, y: 1.927 },
        { x: arena.extent.width, y: arena.extent.height },
      ]) {
        const screen = camera.project(point);
        expect(screen.x).toBeGreaterThanOrEqual(0);
        expect(screen.x).toBeLessThanOrEqual(1100);
        expect(screen.y).toBeGreaterThanOrEqual(0);
        expect(screen.y).toBeLessThanOrEqual(680);
        const restored = camera.unproject(screen);
        expect(restored.x).toBeCloseTo(point.x, 9);
        expect(restored.y).toBeCloseTo(point.y, 9);
      }
    });
  }
});

describe("tactical weapon selection", () => {
  const weapon = (id: string, roundsLoaded: number): WeaponCapability => ({
    itemId: id,
    name: id,
    melee: false,
    rof: 2,
    magazine: 8,
    roundsLoaded,
    spareRounds: 20,
    rangeType: "pistol",
    damageDice: 3,
    broken: false,
  });
  it("keeps an explicitly selected empty gun available for Reload", () => {
    const empty = weapon("heavy_pistol", 0);
    const cap = { weapons: [empty, weapon("medium_pistol", 8)] } as CapabilitySnapshot;
    expect(raisedWeapon(cap, "heavy_pistol")).toBe(empty);
    expect(raisedWeapon(cap, null)?.itemId).toBe("medium_pistol");
  });
  it("still offers a reloadable gun when every magazine is empty", () => {
    const empty = weapon("heavy_pistol", 0);
    expect(raisedWeapon({ weapons: [empty] } as CapabilitySnapshot, null)).toBe(empty);
  });
});
