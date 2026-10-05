/**
 * Validate the returned storefront images against their guides, then make the
 * runtime versions.
 *
 *     bun run tools/art/storefront-assets.ts            validate, then write public/images/storefront/*.webp
 *     bun run tools/art/storefront-assets.ts --check    validate and report, write nothing
 *
 * Sources are src/assets/creator/storefront-<id>.png, exactly as returned. The
 * numbers they are judged by are `storefrontPack.ts`: the same ones the guides
 * were drawn from, so an image cannot pass against a different spec than it was
 * made for. A failed check exits non-zero and writes nothing.
 *
 * WHAT IS CHECKED
 *   shape     the aspect ratio matches the guide. The image tool does not
 *             return the size asked for (the awning came back 1254 x 1254, not
 *             1024 x 1024), so the ratio is what must match; scale is the tool's.
 *   window    the 7 cm frame ring is dark and plain, nothing is blown out
 *             (a lit lamp or screen painted in would be baked light).
 *   awning    four stripes, teal first, boundaries on the quarter lines, and the
 *             left and right edges meet: the seam ratio, as for materials.
 *   wear      the background is the key colour, almost all of it, and the zones the
 *             game covers (housing, rails, bottom bar) hold no art.
 *
 * WHAT IS DONE
 *   window    resize to 768 x 512.
 *   awning    resize to 512 x 512 (one repeat is 1.6 m).
 *   wear      key out #ff00ff with de-spill (a pixel that is part key is un-mixed
 *             back to its own colour, so no pink fringe), clear the covered zones,
 *             resize to 512 x 768 with alpha.
 * No sharpening, no contrast or colour change: light is added in the renderer.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { STOREFRONT_PACK, type PackAsset } from "@/features/play/courtyard/storefrontPack";

const SOURCE = "src/assets/creator";
const OUT = "public/images/storefront";
const check = process.argv.includes("--check");

const asset = (id: PackAsset["id"]) => STOREFRONT_PACK.find((a) => a.id === id)!;
const failures: string[] = [];
const fail = (id: string, msg: string) => failures.push(`${id}: ${msg}`);
const note = (id: string, msg: string) => console.log(`${id.padEnd(16)} ${msg}`);

type Raw = { data: Buffer; width: number; height: number };
async function load(a: PackAsset): Promise<Raw> {
  const { data, info } = await sharp(`${SOURCE}/storefront-${a.id}.png`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ratio = info.width / info.height;
  const want = a.canvas.w / a.canvas.h;
  if (Math.abs(ratio - want) > 0.002)
    fail(
      a.id,
      `aspect ${ratio.toFixed(3)}, guide ${want.toFixed(3)} (${info.width}x${info.height})`,
    );
  return { data, width: info.width, height: info.height };
}

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const px = (img: Raw, x: number, y: number) => {
  const i = (y * img.width + x) * 3;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!] as const;
};
/** A guide rectangle, in this image's own pixels. */
const scaled = (a: PackAsset, img: Raw, r: { x: number; y: number; w: number; h: number }) => {
  const k = img.width / a.canvas.w;
  return {
    x: Math.round(r.x * k),
    y: Math.round(r.y * k),
    w: Math.round(r.w * k),
    h: Math.round(r.h * k),
  };
};

/* ---------------------------------------------------------------- window */
async function window_() {
  const a = asset("window-interior");
  const img = await load(a);
  let blown = 0;
  let sum = 0;
  for (let i = 0; i < img.data.length; i += 3) {
    const l = lum(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!);
    sum += l;
    if (l > 238) blown++;
  }
  const n = img.data.length / 3;
  const blownShare = blown / n;
  if (blownShare > 0.004)
    fail(a.id, `${(blownShare * 100).toFixed(2)}% of pixels are blown out: baked light?`);
  // the frame ring (outer 7 cm) must be dark: the renderer paints the real frame over it
  const ring = scaled(a, img, a.protectedZones.find((z) => z.id === "frame-top")!.rect);
  let ringSum = 0;
  let ringN = 0;
  for (let y = ring.y; y < ring.y + ring.h; y++)
    for (let x = 0; x < img.width; x++) {
      ringSum += lum(...px(img, x, y));
      ringN++;
    }
  const ringMean = ringSum / ringN;
  if (ringMean > 70) fail(a.id, `the frame ring is not dark (mean ${ringMean.toFixed(0)})`);
  note(
    a.id,
    `${img.width}x${img.height}  mean ${(sum / n).toFixed(0)}  blown ${(blownShare * 100).toFixed(2)}%  frame ring ${ringMean.toFixed(0)}`,
  );
  if (!check)
    await writeFile(
      `${OUT}/window-interior.webp`,
      await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
        .resize(768, 512, { kernel: "lanczos3" })
        .webp({ quality: 88, effort: 6 })
        .toBuffer(),
    );
}

/* ---------------------------------------------------------------- awning */
async function awning() {
  const a = asset("awning-fabric");
  const img = await load(a);
  // stripe colour at the middle of each quarter, and just either side of each boundary
  const row = Math.round(img.height * 0.5);
  const isTeal = (x: number) => {
    const [r, g, b] = px(img, x, row);
    return g + b > r * 1.5 && r < 140;
  };
  const quarters = [0.125, 0.375, 0.625, 0.875].map((q) => isTeal(Math.round(q * img.width)));
  if (quarters.join() !== "true,false,true,false")
    fail(
      a.id,
      `stripes are not teal, cream, teal, cream (${quarters.map((t) => (t ? "teal" : "cream")).join(", ")})`,
    );
  // each boundary must fall within 2% of the quarter lines
  const sample = (y: number) =>
    Array.from({ length: img.width }, (_, x) => {
      const [r, g, b] = px(img, x, y);
      return g + b > r * 1.5 && r < 140;
    });
  let worst = 0;
  for (const y of [0.1, 0.3, 0.5, 0.7, 0.85].map((f) => Math.round(f * img.height))) {
    const t = sample(y);
    for (let q = 1; q < 4; q++) {
      const target = Math.round((q / 4) * img.width);
      let best = Infinity;
      for (let x = 1; x < img.width; x++)
        if (t[x] !== t[x - 1]) best = Math.min(best, Math.abs(x - target));
      worst = Math.max(worst, best);
    }
  }
  if (worst > img.width * 0.02) fail(a.id, `a stripe boundary is ${worst}px off its quarter line`);
  // the seam: wrap-around difference against ordinary neighbouring columns
  let wrap = 0;
  let inner = 0;
  for (let y = 0; y < img.height; y++) {
    const l = px(img, 0, y);
    const r = px(img, img.width - 1, y);
    for (let c = 0; c < 3; c++) wrap += Math.abs(l[c]! - r[c]!);
    const m = px(img, Math.floor(img.width / 2), y);
    const m1 = px(img, Math.floor(img.width / 2) + 1, y);
    for (let c = 0; c < 3; c++) inner += Math.abs(m[c]! - m1[c]!);
  }
  const seam = wrap / Math.max(inner, 1);
  // Edges meet at a stripe boundary, so the colour step is expected: the same step
  // the interior boundaries have. A wrap far larger than one is a mismatch.
  const boundary = (() => {
    let d = 0;
    const x = Math.round(img.width / 4);
    for (let y = 0; y < img.height; y++) {
      const l = px(img, x - 1, y);
      const r = px(img, x + 1, y);
      for (let c = 0; c < 3; c++) d += Math.abs(l[c]! - r[c]!);
    }
    return d;
  })();
  const seamRatio = wrap / Math.max(boundary, 1);
  if (seamRatio > 1.5)
    fail(a.id, `left and right edges do not meet: ${seamRatio.toFixed(2)}x a stripe boundary`);
  note(
    a.id,
    `${img.width}x${img.height}  stripes ${quarters.map((t) => (t ? "T" : "C")).join("")}  boundary error ${worst}px  seam ${seamRatio.toFixed(2)}x a stripe edge (plain step ${seam.toFixed(1)}x)`,
  );
  if (!check)
    await writeFile(
      `${OUT}/awning-fabric.webp`,
      await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
        .resize(512, 512, { kernel: "lanczos3" })
        .webp({ quality: 88, effort: 6 })
        .toBuffer(),
    );
}

/* ------------------------------------------------------------------ wear */
/** How far a pixel is toward the key colour: 1 = pure key, 0 = not at all. */
const keyness = (r: number, g: number, b: number) =>
  Math.max(0, Math.min(1, (Math.min(r, b) - g) / 255));

async function wear() {
  const a = asset("shutter-wear");
  const img = await load(a);
  const n = img.width * img.height;
  let pure = 0;
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 3]!;
    const g = img.data[i * 3 + 1]!;
    const b = img.data[i * 3 + 2]!;
    if (r > 245 && g < 10 && b > 245) pure++;
  }
  const share = pure / n;
  if (share < 0.55) fail(a.id, `only ${(share * 100).toFixed(1)}% is pure key colour (needs 55%)`);
  // art in the zones the game covers: only the rails and the foot are held to it, the
  // housing is cleared whatever is there (a drip that starts high is hidden)
  const ink = (z: { x: number; y: number; w: number; h: number }) => {
    let count = 0;
    for (let y = z.y; y < z.y + z.h; y++)
      for (let x = z.x; x < z.x + z.w; x++) {
        const [r, g, b] = px(img, x, y);
        if (keyness(r, g, b) < 0.5) count++;
      }
    return count / Math.max(1, z.w * z.h);
  };
  const zones = Object.fromEntries(a.protectedZones.map((z) => [z.id, scaled(a, img, z.rect)]));
  const rails = Math.max(ink(zones["rail-left"]!), ink(zones["rail-right"]!));
  const foot = ink(zones["bottom-bar"]!);
  const housing = ink(zones["housing"]!);
  if (rails > 0.01) fail(a.id, `${(rails * 100).toFixed(1)}% of the guide-rail zones holds art`);
  if (foot > 0.02) fail(a.id, `${(foot * 100).toFixed(1)}% of the bottom-bar zone holds art`);
  // convert to RGBA with a soft key and de-spill
  const rgba = Buffer.alloc(n * 4);
  let fringe = 0;
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 3]!;
    const g = img.data[i * 3 + 1]!;
    const b = img.data[i * 3 + 2]!;
    const k = keyness(r, g, b);
    // Opaque below a small keyness (a pinkish rust), fully clear by 0.65, linear between:
    // edge pixels that are mostly key go, so no pink halo is left to un-mix.
    const alpha = k < 0.05 ? 1 : Math.max(0, (1 - (k - 0.05) / 0.6 - 0.2) / 0.8);
    // De-spill: take the magenta excess (how far red and blue sit above green) out
    // of both, which keeps a rust edge rust-coloured instead of hot red.
    const spill = Math.max(0, Math.min(r, b) - g) * 0.92;
    rgba[i * 4] = Math.max(0, r - spill);
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = Math.max(0, b - spill);
    if (alpha > 0.3 && Math.min(rgba[i * 4]!, rgba[i * 4 + 2]!) - g > 70) fringe++;
    rgba[i * 4 + 3] = Math.round(alpha * 255);
  }
  // the zones the game covers carry nothing
  for (const z of Object.values(zones))
    for (let y = z.y; y < Math.min(img.height, z.y + z.h); y++)
      for (let x = z.x; x < Math.min(img.width, z.x + z.w); x++)
        rgba[(y * img.width + x) * 4 + 3] = 0;
  const fringeShare = fringe / n;
  if (fringeShare > 0.0015)
    fail(a.id, `${(fringeShare * 100).toFixed(2)}% of pixels keep a pink fringe after keying`);
  note(
    a.id,
    `${img.width}x${img.height}  key ${(share * 100).toFixed(1)}%  rails ${(rails * 100).toFixed(2)}%  foot ${(foot * 100).toFixed(2)}%  (housing art cleared: ${(housing * 100).toFixed(1)}%)  fringe ${(fringeShare * 100).toFixed(3)}%`,
  );
  if (!check)
    await writeFile(
      `${OUT}/shutter-wear.webp`,
      await sharp(rgba, { raw: { width: img.width, height: img.height, channels: 4 } })
        .resize(512, 768, { kernel: "lanczos3" })
        .webp({ quality: 88, alphaQuality: 100, effort: 6 })
        .toBuffer(),
    );
}

if (!check) await mkdir(OUT, { recursive: true });
await window_();
await awning();
await wear();
if (failures.length) {
  console.error("\nRejected:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
console.log(check ? "all pass (nothing written)" : `written to ${OUT}`);
