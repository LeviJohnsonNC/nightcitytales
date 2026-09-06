/**
 * Fit the warp that puts atlas coordinates on the neon map.
 *
 *     node tools/atlas/fit_map_warp.mjs            # fit, report, write the JSON
 *     node tools/atlas/fit_map_warp.mjs --dry      # fit and report, write nothing
 *
 * WHY A WARP AND NOT A TRANSFORM
 * Every position in this codebase — 24 districts, 172 locations, 9 landmarks,
 * 37 street marks and 2,135 traced district polygon runs — is a percentage of
 * the R. Talsorian atlas map. The neon map is the same city drawn again, not
 * the same image rescaled: fitting one scale-and-offset to the whole picture
 * leaves a mean error of 1.2% and a worst of 7%, and fitting the north and the
 * south separately produces offsets 7% apart. Two halves of one picture
 * disagree about where the geography sits, so no affine transform can place
 * pins correctly everywhere.
 *
 * A mesh can. This fits a grid of control points over the atlas map, each
 * saying where that spot landed on the neon one, and the renderer bilinearly
 * interpolates between them. Nothing stored anywhere changes: the percentages
 * stay exactly what they were and the warp is applied only when drawing.
 *
 * HOW IT FITS
 * The yellow highway network is identical in both — same roads, redrawn — and
 * it is thin, so alignment has a sharp optimum rather than the broad one a
 * coastline or a landmass gives. Each node searches locally for the offset that
 * best lines up the roads near it, measured as a symmetric Chamfer distance.
 * Nodes with too little road nearby cannot be fitted and inherit the affine
 * estimate, then the whole mesh is smoothed so those never pull a fold into it.
 */
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const OLD_MAP = "public/images/map/night-city.jpg";
const NEW_MAP = "images/night-city-map.png";
const OUT = "src/data/atlas/map-warp.json";

/** Working resolution. The fit is in fractions, so this only sets precision. */
const N = 360;
/** Mesh nodes across and down the atlas map. */
const COLS = 11;
const ROWS = 15;
/** How far a node may move from the affine estimate, as a fraction of width. */
const SEARCH = 0.05;
/** Road pixels within this radius of a node are what that node is fitted on. */
const RADIUS = 0.085;
/** A node needs at least this many road pixels near it to be trusted. */
const MIN_POINTS = 15;

const yellow = (r, g, b) => r > 120 && g > 110 && Math.abs(r - g) < 70 && b < g - 55;

async function roads(file) {
  const { data, info } = await sharp(file)
    .resize({ width: N })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const m = new Uint8Array(info.width * info.height);
  const pts = [];
  for (let i = 0; i < m.length; i += 1) {
    if (!yellow(data[i * 3], data[i * 3 + 1], data[i * 3 + 2])) continue;
    m[i] = 1;
    pts.push([(i % info.width) / info.width, ((i / info.width) | 0) / info.height]);
  }
  return { m, w: info.width, h: info.height, pts };
}

/** Chessboard distance to the nearest road, in fractions of image width. */
function distanceField(M) {
  const d = new Float32Array(M.w * M.h).fill(1e6);
  for (let i = 0; i < d.length; i += 1) if (M.m[i]) d[i] = 0;
  for (let y = 0; y < M.h; y += 1)
    for (let x = 0; x < M.w; x += 1) {
      const i = y * M.w + x;
      if (x) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y) d[i] = Math.min(d[i], d[i - M.w] + 1);
    }
  for (let y = M.h - 1; y >= 0; y -= 1)
    for (let x = M.w - 1; x >= 0; x -= 1) {
      const i = y * M.w + x;
      if (x < M.w - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < M.h - 1) d[i] = Math.min(d[i], d[i + M.w] + 1);
    }
  return d;
}

const sample = (M, d, fx, fy) =>
  fx < 0 || fy < 0 || fx >= 1 || fy >= 1
    ? null
    : d[((fy * M.h) | 0) * M.w + ((fx * M.w) | 0)] / M.w;

const OLD = await roads(OLD_MAP);
const NEW = await roads(NEW_MAP);
const dNEW = distanceField(NEW);
const dOLD = distanceField(OLD);

// ---------------------------------------------------------------------------
// The affine the mesh starts from.
// ---------------------------------------------------------------------------

function affineCost({ sx, sy, tx, ty }) {
  let sum = 0;
  let n = 0;
  for (const [fx, fy] of OLD.pts) {
    const v = sample(NEW, dNEW, sx * fx + tx, sy * fy + ty);
    if (v !== null) {
      sum += v;
      n += 1;
    }
  }
  for (const [gx, gy] of NEW.pts) {
    const v = sample(OLD, dOLD, (gx - tx) / sx, (gy - ty) / sy);
    if (v !== null) {
      sum += v;
      n += 1;
    }
  }
  return n > 100 ? sum / n : 1e9;
}

let affine = { sx: 0.92, sy: 0.94, tx: 0.03, ty: -0.03 };
for (const [spread, steps] of [
  [0.2, 7],
  [0.06, 7],
  [0.02, 7],
  [0.006, 7],
]) {
  const range = (v, d) =>
    Array.from({ length: steps }, (_, i) => v - d + (2 * d * i) / (steps - 1));
  let best = { ...affine, c: affineCost(affine) };
  for (const sx of range(affine.sx, spread))
    for (const sy of range(affine.sy, spread))
      for (const tx of range(affine.tx, spread / 2))
        for (const ty of range(affine.ty, spread / 2)) {
          const c = affineCost({ sx, sy, tx, ty });
          if (c < best.c) best = { sx, sy, tx, ty, c };
        }
  affine = best;
}
console.log(
  `affine  sx=${affine.sx.toFixed(4)} sy=${affine.sy.toFixed(4)} ` +
    `tx=${affine.tx.toFixed(4)} ty=${affine.ty.toFixed(4)}  mean ${(affine.c * 100).toFixed(2)}%`,
);

// ---------------------------------------------------------------------------
// The mesh.
// ---------------------------------------------------------------------------

const nodes = [];
for (let r = 0; r < ROWS; r += 1) {
  for (let c = 0; c < COLS; c += 1) {
    const fx = c / (COLS - 1);
    const fy = r / (ROWS - 1);
    const near = OLD.pts.filter(([px, py]) => Math.hypot(px - fx, py - fy) <= RADIUS);
    const guess = { x: affine.sx * fx + affine.tx, y: affine.sy * fy + affine.ty };
    if (near.length < MIN_POINTS) {
      nodes.push({ r, c, fx, fy, ...guess, fitted: false, n: near.length, cost: null });
      continue;
    }
    // Weighted so road pixels at the node matter more than ones at the rim.
    const weight = near.map(([px, py]) => 1 - Math.hypot(px - fx, py - fy) / RADIUS);
    let best = null;
    const STEP = SEARCH / 10;
    for (let dx = -SEARCH; dx <= SEARCH + 1e-9; dx += STEP) {
      for (let dy = -SEARCH; dy <= SEARCH + 1e-9; dy += STEP) {
        let sum = 0;
        let wsum = 0;
        for (let i = 0; i < near.length; i += 1) {
          const [px, py] = near[i];
          const v = sample(
            NEW,
            dNEW,
            affine.sx * px + affine.tx + dx,
            affine.sy * py + affine.ty + dy,
          );
          if (v === null) continue;
          sum += v * weight[i];
          wsum += weight[i];
        }
        if (wsum < 1) continue;
        const cost = sum / wsum;
        if (!best || cost < best.cost) best = { dx, dy, cost };
      }
    }
    if (!best) {
      nodes.push({ r, c, fx, fy, ...guess, fitted: false, n: near.length, cost: null });
      continue;
    }
    nodes.push({
      r,
      c,
      fx,
      fy,
      x: guess.x + best.dx,
      y: guess.y + best.dy,
      fitted: true,
      n: near.length,
      cost: best.cost,
    });
  }
}

/** Unfitted nodes take the average of their fitted neighbours' displacement. */
const at = (r, c) => nodes[r * COLS + c];
for (let pass = 0; pass < 4; pass += 1) {
  for (const node of nodes) {
    if (node.fitted) continue;
    const around = [];
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const r = node.r + dr;
      const c = node.c + dc;
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
      const other = at(r, c);
      around.push([
        other.x - (affine.sx * other.fx + affine.tx),
        other.y - (affine.sy * other.fy + affine.ty),
      ]);
    }
    if (!around.length) continue;
    node.x = affine.sx * node.fx + affine.tx + around.reduce((a, b) => a + b[0], 0) / around.length;
    node.y = affine.sy * node.fy + affine.ty + around.reduce((a, b) => a + b[1], 0) / around.length;
  }
}

/** A light smoothing pass, so a single noisy node cannot fold the mesh. */
for (const node of nodes) {
  const around = [];
  for (const [dr, dc] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const r = node.r + dr;
    const c = node.c + dc;
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
    around.push(at(r, c));
  }
  node.sx = node.x * 0.7 + (around.reduce((a, b) => a + b.x, 0) / around.length) * 0.3;
  node.sy = node.y * 0.7 + (around.reduce((a, b) => a + b.y, 0) / around.length) * 0.3;
}
for (const node of nodes) {
  node.x = node.sx;
  node.y = node.sy;
}

// A mesh that folds would send two different places to the same pixel.
let folds = 0;
for (let r = 0; r < ROWS; r += 1)
  for (let c = 1; c < COLS; c += 1) if (at(r, c).x <= at(r, c - 1).x) folds += 1;
for (let c = 0; c < COLS; c += 1)
  for (let r = 1; r < ROWS; r += 1) if (at(r, c).y <= at(r - 1, c).y) folds += 1;

const fitted = nodes.filter((n) => n.fitted).length;
console.log(
  `mesh    ${COLS}x${ROWS}, ${fitted} of ${nodes.length} nodes fitted on road, ${folds} folds`,
);

const warp = {
  houseRule: true,
  note:
    "Where each point of the R. Talsorian atlas map lands on the neon map in " +
    "public/images/map. Every coordinate in the atlas is a percentage of the printed map, and " +
    "the neon map is the same city drawn again rather than the same image rescaled — one " +
    "scale-and-offset leaves a mean error of 1.2% and a worst of 7%, because the north and the " +
    "south of the picture disagree about where the geography sits by 7% of its height. This " +
    "mesh absorbs that. Nothing else changes: percentages stay exactly what they were, and this " +
    "is applied only when drawing.",
  fitNote:
    "Fitted by tools/atlas/fit_map_warp.mjs against the yellow highway network, which is the " +
    "same roads in both pictures and thin enough to have a sharp optimum. Re-run it to " +
    "reproduce this file; do not hand-edit the grid.",
  grid: { cols: COLS, rows: ROWS },
  affine: {
    scaleX: +affine.sx.toFixed(5),
    scaleY: +affine.sy.toFixed(5),
    offsetX: +affine.tx.toFixed(5),
    offsetY: +affine.ty.toFixed(5),
  },
  /** Row-major, ROWS x COLS. Each is where that node of the atlas map landed. */
  points: nodes.map((n) => [+n.x.toFixed(5), +n.y.toFixed(5)]),
};

if (!process.argv.includes("--dry")) {
  await writeFile(OUT, `${JSON.stringify(warp, null, 2)}\n`);
  console.log(`wrote   ${OUT}`);
}

// ---------------------------------------------------------------------------
// What it achieved.
// ---------------------------------------------------------------------------

function warpPoint(fx, fy) {
  const cx = Math.min(COLS - 2, Math.max(0, Math.floor(fx * (COLS - 1))));
  const cy = Math.min(ROWS - 2, Math.max(0, Math.floor(fy * (ROWS - 1))));
  const tx = fx * (COLS - 1) - cx;
  const ty = fy * (ROWS - 1) - cy;
  const p = (r, c) => nodes[r * COLS + c];
  const a = p(cy, cx),
    b = p(cy, cx + 1),
    d = p(cy + 1, cx),
    e = p(cy + 1, cx + 1);
  return {
    x: (a.x * (1 - tx) + b.x * tx) * (1 - ty) + (d.x * (1 - tx) + e.x * tx) * ty,
    y: (a.y * (1 - tx) + b.y * tx) * (1 - ty) + (d.y * (1 - tx) + e.y * tx) * ty,
  };
}

const band = Array.from({ length: 5 }, () => ({ sum: 0, n: 0, max: 0 }));
let sum = 0;
let n = 0;
for (const [fx, fy] of OLD.pts) {
  const w = warpPoint(fx, fy);
  const v = sample(NEW, dNEW, w.x, w.y);
  if (v === null) continue;
  const b = band[Math.min(4, (fy * 5) | 0)];
  b.sum += v;
  b.n += 1;
  if (v > b.max) b.max = v;
  sum += v;
  n += 1;
}
const meta = await sharp(NEW_MAP).metadata();
console.log("\nresidual of the atlas roads on the neon map, after warping:");
band.forEach((b, i) => {
  if (!b.n) return;
  console.log(
    `  y ${(i / 5).toFixed(1)}-${((i + 1) / 5).toFixed(1)}   mean ${((b.sum / b.n) * 100).toFixed(2)}%` +
      `   worst ${(b.max * 100).toFixed(2)}%`,
  );
});
console.log(
  `  OVERALL     mean ${((sum / n) * 100).toFixed(2)}%  ` +
    `= ${((sum / n) * meta.width).toFixed(0)}px on the ${meta.width}x${meta.height} image`,
);
