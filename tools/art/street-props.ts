/**
 * Validate the returned street-prop images and make the runtime frames.
 *
 *     bun run tools/art/street-props.ts            validate, then write public/images/street-props/*.webp
 *     bun run tools/art/street-props.ts --check    validate and report, write nothing
 *     bun run tools/art/street-props.ts --round 2  round two only (the merchandise stand
 *                                                  and the cabinet at rotation 90)
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
 *   seam     the two intact sedan halves, laid over each other exactly as the board
 *            places them, leave nothing see-through inside the car
 *   wreck    a wrecked image stays inside its volume (`wreckVolume`); the guide and
 *            check sheet for a redraw are written to docs/street-props-pack/wreck-guides/
 *   fit      height after the width fit, against the guide's (reported; a car
 *            Picasso drew longer and lower reads as a lower roof, not a failure,
 *            unless it is off by more than 25%)
 *   states   damaged and wrecked sit within 3% of the intact image's footprint
 *   frames   how much of each object fell outside its section frames (clipped)
 *
 * WHAT IS DONE
 *   key out with de-spill (the shutter-wear routine), resample each section's art from
 *   the fitted image at sub-pixel precision, cut the sedan at its join (`sedanCut`),
 *   and write WebP with alpha at twice the board's 256 x 320 frame. A sedan's art is
 *   padded past its frame (`SEDAN_ART_PAD`, 640 x 704) so each half of the car fits
 *   whole; the board reads where the frame sits from `propArtRegistration`.
 * No sharpening, no contrast or colour change: light and shadow are the renderer's.
 */
import { readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { Point } from "@/engine";
import {
  CABINET,
  KIOSK,
  FRAME,
  artPad,
  sectionArtOnGuide,
  PLANTER,
  PROP_STATES,
  SEDAN,
  STREET_PROP_PACK,
  STREET_PROP_PACK_2,
  framePoint,
  sectionFrameOnGuide,
  sedanCut,
  sedanPoint,
  toGuide,
  wreckVolume,
  WRECK_APRON,
  type PackGuide,
  type PropState,
} from "@/features/play/courtyard/streetPropPack";

const SOURCE = "src/assets/creator";
const OUT = "public/images/street-props";
/** Runtime pixels per frame pixel: the files are twice the board's 256 x 320 frame. */
const K = 2;
/** A section's runtime art size: its 2 m frame plus its padding (`artPad`), at K. */
const size = (art: string) => {
  const pad = artPad(art);
  return { width: (FRAME.width + 2 * pad.side) * K, height: (FRAME.height + pad.top) * K };
};
const check = process.argv.includes("--check");
/** `--round 2`: only round two's guides, so round one's files are not rewritten. */
const roundTwo = process.argv.includes("--round") && process.argv.includes("2");
const PACK = roundTwo ? STREET_PROP_PACK_2 : STREET_PROP_PACK;
const WRECK_GUIDES = "docs/street-props-pack/wreck-guides";
/** Share of a wreck's opaque pixels allowed outside its volume: antialiasing and a stray splinter. */
const WRECK_TOLERANCE = 0.01;
/**
 * Wrecks that stand taller than their volume and whose lower redraw has been
 * commissioned (docs/street-props-pack.md, "Lower wrecks"; round two:
 * docs/street-props-pack/round-2.md §7). They still import, with
 * the excess reported; take an id off as soon as its redraw passes.
 */
const TALL_WRECKS_PENDING = new Set<string>(["kiosk-r0"]);
const failures: string[] = [];
const fail = (id: string, msg: string) => failures.push(`${id}: ${msg}`);
const log = (id: string, msg: string) => console.log(`${id.padEnd(22)} ${msg}`);

type Rgba = { data: Buffer; width: number; height: number };
type Box = { left: number; right: number; top: number; bottom: number };

/**
 * A redraw is saved beside the image it replaces, as `<name>-v2.png` (then `-v3`...),
 * so the history stays in the folder; the newest version is the one imported.
 */
function latest(name: string) {
  const versions = readdirSync(SOURCE)
    .map((f) => f.match(new RegExp(`^${name}(?:-v(\\d+))?\\.png$`)))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ v: Number(m[1] ?? 1), file: m[0].slice(0, -4) }))
    .sort((a, b) => b.v - a.v);
  return versions[0]?.file ?? name;
}

const keyness = (r: number, g: number, b: number) =>
  Math.max(0, Math.min(1, (Math.min(r, b) - g) / 255));

/** Load, key out the magenta with de-spill, and measure. */
async function load(id: string, state: PropState) {
  const name = latest(`street-${id}-${state}`);
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
    const b =
      g.id === "planter" ? PLANTER.body : g.id.startsWith("kiosk") ? KIOSK.body : CABINET.body;
    const top =
      g.id === "planter"
        ? PLANTER.foliageMax
        : g.id.startsWith("kiosk")
          ? KIOSK.height
          : CABINET.height;
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

/**
 * Resample a rectangle of the image, at sub-pixel precision, to the runtime frame.
 * The two sedan sections are placed by the board at a fractional offset from each
 * other (2 m along the car is 147.8 frame pixels down at rotation 0), so cutting
 * each frame at rounded pixel bounds put the halves up to half a source pixel out
 * of register. Separable Lanczos-3, widened by the scale when shrinking, on
 * premultiplied colour so no keyed-out colour bleeds into an edge.
 */
function resample(src: Rgba, x0: number, y0: number, w: number, h: number, W: number, H: number) {
  const lanczos = (t: number) => {
    if (t === 0) return 1;
    if (Math.abs(t) >= 3) return 0;
    const a = Math.PI * t;
    return (3 * Math.sin(a) * Math.sin(a / 3)) / (a * a);
  };
  // weights for one axis: output i samples source around x0 + (i + 0.5) * step - 0.5
  const weights = (n: number, origin: number, step: number, size: number) => {
    const scale = Math.max(1, step);
    const support = 3 * scale;
    return Array.from({ length: n }, (_, i) => {
      const centre = origin + (i + 0.5) * step - 0.5;
      const first = Math.ceil(centre - support);
      const last = Math.floor(centre + support);
      const idx: number[] = [];
      const wt: number[] = [];
      let sum = 0;
      for (let k = first; k <= last; k++) {
        const v = lanczos((k - centre) / scale);
        if (v === 0) continue;
        idx.push(k);
        wt.push(v);
        sum += v;
      }
      return { idx, wt: wt.map((v) => v / sum), size };
    });
  };
  const wx = weights(W, x0, w / W, src.width);
  const wy = weights(H, y0, h / H, src.height);
  const px = (x: number, y: number, c: number) => {
    if (x < 0 || y < 0 || x >= src.width || y >= src.height) return 0;
    const i = (y * src.width + x) * 4;
    const a = src.data[i + 3]! / 255;
    return c === 3 ? a : (src.data[i + c]! / 255) * a;
  };
  // horizontal pass over the rows the vertical pass needs
  const rows = new Map<number, Float32Array>();
  const row = (y: number) => {
    let r = rows.get(y);
    if (r) return r;
    r = new Float32Array(W * 4);
    for (let i = 0; i < W; i++) {
      const { idx, wt } = wx[i]!;
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (let k = 0; k < idx.length; k++) v += wt[k]! * px(idx[k]!, y, c);
        r[i * 4 + c] = v;
      }
    }
    rows.set(y, r);
    return r;
  };
  const out = Buffer.alloc(W * H * 4);
  for (let j = 0; j < H; j++) {
    const { idx, wt } = wy[j]!;
    for (let i = 0; i < W; i++) {
      const v = [0, 0, 0, 0];
      for (let k = 0; k < idx.length; k++) {
        const r = row(idx[k]!);
        for (let c = 0; c < 4; c++) v[c]! += wt[k]! * r[i * 4 + c]!;
      }
      const a = Math.max(0, Math.min(1, v[3]!));
      const o = (j * W + i) * 4;
      for (let c = 0; c < 3; c++)
        out[o + c] = a > 1e-4 ? Math.round(Math.max(0, Math.min(1, v[c]! / a)) * 255) : 0;
      out[o + 3] = Math.round(a * 255);
    }
  }
  return out;
}

/** A coverage mask is solid only where it is solid `radius` pixels all round. */
function erode(mask: Buffer, radius: number, W: number, H: number) {
  const out = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let solid = 1;
      for (let dy = -radius; dy <= radius && solid; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          // past the frame's edge is not an edge of the shape: only the cut is eroded
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          if (mask[yy * W + xx]! < 255) {
            solid = 0;
            break;
          }
        }
      out[y * W + x] = solid;
    }
  return out;
}

/** One section's runtime art, cut from the fitted image. */
async function sectionFrame(g: PackGuide, index: number, src: Rgba, fit: Fit) {
  const art = g.sections[index]!.art;
  const { width: W, height: H } = size(art);
  const f = sectionArtOnGuide(g, index);
  // the art's rectangle in image pixels, exactly (it may run past the image's edges)
  const out = resample(
    src,
    fit.s * f.x + fit.tx,
    fit.s * f.y + fit.ty,
    fit.s * f.width,
    fit.s * f.height,
    W,
    H,
  );
  // the sedan's cut, in this art's runtime pixels
  if (g.id.startsWith("sedan")) {
    const cut = sedanCut(g);
    const toFrame = (p: Point) => ({
      x: ((p.x - f.x) / f.width) * W,
      y: ((p.y - f.y) / f.height) * H,
    });
    const points = (poly: Point[]) =>
      poly
        .map(toFrame)
        .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(" ");
    // drawn on black so the hole's soft edge is a real fade to nothing
    const svgMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/><polygon points="${points(cut.nearerShape)}" fill="#fff"/>${
        cut.nearerHole ? `<polygon points="${points(cut.nearerHole)}" fill="#000"/>` : ""
      }</svg>`,
    );
    const mask = await sharp(svgMask).extractChannel(0).raw().toBuffer();
    const nearer = art === cut.nearer;
    // The nearer section is drawn over the farther. It keeps its half with a soft
    // edge; the farther gives up only what lies wholly inside that half, so it stays
    // solid under the nearer one's soft edge. Complementary soft masks never add up
    // to solid when one is drawn over the other: they leave a faint line of
    // whatever is behind the car along the cut.
    const inner = nearer ? null : erode(mask, 2, W, H);
    for (let i = 0; i < W * H; i++) {
      const keep = nearer ? mask[i]! / 255 : 1 - inner![i]!;
      out[i * 4 + 3] = Math.round(out[i * 4 + 3]! * keep);
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
  // every other kind at rotation 90 has art of its own
  const suffix = g.rotation === 90 && g.id !== "planter" ? "-90" : "";
  return `${art}-${state}${suffix}.webp`;
}

/** How far a wreck may be moved onto its footprint, in metres along the ground. */
const WRECK_SHIFT_LIMIT = 0.5;

/**
 * Place a wreck on its footprint by translation alone: the shift (within
 * WRECK_SHIFT_LIMIT) that leaves the least of it outside its volume. A redraw keeps the
 * object's scale, so its fit is the intact one's; only where it stands may differ.
 */
async function registerWreck(
  g: PackGuide,
  fit: Fit,
  shot: Awaited<ReturnType<typeof load>>,
): Promise<Fit> {
  const step = 4;
  const { width: W, height: H } = shot.img;
  const w = Math.ceil(W / step);
  const h = Math.ceil(H / step);
  const pad = Math.ceil((WRECK_SHIFT_LIMIT * 64 * g.scale * fit.s) / step);
  // the volume at the intact fit, coarse, on a canvas padded for the search
  const poly = wreckVolume(g)
    .map(
      (b) =>
        `<polygon points="${b.hull
          .map(
            (p) =>
              `${((fit.s * p.x + fit.tx) / step + pad).toFixed(2)},${((fit.s * p.y + fit.ty) / step + pad).toFixed(2)}`,
          )
          .join(" ")}" fill="#fff"/>`,
    )
    .join("");
  const MW = w + 2 * pad;
  const MH = h + 2 * pad;
  const mask = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${MH}"><rect width="${MW}" height="${MH}" fill="#000"/>${poly}</svg>`,
    ),
  )
    .extractChannel(0)
    .raw()
    .toBuffer();
  // the wreck's solid pixels, coarse
  const solid: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (shot.img.data[(y * step * W + x * step) * 4 + 3]! >= 128) solid.push(x, y);
  const outside = (dx: number, dy: number) => {
    let n = 0;
    for (let i = 0; i < solid.length; i += 2) {
      const x = solid[i]! + pad - dx;
      const y = solid[i + 1]! + pad - dy;
      if (mask[y * MW + x]! < 128) n++;
    }
    return n;
  };
  let best = { dx: 0, dy: 0, n: outside(0, 0) };
  const centre = best.n;
  for (let dy = -pad; dy <= pad; dy++)
    for (let dx = -pad; dx <= pad; dx++) {
      if (dx * dx + dy * dy > pad * pad) continue;
      const n = outside(dx, dy);
      // prefer the smaller move when two are as good
      if (n < best.n || (n === best.n && dx * dx + dy * dy < best.dx ** 2 + best.dy ** 2))
        best = { dx, dy, n };
    }
  // a wreck that already lies inside its volume where it stands is left there
  if (centre / Math.max(1, solid.length / 2) <= WRECK_TOLERANCE || best.n >= centre) return fit;
  const metres = (Math.hypot(best.dx, best.dy) * step) / (64 * g.scale * fit.s);
  log(
    shot.name,
    `placed on its footprint: moved ${metres.toFixed(2)} m (limit ${WRECK_SHIFT_LIMIT} m)`,
  );
  // the volume moves by (dx, dy) to meet the art: the same as the art meeting the volume
  return { s: fit.s, tx: fit.tx + best.dx * step, ty: fit.ty + best.dy * step };
}

/**
 * The WRECKED image against its volume (`wreckVolume`): how much of the remains stands
 * above what a walkable wreck may, and the guide and the check sheet for a redraw.
 * The guide is drawn on the canvas Picasso actually returns, in the intact image's
 * fit, so a corrected wreck lands where the intact object stood.
 */
async function wreckCheck(
  g: PackGuide,
  fit: Fit,
  shot: Awaited<ReturnType<typeof load>>,
  canvas: number,
  /** Where the intact object stands: the layout for a redraw is drawn there. */
  layoutFit: Fit = fit,
) {
  const blocksAt = (f: Fit) => {
    const toImage = (poly: Point[]) =>
      poly.map((p) => ({ x: f.s * p.x + f.tx, y: f.s * p.y + f.ty }));
    return wreckVolume(g).map((b) => ({ hull: toImage(b.hull), top: toImage(b.top) }));
  };
  const layout = blocksAt(layoutFit);
  const volume = blocksAt(fit).map((b) => b.hull);
  const ceiling = `<polygon points="${layout[0]!.top.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="#8f989d" stroke="#1d2327" stroke-width="3" stroke-linejoin="round"/>`;
  // the debris layers first and lighter, the body's block over them and darker
  const polysOf =
    (v: Point[][]) =>
    (fill: string, extra = "", debrisFill = fill) =>
      [...v.slice(1).map((poly) => ({ poly, fill: debrisFill })), { poly: v[0]!, fill }]
        .map(
          ({ poly, fill }) =>
            `<polygon points="${poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="${fill}" ${extra}/>`,
        )
        .join("");
  const polys = polysOf(volume);
  // the gate: the same volume with an apron of flat ground around it (`WRECK_APRON`)
  const gate = wreckVolume(g, WRECK_APRON).map((b) =>
    b.hull.map((p) => ({ x: fit.s * p.x + fit.tx, y: fit.s * p.y + fit.ty })),
  );
  const gateMask = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${shot.img.width}" height="${shot.img.height}"><rect width="${shot.img.width}" height="${shot.img.height}" fill="#000"/>${polysOf(gate)("#fff")}</svg>`,
    ),
  )
    .extractChannel(0)
    .raw()
    .toBuffer();
  const layoutPolys = polysOf(layout.map((b) => b.hull));
  const { width: W, height: H } = shot.img;
  const mask = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/>${polys("#fff")}</svg>`,
    ),
  )
    .extractChannel(0)
    .raw()
    .toBuffer();
  // red: too tall, the gate; amber: flat debris past the prop's own ground, reported
  let solid = 0;
  let over = 0;
  let spill = 0;
  const marked = Buffer.from(shot.img.data);
  const paint = (i: number, r: number, g: number, b: number) => {
    marked[i * 4] = r;
    marked[i * 4 + 1] = g;
    marked[i * 4 + 2] = b;
    marked[i * 4 + 3] = 255;
  };
  for (let i = 0; i < W * H; i++) {
    if (shot.img.data[i * 4 + 3]! < 128) continue;
    solid++;
    if (gateMask[i]! < 128) {
      over++;
      paint(i, 255, 40, 40);
    } else if (mask[i]! < 128) {
      spill++;
      paint(i, 255, 176, 32);
    }
  }
  const share = over / solid;
  const pending = TALL_WRECKS_PENDING.has(g.id);
  log(
    shot.name,
    `wreck ${(share * 100).toFixed(1)}% above its volume (limit ${WRECK_TOLERANCE * 100}%), ${((spill / solid) * 100).toFixed(1)}% lying flat past its ground (within ${WRECK_APRON} m)${pending && share > WRECK_TOLERANCE ? " WAIVED: redraw commissioned" : ""}`,
  );
  if (share > WRECK_TOLERANCE && !pending)
    fail(shot.name, `${(share * 100).toFixed(1)}% of the remains stand above the wreck volume`);
  if (pending && share <= WRECK_TOLERANCE)
    log(shot.name, "now within its volume: take it off TALL_WRECKS_PENDING");
  if (check) return;
  await mkdir(WRECK_GUIDES, { recursive: true });
  // the layout to attach: the key, the 2 m ground, the volume in grey with its ceiling
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}"><rect width="${canvas}" height="${canvas}" fill="#ff00ff"/>${layoutPolys(
        "#6f787d",
        'stroke="#1d2327" stroke-width="3" stroke-linejoin="round"',
        "#b3babe",
      )}${ceiling}</svg>`,
    ),
  )
    .png()
    .toFile(`${WRECK_GUIDES}/${g.id}-wreck-layout.png`);
  // the check sheet (never attach): today's wreck, red where it stands too tall
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 58, g: 66, b: 71, alpha: 1 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${polys(
            "#9aa3a8",
            'fill-opacity="0.35" stroke="#e8f4ff" stroke-width="3" stroke-dasharray="12 8"',
          )}</svg>`,
        ),
      },
      { input: marked, raw: { width: W, height: H, channels: 4 } },
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="60"><text x="20" y="42" font-family="DejaVu Sans" font-size="30" fill="#ffffff">${shot.name}: ${(share * 100).toFixed(1)}% too tall (red), ${((spill / solid) * 100).toFixed(1)}% flat past its ground (amber)</text></svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toFile(`${WRECK_GUIDES}/${g.id}-wreck-check.png`);
}

if (!check) await mkdir(OUT, { recursive: true });
const sheet: {
  label: string;
  frames: { buf: Buffer; offset: Point; g: PackGuide; art: string }[];
}[] = [];
const sedanFrames = new Map<string, { buf: Buffer; offset: Point; g: PackGuide; art: string }[]>();
for (const g of PACK) {
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
    // a wreck is placed on its own footprint: the redraw may sit a little off where the
    // intact object stood, so it is moved (never scaled) to lie inside its volume
    const at = state === "wrecked" ? await registerWreck(g, fit, shot) : fit;
    const frames: { buf: Buffer; offset: Point; g: PackGuide; art: string }[] = [];
    let kept = 0;
    for (let i = 0; i < g.sections.length; i++) {
      const buf = await sectionFrame(g, i, shot.img, at);
      kept += alphaSum(buf);
      frames.push({ buf, offset: g.sections[i]!.offset, g, art: g.sections[i]!.art });
      if (!check)
        await writeFile(
          `${OUT}/${fileFor(g, g.sections[i]!.art, state)}`,
          await sharp(buf, { raw: { ...size(g.sections[i]!.art), channels: 4 } })
            .webp({ quality: 86, alphaQuality: 100, effort: 6 })
            .toBuffer(),
        );
    }
    // how much of the object made it into the frames (runtime px scale back to image px)
    const scaleBack = (fit.s * sectionFrameOnGuide(g, 0).width) / (FRAME.width * K);
    const clipped = 1 - (kept * scaleBack * scaleBack) / alphaSum(shot.img.data);
    log(
      shot.name,
      `key ${(shot.key * 100).toFixed(1)}%  fringe ${(shot.fringe * 100).toFixed(3)}%  drift ${((drift / w) * 100).toFixed(1)}%  clipped ${(clipped * 100).toFixed(1)}%`,
    );
    if (state !== "wrecked" && drift / w > 0.03)
      fail(shot.name, `moved ${((drift / w) * 100).toFixed(1)}% against the intact image`);
    if (state === "wrecked") await wreckCheck(g, at, shot, intact.img.width, fit);
    sheet.push({ label: shot.name, frames });
    if (g.id.startsWith("sedan")) sedanFrames.set(`${g.id}-${state}`, frames);
    // The seam check: the two intact halves, laid over each other exactly as the board
    // places them, must cover the car as solidly as the image did.
    if (g.id.startsWith("sedan") && state === "intact") {
      const placed = placeFrames(drawOrder(frames), 1);
      const f0 = sectionFrameOnGuide(g, 0);
      const k = K;
      const whole = resample(
        shot.img,
        fit.s * (f0.x + (placed.minX / k) * g.scale) + fit.tx,
        fit.s * (f0.y + (placed.minY / k) * g.scale) + fit.ty,
        (fit.s * f0.width * placed.width) / (FRAME.width * K),
        (fit.s * f0.height * placed.height) / (FRAME.height * K),
        placed.width,
        placed.height,
      );
      // inside the car only: the outline itself differs by resampling, not by the cut
      const W = placed.width;
      const solid = (x: number, y: number) =>
        x >= 0 && y >= 0 && x < W && y < placed.height && whole[(y * W + x) * 4 + 3]! >= 250;
      const inside = (i: number) => {
        const x = i % W;
        const y = Math.floor(i / W);
        for (let d = -3; d <= 3; d++)
          if (!solid(x + d, y) || !solid(x, y + d) || !solid(x + d, y + d) || !solid(x + d, y - d))
            return false;
        return true;
      };
      let seam = 0;
      for (let i = 0; i < W * placed.height; i++)
        if (placed.data[i * 4 + 3]! < 0.97 && inside(i)) seam++;
      log(shot.name, `seam: ${seam} px inside the car that the two halves leave see-through`);
      if (process.env.SEAM_DEBUG) {
        const map = Buffer.alloc(placed.width * placed.height * 3);
        for (let i = 0; i < placed.width * placed.height; i++) {
          const d = whole[i * 4 + 3]! / 255 - placed.data[i * 4 + 3]!;
          map[i * 3] = d > 0.03 && inside(i) ? 255 : 0;
          map[i * 3 + 1] = Math.round(placed.data[i * 4 + 3]! * 120);
          map[i * 3 + 2] = d < -0.03 ? 255 : 0;
        }
        await sharp(map, { raw: { width: placed.width, height: placed.height, channels: 3 } })
          .png()
          .toFile(`${process.env.SEAM_DEBUG}/${shot.name}.png`);
      }
      if (seam > 25) fail(shot.name, `${seam} px of seam between the sections (limit 25)`);
    }
  }
}

/** The board draws the nearer sedan section over the farther one. */
function drawOrder<T extends { art: string; g: PackGuide }>(frames: T[]) {
  if (!frames[0]!.g.id.startsWith("sedan")) return frames;
  const near = sedanCut(frames[0]!.g).nearer;
  return [...frames.filter((f) => f.art !== near), ...frames.filter((f) => f.art === near)];
}

/**
 * Lay frames over each other at their exact (fractional) offsets, as the board does,
 * scaled by `scale`; later frames are drawn over earlier ones. Premultiplied float RGBA.
 */
function placeFrames(frames: { buf: Buffer; offset: Point; art: string }[], scale: number) {
  // where each frame's art starts, in runtime px relative to section 0's 2 m frame
  const at = frames.map((f) => {
    const pad = artPad(f.art);
    return { x: (f.offset.x - pad.side) * K, y: (f.offset.y - pad.top) * K, ...size(f.art) };
  });
  const minX = Math.min(...at.map((a) => a.x));
  const minY = Math.min(...at.map((a) => a.y));
  const width = Math.ceil((Math.max(...at.map((a) => a.x + a.width)) - minX) * scale) + 2;
  const height = Math.ceil((Math.max(...at.map((a) => a.y + a.height)) - minY) * scale) + 2;
  const data = new Float32Array(width * height * 4);
  // the board draws the nearer section last; callers pass frames in drawing order
  for (const [n, f] of frames.entries()) {
    const { width: FW, height: FH } = at[n]!;
    const layer = new Float32Array(width * height * 4);
    const ox = (at[n]!.x - minX) * scale;
    const oy = (at[n]!.y - minY) * scale;
    const w = Math.ceil(FW * scale);
    const h = Math.ceil(FH * scale);
    const step = 1 / scale;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        // sample the frame at this pixel's centre (bilinear), into layer at (x+ox, y+oy)
        const sx = (x + 0.5) * step - 0.5;
        const sy = (y + 0.5) * step - 0.5;
        const v = [0, 0, 0, 0];
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ] as const) {
          const px = x0 + dx;
          const py = y0 + dy;
          if (px < 0 || py < 0 || px >= FW || py >= FH) continue;
          const wgt = (dx ? sx - x0 : 1 - (sx - x0)) * (dy ? sy - y0 : 1 - (sy - y0));
          const i = (py * FW + px) * 4;
          const a = f.buf[i + 3]! / 255;
          v[0]! += wgt * (f.buf[i]! / 255) * a;
          v[1]! += wgt * (f.buf[i + 1]! / 255) * a;
          v[2]! += wgt * (f.buf[i + 2]! / 255) * a;
          v[3]! += wgt * a;
        }
        // the layer's own pixel grid is offset by a fraction: split it bilinearly
        const fx = ox - Math.floor(ox);
        const fy = oy - Math.floor(oy);
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ] as const) {
          const tx = x + Math.floor(ox) + dx;
          const ty = y + Math.floor(oy) + dy;
          if (tx >= width || ty >= height) continue;
          const wgt = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
          const o = (ty * width + tx) * 4;
          for (let c = 0; c < 4; c++) layer[o + c]! += wgt * v[c]!;
        }
      }
    for (let i = 0; i < width * height; i++) {
      const a = layer[i * 4 + 3]!;
      for (let c = 0; c < 4; c++) data[i * 4 + c] = layer[i * 4 + c]! + data[i * 4 + c]! * (1 - a);
    }
  }
  return { data, width, height, minX, minY };
}

/** A placed composite as an opaque image over a flat background colour. */
function flatten(p: ReturnType<typeof placeFrames>, bg: [number, number, number]) {
  const out = Buffer.alloc(p.width * p.height * 3);
  for (let i = 0; i < p.width * p.height; i++) {
    const a = p.data[i * 4 + 3]!;
    for (let c = 0; c < 3; c++)
      out[i * 3 + c] = Math.round(
        Math.max(0, Math.min(1, p.data[i * 4 + c]! + (bg[c]! / 255) * (1 - a))) * 255,
      );
  }
  return out;
}

/** Lay out labelled cells of placed composites into one JPEG. */
async function proofSheet(
  cells: { label: string; frames: { buf: Buffer; offset: Point; g: PackGuide; art: string }[] }[],
  cols: number,
  cell: { w: number; h: number },
  file: string,
) {
  const rows = Math.ceil(cells.length / cols);
  const composites: sharp.OverlayOptions[] = [];
  for (const [n, entry] of cells.entries()) {
    const probe = placeFrames(entry.frames, 1);
    const scale = Math.min((cell.w - 20) / probe.width, (cell.h - 40) / probe.height);
    const placed = placeFrames(drawOrder(entry.frames), scale);
    composites.push({
      input: flatten(placed, [58, 66, 71]),
      raw: { width: placed.width, height: placed.height, channels: 3 },
      left: (n % cols) * cell.w + 10,
      top: Math.floor(n / cols) * cell.h + 30,
    });
    composites.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${cell.w}" height="28"><text x="8" y="20" font-family="DejaVu Sans" font-size="18" fill="#e6edf0">${entry.label}</text></svg>`,
      ),
      left: (n % cols) * cell.w,
      top: Math.floor(n / cols) * cell.h,
    });
  }
  await sharp({
    create: { width: cols * cell.w, height: rows * cell.h, channels: 3, background: "#3a4247" },
  })
    .composite(composites)
    .jpeg({ quality: 86 })
    .toFile(file);
}

if (!check) {
  /* Every state rebuilt from its runtime frames alone, placed exactly as the board does. */
  await proofSheet(
    sheet,
    3,
    { w: 520, h: 520 },
    roundTwo
      ? "docs/street-props-pack/round-2/imported-frames.jpg"
      : "docs/street-props-pack/imported-frames.jpg",
  );
  /* The sedan's two sections in mixed states: what a fight can leave. */
  const mixed: (typeof sheet)[number][] = [];
  for (const id of roundTwo ? [] : ["sedan-r90", "sedan-r0"])
    for (const [engine, cabin] of [
      ["intact", "intact"],
      ["wrecked", "intact"],
      ["intact", "wrecked"],
      ["damaged", "wrecked"],
    ] as const) {
      const e = sedanFrames.get(`${id}-${engine}`)!.find((f) => f.art === "sedan-engine")!;
      const c = sedanFrames.get(`${id}-${cabin}`)!.find((f) => f.art === "sedan-cabin")!;
      mixed.push({ label: `${id.slice(6)}: engine ${engine} / cabin ${cabin}`, frames: [e, c] });
    }
  if (mixed.length)
    await proofSheet(mixed, 4, { w: 420, h: 420 }, "docs/street-props-pack/mixed-sections.jpg");
}

if (failures.length) {
  console.error("\nRejected:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
console.log(check ? "all pass (nothing written)" : `written to ${OUT}`);
