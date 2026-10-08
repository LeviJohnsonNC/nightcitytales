import { describe, expect, it } from "vitest";
import { composeScene } from "../sceneComposer";
import { readBattlefieldSnapshot } from "../battlefieldSnapshot";
import { addRepairLofts } from "../intersectionPrograms";
import v10 from "./fixtures/intersection-v10.json";
import { readSceneManifest } from "../persistentScene";
import v8 from "./fixtures/intersection-v8.json";

describe("repair-row massing revision 9", () => {
  it("loads a real pre-change v8 snapshot without regenerating its shed", () => {
    const saved = structuredClone(v8);
    expect(readBattlefieldSnapshot(saved)).toEqual(v8);
    expect(saved).toEqual(v8);
    expect(saved.arena.environment!.recipeVersion).toBe(8);
    expect(saved.arena.environment!.structures.some((s) => s.id.includes("_loft_"))).toBe(false);
  });

  it("keeps the recorded v10 seed8 ground footprint before the compact prototype", () => {
    const scene = readSceneManifest({ version: 1, scene: structuredClone(v10) });
    const now = scene.layout.arena.environment!;
    const before = v8.arena.environment!;
    for (const key of ["zones", "entrances", "props", "clusters", "dressing"] as const)
      expect(
        now[key]!.filter(
          (item) =>
            !("id" in item ? item.id : "clusterId" in item ? item.clusterId : "").startsWith(
              "street_market_",
            ),
        ),
      ).toEqual(before[key]);
    expect(scene.layout.arena.cover!.filter((c) => !c.id.startsWith("street_market_"))).toEqual(
      v8.arena.cover,
    );
    expect(scene.layout.arena.playerStart).toEqual(v8.arena.playerStart);
    expect(scene.layout.arena.hostileSlots).toEqual(v8.arena.hostileSlots);
    const old = before.structures.find((s) => s.id === "building_3")!.rect;
    const parts = now.structures.filter(
      (s) => s.id === "building_3" || s.id.startsWith("building_3_loft_"),
    );
    const inside = (x: number, y: number, r: typeof old) =>
      x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
    for (let x = old.x - 1; x <= old.x + old.width; x += 0.5)
      for (let y = old.y - 1; y <= old.y + old.height; y += 0.5)
        expect(parts.filter((s) => inside(x, y, s.rect)).length).toBe(inside(x, y, old) ? 1 : 0);
  });

  it("partitions once, without overlapping blocks, in every seeded orientation", () => {
    const edges = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const scene = composeScene("intersection", seed);
      const env = scene.layout.arena.environment!;
      const lofts = env.structures.filter((s) => s.id.startsWith("building_3_loft_"));
      if ([1, 2, 3].includes(seed)) {
        expect(env.recipeVersion).toBe(5);
        expect(lofts).toHaveLength(0);
        continue;
      }
      expect(env.recipeVersion).toBe(seed === 8 ? 12 : 10);
      expect(lofts.map((s) => s.height)).toEqual([7.2, 10.2]);
      const front = env.structures.find((s) => s.id === "building_3")!;
      const edge = front.attachments!.find((a) => a.id === "retail-header")!.edge;
      edges.add(edge);
      expect(edge === "north" ? front.rect.height : front.rect.width).toBe(4);
      expect(front.height).toBe(2.5);
      const parts = [front, ...lofts];
      expect(parts.reduce((sum, s) => sum + s.rect.width * s.rect.height, 0)).toBe(220);
      for (const a of parts)
        for (const b of parts) {
          if (a === b) continue;
          expect(
            a.rect.x < b.rect.x + b.rect.width &&
              a.rect.x + a.rect.width > b.rect.x &&
              a.rect.y < b.rect.y + b.rect.height &&
              a.rect.y + a.rect.height > b.rect.y,
          ).toBe(false);
        }
      const frozen = JSON.stringify(env);
      addRepairLofts(env);
      expect(JSON.stringify(env)).toBe(frozen);
      expect(readBattlefieldSnapshot(JSON.parse(JSON.stringify(scene.layout)))).toEqual(
        scene.layout,
      );
    }
    expect(edges).toEqual(new Set(["north", "west"]));
  });
});
