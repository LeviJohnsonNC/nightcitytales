import { expect, it } from "vitest";
import legacy from "./fixtures/composition-transfer-v4.json";
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
  type Rect,
} from "../index";
import { compositionChoice, compositionSelection } from "../sceneComposition";

const kinds = ["alley", "residential", "warehouse", "garage", "nightclub"] as const;
const seeds = [...Array.from({ length: 64 }, (_, i) => i), 0x7fffffff, 0xffffffff];

it("loads fifteen real pre-transfer saves unchanged and keeps every accepted reference layout", () => {
  for (const raw of legacy) {
    const saved = readSceneManifest({ version: 1, scene: raw });
    expect(saved).toEqual(raw);
    const e = saved.layout.arena.environment!;
    const current = composeScene(e.recipe, e.seed);
    expect(current.actors).toEqual(saved.actors);
    expect(current.layout.arena.cover).toEqual(saved.layout.arena.cover);
    expect(current.layout.arena.playerStart).toEqual(saved.layout.arena.playerStart);
    const {
      composition: _choices,
      recipeVersion: _version,
      ...geometry
    } = current.layout.arena.environment!;
    const { recipeVersion: _oldVersion, ...oldGeometry } = e;
    expect(geometry).toEqual(oldGeometry);
  }
});

it.each(kinds)(
  "%s provides real functional variation while preserving access, damage and exact saves",
  (kind) => {
    const signatures = new Set<string>();
    const programs = new Set<string>();
    for (const seed of seeds) {
      const scene = composeScene(kind, seed),
        arena = scene.layout.arena,
        env = arena.environment!;
      expect(env.composition!.rejected).toEqual([]);
      expect(composeScene(kind, seed)).toEqual(scene);
      expect(readSceneManifest(JSON.parse(JSON.stringify({ version: 1, scene })))).toEqual(scene);
      programs.add(`${env.composition!.family}/${env.composition!.program}`);
      // Do not count rotations, height, labels, provenance or incidental decoration.
      const transposed =
        env.zones.find((z) => z.id === (kind === "alley" ? "passage" : "street"))?.axis === "x";
      const rect = (r: Rect) =>
        transposed ? [r.y, r.x, r.height, r.width] : [r.x, r.y, r.width, r.height];
      const rooms = env.zones
        .filter((z) => !["aisle", "doorway"].includes(z.kind))
        .map((z) => [z.kind, rect(z.rect)])
        .sort();
      const functional = env.props
        .filter((p) => {
          const c = env.clusters.find((c) => c.id === p.clusterId)!;
          return [
            "workshop_delivery",
            "workshop_service",
            "parking",
            "driveway",
            "residential_entry",
            "rack_aisle",
            "service_bay",
            "lounge_bench",
            "lounge_conversation",
          ].includes(c.kind);
        })
        .map((p) => [p.art, rect(arena.cover!.find((c) => c.id === p.coverId)!.rect)])
        .sort();
      signatures.add(JSON.stringify([rooms, functional]));
      if (kind === "garage")
        expect(env.clusters.filter((c) => c.kind === "service_bay")).toHaveLength(2);
      if (kind === "nightclub")
        expect(env.clusters.filter((c) => c.zoneId === "seating").length).toBeGreaterThanOrEqual(2);
      if (kind === "alley")
        for (const group of ["workshop_delivery", "workshop_service"])
          expect(env.clusters.filter((c) => c.kind === group)).toHaveLength(2);
      if (kind === "residential") expect(env.entrances).toHaveLength(9);
      for (const damage of [
        {},
        Object.fromEntries(arena.cover!.map((c) => [c.id, 1])),
        Object.fromEntries(arena.cover!.map((c) => [c.id, coverMaxHp(c)])),
      ]) {
        const blocked = blockedTiles(arena, damage);
        const reached = reachableTiles({
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
          expect(
            blocked.has(tileKey(tileOf(arena, p))),
            `${kind}/${seed} blocked actor or access`,
          ).toBe(false);
          expect(
            reached.has(tileKey(tileOf(arena, p))),
            `${kind}/${seed} disconnected actor or access`,
          ).toBe(true);
        }
        for (const z of env.zones.filter((z) => ["aisle", "corridor", "doorway"].includes(z.kind)))
          for (
            let x = Math.max(1, z.rect.x + 1);
            x < Math.min(arena.extent.width, z.rect.x + z.rect.width);
            x += 2
          )
            for (
              let y = Math.max(1, z.rect.y + 1);
              y < Math.min(arena.extent.height, z.rect.y + z.rect.height);
              y += 2
            ) {
              expect(
                blocked.has(tileKey(tileOf(arena, { x, y }))),
                `${kind}/${seed} obstructed ${z.id}`,
              ).toBe(false);
              expect(
                reached.has(tileKey(tileOf(arena, { x, y }))),
                `${kind}/${seed} disconnected ${z.id}`,
              ).toBe(true);
            }
      }
      for (const s of env.structures)
        for (const a of s.attachments ?? []) {
          const p = attachmentPoint(s, a, a.span / 2);
          expect(
            env.entrances!.some((e) => Math.hypot(e.position.x - p.x, e.position.y - p.y) <= 1.01),
          ).toBe(true);
        }
      for (const c of arena.cover!)
        expect(env.structures.some((s) => rectsOverlap(s.rect, c.rect))).toBe(false);
    }
    expect(programs.size).toBe(6);
    // Residential family 2 is the rotated family 0: four genuine arrangements, not six.
    expect(signatures.size).toBe(kind === "residential" ? 4 : 6);
  },
);

it.each(kinds)(
  "%s keeps named streams independent and rejects incompatible saved choices",
  (kind) => {
    const before = seeds.map((seed) => compositionSelection(kind, seed));
    seeds.forEach((seed) => compositionChoice(seed, "unrelated-future-art-stream", 31));
    expect(seeds.map((seed) => compositionSelection(kind, seed))).toEqual(before);
    const scene = composeScene(kind, 4);
    for (const choice of [
      undefined,
      { ...scene.layout.arena.environment!.composition, program: "parallel-pods" },
      { ...scene.layout.arena.environment!.composition, activity: "office" },
    ]) {
      const raw = JSON.parse(JSON.stringify({ version: 1, scene }));
      raw.scene.layout.arena.environment.composition = choice;
      expect(() => readSceneManifest(raw)).toThrow();
    }
  },
);
