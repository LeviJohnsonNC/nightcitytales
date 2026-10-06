/**
 * Contact shade: where a prop meets the ground, read from the prop's own picture.
 *
 * Presentation only, on intersection scenes. It replaces the flat footprint-sized
 * parallelogram the kit used to bake under every prop (and under every wreck, at the
 * same size), which read as a dark rectangle rather than as weight on the ground.
 *
 * For each column of the texture inside its registered 2 m footprint, the lowest
 * opaque pixel is where the object stands, if it is near the footprint's front edge:
 * a wheel, a plinth, a crate's base. A short soft fall of shade runs from there onto
 * the ground. A canopy or an overhang high above the ground is not a contact and casts
 * nothing here: this is contact shading, not a cast shadow, and there is no sun.
 *
 * Because it is made from the condition's own texture, a wreck's shade is the wreck's:
 * low, short and faint, never the intact object's. It is drawn by the board as its own
 * sprite under the prop, registered exactly as the prop is, at ground depth.
 */

export interface Registration {
  /** Where the footprint's front corner is, as fractions of the texture. */
  originX: number;
  originY: number;
  /** The footprint's width as a fraction of the texture's width. */
  groundWidth: number;
}

export interface ContactOptions {
  /** How dark the contact is at the object's foot. */
  strength: number;
}

/** A wreck lies on the ground: its contact is fainter than a standing object's. */
export const CONTACT = {
  intact: { strength: 0.85 },
  damaged: { strength: 0.85 },
  wrecked: { strength: 0.45 },
} as const;

/** The projection's ground slope: a metre across is 1/√3 of a metre down on screen. */
const SLOPE = 1 / Math.sqrt(3);

/**
 * The shade's alpha (0..1) for every pixel, from the texture's alpha. Pure: the
 * canvas work is the caller's.
 */
export function contactAlpha(
  alpha: Uint8ClampedArray | number[],
  width: number,
  height: number,
  reg: Registration,
  { strength }: ContactOptions,
  /** Rows of output below the texture, for the shade to fall into. */
  pad = 0,
): Float32Array {
  const rows = height + pad;
  const out = new Float32Array(width * rows);
  const gw = reg.groundWidth * width;
  const cx = reg.originX * width;
  const fy = reg.originY * height;
  // how far above the footprint's front edge a pixel may sit and still stand on it:
  // a body inset from its cell, a wheel arch; never a canopy or a raised awning
  const reach = gw * 0.2;
  // how far the shade falls below the foot: about 0.4 m of ground at the board's scale
  const fall = gw * 0.13;
  for (let x = 0; x < width; x++) {
    const dx = Math.abs(x + 0.5 - cx);
    if (dx > gw / 2) continue;
    const front = fy - dx * SLOPE;
    let foot = -1;
    for (let y = Math.min(height - 1, Math.floor(front + 2)); y >= 0; y--)
      if ((alpha[y * width + x] ?? 0) > 48) {
        foot = y;
        break;
      }
    if (foot < 0 || foot < front - reach) continue;
    // softer toward the footprint's sides, where a body curves away from the ground
    const side = 1 - Math.pow(dx / (gw / 2), 6);
    for (let y = Math.max(0, foot - 2); y < Math.min(rows, foot + fall); y++) {
      const t = (y - (foot - 2)) / (fall + 2);
      out[y * width + x] = strength * side * Math.pow(1 - t, 1.3);
    }
  }
  return out;
}

/**
 * Rows added under the texture for the shade to fall into: a texture whose bottom edge
 * is its footprint's front corner has no room below its foot otherwise.
 */
export function contactPad(width: number, reg: Registration) {
  return Math.ceil(reg.groundWidth * width * 0.16);
}

/**
 * The shade as a canvas as wide as the texture and `contactPad` rows taller, softened
 * a little sideways. Its top rows are the texture's: draw it with the prop's origin
 * scaled by height / (height + pad).
 */
export function contactCanvas(
  image: CanvasImageSource & { width: number; height: number },
  reg: Registration,
  options: ContactOptions,
): HTMLCanvasElement {
  const { width, height } = image;
  const read = document.createElement("canvas");
  read.width = width;
  read.height = height;
  const rc = read.getContext("2d", { willReadFrequently: true })!;
  rc.drawImage(image, 0, 0);
  const src = rc.getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = src[i * 4 + 3]!;
  const pad = contactPad(width, reg);
  const shade = contactAlpha(alpha, width, height, reg, options, pad);
  const raw = document.createElement("canvas");
  raw.width = width;
  raw.height = height + pad;
  const ctx = raw.getContext("2d")!;
  const data = ctx.createImageData(width, height + pad);
  for (let i = 0; i < shade.length; i++) {
    data.data[i * 4] = 6;
    data.data[i * 4 + 1] = 8;
    data.data[i * 4 + 2] = 10;
    data.data[i * 4 + 3] = Math.round(shade[i]! * 255);
  }
  ctx.putImageData(data, 0, 0);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height + pad;
  const oc = out.getContext("2d")!;
  oc.filter = `blur(${Math.max(1, reg.groundWidth * width * 0.012)}px)`;
  oc.drawImage(raw, 0, 0);
  return out;
}
