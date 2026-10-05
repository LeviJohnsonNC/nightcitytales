/**
 * Validate the returned street-prop images and make the runtime frames.
 *
 *     bun run tools/art/street-props.ts            validate, then write public/images/street-props/*.webp
 *     bun run tools/art/street-props.ts --check    validate and report, write nothing
 *
 * Sources are src/assets/creator/street-<guide>-<state>.png, exactly as returned. The
 * numbers they are judged and cut by are `streetPropPack.ts`, the same ones the guides
 * were drawn from. A failed check exits non-zero and writes nothing.
 *
 * REGISTRATION. The image tool does not return the size asked for (these came back
 * 1254 square, not 1536 or 1024), and it does not place the object exactly where the
 * guide drew it, so each object is FITTED to its guide: one uniform scale and an
 * offset, from the intact image's silhouette (its left and right extremes, the
 * bumpers or the box's side corners, and its lowest point, a tyre or the box's front
 * corner on the ground). That puts the footprint on the saved 2 m cover pieces, which
 * is what registration means here. Damaged and wrecked images use the intact image's
 * fit, so the three states line up; their silhouettes are reported against it.
 *
 * WHAT IS CHECKED
 *   key      at least 45% pure #FF00FF; after keying, almost no pink fringe
 *   fit      height after the width fit, against the guide's (reported; a car
 *            Picasso drew longer and lower reads as a lower roof, not a failure,
 *            unless it is off by more than 25%)
 *   states   damaged and wrecked sit within 3% of the intact image's footprint
 *   frames   how much of each object fell outside its section frames (clipped)
 *
 * WHAT IS DONE
 *   key out with de-spill (the shutter-wear routine), cut each section's frame from
 *   the fitted image, cut the sedan at its join (`sedanCut`), and write 512 x 640
 *   WebP with alpha: twice the board's 256 x 320 frame, registered identically.
 * No sharpening, no contrast or colour change: light and shadow are the renderer's.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { Point } from "@/engine";
import {
  CABINET,
  PLANTER,
  PROP_STATES,
  SEDAN,
  STREET_PROP_PACK,
  framePoint,
  sectionFrameOnGuide,
  sedanCut,
  sedanPoint,
  toGuide,
  type PackGuide,
  type PropState,
} from "@/features/play/courtyard/streetPropPack";

const SOURCE = "src/assets/creator";
const OUT = "public/images/street-props";
const RUNTIME = { width: 512, height: 640 } as const;
const check = process.argv.includes("--check");
const failures: string[] = [];
const fail = (id: string, msg: string) => failures.push(`${id}: ${msg}`);
const log = (id: string, msg: string) => console.log(`${id.padEnd(22)} ${msg}`);

type Rgba = { data: Buffer; width: number; height: number };
type Box = { left: number; right: number; top: number; bottom: number };

const keyness = (r: number, g: number, b: number) =>
  Math.max(0, Math.min(1, (Math.min(r, b) - g) / 255));

/** Load, key out the magenta with de-spill, and measure. */
async function load(id: string, state: PropState) {
  const name = `street-${id}-${state}`;
  const { data, info } = await sharp(`${SOURCE}/${name}.png`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const rgba = Buffer.alloc(n * 4);
  let pure = 0;
  let fringe = 0;
  const box: Box = { left: info.width, right: 0, top: info.height, bottom: 0 };
  for (let i = 0; i < n; i++) {
    const r = data[i * 3]!;
    const g = data[i * 3 + 1]!;
    const b = data[i * 3 + 2]!;
    if (r > 240 && g < 15 && b > 240) pure++;
    const k = keyness(r, g, b);
    const alpha = k < 0.05 ? 1 : Math.max(0, (1 - (k - 0.05) / 0.6 - 0.2) / 0.8);
    const spill = Math.max(0, Math.min(r, b) - g) * 0.92;
    rgba[i * 4] = Math.max(0, r - spill);
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = Math.max(0, b - spill);
    rgba[i * 4 + 3] = Math.round(alpha * 255);
    if (alpha > 0.3 && Math.min(rgba[i * 4]!, rgba[i * 4 + 2]!) - g > 70) fringe++;
    if (alpha > 0.5) {
      const x = i % info.width;
      const y = Math.floor(i / info.width);
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
  }
  if (pure / n < 0.45) fail(name, `only ${((pure / n) * 100).toFixed(1)}% pure key (needs 45%)`);
  if (fringe / n > 0.0015)
    fail(name, `${((fringe / n) * 100).toFixed(2)}% of pixels keep a pink fringe after keying`);
  return {
    name,
    img: { data: rgba, width: info.width, height: info.height } as Rgba,
    box,
    key: pure / n,
    fringe: fringe / n,
  };
}

/** Where the guide expects the object's silhouette, in guide pixels. */
function expected(g: PackGuide): Box {
  const pts: Point[] = [];
  if (g.id.startsWith("sedan")) {
    const at = (x: number, y: number, z: number) => toGuide(g, sedanPoint(x, y, z, g.rotation));
    for (const x of [SEDAN.body.x0, SEDAN.body.x1])
      for (const y of [SEDAN.body.y0, SEDAN.body.y1])
        for (const z of [SEDAN.sill, SEDAN.hood]) pts.push(at(x, y, z));
    for (const x of [SEDAN.cabin.x0, SEDAN.cabin.x1])
      for (const y of [SEDAN.cabin.y0, SEDAN.cabin.y1]) pts.push(at(x, y, SEDAN.roof));
    // the lowest point is a tyre on the ground
    for (const x of SEDAN.wheel.centres) for (const y of SEDAN.wheel.y) pts.push(at(x, y, 0));
  } else {
    const b = g.id === "planter" ? PLANTER.body : CABINET.body;
    const top = g.id === "planter" ? PLANTER.foliageMax : CABINET.height;
    const at = (x: number, y: number, z: number) => toGuide(g, framePoint(x, y, z, g.rotation));
    for (const x of [b.x0, b.x1])
      for (const y of [b.y0, b.y1]) for (const z of [0, top]) pts.push(at(x, y, z));
  }
  return {
    left: Math.min(...pts.map((p) => p.x)),
    right: Math.max(...pts.map((p) => p.x)),
    top: Math.min(...pts.map((p) => p.y)),
    bottom: Math.max(...pts.map((p) => p.y)),
  };
}

/** Image pixel = s * guide pixel + t, fitted on the width and the lowest point. */
type Fit = { s: number; tx: number; ty: number };
function fitTo(g: PackGuide, box: Box): Fit {
  const e = expected(g);
  const s = (box.right - box.left) / (e.right - e.left);
  return { s, tx: box.left - s * e.left, ty: box.bottom - s * e.bottom };
}

/** One section's runtime frame, cut from the fitted image. */
async function sectionFrame(g: PackGuide, index: number, src: Rgba, fit: Fit) {
  const f = sectionFrameOnGuide(g, index);
  // the frame's rectangle in image pixels (it may run past the image's edges)
  const x0 = fit.s * f.x + fit.tx;
  const y0 = fit.s * f.y + fit.ty;
  const w = fit.s * f.width;
  const h = fit.s * f.height;
  const pad = Math.ceil(Math.max(w, h));
  const padded = await sharp(src.data, {
    raw: { width: src.width, height: src.height, channels: 4 },
  })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer();
  const left = Math.round(x0 + pad);
  const top = Math.round(y0 + pad);
  const out = await sharp(padded, {
    raw: { width: src.width + 2 * pad, height: src.height + 2 * pad, channels: 4 },
  })
    .extract({ left, top, width: Math.round(w), height: Math.round(h) })
    .resize(RUNTIME.width, RUNTIME.height, { kernel: "lanczos3" })
    .raw()
    .toBuffer();
  // the sedan's cut, in this frame's runtime pixels
  if (g.id.startsWith("sedan")) {
    const cut = sedanCut(g);
    const toFrame = (p: Point) => ({
      x: ((p.x - f.x) / f.width) * RUNTIME.width,
      y: ((p.y - f.y) / f.height) * RUNTIME.height,
    });
    const shape = cut.nearerShape.map(toFrame);
    const svgMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${RUNTIME.width}" height="${RUNTIME.height}"><polygon points="${shape
        .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(" ")}" fill="#fff"/></svg>`,
    );
    const mask = await sharp(svgMask).ensureAlpha().extractChannel(3).raw().toBuffer();
    const nearer = g.sections[index]!.art === cut.nearer;
    for (let i = 0; i < RUNTIME.width * RUNTIME.height; i++) {
      const m = mask[i]! / 255;
      out[i * 4 + 3] = Math.round(out[i * 4 + 3]! * (nearer ? m : 1 - m));
    }
  }
  return out;
}

const alphaSum = (b: Buffer) => {
  let s = 0;
  for (let i = 3; i < b.length; i += 4) s += b[i]!;
  return s;
};

/** The runtime file for a guide's section in a state. */
function fileFor(g: PackGuide, art: string, state: PropState) {
  // the board's texture keys: rotation 90 of a procedural kind carries "-90"; the
  // planter is square and symmetric, so one file serves both rotations
  const suffix = g.rotation === 90 && g.id.startsWith("sedan") ? "-90" : "";
  return `${art}-${state}${suffix}.webp`;
}

if (!check) await mkdir(OUT, { recursive: true });
const sheet: { label: string; frames: { buf: Buffer; offset: Point; g: PackGuide }[] }[] = [];
for (const g of STREET_PROP_PACK) {
  const intact = await load(g.id, "intact");
  const fit = fitTo(g, intact.box);
  const e = expected(g);
  const heightRatio = (intact.box.bottom - intact.box.top) / (fit.s * (e.bottom - e.top));
  log(
    `street-${g.id}`,
    `fit ${(fit.s * g.canvas).toFixed(0)} px for the guide's ${g.canvas}; height ${(heightRatio * 100).toFixed(0)}% of the guide's after the width fit`,
  );
  if (Math.abs(heightRatio - 1) > 0.25)
    fail(
      `street-${g.id}`,
      `height is ${(heightRatio * 100).toFixed(0)}% of the guide's (limit ±25%)`,
    );
  for (const state of PROP_STATES) {
    const shot = state === "intact" ? intact : await load(g.id, state);
    const w = intact.box.right - intact.box.left;
    const drift = Math.max(
      Math.abs(shot.box.left - intact.box.left),
      Math.abs(shot.box.right - intact.box.right),
      state === "wrecked" ? 0 : Math.abs(shot.box.bottom - intact.box.bottom),
    );
    const frames: { buf: Buffer; offset: Point; g: PackGuide }[] = [];
    let kept = 0;
    for (let i = 0; i < g.sections.length; i++) {
      const buf = await sectionFrame(g, i, shot.img, fit);
      kept += alphaSum(buf);
      frames.push({ buf, offset: g.sections[i]!.offset, g });
      if (!check)
        await writeFile(
          `${OUT}/${fileFor(g, g.sections[i]!.art, state)}`,
          await sharp(buf, { raw: { width: RUNTIME.width, height: RUNTIME.height, channels: 4 } })
            .webp({ quality: 86, alphaQuality: 100, effort: 6 })
            .toBuffer(),
        );
    }
    // how much of the object made it into the frames (runtime px scale back to image px)
    const scaleBack = (fit.s * sectionFrameOnGuide(g, 0).width) / RUNTIME.width;
    const clipped = 1 - (kept * scaleBack * scaleBack) / alphaSum(shot.img.data);
    log(
      shot.name,
      `key ${(shot.key * 100).toFixed(1)}%  fringe ${(shot.fringe * 100).toFixed(3)}%  drift ${((drift / w) * 100).toFixed(1)}%  clipped ${(clipped * 100).toFixed(1)}%`,
    );
    if (state !== "wrecked" && drift / w > 0.03)
      fail(shot.name, `moved ${((drift / w) * 100).toFixed(1)}% against the intact image`);
    sheet.push({ label: shot.name, frames });
  }
}

/* A proof sheet: every state rebuilt from its runtime frames alone, in place. */
{
  const cell = 520;
  const cols = 3;
  const rows = Math.ceil(sheet.length / cols);
  const composites: sharp.OverlayOptions[] = [];
  for (const [n, entry] of sheet.entries()) {
    const g = entry.frames[0]!.g;
    // runtime px per frame px
    const k = RUNTIME.width / 256;
    const xs = entry.frames.map((f) => f.offset.x * k);
    const ys = entry.frames.map((f) => f.offset.y * k);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanW = Math.max(...xs) - minX + RUNTIME.width;
    const spanH = Math.max(...ys) - minY + RUNTIME.height;
    const scale = Math.min((cell - 20) / spanW, (cell - 40) / spanH);
    for (const f of entry.frames) {
      const img = await sharp(f.buf, {
        raw: { width: RUNTIME.width, height: RUNTIME.height, channels: 4 },
      })
        .resize(Math.round(RUNTIME.width * scale), Math.round(RUNTIME.height * scale))
        .png()
        .toBuffer();
      composites.push({
        input: img,
        left: Math.round((n % cols) * cell + 10 + (f.offset.x * k - minX) * scale),
        top: Math.round(Math.floor(n / cols) * cell + 30 + (f.offset.y * k - minY) * scale),
      });
    }
    composites.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="28"><text x="8" y="20" font-family="DejaVu Sans" font-size="18" fill="#e6edf0">${entry.label} (${g.sections.length} frame${g.sections.length > 1 ? "s" : ""})</text></svg>`,
      ),
      left: (n % cols) * cell,
      top: Math.floor(n / cols) * cell,
    });
  }
  if (!check)
    await sharp({
      create: { width: cols * cell, height: rows * cell, channels: 3, background: "#3a4247" },
    })
      .composite(composites)
      .jpeg({ quality: 84 })
      .toFile("docs/street-props-pack/imported-frames.jpg");
}

if (failures.length) {
  console.error("\nRejected:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
console.log(check ? "all pass (nothing written)" : `written to ${OUT}`);
