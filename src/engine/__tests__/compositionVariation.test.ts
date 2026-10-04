import { expect, it } from "vitest";
import legacy from "./fixtures/composition-v4.json";
import {
  composeScene,
  readSceneManifest,
  reachableTiles,
  blockedTiles,
  tileOf,
  tileKey,
  coverMaxHp,
  rectsOverlap,
  attachmentPoint,
} from "../index";
import { compositionChoice, compositionSelection } from "../sceneComposition";
import { CLUSTERS } from "../sceneClusters";

it("loads actual pre-4D snapshots unchanged and preserves the accepted reference geometry", () => {
  for (const raw of legacy) {
    const old = readSceneManifest({ version: 1, scene: raw });
    expect(old).toEqual(raw);
    const e = old.layout.arena.environment!;
    const current = composeScene(e.recipe, e.seed);
    expect(current.actors).toEqual(old.actors);
    expect(current.layout.arena.cover).toEqual(old.layout.arena.cover);
    expect(current.layout.arena.playerStart).toEqual(old.layout.arena.playerStart);
    const {
      composition: _composition,
      recipeVersion: _version,
      ...geometry
    } = current.layout.arena.environment!;
    const { recipeVersion: _oldVersion, ...previous } = e;
    expect(geometry).toEqual(previous);
  }
});

it("isolates named choices and bounds the public seed input", () => {
  const before = Array.from({ length: 64 }, (_, seed) => compositionSelection("office", seed));
  for (let seed = 0; seed < 64; seed++)
    compositionChoice(seed, "new-unrelated-furniture-stream", 77);
  expect(Array.from({ length: 64 }, (_, seed) => compositionSelection("office", seed))).toEqual(
    before,
  );
  for (const seed of [-1, 1.5, NaN, 4294967296])
    expect(() => composeScene("office", seed)).toThrow();
});

it.each(["intersection", "office"] as const)(
  "preserves %s routes, groups, attachments and exact saves across 64 seeds",
  (kind) => {
    const structural = new Set<string>(),
      furnished = new Set<string>();
    for (const seed of [...Array.from({ length: 64 }, (_, i) => i), 0x7fffffff, 0xffffffff]) {
      const scene = composeScene(kind, seed),
        arena = scene.layout.arena,
        env = arena.environment!;
      expect(env.composition!.rejected, `${kind} seed ${seed}`).toEqual([]);
      if (kind === "office")
        expect(
          env.props.filter((p) => p.clusterId.startsWith("work_") && p.art.startsWith("desk")),
        ).toHaveLength(env.composition!.family === 1 ? 8 : 4);
      expect(composeScene(kind, seed)).toEqual(scene);
      expect(readSceneManifest(JSON.parse(JSON.stringify({ version: 1, scene })))).toEqual(scene);
      // Geometry-based signatures: discard IDs, labels, heights, dressing, seeds and transpose.
      const rotated = env.zones.find((z) => z.id === "street")?.axis === "x";
      const normalize = (r: { x: number; y: number; width: number; height: number }) =>
        rotated ? [r.y, r.x, r.height, r.width] : [r.x, r.y, r.width, r.height];
      const structures = env.structures
        .filter((s) => s.style !== "mesh-fence")
        .map((s) => [s.style, normalize(s.rect)])
        .sort();
      const rooms = env.zones
        .filter((z) => !["aisle", "doorway", "sidewalk", "crosswalk"].includes(z.kind))
        .map((z) => [z.kind, normalize(z.rect)])
        .sort();
      const signature = JSON.stringify([structures, rooms]);
      structural.add(signature);
      // Only functional work groups contribute to Office furnishing diversity, not detail scatter.
      const work = env.props
        .filter((p) => kind === "intersection" || p.clusterId.startsWith("work_"))
        .map((p) => [p.art, normalize(arena.cover!.find((c) => c.id === p.coverId)!.rect)])
        .sort();
      furnished.add(JSON.stringify([signature, work]));
      for (const damage of [
        {},
        Object.fromEntries(arena.cover!.map((c) => [c.id, coverMaxHp(c)])),
      ]) {
        const blocked = blockedTiles(arena, damage);
        const reachable = reachableTiles({
          arena,
          cover: damage,
          from: tileOf(arena, arena.playerStart),
          allowance: 1000,
        });
        for (const p of [
          ...scene.actors.map((a) => a.position),
          ...(env.entrances ?? []).map((e) => e.position),
          ...(env.interior?.access ?? []).map((a) => a.position),
        ]) {
          expect(blocked.has(tileKey(tileOf(arena, p))), `blocked ${kind}/${seed}`).toBe(false);
          expect(reachable.has(tileKey(tileOf(arena, p))), `unreachable ${kind}/${seed}`).toBe(
            true,
          );
        }
        for (const z of env.zones.filter((z) =>
          ["aisle", "doorway", "crosswalk", "corridor"].includes(z.kind),
        ))
          for (
            let y = Math.max(1, z.rect.y + 1);
            y < Math.min(arena.extent.height, z.rect.y + z.rect.height);
            y += 2
          )
            for (
              let x = Math.max(1, z.rect.x + 1);
              x < Math.min(arena.extent.width, z.rect.x + z.rect.width);
              x += 2
            ) {
              expect(blocked.has(tileKey(tileOf(arena, { x, y }))), `route ${z.id}/${seed}`).toBe(
                false,
              );
              expect(reachable.has(tileKey(tileOf(arena, { x, y })))).toBe(true);
            }
      }
      for (const s of env.structures)
        for (const a of s.attachments ?? []) {
          const point = attachmentPoint(s, a, a.span / 2);
          expect(Number.isFinite(point.x + point.y)).toBe(true);
          if (a.kind.endsWith("surround"))
            expect(
              env.entrances!.some(
                (e) => Math.hypot(e.position.x - point.x, e.position.y - point.y) <= 1.01,
              ),
            ).toBe(true);
        }
      for (const prop of arena.cover!)
        expect(env.structures.some((s) => rectsOverlap(s.rect, prop.rect))).toBe(false);
      if (kind === "office")
        expect(env.clusters.filter((c) => c.zoneId === "work" && c.kind !== "garden")).toHaveLength(
          2,
        );
      else
        for (const id of ["broth_cart", "housing_entry", "utility_waiting", "deliveries"])
          expect(env.clusters.some((c) => c.id === id)).toBe(true);
    }
    expect(structural.size).toBe(kind === "office" ? 3 : 6);
    expect(furnished.size).toBeGreaterThanOrEqual(6);
  },
);

it("falls back deterministically as a whole Office program when the preferred pods cannot fit", () => {
  const definition = CLUSTERS["work_pod"]!;
  const original = definition.members;
  try {
    definition.members = original.map((m) => ({ ...m, x: m.x + 100 }));
    const scene = composeScene("office", 4);
    expect(scene.layout.arena.environment!.composition).toMatchObject({
      family: 0,
      program: "opposed-pods",
      rejected: ["Required cluster cannot fit: work_0"],
    });
    expect(
      scene.layout.arena.environment!.clusters.filter(
        (c) => c.zoneId === "work" && c.kind !== "garden",
      ),
    ).toHaveLength(2);
    expect(composeScene("office", 4)).toEqual(scene);
    expect(readSceneManifest({ version: 1, scene })).toEqual(scene);
  } finally {
    definition.members = original;
  }
});

it("rejects missing or incompatible v5 provenance without regenerating the scene", () => {
  const scene = composeScene("office", 4);
  for (const choice of [
    undefined,
    { ...scene.layout.arena.environment!.composition, program: "shop-east" },
    { ...scene.layout.arena.environment!.composition, family: 20 },
  ]) {
    const raw = JSON.parse(JSON.stringify({ version: 1, scene }));
    raw.scene.layout.arena.environment.composition = choice;
    expect(() => readSceneManifest(raw)).toThrow();
  }
});
