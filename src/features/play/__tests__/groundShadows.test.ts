import { describe, expect, it } from "vitest";
import { comparePixels } from "../courtyard/groundShadows";

const px = (...rgb: number[][]) => rgb.flatMap(([r, g, b]) => [r!, g!, b!, 255]);

describe("ground shadows: what the board shows against a fresh render", () => {
  it("passes an exact match", () => {
    const a = px([10, 20, 30], [40, 50, 60]);
    expect(comparePixels(a, a, a)).toEqual({
      rounding: 0,
      roundingMax: 0,
      unexplained: 0,
      unexplainedMax: 0,
    });
  });

  it("allows only the standing value kept where the fresh render rounds below it", () => {
    const standing = px([11, 20, 30]);
    const shown = px([11, 20, 30]);
    const fresh = px([8, 20, 30]);
    expect(comparePixels(shown, fresh, standing)).toMatchObject({
      rounding: 1,
      roundingMax: 3,
      unexplained: 0,
    });
  });

  it("does not take a larger drop below standing as rounding", () => {
    // a wreck's render 4 levels below standing is a shadow the board failed to lift
    const standing = px([12, 20, 30]);
    expect(comparePixels(standing, px([8, 20, 30]), standing)).toMatchObject({
      rounding: 0,
      unexplained: 1,
      unexplainedMax: 4,
    });
    // the accepted ones are still counted beside it
    const two = px([12, 0, 0], [11, 0, 0]);
    expect(comparePixels(two, px([8, 0, 0], [8, 0, 0]), two)).toEqual({
      rounding: 1,
      roundingMax: 3,
      unexplained: 1,
      unexplainedMax: 4,
    });
  });

  it("counts every other difference as unexplained", () => {
    // too dark: the overlap #299 left shaded after both props were destroyed
    expect(comparePixels(px([40, 0, 0]), px([46, 0, 0]), px([40, 0, 0])).unexplained).toBe(1);
    // too bright
    expect(comparePixels(px([50, 0, 0]), px([46, 0, 0]), px([40, 0, 0])).unexplained).toBe(1);
    // below standing but not kept at it
    expect(comparePixels(px([9, 0, 0]), px([8, 0, 0]), px([11, 0, 0])).unexplained).toBe(1);
  });
});
