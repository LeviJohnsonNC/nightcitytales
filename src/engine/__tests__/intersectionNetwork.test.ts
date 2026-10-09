import { expect, it } from "vitest";
import { composeScene, rectContains, rectsOverlap } from "../index";

it("connects every entrance and crossing through pedestrian space over 32 seeds", () => {
  for (let seed = 0; seed < 32; seed++) {
    const arena = composeScene("intersection", seed).layout.arena,
      env = arena.environment!;
    const pedestrian = env.zones.filter((z) => ["sidewalk", "crosswalk", "aisle"].includes(z.kind));
    const tiles = new Set<string>();
    let roadCells = 0;
    for (let y = 1; y < 32; y += 2)
      for (let x = 1; x < 32; x += 2) {
        const p = { x, y };
        if (env.zones.some((z) => z.kind === "road" && rectContains(z.rect, p))) roadCells++;
        if (
          pedestrian.some((z) => rectContains(z.rect, p)) &&
          ![...arena.cover!, ...env.structures].some((c) => rectContains(c.rect, p))
        )
          tiles.add(`${x},${y}`);
      }
    expect(roadCells / 256).toBeLessThan(0.4);
    const first = env.entrances![0]!.position;
    const queue = [first],
      seen = new Set([`${first.x},${first.y}`]);
    for (let i = 0; i < queue.length; i++)
      for (const [dx, dy] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ]) {
        const p = { x: queue[i]!.x + dx!, y: queue[i]!.y + dy! },
          key = `${p.x},${p.y}`;
        if (tiles.has(key) && !seen.has(key)) {
          seen.add(key);
          queue.push(p);
        }
      }
    for (const e of env.entrances!) expect(seen.has(`${e.position.x},${e.position.y}`)).toBe(true);
    const crossings = env.zones.filter((z) => z.kind === "crosswalk");
    expect(crossings).toHaveLength(4);
    for (const z of crossings)
      for (let x = z.rect.x + 1; x < z.rect.x + z.rect.width; x += 2)
        for (let y = z.rect.y + 1; y < z.rect.y + z.rect.height; y += 2)
          expect(seen.has(`${x},${y}`)).toBe(true);
    for (const route of env.zones.filter((z) => z.kind === "aisle")) {
      expect(arena.cover!.some((c) => rectsOverlap(c.rect, route.rect))).toBe(false);
      expect(env.structures.some((c) => rectsOverlap(c.rect, route.rect))).toBe(false);
    }
    // Pedestrian continuation reaches all four map boundaries, not just corner pads.
    for (const boundary of [
      (p: typeof first) => p.x === 1,
      (p: typeof first) => p.x === 31,
      (p: typeof first) => p.y === 1,
      (p: typeof first) => p.y === 31,
    ])
      expect(queue.some(boundary)).toBe(true);
  }
});

it("keeps the reviewed intersections within their previous furnishing budget", () => {
  for (const [seed, previousCount] of [
    [1, 28],
    [2, 29],
    [3, 23],
  ]) {
    const arena = composeScene("intersection", seed!).layout.arena;
    expect(arena.cover!.length).toBeLessThanOrEqual(previousCount!);
  }
});
