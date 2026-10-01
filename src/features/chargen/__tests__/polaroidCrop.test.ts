/**
 * The crop the file's print puts on a portrait. The portraits are composed with
 * the head at the top; centring them in a near-square window cut it off.
 */
import { describe, expect, it } from "vitest";
import { PHOTO_ANCHOR_Y, photoBoxAspect, visibleBand } from "../polaroidCrop";

describe("what of the portrait the print shows", () => {
  it("is close to square in the framed print, so a third of the picture is out of frame", () => {
    expect(photoBoxAspect(true)).toBeGreaterThan(0.95);
    expect(photoBoxAspect(true)).toBeLessThan(1.1);
    expect(photoBoxAspect(false)).toBe(1);
  });

  it("keeps the headroom and the shoulders, in the framed and the drawn print", () => {
    for (const framed of [true, false]) {
      const { top, bottom } = visibleBand(photoBoxAspect(framed));
      // The prompt leaves a hand's width above the hair; the crop may not eat it.
      expect(top, `framed ${framed}`).toBeLessThanOrEqual(0.03);
      // And the shoulders are in by the two-thirds line it composes for.
      expect(bottom, `framed ${framed}`).toBeGreaterThanOrEqual(0.62);
    }
  });

  it("is anchored high, not centred", () => {
    expect(PHOTO_ANCHOR_Y).toBeLessThan(15);
  });
});
