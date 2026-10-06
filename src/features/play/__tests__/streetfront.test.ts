import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import { BAY } from "../courtyard/architecturePack";
import { facadeOpenings } from "../courtyard/architectureArt";
import { frontagePilot } from "../courtyard/composedEnvironment";
import { NEIGHBOUR_FACE } from "../courtyard/frontage";
import { storefrontFor } from "../courtyard/storefront";
import {
  composedBays,
  neighbourFronts,
  NEIGHBOUR_FRONT,
  RETURN,
  shopReturns,
} from "../courtyard/streetfront";

const scene = (seed: number) => {
  const arena = composeScene("intersection", seed).layout.arena;
  const env = arena.environment!;
  const storefronts = env.structures.flatMap((s) => {
    const sf = storefrontFor(s, env, arena.cover ?? []);
    return sf ? [sf] : [];
  });
  return { env, storefronts };
};

describe("the shop's other faces", () => {
  it("seed 0: the shopfront faces away, so its long side shows the shop", () => {
    const { env, storefronts } = scene(0);
    expect(storefronts).toEqual([]);
    const [face, ...rest] = shopReturns(env);
    expect(rest).toEqual([]);
    expect(face!.structure.id).toBe("building_0");
    expect(face!.edge).toBe("east");
    // the two bays nearest the corner the awning is on (s = 20), and nothing else
    expect(face!.display).toEqual([12.5, 15.5]);
    expect(face!.grille).toBe(0.5);
    expect(face!.duct).toBeGreaterThan(9.5 + BAY.width);
    expect(face!.duct).toBeLessThan(12.5);
  });

  it("seed 7: the shop turns its corner with one display bay", () => {
    const { env } = scene(7);
    const [face] = shopReturns(env);
    expect(face!.edge).toBe("east");
    expect(face!.display).toEqual([0.5]);
    expect(face!.store).toEqual([3.5]);
    expect(face!.grille).toBeUndefined();
  });

  it("seed 8: the shop's other face is behind its neighbour, so nothing is composed", () => {
    expect(shopReturns(scene(8).env)).toEqual([]);
  });

  for (const seed of [7, 0, 8])
    it(`seed ${seed}: composes only the saved bays, and fits under the roof`, () => {
      const { env } = scene(seed);
      for (const face of shopReturns(env)) {
        const { bays, doors } = facadeOpenings(face.structure, env.entrances, face.edge);
        expect(doors).toEqual([]);
        for (const b of [...composedBays(face), ...face.store]) expect(bays).toContain(b);
        expect(new Set([...face.display, ...face.store]).size).toBe(
          face.display.length + face.store.length,
        );
        // the extract stands on a pier, clear of every bay
        if (face.duct !== undefined)
          for (const b of bays) {
            const half = RETURN.duct.width / 2;
            expect(face.duct + half <= b || face.duct - half >= b + BAY.width).toBe(true);
          }
        const sign = face.sign!;
        expect(sign.s0).toBeGreaterThanOrEqual(0);
        expect(sign.s1).toBeLessThanOrEqual(face.length);
        expect(RETURN.sign.z0 + RETURN.sign.height).toBeLessThan(face.structure.height);
        expect(RETURN.course).toBeGreaterThan(BAY.head);
      }
    });

  it("is the same every time", () => {
    expect(shopReturns(scene(0).env)).toEqual(shopReturns(scene(0).env));
  });
});

describe("the neighbours' frontage", () => {
  const fronts = (seed: number) => {
    const { env, storefronts } = scene(seed);
    const sf = storefronts[0]!;
    const pilot = frontagePilot(sf, env.structures, env.entrances);
    const pipeAt = (s: (typeof env.structures)[number], e: "north" | "east") =>
      pilot.pipes.find((p) => p.structure === s && p.edge === e)?.s;
    return {
      pipeAt,
      faces: neighbourFronts(pilot.neighbours, env.structures, pipeAt, {
        structure: sf.structure,
        edge: sf.edge,
      }),
    };
  };

  for (const seed of [7, 8])
    it(`seed ${seed}: one board, on a face tall enough, clear of the pipe and the windows`, () => {
      const { faces, pipeAt } = fronts(seed);
      const boards = faces.filter((f) => f.board);
      expect(boards).toHaveLength(1);
      const f = boards[0]!;
      expect(f.board!.s0).toBeGreaterThanOrEqual(f.span[0]);
      expect(f.board!.s1).toBeLessThanOrEqual(f.span[1]);
      expect(NEIGHBOUR_FRONT.board.z0 + NEIGHBOUR_FRONT.board.height).toBeLessThan(
        f.structure.height,
      );
      expect(NEIGHBOUR_FRONT.course).toBeGreaterThan(NEIGHBOUR_FACE.windowTop);
      const pipe = pipeAt(f.structure, f.edge);
      if (pipe !== undefined)
        expect(pipe < f.board!.s0 - 0.4 || pipe > f.board!.s1 + 0.4).toBe(true);
    });

  it("seed 8: the board continues the shop's own street line, at the end nearest it", () => {
    const f = fronts(8).faces.find((x) => x.board)!;
    expect(f.structure.id).toBe("building_0_rear");
    expect(f.edge).toBe("east");
    expect(f.board!.s1).toBeCloseTo(f.span[1] - 1);
  });
});
