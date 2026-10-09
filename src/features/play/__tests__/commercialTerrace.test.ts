import { expect, it } from "vitest";
import { composeScene, readBattlefieldSnapshot } from "@/engine";
import { commercialTerrace } from "../courtyard/commercialTerrace";
import { rooftopUnits } from "../courtyard/architectureArt";
import { commercialUpperWindows } from "../courtyard/commercialUpper";
import { occupiedUse } from "../courtyard/occupiedFrontage";

it("fits recessed rooms and their roof equipment inside every saved commercial footprint", () => {
  for (let seed = 0; seed < 41; seed++) {
    const scene = composeScene("intersection", seed);
    const saved = JSON.stringify(scene.layout);
    for (const s of scene.layout.arena.environment!.structures) {
      const upper = commercialTerrace(s);
      if (!upper) continue;
      expect(upper.height).toBe(s.height);
      expect(upper.rect.x).toBeGreaterThan(s.rect.x);
      expect(upper.rect.y).toBeGreaterThan(s.rect.y);
      expect(upper.rect.x + upper.rect.width).toBeLessThan(s.rect.x + s.rect.width);
      expect(upper.rect.y + upper.rect.height).toBeLessThan(s.rect.y + s.rect.height);
      for (const equipment of rooftopUnits(upper)) {
        expect(equipment.x).toBeGreaterThanOrEqual(upper.rect.x);
        expect(equipment.y).toBeGreaterThanOrEqual(upper.rect.y);
        expect(equipment.x + equipment.width).toBeLessThanOrEqual(upper.rect.x + upper.rect.width);
        expect(equipment.y + equipment.height).toBeLessThanOrEqual(
          upper.rect.y + upper.rect.height,
        );
      }
      for (const edge of ["north", "east"] as const)
        for (const w of commercialUpperWindows(upper, edge)) {
          expect(w.s0).toBeGreaterThan(0);
          expect(w.s1).toBeLessThan(edge === "north" ? upper.rect.width : upper.rect.height);
        }
    }
    expect(JSON.stringify(scene.layout)).toBe(saved);
    expect(readBattlefieldSnapshot(scene.layout)).toEqual(scene.layout);
  }
});

it("keeps occupied repair balconies and low buildings on their original planes", () => {
  const structures = composeScene("intersection", 8).layout.arena.environment!.structures;
  for (const s of structures)
    if (occupiedUse(s) || s.height < 6.8) expect(commercialTerrace(s)).toBeUndefined();
  const corner = structures.find((s) => s.id === "building_0")!;
  const tower = structures.find((s) => s.id === "building_0_middle")!;
  expect(commercialTerrace(corner)!.rect.y - corner.rect.y).toBeGreaterThan(
    commercialTerrace(tower)!.rect.y - tower.rect.y,
  );
});
