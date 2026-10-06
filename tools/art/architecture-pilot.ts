/**
 * Validate the architectural pilot's returned images and make their runtime files.
 *
 *     bun run tools/art/architecture-pilot.ts           validate, then write public/images/architecture/
 *     bun run tools/art/architecture-pilot.ts --check   validate and report, write nothing
 *
 * Sources are src/assets/creator/arch-*.png, exactly as returned (the newest `-vN`).
 * They are judged by `architecturePack.ts`, the numbers the guides were drawn from
 * (`architecture-pilot-guides.ts`). A failed check exits non-zero and writes nothing.
 * No check is loosened to let an image pass: where an image is off its guide and can
 * be corrected without changing what it depicts, the correction is made here, said
 * out loud, and the corrected image is held to the guide again.
 *
 * ROOF UNIT (an isometric sprite)
 *   key      at least 40% pure #FF00FF; after keying, almost no pink fringe
 *   fit      one uniform scale and an offset, from the silhouette's width and its
 *            lowest point (the front corner), as the street props are fitted; the
 *            height that falls out is the unit's, held to 0.53 m +-15%
 *   frame    nothing of the unit outside its 256 x 200 frame
 *   out      roof-unit.webp, 512 x 400, the frame at twice its size
 *
 * WINDOW (a straight-on elevation, no key)
 *   bands    the aluminium frame and the mullion, found by their bronze, must lie on
 *            the guide's bands (+-2% of the width). Returned art that does not is
 *            REGISTERED BY ITS BANDS: each frame bar is mapped onto the guide's bar
 *            and each pane's glass onto the guide's pane at one uniform scale, the
 *            room behind cropped (never squeezed) at the pane's sides, inside the
 *            gaskets. The result is measured again, on the same bands.
 *   light    the frame's bars (one material, one colour) agree within 6/255: the
 *            room and the blind are content, not light, so they are not the probe
 *   out      annex-window.webp, 1024 x 791, the 2.2 x 1.7 m opening
 *
 * SHUTTER (a straight-on elevation, keyed)
 *   key      the guide's magenta stays magenta (>= 97%) and its grey is painted
 *            (>= 99% opaque): nothing outside the assembly, nothing missing in it
 *   edges    the housing's top and foot, the rails' outer edges, the opening's edges
 *            (where the slats begin) and the ground line, each within 1.5%
 *   light    the curtain's two halves and the housing's two ends agree within 6/255
 *            (top against bottom is not a probe: the wear is asked for at the foot)
 *   out      annex-shutter.webp, 696 x 946, the 1.84 x 2.5 m assembly
 *
 * No sharpening, no contrast or colour change: light and shadow are the renderer's.
 */
import { readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  ARCHITECTURE_PILOT as P,
  ARCHITECTURE_ART_SIZE,
  BAY,
  ROOF_UNIT,
  ROOF_UNIT_FRAME,
  SHUTTER,
  SHUTTER_ASSEMBLY,
  centredRegion,
  roofUnitGuide,
} from "@/features/play/courtyard/architecturePack";
import { framePoint } from "@/features/play/courtyard/streetPropPack";

const SOURCE = "src/assets/creator";
const OUT = "public/images/architecture";
const GUIDES = "docs/architecture-pilot/guides";
const check = process.argv.includes("--check");
const failures: string[] = [];
const fail = (id: string, msg: string) => failures.push(`${id}: ${msg}`);
const log = (id: string, msg: string) => console.log(`${id.padEnd(14)} ${msg}`);

type Raw = { data: Buffer; width: number; height: number; channels: number };

/** The newest `-vN` of a returned image; a redraw is saved beside the one it replaces. */
function latest(file: string) {
  const name = file.replace(/\.png$/, "");
  const versions = readdirSync(SOURCE)
    .map((f) => f.match(new RegExp(`^${name}(?:-v(\\d+))?\\.png$`)))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ v: Number(m[1] ?? 1), file: m[0] }))
    .sort((a, b) => b.v - a.v);
  return versions[0]?.file ?? file;
}

async function load(file: string, canvas: { width: number; height: number }): Promise<Raw> {
  const name = latest(file);
  const { data, info } = await sharp(`${SOURCE}/${name}`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== canvas.width || info.height !== canvas.height)
    fail(name, `${info.width} x ${info.height}, the guide is ${canvas.width} x ${canvas.height}`);
  return { data, width: info.width, height: info.height, channels: 3 };
}

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const rgb = (img: Raw, x: number, y: number) => {
  const i = (y * img.width + x) * img.channels;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!] as const;
};
const isKey = (r: number, g: number, b: number) => r > 240 && g < 15 && b > 240;
const keyness = (r: number, g: number, b: number) =>
  Math.max(0, Math.min(1, (Math.min(r, b) - g) / 255));

/** Key out the magenta with de-spill (the shutter-wear routine); count the fringe left. */
function keyOut(img: Raw) {
  const n = img.width * img.height;
  const out = Buffer.alloc(n * 4);
  let pure = 0;
  let fringe = 0;
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 3]!;
    const g = img.data[i * 3 + 1]!;
    const b = img.data[i * 3 + 2]!;
    if (isKey(r, g, b)) pure++;
    const k = keyness(r, g, b);
    const alpha = k < 0.05 ? 1 : Math.max(0, (1 - (k - 0.05) / 0.6 - 0.2) / 0.8);
    const spill = Math.max(0, Math.min(r, b) - g) * 0.92;
    out[i * 4] = Math.max(0, r - spill);
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = Math.max(0, b - spill);
    out[i * 4 + 3] = Math.round(alpha * 255);
    if (alpha > 0.3 && Math.min(out[i * 4]!, out[i * 4 + 2]!) - g > 70) fringe++;
  }
  return {
    rgba: { data: out, width: img.width, height: img.height, channels: 4 },
    pure: pure / n,
    fringe: fringe / n,
  };
}

/** Mean luminance of a rectangle (integer bounds, clamped). */
function meanLum(img: Raw, x0: number, y0: number, x1: number, y1: number) {
  let s = 0;
  let n = 0;
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(img.height, Math.round(y1)); y++)
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(img.width, Math.round(x1)); x++) {
      s += lum(...rgb(img, x, y));
      n++;
    }
  return s / Math.max(1, n);
}

/** Cut a rectangle (fractional bounds, transparent past the image's edges) and resize it. */
async function cut(src: Raw, x: number, y: number, w: number, h: number, W: number, H: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + w);
  const y1 = Math.ceil(y + h);
  const pad = {
    left: Math.max(0, -x0),
    top: Math.max(0, -y0),
    right: Math.max(0, x1 - src.width),
    bottom: Math.max(0, y1 - src.height),
  };
  const raw = { width: src.width, height: src.height, channels: src.channels as 3 | 4 };
  let piece = sharp(src.data, { raw }).ensureAlpha();
  if (pad.left || pad.top || pad.right || pad.bottom)
    piece = sharp(
      await piece
        .extend({ ...pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .raw()
        .toBuffer(),
      {
        raw: {
          width: src.width + pad.left + pad.right,
          height: src.height + pad.top + pad.bottom,
          channels: 4,
        },
      },
    );
  return piece
    .extract({ left: x0 + pad.left, top: y0 + pad.top, width: x1 - x0, height: y1 - y0 })
    .resize(W, H, { kernel: "lanczos3", fit: "fill" });
}

/* ---------------------------------------------------------------- roof unit */
async function roofUnit() {
  const id = "roof-unit";
  const src = await load(P.roofUnit.file, P.roofUnit.canvas);
  const { rgba, pure, fringe } = keyOut(src);
  if (pure < 0.4) fail(id, `only ${(pure * 100).toFixed(1)}% pure key (needs 40%)`);
  if (fringe > 0.0015) fail(id, `${(fringe * 100).toFixed(2)}% keep a pink fringe after keying`);
  // the silhouette
  const box = { left: rgba.width, right: 0, top: rgba.height, bottom: 0 };
  for (let y = 0; y < rgba.height; y++)
    for (let x = 0; x < rgba.width; x++)
      if (rgba.data[(y * rgba.width + x) * 4 + 3]! > 127) {
        box.left = Math.min(box.left, x);
        box.right = Math.max(box.right + 0, x + 1);
        box.top = Math.min(box.top, y);
        box.bottom = Math.max(box.bottom, y + 1);
      }
  // the guide's block, in guide pixels
  const g = roofUnitGuide();
  const corners = [0, ROOF_UNIT.height].flatMap((z) =>
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ].map(([x, y]) => g.at(x!, y!, z)),
  );
  const e = {
    left: Math.min(...corners.map((p) => p.x)),
    right: Math.max(...corners.map((p) => p.x)),
    top: Math.min(...corners.map((p) => p.y)),
    bottom: Math.max(...corners.map((p) => p.y)),
  };
  // image px = s * guide px + t: the width and the front corner on the roof
  const s = (box.right - box.left) / (e.right - e.left);
  const tx = box.left - s * e.left;
  const ty = box.bottom - s * e.bottom;
  // what height that gives the unit: the silhouette's height less the diamond's
  const diamond = (framePoint(2, 0).y - framePoint(0, 2).y) * g.scale;
  const height = ((box.bottom - box.top) / s - diamond) / (ROOF_UNIT_FRAME.pxPerMetreUp * g.scale);
  const off = height / ROOF_UNIT.height - 1;
  if (Math.abs(off) > 0.15)
    fail(id, `stands ${height.toFixed(2)} m, the unit is ${ROOF_UNIT.height.toFixed(2)} m (+-15%)`);
  // the frame, in image pixels: nothing of the unit may fall outside it
  const f0 = g.at(0, 0, 0);
  const frameOrigin = {
    x: f0.x - framePoint(0, 0).x * g.scale,
    y: f0.y - framePoint(0, 0).y * g.scale,
  };
  const frame = {
    x: s * frameOrigin.x + tx,
    y: s * (frameOrigin.y + ROOF_UNIT_FRAME.top * g.scale) + ty,
    w: s * ROOF_UNIT_FRAME.width * g.scale,
    h: s * ROOF_UNIT_FRAME.height * g.scale,
  };
  const outside =
    box.left < frame.x - 1 ||
    box.right > frame.x + frame.w + 1 ||
    box.top < frame.y - 1 ||
    box.bottom > frame.y + frame.h + 1;
  if (outside) fail(id, "part of the unit falls outside its frame");
  // face means, for the record: neutral light reads top > left > right, no hot spot
  const at = (x: number, y: number, z: number) => {
    const p = g.at(x, y, z);
    return { x: s * p.x + tx, y: s * p.y + ty };
  };
  const face = (x: number, y: number, z: number) => {
    const p = at(x, y, z);
    return meanLum(src, p.x - 12, p.y - 6, p.x + 12, p.y + 6).toFixed(0);
  };
  log(
    id,
    `${src.width}x${src.height}  key ${(pure * 100).toFixed(1)}%  fringe ${(fringe * 100).toFixed(3)}%  ` +
      `scale ${s.toFixed(3)} of the guide  height ${height.toFixed(3)} m (${off >= 0 ? "+" : ""}${(off * 100).toFixed(1)}%)  ` +
      `faces (lid by the front corner / north / east) ${face(1.7, 0.3, ROOF_UNIT.height)}/${face(1, 0, ROOF_UNIT.height / 2)}/${face(2, 1, ROOF_UNIT.height / 2)}`,
  );
  const size = ARCHITECTURE_ART_SIZE.roofUnit;
  return cut(rgba, frame.x, frame.y, frame.w, frame.h, size.width, size.height).then((p) =>
    p.webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer(),
  );
}

/* ------------------------------------------------------------------- window */

/** The bronze aluminium against the dark glass: red well above blue. */
const bronze = (img: Raw, x: number, y: number) => {
  const [r, , b] = rgb(img, x, y);
  return r - b;
};

/** Where the frame's bars and the mullion are: their bronze bands, in image pixels. */
function windowBands(img: Raw) {
  const W = img.width;
  const H = img.height;
  const col = Array.from({ length: W }, (_, x) => {
    let s = 0;
    for (let y = Math.round(H * 0.3); y < Math.round(H * 0.7); y++) s += bronze(img, x, y);
    return s / Math.round(H * 0.4);
  });
  const rowOver = (x0: number, x1: number) =>
    Array.from({ length: H }, (_, y) => {
      let s = 0;
      for (let x = Math.round(x0); x < Math.round(x1); x++) s += bronze(img, x, y);
      return s / (Math.round(x1) - Math.round(x0));
    });
  const T = 12;
  // outer bars: from each edge inward, the bronze run (a dark rim pixel or two allowed)
  const inward = (v: number[], from: number, step: number) => {
    let i = from;
    let seen = false;
    for (let n = 0; n < v.length / 4; n++, i += step) {
      if (v[i]! > T) seen = true;
      else if (seen) return i;
    }
    return NaN;
  };
  const left = inward(col, 0, 1);
  const right = inward(col, W - 1, -1) + 1;
  // the mullion: the bronze run nearest the centre
  let m0 = Math.round(W / 2);
  while (col[m0]! <= T && m0 > W * 0.4) m0--;
  while (col[m0 - 1]! > T) m0--;
  let m1 = m0;
  while (col[m1]! > T) m1++;
  // top and bottom, read down the middle of both panes (clear of the blind)
  const rows = rowOver(right - (right - m1) * 0.75, right - (right - m1) * 0.25);
  const top = inward(rows, 0, 1);
  const bottom = inward(rows, H - 1, -1) + 1;
  // the black gasket inside each bar: the dark run before the glass
  const dark = (x: number) => meanLum(img, x, H * 0.3, x + 1, H * 0.7);
  const gasket = (from: number, step: number) => {
    let n = 0;
    while (n < 40 && dark(from + n * step) < 30) n++;
    return n;
  };
  return {
    left,
    right,
    mullion: [m0, m1] as const,
    top,
    bottom,
    gaskets: {
      left: gasket(left, 1),
      mullionLeft: gasket(m0 - 1, -1),
      mullionRight: gasket(m1, 1),
      right: gasket(right - 1, -1),
    },
  };
}

async function window_() {
  const id = "window";
  const src = await load(P.window.file, P.window.canvas);
  const region = centredRegion(P.window.canvas, P.window.region.aspect);
  const m = region.height / (BAY.head - BAY.sill);
  // the guide's bands, in guide (canvas) pixels
  const guide = {
    left: region.x + BAY.frame * m,
    right: region.x + region.width - BAY.frame * m,
    mullion: [
      region.x + region.width / 2 - (BAY.mullion * m) / 2,
      region.x + region.width / 2 + (BAY.mullion * m) / 2,
    ] as const,
    top: region.y + BAY.frame * m,
    bottom: region.y + region.height - BAY.frame * m,
  };
  const b = windowBands(src);
  const tolerance = src.width * 0.02;
  const errors = (x: typeof b) => ({
    left: x.left - guide.left,
    right: x.right - guide.right,
    mullion0: x.mullion[0] - guide.mullion[0],
    mullion1: x.mullion[1] - guide.mullion[1],
    top: x.top - guide.top,
    bottom: x.bottom - guide.bottom,
  });
  const before = errors(b);
  const fmt = (e: ReturnType<typeof errors>) =>
    Object.entries(e)
      .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v.toFixed(0)}`)
      .join(", ");
  const offGuide = Object.values(before).some((v) => Math.abs(v) > tolerance);
  log(
    id,
    `as returned, bands against the guide (px): ${fmt(before)}  (tolerance ${tolerance.toFixed(0)})`,
  );
  log(
    id,
    `as returned: frame ${b.left} | ${b.mullion[0]}-${b.mullion[1]} | ${b.right}, ${b.top} to ${b.bottom}; ` +
      `gaskets ${Object.values(b.gaskets).join("/")} px`,
  );

  // Register by the bands. Out is the opening at the guide's pixels per metre.
  const OW = Math.round(region.width);
  const OH = Math.round(region.height);
  const g = {
    frame: BAY.frame * m,
    mullion: [guide.mullion[0] - region.x, guide.mullion[1] - region.x] as const,
  };
  const glassH = OH - 2 * g.frame;
  const sy = glassH / (b.bottom - b.top);
  // each pane: its gaskets kept at the bars, the room between cropped to the scale
  type Span = { from: number; to: number; at: number; width: number };
  const xs: Span[] = [];
  const pane = (s0: number, s1: number, gl: number, gr: number, t0: number, t1: number) => {
    const target = t1 - t0;
    const keepL = gl * sy;
    const keepR = gr * sy;
    const room = target - keepL - keepR;
    const srcRoom = s1 - s0 - gl - gr;
    const need = room / sy;
    if (need > srcRoom + 0.5) {
      fail(
        id,
        `a pane is ${(srcRoom - need).toFixed(0)} px narrower than its glass: it would have to stretch`,
      );
      return 0;
    }
    const crop = (srcRoom - need) / 2;
    xs.push(
      { from: s0, to: s0 + gl, at: t0, width: keepL },
      { from: s0 + gl + crop, to: s1 - gr - crop, at: t0 + keepL, width: room },
      { from: s1 - gr, to: s1, at: t1 - keepR, width: keepR },
    );
    return crop;
  };
  xs.push({ from: 0, to: b.left, at: 0, width: g.frame });
  const cropL = pane(
    b.left,
    b.mullion[0],
    b.gaskets.left,
    b.gaskets.mullionLeft,
    g.frame,
    g.mullion[0],
  );
  xs.push({
    from: b.mullion[0],
    to: b.mullion[1],
    at: g.mullion[0],
    width: g.mullion[1] - g.mullion[0],
  });
  const cropR = pane(
    b.mullion[1],
    b.right,
    b.gaskets.mullionRight,
    b.gaskets.right,
    g.mullion[1],
    OW - g.frame,
  );
  xs.push({ from: b.right, to: src.width, at: OW - g.frame, width: g.frame });
  const ys: Span[] = [
    { from: 0, to: b.top, at: 0, width: g.frame },
    { from: b.top, to: b.bottom, at: g.frame, width: glassH },
    { from: b.bottom, to: src.height, at: OH - g.frame, width: g.frame },
  ];
  // whole pixels in the output: each piece runs from its rounded start to the next's
  const edges = (spans: Span[], total: number) =>
    spans.map(
      (s, i) =>
        [Math.round(s.at), i + 1 < spans.length ? Math.round(spans[i + 1]!.at) : total] as const,
    );
  const ex = edges(xs, OW);
  const ey = edges(ys, OH);
  const pieces: sharp.OverlayOptions[] = [];
  for (const [j, sy_] of ys.entries())
    for (const [i, sx] of xs.entries()) {
      const [x0, x1] = ex[i]!;
      const [y0, y1] = ey[j]!;
      if (x1 <= x0 || y1 <= y0 || sx.to <= sx.from) continue;
      const piece = await cut(
        src,
        sx.from,
        sy_.from,
        sx.to - sx.from,
        sy_.to - sy_.from,
        x1 - x0,
        y1 - y0,
      );
      pieces.push({ input: await piece.png().toBuffer(), left: x0, top: y0 });
    }
  const registered = await sharp({
    create: { width: OW, height: OH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .composite(pieces)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out: Raw = { data: registered.data, width: OW, height: OH, channels: 3 };
  // held to the guide again, on the same bands, in the opening's own pixels
  const placed = windowBands({ ...out });
  const shifted = {
    ...placed,
    left: placed.left + region.x,
    right: placed.right + region.x,
    mullion: [placed.mullion[0] + region.x, placed.mullion[1] + region.x] as const,
  };
  const after = errors(shifted);
  for (const [k, v] of Object.entries(after))
    if (Math.abs(v) > tolerance)
      fail(id, `after registration, ${k} is ${v.toFixed(0)} px off the guide`);
  if (offGuide)
    log(
      id,
      `REGISTERED by its bands: room cropped ${cropL.toFixed(0)} + ${cropR.toFixed(0)} px each side of each pane at scale ${sy.toFixed(3)}; ` +
        `after: ${fmt(after)}`,
    );
  // light: the frame is one bronze; its bars agree. Each is read across its core, the
  // middle 60% of its thickness, clear of the bevel's highlight and shadow lines, which
  // are modelling, drawn differently on each bar, not light.
  const core = [0.2 * g.frame, 0.8 * g.frame] as const;
  const bars = {
    left: meanLum(out, core[0], OH * 0.2, core[1], OH * 0.8),
    right: meanLum(out, OW - core[1], OH * 0.2, OW - core[0], OH * 0.8),
    top: meanLum(out, OW * 0.2, core[0], OW * 0.8, core[1]),
    bottom: meanLum(out, OW * 0.2, OH - core[1], OW * 0.8, OH - core[0]),
  };
  const spread = Math.max(...Object.values(bars)) - Math.min(...Object.values(bars));
  if (spread > 6) fail(id, `the frame's bars differ by ${spread.toFixed(1)}/255: baked light?`);
  log(
    id,
    `frame bars ${Object.values(bars)
      .map((v) => v.toFixed(0))
      .join("/")} (spread ${spread.toFixed(1)}/255)`,
  );
  const size = ARCHITECTURE_ART_SIZE.window;
  return {
    file: await sharp(out.data, { raw: { width: OW, height: OH, channels: 3 } })
      .resize(size.width, size.height, { kernel: "lanczos3", fit: "fill" })
      .webp({ quality: 90, effort: 6 })
      .toBuffer(),
    proof: await sharp(out.data, { raw: { width: OW, height: OH, channels: 3 } })
      .jpeg({ quality: 88 })
      .toBuffer(),
  };
}

/* ------------------------------------------------------------------ shutter */
async function shutter() {
  const id = "shutter";
  const src = await load(P.shutter.file, P.shutter.canvas);
  const region = centredRegion(P.shutter.canvas, P.shutter.region.aspect);
  const m = region.width / SHUTTER_ASSEMBLY.width;
  const guideImg = await sharp(`${GUIDES}/shutter-layout.png`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gImg: Raw = {
    data: guideImg.data,
    width: guideImg.info.width,
    height: guideImg.info.height,
    channels: 3,
  };
  const { rgba, fringe } = keyOut(src);
  // the guide's magenta stays magenta; its grey is painted
  let keyN = 0;
  let keyKept = 0;
  let greyN = 0;
  let greyPainted = 0;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const a = rgba.data[(y * src.width + x) * 4 + 3]!;
      if (isKey(...rgb(gImg, x, y))) {
        keyN++;
        if (a < 128) keyKept++;
      } else {
        greyN++;
        if (a > 127) greyPainted++;
      }
    }
  const kept = keyKept / keyN;
  const painted = greyPainted / greyN;
  if (kept < 0.97) fail(id, `${((1 - kept) * 100).toFixed(1)}% of the guide's magenta holds art`);
  if (painted < 0.99)
    fail(id, `${((1 - painted) * 100).toFixed(1)}% of the assembly is see-through`);
  if (fringe > 0.0015) fail(id, `${(fringe * 100).toFixed(2)}% keep a pink fringe after keying`);
  // edges, against the guide's
  const opaque = (x: number, y: number) => rgba.data[(y * src.width + x) * 4 + 3]! > 127;
  const g = {
    top: region.y,
    housingFoot: region.y + SHUTTER.housingHeight * m,
    railLeft: region.x + (SHUTTER.housingOverhang - SHUTTER.rail) * m,
    railRight: region.x + region.width - (SHUTTER.housingOverhang - SHUTTER.rail) * m,
    openLeft: region.x + SHUTTER.housingOverhang * m,
    openRight: region.x + region.width - SHUTTER.housingOverhang * m,
    ground: region.y + region.height,
  };
  const firstOpaque = (x: number) => {
    let y = 0;
    while (y < src.height && !opaque(x, y)) y++;
    return y;
  };
  const lastOpaque = (x: number) => {
    let y = src.height - 1;
    while (y > 0 && !opaque(x, y)) y--;
    return y + 1;
  };
  const along = (y: number) => {
    let l = 0;
    while (l < src.width && !opaque(l, y)) l++;
    let r = src.width - 1;
    while (r > 0 && !opaque(r, y)) r--;
    return [l, r + 1] as const;
  };
  // the housing's foot: the lowest row still the full width, read at its two ends
  const housingFoot = (x: number) => {
    let y = firstOpaque(x);
    while (y < src.height && opaque(x, y)) y++;
    return y;
  };
  const middle = Math.round((g.housingFoot + g.ground) / 2);
  const [railLeft, railRight] = along(middle);
  // where the slats begin: the slats' edges are strong horizontal lines, the rails' are not
  const ridges = (x: number) => {
    let s = 0;
    for (let y = Math.round(g.housingFoot + 40); y < Math.round(g.ground - 60); y++)
      s += Math.abs(lum(...rgb(src, x, y + 1)) - lum(...rgb(src, x, y)));
    return s;
  };
  const prof = Array.from({ length: src.width }, (_, x) => ridges(x));
  const curtain = prof.slice(Math.round(src.width * 0.3), Math.round(src.width * 0.7));
  const level = curtain.reduce((a, v) => a + v, 0) / curtain.length;
  // the first column of a sustained run of slat ridges (a rail's outline is one line)
  const slats = (x: number, step: number) => {
    for (; x > 0 && x < src.width - 1; x += step) {
      let run = 0;
      while (run < 12 && prof[x + run * step]! >= level * 0.6) run++;
      if (run === 12) return x;
    }
    return NaN;
  };
  const openLeft = slats(railLeft, 1);
  const openRight = slats(railRight - 1, -1) + 1;
  const groundAt = Math.round(
    [0.3, 0.5, 0.7].map((t) => lastOpaque(Math.round(src.width * t))).reduce((a, v) => a + v, 0) /
      3,
  );
  const measured = {
    top: Math.round(
      (firstOpaque(Math.round(src.width * 0.02)) + firstOpaque(Math.round(src.width * 0.98))) / 2,
    ),
    housingFoot: Math.round(
      (housingFoot(Math.round(src.width * 0.005)) + housingFoot(Math.round(src.width * 0.995))) / 2,
    ),
    railLeft,
    railRight,
    openLeft,
    openRight,
    ground: groundAt,
  };
  const tol = { x: src.width * 0.015, y: src.height * 0.015 };
  const report: string[] = [];
  for (const k of Object.keys(g) as (keyof typeof g)[]) {
    const d = measured[k] - g[k];
    const t = k === "top" || k === "housingFoot" || k === "ground" ? tol.y : tol.x;
    report.push(`${k} ${d >= 0 ? "+" : ""}${d.toFixed(1)}`);
    if (Math.abs(d) > t)
      fail(id, `${k} is ${d.toFixed(1)} px off the guide (tolerance ${t.toFixed(0)})`);
  }
  // light: left against right, where the material is one
  const c0 = g.openLeft + 10;
  const c1 = g.openRight - 10;
  const cm = (c0 + c1) / 2;
  const curtainL = meanLum(src, c0, g.housingFoot + 20, cm, g.ground - 20);
  const curtainR = meanLum(src, cm, g.housingFoot + 20, c1, g.ground - 20);
  const housingL = meanLum(
    src,
    g.railLeft + 10,
    g.top + 10,
    region.x + region.width * 0.3,
    g.housingFoot - 10,
  );
  const housingR = meanLum(
    src,
    region.x + region.width * 0.7,
    g.top + 10,
    g.railRight - 10,
    g.housingFoot - 10,
  );
  const dc = Math.abs(curtainL - curtainR);
  const dh = Math.abs(housingL - housingR);
  if (dc > 6) fail(id, `the curtain's halves differ by ${dc.toFixed(1)}/255: baked light?`);
  if (dh > 6) fail(id, `the housing's ends differ by ${dh.toFixed(1)}/255: baked light?`);
  log(
    id,
    `${src.width}x${src.height}  guide key kept ${(kept * 100).toFixed(1)}%  assembly painted ${(painted * 100).toFixed(2)}%  ` +
      `fringe ${(fringe * 100).toFixed(3)}%`,
  );
  log(
    id,
    `edges against the guide (px): ${report.join(", ")}  (tolerance ${tol.x.toFixed(0)}/${tol.y.toFixed(0)})`,
  );
  log(id, `light: curtain halves ${dc.toFixed(1)}/255, housing ends ${dh.toFixed(1)}/255`);
  const size = ARCHITECTURE_ART_SIZE.shutter;
  return cut(rgba, region.x, region.y, region.width, region.height, size.width, size.height).then(
    (p) => p.webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer(),
  );
}

const roof = await roofUnit();
const win = await window_();
const shut = await shutter();
if (failures.length) {
  console.error("\nRejected:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
if (!check) {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/roof-unit.webp`, roof);
  await writeFile(`${OUT}/annex-window.webp`, win.file);
  await writeFile(`${OUT}/annex-shutter.webp`, shut);
  await writeFile(`${GUIDES}/window-registered.jpg`, win.proof);
}
console.log(check ? "all pass (nothing written)" : `written to ${OUT}`);
