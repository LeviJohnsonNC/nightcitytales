import v10 from "./fixtures/intersection-v10.json";
import type { AuthoredScene } from "../authoredScene";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { composeScene } from "../sceneComposer";
import { readSceneEnvironment } from "../sceneEnvironment";

/**
 * What the intersection's saved geometry hashed to on `main` before revision 7,
 * with dressing and clusters included. Revision 7 adds exactly one lamp, so every
 * seed must still hash to this once that one lamp and its cluster are taken out:
 * nothing else about a scene moved.
 */
const BEFORE_REVISION_7: Record<number, string> = {
  0: "c9f60063f1266259",
  1: "c53e6afb18ba873e",
  2: "6896bf914d17add4",
  3: "60a5c197b9465a81",
  4: "33a8940165fee38f",
  5: "5575cd463e33ca79",
  6: "16af8bbe7cf34e81",
  7: "6aae9d26f97aefa3",
  8: "f13dc9a69125c83a",
  9: "4a1a4a60c6af4172",
  10: "e74d642ab75609eb",
  11: "6fa49b250d546f00",
  12: "19222e85c115992b",
  13: "18f7642d2f57cf5e",
  14: "c71f8b8bca5d1e14",
  15: "4a1a4a60c6af4172",
  16: "6aae9d26f97aefa3",
  17: "dc53297ca459b065",
  18: "c9f60063f1266259",
  19: "2e9388e150fe1ef6",
  20: "3f68668e87a06318",
  21: "c71f8b8bca5d1e14",
  22: "6aae9d26f97aefa3",
  23: "d117f24d95ac2c18",
  24: "5575cd463e33ca79",
  25: "2e9388e150fe1ef6",
  26: "c71f8b8bca5d1e14",
  27: "30bc80a32cbf0a56",
  28: "c71f8b8bca5d1e14",
  29: "c9f60063f1266259",
  30: "78562d69ae5b8f4e",
  31: "33a8940165fee38f",
  32: "3f68668e87a06318",
  33: "4a1a4a60c6af4172",
  34: "7b25e32cdbf992a1",
  35: "5575cd463e33ca79",
  36: "5575cd463e33ca79",
  37: "2e9388e150fe1ef6",
  38: "18f7642d2f57cf5e",
  39: "78562d69ae5b8f4e",
  40: "4a1a4a60c6af4172",
};

const geometryHash = (seed: number, withoutLamp: boolean) => {
  // Seed 8 is the v11 geometry prototype; pin its actual v10 save here.
  const scene =
    seed === 8 ? (structuredClone(v10) as AuthoredScene) : composeScene("intersection", seed);
  const arena = scene.layout.arena;
  const env = arena.environment!;
  // V10 adds independently tested counters and browsing anchors. Remove only
  // these additions before comparing the historical layout.
  env.zones = env.zones.filter((z) => !z.id.startsWith("street_market_"));
  env.clusters = env.clusters.filter((c) => !c.id.startsWith("street_market_"));
  env.props = env.props.filter((p) => !p.clusterId.startsWith("street_market_"));
  arena.cover = arena.cover!.filter((c) => !c.id.startsWith("street_market_"));
  // V9 partitions the utility parcel without changing its occupied ground union.
  // Rejoin it for the historical ground-layout checksum (new partition tested separately).
  const lofts = env.structures.filter((s) => s.id.startsWith("building_3_loft_"));
  if (lofts.length) {
    const front = env.structures.find((s) => s.id === "building_3")!;
    const rs = [front, ...lofts].map((s) => s.rect);
    const x = Math.min(...rs.map((r) => r.x)),
      y = Math.min(...rs.map((r) => r.y));
    front.rect = {
      x,
      y,
      width: Math.max(...rs.map((r) => r.x + r.width)) - x,
      height: Math.max(...rs.map((r) => r.y + r.height)) - y,
    };
    env.structures = env.structures.filter((s) => !s.id.startsWith("building_3_loft_"));
  }
  const dressing = withoutLamp
    ? env.dressing.filter((d) => d.clusterId !== "shop_lamp")
    : env.dressing;
  const clusters = withoutLamp ? env.clusters.filter((c) => c.id !== "shop_lamp") : env.clusters;
  const geometry = {
    zones: env.zones,
    structures: env.structures.map((s) => ({
      ...s,
      height:
        env.recipeVersion >= 8
          ? ((
              { building_0: 4, building_0_middle: 3.5, building_0_rear: 4 } as Record<
                string,
                number
              >
            )[s.id] ?? s.height)
          : s.height,
    })),
    entrances: env.entrances,
    props: env.props,
    cover: arena.cover,
    actors: scene.actors,
    start: arena.playerStart,
    slots: arena.hostileSlots,
    extent: arena.extent,
    dressing,
    clusters,
    composition: env.composition,
  };
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").slice(0, 16);
};

const REFERENCE = [1, 2, 3];
const SEEDS = Array.from({ length: 120 }, (_, i) => i);

describe("recipe revision 7: the shop lamp", () => {
  it("keeps the accepted seeds 1-3 exactly as they were, with no lamp and still v5", () => {
    for (const seed of REFERENCE) {
      const env = composeScene("intersection", seed).layout.arena.environment!;
      expect(env.recipeVersion).toBe(5);
      expect(env.dressing.some((d) => d.clusterId === "shop_lamp")).toBe(false);
      expect(geometryHash(seed, false)).toBe(BEFORE_REVISION_7[seed]);
    }
  });

  it("preserves the pinned ground layout, accounting for the v8 commercial heights", () => {
    for (const seed of Object.keys(BEFORE_REVISION_7).map(Number))
      expect(geometryHash(seed, true), `seed ${seed}`).toBe(BEFORE_REVISION_7[seed]);
  });

  it("keeps one lamp beside the shop in current recipes", () => {
    for (const seed of SEEDS.filter((s) => !REFERENCE.includes(s))) {
      const arena = composeScene("intersection", seed).layout.arena;
      const env = arena.environment!;
      expect(env.recipeVersion).toBe(seed === 8 ? 12 : 10);
      expect(arena.key).toContain(seed === 8 ? ":v12:" : ":v10:");
      const lamps = env.dressing.filter((d) => d.clusterId === "shop_lamp");
      expect(lamps, `seed ${seed}`).toHaveLength(1);
      const lamp = lamps[0]!;
      expect(lamp.kind).toBe("lamp");
      const shop = env.structures.find((s) => s.attachments?.some((a) => a.id === "shop-canopy"))!;
      const entrance = env.entrances!.find((e) => e.structureId === shop.id)!;
      expect(
        Math.hypot(lamp.position.x - entrance.position.x, lamp.position.y - entrance.position.y),
      ).toBeLessThan(4);
      // on a sidewalk, clear of every reservation, structure and prop
      const zone = env.zones.find(
        (z) => z.id === env.clusters.find((c) => c.id === "shop_lamp")!.zoneId,
      )!;
      expect(zone.kind).toBe("sidewalk");
      const inside = (r: { x: number; y: number; width: number; height: number }) =>
        lamp.position.x > r.x &&
        lamp.position.x < r.x + r.width &&
        lamp.position.y > r.y &&
        lamp.position.y < r.y + r.height;
      expect(
        env.zones
          .filter((z) => ["aisle", "crosswalk", "intersection", "road"].includes(z.kind))
          .some((z) => inside(z.rect)),
      ).toBe(false);
      expect(env.structures.some((s) => inside(s.rect))).toBe(false);
      expect(arena.cover!.some((c) => inside(c.rect))).toBe(false);
    }
  });

  it("saves, reads back and loads like any other scene, and v6 snapshots still load", () => {
    const scene = composeScene("intersection", 7);
    const env = scene.layout.arena.environment!;
    const roundTripped = readSceneEnvironment(JSON.parse(JSON.stringify(env)), scene.layout.arena);
    expect(roundTripped.dressing.some((d) => d.id === "shop_lamp_detail_0")).toBe(true);
    // A v6 snapshot, as already saved: no lamp, recipe version 6.
    const frozen = JSON.parse(JSON.stringify(env));
    frozen.recipeVersion = 6;
    frozen.dressing = frozen.dressing.filter(
      (d: { clusterId: string }) => d.clusterId !== "shop_lamp",
    );
    frozen.clusters = frozen.clusters.filter((c: { id: string }) => c.id !== "shop_lamp");
    expect(readSceneEnvironment(frozen, scene.layout.arena).recipeVersion).toBe(6);
  });
});
