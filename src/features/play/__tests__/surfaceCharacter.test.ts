import { expect, it } from "vitest";
import { surfaceCoordinates, paintSurfaceCharacter } from "../courtyard/surfaceCharacter";

it("maps affine surface metres consistently across clipped pieces and resolutions", () => {
  for (const scale of [0.5, 1, 2]) {
    const basis = {
      origin: { x: 30 * scale, y: -45 * scale },
      u: { x: 12 * scale, y: 6 * scale },
      v: { x: 0, y: 15 * scale },
    };
    const point = {
      x: basis.origin.x + 7 * basis.u.x + 3 * basis.v.x,
      y: basis.origin.y + 7 * basis.u.y + 3 * basis.v.y,
    };
    expect(surfaceCoordinates([point], basis)[0]).toEqual({ x: 7, y: 3 });
  }
  expect(
    surfaceCoordinates([{ x: 1, y: 1 }], {
      origin: { x: 0, y: 0 },
      u: { x: 0, y: 0 },
      v: { x: 0, y: 0 },
    }),
  ).toEqual([]);
});

it("restores canvas state and deterministically paints a finite broad surface field", () => {
  const draw = () => {
    const calls: unknown[] = [];
    let depth = 0;
    const ctx = new Proxy(
      {},
      {
        get: (_, key) => {
          if (key === "save")
            return () => {
              depth++;
            };
          if (key === "restore")
            return () => {
              depth--;
            };
          if (key === "createLinearGradient")
            return (...args: number[]) => {
              calls.push(args);
              return { addColorStop: (...args: unknown[]) => calls.push(args) };
            };
          return (...args: unknown[]) => {
            expect(args.filter((a) => typeof a === "number").every(Number.isFinite)).toBe(true);
            calls.push([key, ...args]);
          };
        },
        set: (_, key, value) => {
          calls.push([key, typeof value === "object" ? "gradient" : value]);
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    paintSurfaceCharacter(
      ctx,
      [
        { x: 0, y: -90 },
        { x: 150, y: -15 },
        { x: 150, y: 60 },
        { x: 0, y: -15 },
      ],
      { origin: { x: 0, y: -60 }, u: { x: 15, y: 7.5 }, v: { x: 0, y: 15 } },
      "painted-render",
      4,
    );
    expect(depth).toBe(0);
    expect(calls.length).toBeGreaterThan(20);
    expect(calls.length).toBeLessThan(3000);
    return calls;
  };
  expect(draw()).toEqual(draw());
});
