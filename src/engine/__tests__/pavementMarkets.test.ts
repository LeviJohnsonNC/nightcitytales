import { expect, it } from "vitest";
import v11 from "./fixtures/intersection-v11.json";
import { readSceneManifest } from "../persistentScene";
import { composeScene } from "../sceneComposer";
import { addPavementMarkets } from "../intersectionPrograms";
import { readBattlefieldSnapshot } from "../battlefieldSnapshot";
import { blockedTiles, reachableTiles, tileKey, tileOf } from "../grid";
import { coverMaxHp } from "../cover";
import { rectsOverlap } from "../sceneEnvironment";

it("preserves the accepted v11 market arrangement and other review seeds", () => {
  for (const seed of [8, 0, 7]) {
    const scene =
      seed === 8
        ? readSceneManifest({ version: 1, scene: structuredClone(v11) })
        : composeScene("intersection", seed);
    const arena = scene.layout.arena,
      env = arena.environment!;
    const props = env.props.filter((p) => p.clusterId.startsWith("street_market_"));
    expect(props).toHaveLength(3);
    expect(props.every((p) => p.art === "shop-display")).toBe(true);
    if (seed === 8)
      expect(arena.cover!.find((c) => c.id === props[0]!.coverId)!.rect).toEqual({
        x: 8,
        y: 4,
        width: 2,
        height: 2,
      });
    const saved = JSON.stringify(scene.layout);
    addPavementMarkets(arena, scene.actors);
    expect(JSON.stringify(scene.layout)).toBe(saved);
    expect(readBattlefieldSnapshot(JSON.parse(saved))).toEqual(scene.layout);
  }
});

it("keeps entrances, actors and browsing lanes reachable with intact and destroyed counters", () => {
  for (let seed = 0; seed < 64; seed++) {
    const scene = composeScene("intersection", seed),
      arena = scene.layout.arena;
    const env = arena.environment!;
    const counters = arena.cover!.filter((c) => c.id.startsWith("street_market_"));
    if ([1, 2, 3].includes(seed)) expect(counters).toHaveLength(0);
    for (const c of counters) {
      expect(c.maxHp).toBe(25);
      expect(env.structures.some((s) => rectsOverlap(s.rect, c.rect))).toBe(false);
      expect(
        env.zones
          .filter((z) => ["crosswalk", "aisle"].includes(z.kind))
          .some((z) => rectsOverlap(z.rect, c.rect)),
      ).toBe(false);
    }
    for (const damage of [{}, Object.fromEntries(counters.map((c) => [c.id, coverMaxHp(c)]))]) {
      const seen = reachableTiles({
        arena,
        cover: damage,
        from: tileOf(arena, arena.playerStart),
        allowance: 1000,
      });
      const blocked = blockedTiles(arena, damage);
      for (const point of [
        ...scene.actors.map((a) => a.position),
        ...env.entrances!.map((e) => e.position),
        ...env.zones
          .filter((z) => z.id.startsWith("street_market_"))
          .map((z) => ({ x: z.rect.x + 1, y: z.rect.y + 1 })),
      ]) {
        const key = tileKey(tileOf(arena, point));
        expect(blocked.has(key), `blocked seed ${seed}`).toBe(false);
        expect(seen.has(key), `unreachable seed ${seed}`).toBe(true);
      }
    }
  }
});
