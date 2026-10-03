import { describe, it, expect } from "vitest";
import {
  composeScene,
  readBattlefieldSnapshot,
  readSceneManifest,
  blockedTiles,
  reachableTiles,
  tileKey,
  tileOf,
  doorwayApproaches,
  exteriorDoorwayApproaches,
  shotObstacles,
  rectsOverlap,
  coverMaxHp,
  walkToStructuralSight,
  structuresBetween,
} from "../index";

describe("shared interior composition", () => {
  it.each(["office", "nightclub", "warehouse", "garage"] as const)(
    "keeps %s rooms, opening approaches and working spaces reachable over 32 seeds",
    (kind) => {
      const organizations = new Set<string>();
      for (let seed = 0; seed < 32; seed++) {
        const scene = composeScene(kind, seed),
          arena = scene.layout.arena,
          env = arena.environment!;
        expect(composeScene(kind, seed)).toEqual(scene);
        expect(readSceneManifest(JSON.parse(JSON.stringify({ version: 1, scene })))).toEqual(scene);
        expect(JSON.stringify(scene.layout).length).toBeLessThan(65536);
        organizations.add(JSON.stringify(env.zones));
        const reachable = reachableTiles({
          arena,
          cover: {},
          from: tileOf(arena, arena.playerStart),
          allowance: 1000,
        });
        for (const p of [
          ...scene.actors.map((a) => a.position),
          ...env.interior!.access.map((a) => a.position),
        ])
          expect(reachable.has(tileKey(tileOf(arena, p)))).toBe(true);
        for (const c of env.interior!.connections) {
          const z = env.zones.find((z) => z.id === c.zoneId)!,
            a = env.zones.find((z) => z.id === c.from)!,
            b = env.zones.find((z) => z.id === c.to)!;
          const approaches = b
            ? doorwayApproaches(z.rect, a.rect, b.rect)
            : exteriorDoorwayApproaches(z.rect, a.rect, arena.extent);
          expect(approaches.every((p) => reachable.has(tileKey(tileOf(arena, p))))).toBe(true);
          expect(shotObstacles(arena, approaches[0]!, approaches.at(-1)!, {})).toEqual([]);
        }
        for (const z of env.zones.filter((z) => ["dance", "corridor", "doorway"].includes(z.kind)))
          expect(arena.cover!.some((c) => rectsOverlap(z.rect, c.rect))).toBe(false);
        for (const c of env.clusters.filter((c) =>
          ["bar", "reception", "meeting"].includes(c.kind),
        ))
          expect(env.interior!.access.filter((a) => a.id.startsWith(c.id + "_access")).length).toBe(
            2,
          );
      }
      expect(organizations.size).toBe(3);
    },
  );
  it.each([
    "missing-connection",
    "wrong-room",
    "moved-door",
    "blocked-approach",
    "erased-wall",
    "missing-access",
    "off-grid-access",
    "duplicate-room",
  ])("rejects saved interior corruption: %s", (fault) => {
    const layout = composeScene("office").layout,
      env = layout.arena.environment!;
    if (fault === "missing-connection") env.interior!.connections.pop();
    if (fault === "wrong-room") env.interior!.connections[0]!.to = "service";
    if (fault === "moved-door") env.zones.find((z) => z.kind === "doorway")!.rect.y += 2;
    if (fault === "blocked-approach") {
      const p = env.interior!.access[0]!.position;
      layout.arena.cover![0]!.rect = { x: p.x - 1, y: p.y - 1, width: 2, height: 2 };
    }
    if (fault === "erased-wall") env.structures.pop();
    if (fault === "missing-access")
      env.interior!.access = env.interior!.access.filter((a) => a.zoneId !== "meeting");
    if (fault === "off-grid-access") env.interior!.access[0]!.position.x += 1;
    if (fault === "duplicate-room") env.zones.push({ ...env.zones[0]!, id: "duplicate" });
    // Moving a door within the same legal connection is valid; move it into the solid outer wall instead.
    if (fault === "moved-door") env.zones.find((z) => z.kind === "doorway")!.rect.y = 0;
    expect(() => readBattlefieldSnapshot(layout)).toThrow();
  });
  it("keeps walls permanent while destroying furniture opens only its own tile", () => {
    const arena = composeScene("office").layout.arena,
      env = arena.environment!;
    const piece = arena.cover![0]!,
      point = { x: piece.rect.x + 1, y: piece.rect.y + 1 },
      key = tileKey(tileOf(arena, point));
    expect(blockedTiles(arena, {}).has(key)).toBe(true);
    const damage = Object.fromEntries([
      ...arena.cover!.map((c) => [c.id, coverMaxHp(c)]),
      ...env.structures.map((w) => [w.id, 999999]),
    ]);
    expect(blockedTiles(arena, damage).has(key)).toBe(false);
    const from = { x: 9, y: 3 },
      to = { x: 13, y: 3 };
    expect(shotObstacles(arena, from, to, damage).some((o) => o.id.startsWith("wall_"))).toBe(true);
    expect(blockedTiles(arena, damage).has(tileKey(tileOf(arena, { x: 11, y: 3 })))).toBe(true);
  });
});

it.each(["office", "nightclub", "warehouse", "garage"] as const)(
  "existing hostile movement finds firing lanes through %s openings",
  (kind) => {
    for (const seed of [1, 2, 3]) {
      const arena = composeScene(kind, seed).layout.arena;
      let from = arena.hostileSlots[0]!;
      for (let i = 0; i < 32 && structuresBetween(arena, from, arena.playerStart).length; i++) {
        const step = walkToStructuralSight({
          arena,
          cover: {},
          from,
          target: arena.playerStart,
          squares: 3,
          occupied: [arena.playerStart],
        });
        for (const point of step.path)
          expect(blockedTiles(arena, {}).has(tileKey(tileOf(arena, point)))).toBe(false);
        from = step.position;
      }
      expect(structuresBetween(arena, from, arena.playerStart)).toEqual([]);
    }
  },
);
