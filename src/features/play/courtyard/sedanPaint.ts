/**
 * Body paint for the street sedan: the same painted car in a restrained palette, so a
 * street of them is not one beige car four times over.
 *
 * The art is Picasso's (`docs/street-props-pack.md`); nothing new is generated. A paint
 * is made from it by a MASK of its beige body paint and a recolour inside the mask:
 *
 *   - **The mask** is chromatic. Shading darkens the beige without turning it. So a
 *     pixel is paint when its hue is the paint's and its chroma, for its lightness, is
 *     what the paint's is at that lightness. Glass, tyres, trim, rubber, lamps,
 *     bullet holes and rust have another hue or another chroma and stay out. A 5 px
 *     median and a slight blur clean the mask's edge, so no speckle survives.
 *   - **The recolour** keeps each pixel's own luminance, in linear light, against the
 *     paint's. Every shade, scratch and streak of grime stays where it was; only the
 *     colour of the paint under it changes.
 *   - **A wreck keeps its art.** It is burned to bare metal, so it has no paint left
 *     to recolour, and it is the same wreck whatever colour the car was.
 *
 * `tools/art/sedan-paint.ts` bakes the files; `sedanPaintFor` chooses one per car.
 * Presentation only: a paint never changes a section's footprint, cover, damage or
 * sorting.
 */

/** sRGB colours, 0-255. `beige` is the art as painted. */
export const SEDAN_PAINTS = {
  beige: undefined,
  burgundy: [112, 30, 40],
  // lighter than the asphalt (64, 64, 62) it parks on, so the silhouette holds at night
  charcoal: [92, 96, 102],
} as const;
export type SedanPaint = keyof typeof SEDAN_PAINTS;
/** Their order on a street: the first car keeps the art's own beige. */
export const SEDAN_PAINT_ORDER: readonly SedanPaint[] = ["beige", "burgundy", "charcoal"];

/** The painted beige, measured off the intact cabin's lit roof (CIE L*a*b*). */
export const BODY_PAINT = {
  hue: 82,
  /** Chroma over lightness at L* 75; it rises as the paint falls into shade. */
  chromaRatio: 0.31,
  chromaRatioSlope: 0.0055,
  /** The paint's own luminance (sRGB 188, 166, 128), against which a pixel is scaled. */
  srgb: [188, 166, 128] as const,
} as const;

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (v: number) => {
  const c = Math.max(0, Math.min(1, v));
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
};
const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** CIE L*a*b* (D65) of an sRGB colour. */
export function lab(r: number, g: number, b: number): [number, number, number] {
  const R = toLinear(r),
    G = toLinear(g),
    B = toLinear(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const ramp = (x: number, full: number, zero: number) =>
  Math.max(0, Math.min(1, (zero - x) / (zero - full)));

/** How much a pixel is body paint, 0-1, before the mask is cleaned. */
export function paintLikeness(r: number, g: number, b: number): number {
  const [L, A, B] = lab(r, g, b);
  const chroma = Math.hypot(A, B);
  const hue = (Math.atan2(B, A) * 180) / Math.PI;
  const expected = BODY_PAINT.chromaRatio + (75 - L) * BODY_PAINT.chromaRatioSlope;
  return (
    ramp(Math.abs(hue - BODY_PAINT.hue), 8, 16) *
    ramp(Math.abs(chroma / Math.max(L, 1) - expected), 0.1, 0.2) *
    Math.max(0, Math.min(1, (chroma - 5) / 4)) *
    Math.max(0, Math.min(1, (L - 30) / 10))
  );
}

/** A median over a (2r+1)² window, then a 3x3 binomial blur: the cleaned mask. */
function clean(mask: Float32Array, width: number, height: number, r = 2): Float32Array {
  const med = new Float32Array(mask.length);
  const window: number[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      window.length = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = Math.max(0, Math.min(width - 1, x + dx));
          const yy = Math.max(0, Math.min(height - 1, y + dy));
          window.push(mask[yy * width + xx]!);
        }
      window.sort((a, b) => a - b);
      med[y * width + x] = window[window.length >> 1]!;
    }
  const out = new Float32Array(mask.length);
  const k = [1, 2, 1];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.max(0, Math.min(width - 1, x + dx));
          const yy = Math.max(0, Math.min(height - 1, y + dy));
          sum += med[yy * width + xx]! * k[dx + 1]! * k[dy + 1]!;
        }
      out[y * width + x] = sum / 16;
    }
  return out;
}

/** The body-paint mask of an RGBA image (alpha ignored: the caller keeps it). */
export function bodyPaintMask(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number) {
  const raw = new Float32Array(width * height);
  for (let i = 0; i < raw.length; i++)
    raw[i] = rgba[i * 4 + 3]! ? paintLikeness(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!) : 0;
  return clean(raw, width, height);
}

/**
 * Repaint an RGBA image in place: inside the mask, the paint's colour at each pixel's
 * own luminance; outside it, the art untouched. Returns the mask's coverage of the
 * opaque pixels, for the baking tool to check.
 */
export function repaint(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  paint: SedanPaint,
): number {
  const target = SEDAN_PAINTS[paint];
  if (!target) return 0;
  const mask = bodyPaintMask(rgba, width, height);
  const [pr, pg, pb] = BODY_PAINT.srgb.map(toLinear) as [number, number, number];
  const base = luminance(pr, pg, pb);
  const t = target.map(toLinear) as [number, number, number];
  let covered = 0,
    opaque = 0;
  for (let i = 0; i < mask.length; i++) {
    if (rgba[i * 4 + 3]! > 128) {
      opaque++;
      if (mask[i]! > 0.5) covered++;
    }
    const m = mask[i]!;
    if (m <= 0) continue;
    const r = toLinear(rgba[i * 4]!),
      g = toLinear(rgba[i * 4 + 1]!),
      b = toLinear(rgba[i * 4 + 2]!);
    const k = luminance(r, g, b) / base;
    rgba[i * 4] = Math.round(toSrgb(r * (1 - m) + t[0] * k * m));
    rgba[i * 4 + 1] = Math.round(toSrgb(g * (1 - m) + t[1] * k * m));
    rgba[i * 4 + 2] = Math.round(toSrgb(b * (1 - m) + t[2] * k * m));
  }
  return opaque ? covered / opaque : 0;
}

/** The FNV-1a hash of a string, 0 to 2^32. */
function fnv(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * Each car's paint, from the saved layout alone: the cars (their clusters) sorted by
 * id, and the palette walked from an offset that is a hash of those ids and of where
 * the layout parked them (`salt`), so every street has more than one colour, two
 * variants that reuse the same cluster names are painted differently, the same street
 * is always painted the same, and both sections of a car (one cluster) share it in
 * either rotation and any damage.
 */
export function sedanPaints(clusterIds: readonly string[], salt = ""): Map<string, SedanPaint> {
  const ids = [...new Set(clusterIds)].sort();
  const offset = fnv(`${ids.join("|")}#${salt}`) % SEDAN_PAINT_ORDER.length;
  return new Map(
    ids.map((id, i) => [id, SEDAN_PAINT_ORDER[(i + offset) % SEDAN_PAINT_ORDER.length]!]),
  );
}

/** The texture key of a painted sedan section: the art's own key for beige. */
export const paintedTexture = (texture: string, paint: SedanPaint) =>
  paint === "beige" ? texture : `${texture}~${paint}`;

/** The salt for `sedanPaints`: where the layout parked each car, sorted. */
export const parkedAt = (rects: readonly { x: number; y: number }[]) =>
  rects
    .map((r) => `${r.x},${r.y}`)
    .sort()
    .join(";");
