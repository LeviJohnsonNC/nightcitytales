import { describe, expect, it } from "vitest";
import {
  composeScene,
  readSceneManifest,
  readBattlefieldSnapshot,
  northHeywoodScene,
  blockedTiles,
  tileKey,
  tileOf,
  rectInside,
  rectsOverlap,
  shotObstacles,
  coverStatuses,
  hasLineOfSight,
  battlefieldProp,
  placeProp,
} from "../index";

describe("composed places", () => {
  it.each(["intersection", "alley"] as const)(
    "keeps %s clusters in their parcels, crossings clear, actors reachable and snapshots stable over 32 seeds",
    (kind) => {
      for (let seed = 0; seed < 32; seed++) {
        const scene = composeScene(kind, seed),
          arena = scene.layout.arena,
          env = arena.environment!;
        expect(scene.layout.version).toBe(2);
        expect(readSceneManifest(JSON.parse(JSON.stringify({ version: 1, scene })))).toEqual(scene);
        expect(composeScene(kind, seed)).toEqual(scene);
        expect(env.structures.length).toBeGreaterThanOrEqual(4);
        expect(env.dressing.length).toBeGreaterThan(10);
        for (const binding of env.props) {
          const piece = arena.cover!.find((c) => c.id === binding.coverId)!;
          const cluster = env.clusters.find((c) => c.id === binding.clusterId)!;
          expect(rectInside(piece.rect, env.zones.find((z) => z.id === cluster.zoneId)!.rect)).toBe(
            true,
          );
          expect(
            env.zones
              .filter((z) => ["intersection", "crosswalk"].includes(z.kind))
              .some((z) => rectsOverlap(z.rect, piece.rect)),
          ).toBe(false);
        }
        const blocked = blockedTiles(arena, {});
        for (const p of [arena.playerStart, ...scene.actors.map((a) => a.position)])
          expect(blocked.has(tileKey(tileOf(arena, p)))).toBe(false);
        expect(JSON.stringify(scene.layout).length).toBeLessThan(65536);
      }
    },
  );
  it("keeps cars parallel to the curb and beside their named rifleman", () => {
    const arena = composeScene("intersection").layout.arena;
    const engine = arena.cover!.find((c) => c.id === "thorton_car_engine")!;
    const cabin = arena.cover!.find((c) => c.id === "thorton_car_cabin")!;
    expect(engine.rect.x).toBe(cabin.rect.x);
    expect(cabin.rect.y - engine.rect.y).toBe(2);
    expect(arena.hostileSlots[0]).toEqual({ x: engine.rect.x + 3, y: engine.rect.y + 1 });
  });
  it("varies optional contents without moving required story objects", () => {
    const scenes = Array.from({ length: 8 }, (_, seed) => composeScene("intersection", seed));
    expect(
      new Set(scenes.map((s) => JSON.stringify(s.layout.arena.environment!.props))).size,
    ).toBeGreaterThan(1);
    for (const s of scenes)
      expect(s.layout.arena.cover!.find((c) => c.id === "thorton_car_engine")!.rect).toEqual({
        x: 20,
        y: 2,
        width: 2,
        height: 2,
      });
  });
  it("permanent buildings block movement and sight independently of cover damage", () => {
    const arena = composeScene("intersection").layout.arena;
    const from = { x: 1, y: 13 },
      to = { x: 9, y: 1 };
    const damage = Object.fromEntries(arena.cover!.map((p) => [p.id, 10000]));
    damage["building_0"] = 100000;
    expect(shotObstacles(arena, from, to, damage).map((o) => o.id)).toContain("building_0");
    expect(hasLineOfSight(arena, from, to, () => true)).toBe(false);
    expect(blockedTiles(arena, damage).has(tileKey(tileOf(arena, { x: 1, y: 1 })))).toBe(true);
    expect(coverStatuses(arena, damage).some((s) => s.piece.id === "building_0")).toBe(false);
  });
  it.each([
    "version",
    "missing-binding",
    "duplicate-binding",
    "overlap",
    "spawn",
    "zone",
    "unversioned",
  ])("fails closed on invalid composition: %s", (fault) => {
    const scene = composeScene("intersection"),
      layout = scene.layout,
      env = layout.arena.environment!;
    if (fault === "version") (env as { version: number }).version = 2;
    if (fault === "missing-binding") env.props.pop();
    if (fault === "duplicate-binding") env.props.push(env.props[0]!);
    if (fault === "overlap") env.structures[0]!.rect = { ...layout.arena.cover![0]!.rect };
    if (fault === "spawn") layout.arena.playerStart = { x: 1, y: 1 };
    if (fault === "zone") env.clusters[0]!.zoneId = "missing";
    if (fault === "unversioned") layout.version = 1;
    expect(() => readBattlefieldSnapshot(layout)).toThrow();
  });
  it("preserves version-one geometry and scenic dispatch", () => {
    const legacy = northHeywoodScene();
    expect(readSceneManifest({ version: 1, scene: legacy })).toEqual(legacy);
    expect(legacy.layout.version).toBe(1);
    expect(legacy.layout.arena.environment).toBeUndefined();
  });
  it("rotates cover sections without changing IDs or material rules", () => {
    const prop = battlefieldProp("sedan")!,
      at = { x: 2, y: 4 };
    const a = placeProp(prop, at, "car"),
      b = placeProp(prop, at, "car", 90);
    expect(b.map((p) => p.id)).toEqual(a.map((p) => p.id));
    expect(b.map((p) => p.rect)).toEqual([
      { x: 2, y: 4, width: 2, height: 2 },
      { x: 2, y: 6, width: 2, height: 2 },
    ]);
    expect(b.map((p) => [p.material, p.thickness])).toEqual(
      a.map((p) => [p.material, p.thickness]),
    );
  });
});
