import { describe, expect, it } from "vitest";
import { composeScene, type Point, type Rect } from "@/engine";
import { streetLife } from "../courtyard/streetLife";

const inside = (p: Point, r: Rect) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

describe("flush street details", () => {
  it("keeps crossings and entrances clear and leaves saved geometry unchanged across seeds", () => {
    for (const seed of [0, 7, 8, 12, 19, 40]) {
      const arena = composeScene("intersection", seed).layout.arena;
      const before = JSON.stringify(arena);
      const env = arena.environment!;
      const details = streetLife(arena);
      expect(details).toEqual(streetLife(arena));
      expect(details.covers.length).toBeGreaterThan(0);
      expect(details.channels.length).toBeGreaterThan(0);
      expect(details.scraps.length).toBeLessThan(100);
      for (const cover of details.covers) {
        expect(env.zones.some((z) => z.kind === "road" && inside(cover.at, z.rect))).toBe(true);
        expect(
          env.zones.some(
            (z) =>
              (z.kind === "crosswalk" || z.kind === "intersection") && inside(cover.at, z.rect),
          ),
        ).toBe(false);
      }
      for (const { a, b, inward: n } of details.channels) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const pavement = { x: mid.x - n.x * 0.2, y: mid.y - n.y * 0.2 };
        expect(env.zones.some((z) => z.kind === "sidewalk" && inside(pavement, z.rect))).toBe(true);
        expect(
          env.zones.some(
            (z) => (z.kind === "crosswalk" || z.kind === "intersection") && inside(mid, z.rect),
          ),
        ).toBe(false);
      }
      for (const { at } of details.scraps) {
        expect(env.zones.some((z) => z.kind === "sidewalk" && inside(at, z.rect))).toBe(true);
        expect(env.structures.some((s) => s.style !== "mesh-fence" && inside(at, s.rect))).toBe(
          false,
        );
        expect(
          (env.entrances ?? []).every(
            (e) => Math.hypot(at.x - e.position.x, at.y - e.position.y) > 1.25,
          ),
        ).toBe(true);
      }
      expect(JSON.stringify(arena)).toBe(before);
    }
  });
  it("adds nothing to interior environments", () => {
    expect(streetLife(composeScene("office", 8).layout.arena)).toEqual({
      channels: [],
      covers: [],
      scraps: [],
      pads: [],
    });
  });
});
