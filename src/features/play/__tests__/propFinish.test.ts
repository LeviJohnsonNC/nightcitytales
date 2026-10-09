import { describe, expect, it } from "vitest";
import { finishPropPixels } from "../courtyard/propFinish";

describe("street prop material finish", () => {
  it("preserves alpha and transparent padding, without modifying its source", () => {
    const src = new Uint8ClampedArray([255, 210, 40, 255, 160, 170, 180, 82, 255, 0, 255, 0]);
    const saved = new Uint8ClampedArray(src);
    const out = finishPropPixels(src, 3, 1, true);
    expect(src).toEqual(saved);
    expect([out[3], out[7], out[11]]).toEqual([255, 82, 0]);
    expect(out.slice(8)).toEqual(src.slice(8));
    expect(out[0]).toBeLessThan(220);
    expect(out[0]).toBeGreaterThan(out[2]!);
  });
  it("retains dark silhouette edges against bright neighbouring faces", () => {
    const src = new Uint8ClampedArray([10, 10, 10, 255, 240, 240, 240, 255]);
    const out = finishPropPixels(src, 2, 1, false);
    expect(out[0]).toBeLessThanOrEqual(10);
    expect(out[4]).toBeGreaterThan(180);
    expect(out[4]).toBeLessThan(220);
    expect(finishPropPixels(src, 2, 1, false)).toEqual(out);
  });
});
