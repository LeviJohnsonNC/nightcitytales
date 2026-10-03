import { expect, it } from "vitest";
import {
  composeScene,
  readSceneManifest,
  applyCoverDamage,
  coverStatuses,
  coverBlocking,
  blockedTiles,
  tileKey,
  tileOf,
} from "@/engine";
import legacy from "@/engine/__tests__/fixtures/composed-v1.json";
import { battlefieldProjection } from "../battlefieldProjection";
import { propPlacement, propCondition } from "../courtyard/propPresentation";
import { scenicTheme } from "../courtyard/scenicPresentation";
import { sceneryOccludes } from "../courtyard/sceneryOcclusion";

it("reads the actual published recipe-v1 scene unchanged rather than regenerating it", () => {
  expect(readSceneManifest(legacy)).toEqual(legacy.scene);
  expect(composeScene("intersection", 1).anchor).not.toBe(legacy.scene.anchor);
});
it.each([1, 3])(
  "keeps rotated section geometry, damage, art anchors and opened routes aligned (seed %s)",
  (seed) => {
    const scene = composeScene("intersection", seed),
      arena = scene.layout.arena;
    const engine = arena.cover!.find((c) => c.id === "thorton_car_engine")!;
    const cabin = arena.cover!.find((c) => c.id === "thorton_car_cabin")!;
    const binding = arena.environment!.props.find((p) => p.coverId === engine.id)!;
    const center = { x: engine.rect.x + 1, y: engine.rect.y + 1 };
    const step = binding.rotation === 90 ? { x: 2, y: 0 } : { x: 0, y: 2 };
    const from = { x: center.x - step.x, y: center.y - step.y },
      to = { x: center.x + step.x, y: center.y + step.y };
    const key = tileKey(tileOf(arena, center));
    expect(coverBlocking(arena, from, to, {}).map((c) => c.id)).toContain(engine.id);
    expect(blockedTiles(arena, {}).has(key)).toBe(true);
    const damage = applyCoverDamage(engine, {}, 1).damageMap;
    expect(propCondition(coverStatuses(arena, damage).find((s) => s.piece.id === engine.id)!)).toBe(
      "damaged",
    );
    const destroyed = applyCoverDamage(engine, damage, 1000).damageMap;
    const reloaded = readSceneManifest(JSON.parse(JSON.stringify({ version: 1, scene })));
    expect(reloaded).toEqual(scene);
    expect(blockedTiles(reloaded.layout.arena, destroyed).has(key)).toBe(false);
    expect(coverBlocking(arena, from, to, destroyed).map((c) => c.id)).not.toContain(engine.id);
    const statuses = coverStatuses(arena, destroyed);
    expect(propCondition(statuses.find((s) => s.piece.id === cabin.id)!)).toBe("intact");
    const { project } = battlefieldProjection(32, 32);
    const intact = propPlacement(
      coverStatuses(arena, {}).find((s) => s.piece.id === engine.id)!,
      project,
    );
    const wrecked = propPlacement(
      statuses.find((s) => s.piece.id === engine.id)!,
      project,
    );
    expect([wrecked.x, wrecked.y, wrecked.width, wrecked.groundDepth]).toEqual([
      intact.x,
      intact.y,
      intact.width,
      intact.groundDepth,
    ]);
    expect(wrecked.depth).toBeLessThan(intact.depth);
  },
);
it.each(["alley", "office", "nightclub"] as const)(
  "uses the shared renderer for %s with an unfamiliar location identifier",
  (kind) => {
    const arena = composeScene(kind).layout.arena;
    arena.key = "another-location-without-a-renderer-branch";
    expect(scenicTheme(arena)).toBe("composed");
  },
);
it("fades scenery for a partially overlapping silhouette but leaves foreground actors and absent units alone", () => {
  const prop = { x: 100, y: 200, depth: 220, displayWidth: 100, displayHeight: 100 };
  expect(sceneryOccludes(prop, { x: 155, y: 210, visible: true }, 48)).toBe(true);
  expect(sceneryOccludes(prop, { x: 100, y: 230, visible: true }, 48)).toBe(false);
  expect(sceneryOccludes(prop, { x: 100, y: 190, visible: false }, 48)).toBe(false);
});
