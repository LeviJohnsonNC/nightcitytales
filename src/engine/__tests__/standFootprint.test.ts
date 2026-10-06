import { describe, expect, it } from "vitest";
import {
  composeScene,
  coverMaxHp,
  pathTo,
  reachableTiles,
  tileKey,
  tileOf,
  type Point,
} from "@/engine";

/**
 * The shop's merchandise stand (`utility_waiting_display_cabinet`) at r0 (seed 7) and
 * r90 (seed 0): a body cannot walk through it while it stands, and walks straight
 * across its square once it is destroyed. The art swap (round two) is presentation;
 * this holds the rule it must not have changed.
 */
const CASES = [
  { seed: 7, beside: { x: 27, y: 23 }, across: { x: 31, y: 27 } },
  { seed: 0, beside: { x: 23, y: 27 }, across: { x: 27, y: 31 } },
] as const;

describe("the merchandise stand's footprint", () => {
  for (const c of CASES) {
    it(`seed ${c.seed}: is walked round while it stands and through once destroyed`, () => {
      const arena = composeScene("intersection", c.seed).layout.arena;
      const stand = arena.cover!.find((p) => p.id === "utility_waiting_display_cabinet")!;
      const square = tileKey(tileOf(arena, { x: stand.rect.x + 1, y: stand.rect.y + 1 }));
      const route = (cover: Record<string, number>) => {
        const field = reachableTiles({ arena, cover, from: tileOf(arena, c.beside), allowance: 8 });
        const to = tileOf(arena, c.across as Point);
        return { path: pathTo(field, to)!.map(tileKey), cost: field.get(tileKey(to))!.cost };
      };
      const intact = route({});
      const destroyed = route({ [stand.id]: coverMaxHp(stand) });
      expect(intact.path).not.toContain(square);
      expect(destroyed.path).toContain(square);
      // two diagonal steps straight across the cleared square
      expect(destroyed.cost).toBe(3);
      expect(intact.cost).toBeGreaterThan(destroyed.cost);
    });
  }
});
