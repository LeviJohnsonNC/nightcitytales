import { expect, it } from "vitest";
import {
  composeScene,
  readSceneManifest,
  reachableTiles,
  tileKey,
  tileOf,
  rectInside,
  rectsOverlap,
  coverMaxHp,
  applyCoverDamage,
  blockedTiles,
} from "../index";
it("keeps residential front doors reachable and vehicles aligned with their curb or driveway", () => {
  const variants = new Set<string>();
  for (let seed = 0; seed < 32; seed++) {
    const scene = composeScene("residential", seed),
      arena = scene.layout.arena,
      env = arena.environment!;
    expect(readSceneManifest(JSON.parse(JSON.stringify({ version: 1, scene })))).toEqual(scene);
    expect(composeScene("residential", seed)).toEqual(scene);
    variants.add(JSON.stringify(env.zones));
    const reached = reachableTiles({
      arena,
      cover: {},
      from: tileOf(arena, arena.playerStart),
      allowance: 1000,
    });
    for (const p of [
      ...scene.actors.map((a) => a.position),
      ...env.entrances!.map((e) => e.position),
    ])
      expect(reached.has(tileKey(tileOf(arena, p)))).toBe(true);
    for (const cluster of env.clusters) {
      const zone = env.zones.find((z) => z.id === cluster.zoneId)!;
      const parts = env.props
        .filter((p) => p.clusterId === cluster.id)
        .map((p) => arena.cover!.find((c) => c.id === p.coverId)!);
      expect(parts.every((p) => rectInside(p.rect, zone.rect))).toBe(true);
      if (["parking", "driveway"].includes(cluster.kind)) {
        expect(zone.kind).toBe(cluster.kind === "parking" ? "parking" : "driveway");
        expect(parts).toHaveLength(2);
        expect(
          zone.axis === "x"
            ? parts[0]!.rect.y === parts[1]!.rect.y
            : parts[0]!.rect.x === parts[1]!.rect.x,
        ).toBe(true);
      }
    }
  }
  expect(variants.size).toBe(6);
});
it.each(["warehouse", "garage"] as const)(
  "keeps %s loading openings clear and working clusters in their context",
  (kind) => {
    for (const seed of [1, 2, 3]) {
      const arena = composeScene(kind, seed).layout.arena,
        env = arena.environment!;
      expect(
        env.clusters.some((c) => c.kind === (kind === "warehouse" ? "rack_aisle" : "service_bay")),
      ).toBe(true);
      expect(
        env.zones.some((z) => z.kind === "doorway" && (z.rect.width >= 8 || z.rect.height >= 8)),
      ).toBe(true);
      for (const cluster of env.clusters) {
        const zone = env.zones.find((z) => z.id === cluster.zoneId)!;
        if (cluster.kind === "rack_aisle") expect(zone.kind).toBe("storage");
        if (cluster.kind === "service_bay") expect(zone.kind).toBe("workbay");
        if (cluster.kind === "repair_support") expect(zone.kind).toBe("service");
      }
      for (const door of env.zones.filter((z) => z.kind === "doorway"))
        expect(arena.cover!.some((c) => rectsOverlap(c.rect, door.rect))).toBe(false);
    }
  },
);
it.each([1, 3])(
  "garage car sections retain independent HP and opened footprints after rotation %s",
  (seed) => {
    const arena = composeScene("garage", seed).layout.arena;
    const engine = arena.cover!.find((c) => c.id.endsWith("vehicle_engine"))!,
      cabin = arena.cover!.find((c) => c.id === engine.id.replace(/engine$/, "cabin"))!;
    expect(coverMaxHp(engine)).toBe(50);
    expect(coverMaxHp(cabin)).toBe(25);
    const damage = applyCoverDamage(cabin, {}, 100).damageMap;
    const key = (r: typeof engine.rect) => tileKey(tileOf(arena, { x: r.x + 1, y: r.y + 1 }));
    expect(blockedTiles(arena, damage).has(key(cabin.rect))).toBe(false);
    expect(blockedTiles(arena, damage).has(key(engine.rect))).toBe(true);
  },
);

it("gives low residential rows repeated arrivals and separates curb bays from travel", () => {
  for (let seed = 0; seed < 32; seed++) {
    const arena = composeScene("residential", seed).layout.arena;
    const env = arena.environment!;
    for (const id of ["house_0", "house_1", "house_3"]) {
      const entries = env.entrances!.filter((e) => e.structureId === id);
      expect(entries.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < entries.length; i++)
        for (let j = i + 1; j < entries.length; j++)
          expect(
            Math.hypot(
              entries[i]!.position.x - entries[j]!.position.x,
              entries[i]!.position.y - entries[j]!.position.y,
            ),
          ).toBeGreaterThanOrEqual(4);
    }
    expect(env.entrances!.filter((e) => e.structureId === "house_2")).toHaveLength(1);
    const travel = env.zones.find((z) => z.id === "travel-lane")!;
    const bays = env.zones.filter((z) => z.kind === "parking");
    expect(bays).toHaveLength(2);
    expect(env.clusters.filter((c) => c.kind === "parking")).toHaveLength(2);
    for (const bay of bays) {
      expect(rectsOverlap(bay.rect, travel.rect)).toBe(false);
      for (const z of env.zones.filter((z) => ["sidewalk", "driveway"].includes(z.kind)))
        expect(rectsOverlap(bay.rect, z.rect)).toBe(false);
      const walk = env.zones.find(
        (z) =>
          z.kind === "sidewalk" &&
          (bay.axis === "y"
            ? z.rect.x === bay.rect.x + bay.rect.width || z.rect.x + z.rect.width === bay.rect.x
            : z.rect.y === bay.rect.y + bay.rect.height || z.rect.y + z.rect.height === bay.rect.y),
      );
      expect(walk).toBeDefined();
    }
    expect(arena.cover!.some((c) => rectsOverlap(c.rect, travel.rect))).toBe(false);
  }
});
