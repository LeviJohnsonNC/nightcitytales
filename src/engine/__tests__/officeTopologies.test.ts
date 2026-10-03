import { describe, expect, it } from "vitest";
import { composeScene, rectsOverlap } from "../index";

const environment = (seed: number) => composeScene("office", seed).layout.arena.environment!;

describe("office programs", () => {
  it("offers a branch, a real corridor cycle, and a workspace hub", () => {
    const spine = environment(1),
      loop = environment(2),
      core = environment(3);
    const edges = (env: typeof spine) =>
      env.interior!.connections.filter((c) => c.to !== "outside");
    const rooms = (env: typeof spine) =>
      env.zones.filter((z) => !["aisle", "doorway"].includes(z.kind));
    expect(edges(spine).length).toBe(rooms(spine).length - 1);
    const corridors = new Set(loop.zones.filter((z) => z.kind === "corridor").map((z) => z.id));
    const ring = edges(loop).filter((c) => corridors.has(c.from) && corridors.has(c.to));
    expect(corridors.size).toBe(4);
    expect(ring).toHaveLength(4);
    for (const id of corridors)
      expect(ring.filter((c) => c.from === id || c.to === id)).toHaveLength(2);
    expect(core.zones.some((z) => z.kind === "corridor")).toBe(false);
    expect(edges(core).every((c) => c.from === "work" || c.to === "work")).toBe(true);
  });

  it("sizes support below visitor rooms and reserves the main arrival landing", () => {
    for (let seed = 0; seed < 32; seed++) {
      const arena = composeScene("office", seed).layout.arena,
        env = arena.environment!;
      const area = (id: string) => {
        const r = env.zones.find((z) => z.id === id)!.rect;
        return r.width * r.height;
      };
      expect(area("service")).toBeLessThanOrEqual(36);
      expect(area("service")).toBeLessThan(area("reception"));
      expect(area("work")).toBeGreaterThan(area("meeting"));
      const exits = env.interior!.connections.filter((c) => c.to === "outside");
      expect(exits.map((c) => c.from)).toEqual(["reception", "service"]);
      const landing = env.zones.find((z) => z.id === "entry_landing")!;
      expect(landing.rect.width * landing.rect.height).toBe(16);
      expect(arena.cover!.some((c) => rectsOverlap(c.rect, landing.rect))).toBe(false);
      expect(env.structures.some((c) => rectsOverlap(c.rect, landing.rect))).toBe(false);
    }
  });
});
