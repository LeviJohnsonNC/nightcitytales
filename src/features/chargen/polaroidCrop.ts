/**
 * Where the photo sits in the print, and what of the portrait that leaves.
 *
 * The window cut in `file-polaroid` is nearly square and the portraits are
 * 2:3, so `object-cover` has to throw a third of the picture away. From the
 * centre that was the top of the head and the chin; the picture is composed
 * with the head at the top (see the framing line in `portraitPrompt`), so the
 * crop is anchored there instead. Pure, so a test can hold the numbers.
 */
import { PORTRAIT_SIZE } from "./portraitPrompt";

/** The uploaded print, in pixels, and its window as percentages of it. */
export const POLAROID_IMAGE = { width: 640, height: 772 };
export const POLAROID_WINDOW = { top: 11.07, left: 6.79, width: 86.21, height: 69.2 };
/** The photo runs a little past the window so the painted edge frames it. */
export const WINDOW_BLEED = 1.2;

/** Where the crop is anchored, as CSS `object-position` y: 0 is the top edge. */
export const PHOTO_ANCHOR_Y = 5;

/** Width over height of the box the photo fills, with the bleed. */
export function photoBoxAspect(framed: boolean): number {
  if (!framed) return 1;
  const w = ((POLAROID_WINDOW.width + 2 * WINDOW_BLEED) / 100) * POLAROID_IMAGE.width;
  const h = ((POLAROID_WINDOW.height + 2 * WINDOW_BLEED) / 100) * POLAROID_IMAGE.height;
  return w / h;
}

/**
 * The slice of the portrait, top to bottom as fractions of its height, that
 * `object-cover` shows in a box of this aspect with the anchor above.
 */
export function visibleBand(boxAspect: number): { top: number; bottom: number } {
  const imageAspect = PORTRAIT_SIZE.width / PORTRAIT_SIZE.height;
  const shown = Math.min(1, imageAspect / boxAspect);
  const top = (1 - shown) * (PHOTO_ANCHOR_Y / 100);
  return { top, bottom: top + shown };
}
