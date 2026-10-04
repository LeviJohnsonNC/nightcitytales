import { expect, it } from "vitest";
import {
  composeScene,
  readBattlefieldSnapshot,
  blockedTiles,
  tileKey,
  tileOf,
  reachableTiles,
  rectsOverlap,
  shotObstacles,
} from "../index";

it("defines the court without consuming its loading mouth, handling apron or rear lane", () => {
  for (let seed = 0; seed < 32; seed++) {
    const layout = composeScene("intersection", seed).layout;
    const arena = readBattlefieldSnapshot(JSON.parse(JSON.stringify(layout))).arena;
    const env = arena.environment!,
      fence = env.structures.find((s) => s.style === "mesh-fence")!;
    expect(fence).toBeDefined();
    expect(fence.blocksShots).toBe(false);
    const blocked = blockedTiles(arena, {});
    const reachable = reachableTiles({
      arena,
      cover: {},
      from: tileOf(arena, arena.playerStart),
      allowance: 1000,
    });
    const r = fence.rect,
      vertical = r.width < r.height;
    for (let t = 1; t < (vertical ? r.height : r.width); t += 2) {
      const p = vertical
        ? { x: r.x + r.width / 2, y: r.y + t }
        : { x: r.x + t, y: r.y + r.height / 2 };
      if (p.x < 32 && p.y < 32) expect(blocked.has(tileKey(tileOf(arena, p)))).toBe(true);
    }
    for (const id of [
      "loading-mouth",
      "workshop-handling",
      "workshop-unloading",
      "service-access",
      "walk-west-south",
    ]) {
      const z = env.zones.find((z) => z.id === id)!;
      expect(rectsOverlap(z.rect, r)).toBe(false);
      for (let x = z.rect.x + 1; x < Math.min(32, z.rect.x + z.rect.width); x += 2)
        for (let y = z.rect.y + 1; y < Math.min(32, z.rect.y + z.rect.height); y += 2)
          expect(reachable.has(tileKey(tileOf(arena, { x, y })))).toBe(true);
    }
    expect(env.props.some((p) => p.clusterId.startsWith("south-west-walk_infill"))).toBe(false);
    const from = vertical ? { x: r.x - 1, y: r.y + 1 } : { x: r.x + 1, y: r.y - 1 };
    const to = vertical
      ? { x: r.x + r.width + 1, y: r.y + 1 }
      : { x: r.x + 1, y: r.y + r.height + 1 };
    expect(shotObstacles(arena, from, to, {}).some((s) => s.id === fence.id)).toBe(false);
    // Positive control proves the ray actually crosses the fence in both orientations.
    fence.blocksShots = true;
    expect(shotObstacles(arena, from, to, {}).some((s) => s.id === fence.id)).toBe(true);
  }
});
it("rejects a fence that implies cover, misses tile centres or blocks a reserved route", () => {
  for (const mode of ["shots", "offset", "route"]) {
    const layout = composeScene("intersection", 1).layout;
    const f = layout.arena.environment!.structures.find((s) => s.style === "mesh-fence")!;
    if (mode === "shots") f.blocksShots = true;
    if (mode === "offset") f.rect.x = 8;
    if (mode === "route") f.rect.x = 10.75;
    expect(() => readBattlefieldSnapshot(layout)).toThrow();
  }
});
