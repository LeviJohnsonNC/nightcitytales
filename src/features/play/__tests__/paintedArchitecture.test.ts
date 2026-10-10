import { describe, expect, it } from "vitest";
import { facadeSlices, paintArchitecturalBay } from "../courtyard/paintedArchitecture";

describe("painted facade registration", () => {
  const outer = Object.freeze({ s0: 0, s1: 3.2, z0: 3.85, z1: 6.85 });
  const opening = Object.freeze({ s0: 0.72, s1: 2.48, z0: 4.45, z1: 6.1 });

  it("registers the artwork to the existing aperture without expanding it", () => {
    const slices = facadeSlices(outer, opening)!;
    expect(slices.x.slice(1, 3)).toEqual([opening.s0, opening.s1]);
    expect(slices.z.slice(1, 3)).toEqual([opening.z1, opening.z0]);
    expect(facadeSlices({ ...outer, s1: 2 }, opening)).toBeUndefined();
  });

  it("leaves the interior unpainted when a separately lit ground-floor bay owns it", () => {
    const draws: number[][] = [];
    let depth = 0;
    const ctx = {
      save: () => depth++,
      restore: () => depth--,
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1 }),
      transform: () => undefined,
      drawImage: (_image: unknown, ...args: number[]) => draws.push(args),
    } as unknown as CanvasRenderingContext2D;
    // Small image avoids requiring a DOM for prefiltering in this geometry test.
    const image = { width: 4, height: 4 } as HTMLCanvasElement;
    const at = (s: number, _out: number, z: number) => ({ x: s * 15, y: -z * 15 });
    expect(paintArchitecturalBay(ctx, image, at, outer, opening, "upper", true)).toBe(true);
    expect(draws).toHaveLength(8);
    for (const d of draws) {
      const [x, y, width, height] = d.slice(4) as [number, number, number, number];
      expect(
        x + width <= opening.s0 || x >= opening.s1 || y + height <= -opening.z1 || y >= -opening.z0,
      ).toBe(true);
    }
    expect(depth).toBe(0);
    expect(paintArchitecturalBay(ctx, undefined, at, outer, opening, "upper")).toBe(false);
  });
});
