/**
 * Draws the storefront art pack's guides from `storefrontPack.ts`.
 *
 *     bun run tools/scenes/storefront-guides.ts [--port 5180]
 *
 * Writes to docs/storefront-pack/:
 *   guides/<asset>-layout.png   exact canvas size, zones only, no text: the file
 *                               to attach when generating
 *   guides/<asset>-annotated.png  same canvas with dimensions, for people and for
 *                               checking the result against
 *   storefront-elevation.png    the storefront face, straight on, with every asset
 *                               and every number
 *   context-placement.jpg       the real /scene-review renderer (needs a dev server
 *                               on --port and CHROMIUM_PATH) with each asset's
 *                               footprint drawn over it through the scene's own
 *                               projection and camera
 *
 * Nothing here is a second renderer: the placement preview is a screenshot of the
 * shipping one plus a wireframe computed from the same projection and camera.
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { chromium } from "playwright";
import { composeScene } from "@/engine";
import { battlefieldProjection } from "@/features/play/battlefieldProjection";
import { battlefieldCameraPreset } from "@/features/play/courtyard/courtyardPresentation";
import {
  STOREFRONT_BENCHMARK,
  STOREFRONT_FACE,
  STOREFRONT_LEVELS,
  STOREFRONT_PACK,
  STOREFRONT_SIGN,
  packPixelsPerMetre,
  type PackAsset,
} from "@/features/play/courtyard/storefrontPack";

const OUT = "docs/storefront-pack";
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const FONT = `font-family="DejaVu Sans, sans-serif"`;
const svg = (w: number, h: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);

/* ------------------------------------------------------------------ guides */

function guideSvg(a: PackAsset, annotated: boolean) {
  const { w, h } = a.canvas;
  const ppm = packPixelsPerMetre(a).x;
  const keyed = a.key !== null;
  const parts: string[] = [];
  parts.push(
    `<defs><pattern id="hatch" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="#b3261e" fill-opacity=".38"/><line x1="0" y1="0" x2="0" y2="22" stroke="#7a0f0a" stroke-width="5"/></pattern></defs>`,
  );
  parts.push(`<rect width="${w}" height="${h}" fill="${keyed ? a.key : "#8d9aa0"}"/>`);
  if (annotated) {
    // a 0.1 m grid, heavier each half metre
    for (let m = 0.1; m < a.metres.w - 1e-6; m += 0.1) {
      const x = Math.round(m * ppm);
      const half = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
      parts.push(
        `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#000" stroke-opacity="${half ? 0.28 : 0.1}" stroke-width="${half ? 2 : 1}"/>`,
      );
    }
    for (let m = 0.1; m < a.metres.h - 1e-6; m += 0.1) {
      const y = Math.round(m * ppm);
      const half = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
      parts.push(
        `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#000" stroke-opacity="${half ? 0.28 : 0.1}" stroke-width="${half ? 2 : 1}"/>`,
      );
    }
  }
  if (a.id === "awning-fabric")
    // The four 0.4 m stripes, teal first: the one thing about the fabric that is exact.
    for (let i = 0; i < 4; i++)
      parts.push(
        `<rect x="${i * 256}" y="0" width="256" height="${h}" fill="${i % 2 ? "#c6b999" : "#527b76"}" fill-opacity=".55"/>`,
      );
  for (const z of a.protectedZones)
    parts.push(
      `<rect x="${z.rect.x}" y="${z.rect.y}" width="${z.rect.w}" height="${z.rect.h}" fill="url(#hatch)"/>`,
    );
  // The canvas edge is the usable boundary except where a zone covers it.
  parts.push(
    `<rect x="3" y="3" width="${w - 6}" height="${h - 6}" fill="none" stroke="#fff" stroke-width="6"/>`,
  );
  for (const p of a.attachments)
    parts.push(
      `<g stroke="#0b3d91" stroke-width="5"><line x1="${p.x - 26}" y1="${p.y}" x2="${p.x + 26}" y2="${p.y}"/><line x1="${p.x}" y1="${p.y - 26}" x2="${p.x}" y2="${p.y + 26}"/></g><circle cx="${p.x}" cy="${p.y}" r="9" fill="#fff" stroke="#0b3d91" stroke-width="4"/>`,
    );
  if (annotated) {
    const t = (x: number, y: number, s: string, size = 30, anchor = "start") =>
      `<text x="${x}" y="${y}" ${FONT} font-size="${size}" text-anchor="${anchor}" fill="#fff" stroke="#000" stroke-width="5" paint-order="stroke" font-weight="bold">${s}</text>`;
    parts.push(
      t(w / 2, h / 2 - 20, `${a.file}`, Math.round(w / 34), "middle"),
      t(
        w / 2,
        h / 2 + 30,
        `${w} × ${h} px = ${a.metres.w.toFixed(3)} × ${a.metres.h.toFixed(3)} m · ${ppm.toFixed(1)} px/m`,
        Math.round(w / 40),
        "middle",
      ),
    );
    for (const z of a.protectedZones)
      if (z.rect.w > 90 && z.rect.h > 40)
        parts.push(t(z.rect.x + 12, z.rect.y + Math.min(z.rect.h - 10, 36), z.label, 24));
    for (const p of a.attachments)
      parts.push(t(p.x + 34, Math.max(30, Math.min(p.y + 8, h - 44)), p.label, 22));
    for (let m = 0.5; m < a.metres.w; m += 0.5)
      parts.push(t(Math.round(m * ppm) + 4, h - 10, `${m.toFixed(1)} m`, 20));
    for (let m = 0.5; m < a.metres.h; m += 0.5)
      parts.push(t(8, Math.round(m * ppm) - 6, `${m.toFixed(1)} m`, 20));
  }
  return svg(w, h, parts.join(""));
}

/* --------------------------------------------------------------- elevation */

function elevationSvg() {
  const L = STOREFRONT_LEVELS;
  const F = STOREFRONT_FACE;
  const S = 150; // px per metre
  const left = 210;
  const sMax = 12;
  const top = 80;
  const zMax = 4.4;
  const W = left + sMax * S + 260;
  const H = top + zMax * S + 120;
  const X = (s: number) => left + s * S;
  const Y = (z: number) => top + (zMax - z) * S;
  const r = (s0: number, z0: number, s1: number, z1: number, style: string) =>
    `<rect x="${X(s0)}" y="${Y(z1)}" width="${(s1 - s0) * S}" height="${(z1 - z0) * S}" ${style}/>`;
  const label = (x: number, y: number, s: string, size = 22, anchor = "middle", fill = "#10222a") =>
    `<text x="${x}" y="${y}" ${FONT} font-size="${size}" text-anchor="${anchor}" fill="${fill}">${s}</text>`;
  const dim = (s0: number, s1: number, y: number, text: string) =>
    `<g stroke="#10222a" stroke-width="2"><line x1="${X(s0)}" y1="${y}" x2="${X(s1)}" y2="${y}"/><line x1="${X(s0)}" y1="${y - 8}" x2="${X(s0)}" y2="${y + 8}"/><line x1="${X(s1)}" y1="${y - 8}" x2="${X(s1)}" y2="${y + 8}"/></g>${label((X(s0) + X(s1)) / 2, y - 10, text, 20)}`;
  const vdim = (z0: number, z1: number, x: number, text: string) =>
    `<g stroke="#10222a" stroke-width="2"><line x1="${x}" y1="${Y(z0)}" x2="${x}" y2="${Y(z1)}"/><line x1="${x - 8}" y1="${Y(z0)}" x2="${x + 8}" y2="${Y(z0)}"/><line x1="${x - 8}" y1="${Y(z1)}" x2="${x + 8}" y2="${Y(z1)}"/></g><text x="${x - 12}" y="${(Y(z0) + Y(z1)) / 2}" ${FONT} font-size="18" text-anchor="end" fill="#10222a">${text}</text>`;
  const b: string[] = [];
  b.push(`<rect width="${W}" height="${H}" fill="#e9eef0"/>`);
  b.push(r(0, 0, sMax, L.parapetTop, `fill="#a9b0b0" stroke="#10222a" stroke-width="3"`));
  b.push(r(0, 0, sMax, 0.12, `fill="#6e777a"`));
  b.push(
    r(
      0,
      L.parapetTop - 0.35,
      sMax,
      L.parapetTop,
      `fill="#8e9696" stroke="#10222a" stroke-width="2"`,
    ),
  );
  // fascia and sign
  b.push(
    r(
      0,
      L.fasciaBottom,
      sMax,
      L.fasciaTop,
      `fill="#c9ced0" stroke="#10222a" stroke-width="2" stroke-dasharray="10 6"`,
    ),
  );
  b.push(label(X(7.4), Y(L.fasciaTop - 0.42), "fascia band (code)", 20));
  b.push(
    r(
      STOREFRONT_SIGN.s0,
      STOREFRONT_SIGN.z0,
      STOREFRONT_SIGN.s0 + STOREFRONT_SIGN.width,
      STOREFRONT_SIGN.z0 + STOREFRONT_SIGN.height,
      `fill="#f2c14e" fill-opacity=".75" stroke="#7a4b00" stroke-width="4"`,
    ),
  );
  b.push(
    label(
      X(STOREFRONT_SIGN.s0 + STOREFRONT_SIGN.width / 2),
      Y(3.2) + 7,
      "深夜市場 sign (code)",
      22,
      "middle",
      "#4a2a00",
    ),
  );
  // door, shutter housing and rails
  b.push(
    r(
      F.doorCentre - 0.8,
      0,
      F.doorCentre + 0.8,
      L.doorHeight,
      `fill="#5f7480" stroke="#10222a" stroke-width="3"`,
    ),
  );
  b.push(
    r(
      F.doorCentre - 0.9,
      L.doorHeight,
      F.doorCentre + 0.9,
      L.housingTop + 0.05,
      `fill="#7b8a92" stroke="#10222a" stroke-width="3"`,
    ),
  );
  for (const dx of [-0.88, 0.8])
    b.push(r(F.doorCentre + dx, 0, F.doorCentre + dx + 0.08, L.doorHeight, `fill="#3b4a52"`));
  b.push(label(X(F.doorCentre), Y(1.1), "D shutter wear", 22, "middle", "#fff"));
  b.push(
    label(
      X(F.doorCentre + 1.0),
      Y(1.2),
      "← shutter housing z 2.2–2.4 and side rails: code",
      17,
      "start",
    ),
  );
  // awning (front elevation: the slope is hidden, so show its span and wall line)
  b.push(
    r(
      0,
      L.awningWall - 0.05,
      L.awningSpan ?? 4,
      L.awningWall + 0.02,
      `fill="#527b76" stroke="#10222a" stroke-width="2"`,
    ),
  );
  b.push(
    r(
      0,
      L.awningOuter - 0.15,
      4,
      L.awningOuter,
      `fill="#527b76" fill-opacity=".85" stroke="#10222a" stroke-width="2"`,
    ),
  );
  b.push(
    label(X(2), Y(2.57) + 7, "C awning fabric (a slope: see context image)", 18, "middle", "#fff"),
  );
  // windows
  for (const start of F.bayStarts) {
    b.push(
      r(
        start,
        L.riser,
        start + F.bayWidth,
        L.glazingTop,
        `fill="#3c5560" stroke="#10222a" stroke-width="4"`,
      ),
    );
    b.push(
      `<line x1="${X(start + F.bayWidth / 2)}" y1="${Y(L.glazingTop)}" x2="${X(start + F.bayWidth / 2)}" y2="${Y(L.riser)}" stroke="#10222a" stroke-width="4"/>`,
    );
    b.push(label(X(start + F.bayWidth / 2), Y(1.6), "A window interior", 22, "middle", "#fff"));
    b.push(
      r(
        start,
        0,
        start + F.bayWidth,
        L.riser,
        `fill="#8d9698" stroke="#10222a" stroke-width="2" stroke-dasharray="8 6"`,
      ),
    );
    b.push(label(X(start + F.bayWidth / 2), Y(0.4), "stall riser (code)", 18));
  }
  b.push(
    `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(sMax)}" y2="${Y(0)}" stroke="#10222a" stroke-width="5"/>`,
  );
  // dimensions
  b.push(dim(F.doorCentre - 0.8, F.doorCentre + 0.8, Y(0) + 42, "door 1.6"));
  for (const start of F.bayStarts) b.push(dim(start, start + F.bayWidth, Y(0) + 42, "bay 2.2"));
  b.push(dim(0, 4, Y(0) + 86, "awning span 4.0 (saved)"));
  b.push(dim(0, F.doorCentre, Y(0) + 118, `${F.doorCentre}`));
  b.push(vdim(0, L.riser, X(-0.06), `riser ${L.riser.toFixed(3)}`));
  b.push(
    vdim(L.riser, L.glazingTop, X(-0.06) - 0, `glazing ${(L.glazingTop - L.riser).toFixed(3)}`),
  );
  b.push(vdim(0, L.parapetTop, X(-0.06) - 120, `wall ${L.parapetTop}`));
  b.push(
    vdim(L.fasciaBottom, L.fasciaTop, X(sMax) + 22, `fascia ${L.fasciaBottom}–${L.fasciaTop}`),
  );
  b.push(
    label(
      left,
      40,
      "Storefront, benchmark seed 7 · building_0 · north face · straight-on elevation · metres along the wall from the west corner (s) and above the pavement (z)",
      22,
      "start",
    ),
  );
  b.push(
    label(
      left,
      64,
      `awning wall line z ${L.awningWall}, outer edge z ${L.awningOuter}, projection ${L.awningProjection} m (saved geometry); window bays also start at s 3.5, 6.5, 9.5, 12.5, 15.5`,
      18,
      "start",
    ),
  );
  for (let s = 0; s <= sMax; s += 1)
    b.push(label(X(s), Y(0) + 24, `${s}`, 16, "middle", "#53656c"));
  return { buffer: svg(W, H, b.join("")), W, H };
}

/* ------------------------------------------------------- context placement */

async function contextPlacement(port: string) {
  const scene = composeScene(STOREFRONT_BENCHMARK.recipe, STOREFRONT_BENCHMARK.seed);
  const arena = scene.layout.arena;
  const env = arena.environment!;
  const structure = env.structures.find((s) => s.id === STOREFRONT_BENCHMARK.structureId)!;
  const { project, pixelsPerMetre } = battlefieldProjection(
    arena.extent.width,
    arena.extent.height,
  );
  const preset = battlefieldCameraPreset(arena, "play");
  const viewport = { width: 2000, height: 1400 };
  const browser = await chromium.launch({
    executablePath: process.env["CHROMIUM_PATH"],
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.goto(
    `http://127.0.0.1:${port}/scene-review?place=${STOREFRONT_BENCHMARK.recipe}&seed=${STOREFRONT_BENCHMARK.seed}&actors=0&framing=play&reveal=1`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(3500);
  const box = (await (await page.$("canvas"))!.boundingBox())!;
  const shot = await page.screenshot({ clip: box });
  await browser.close();

  const zoom = Math.min(box.width / 1100, box.height / 680) * preset.zoom;
  const centre = { x: 550 + preset.x, y: 340 + preset.y };
  const toScreen = (s: number, out: number, z: number) => {
    // `out` metres from the wall along world -y; s along +x from the building's corner
    const p = project({ x: structure.rect.x + s, y: structure.rect.y - out });
    return {
      x: (p.x - centre.x) * zoom + box.width / 2,
      y: (p.y - z * pixelsPerMetre - centre.y) * zoom + box.height / 2,
    };
  };
  const quad = (pts: { x: number; y: number }[], color: string, name: string) => {
    const d = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const c = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), {
      x: 0,
      y: 0,
    });
    return `<polygon points="${d}" fill="${color}" fill-opacity=".28" stroke="${color}" stroke-width="3"/><text x="${c.x}" y="${c.y + 9}" ${FONT} font-size="28" font-weight="bold" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="5" paint-order="stroke">${name}</text>`;
  };
  const L = STOREFRONT_LEVELS;
  const F = STOREFRONT_FACE;
  const wall = (s0: number, z0: number, s1: number, z1: number) => [
    toScreen(s0, 0, z0),
    toScreen(s1, 0, z0),
    toScreen(s1, 0, z1),
    toScreen(s0, 0, z1),
  ];
  const parts: string[] = [];
  for (const start of F.bayStarts)
    parts.push(quad(wall(start, L.riser, start + F.bayWidth, L.glazingTop), "#ff4fd8", "A"));
  parts.push(
    quad(
      wall(
        STOREFRONT_SIGN.s0,
        STOREFRONT_SIGN.z0,
        STOREFRONT_SIGN.s0 + STOREFRONT_SIGN.width,
        STOREFRONT_SIGN.z0 + STOREFRONT_SIGN.height,
      ),
      "#ffd23f",
      "sign",
    ),
  );
  parts.push(
    quad(
      [
        toScreen(0, 0, L.awningWall),
        toScreen(4, 0, L.awningWall),
        toScreen(4, L.awningProjection, L.awningOuter),
        toScreen(0, L.awningProjection, L.awningOuter),
      ],
      "#35e0c2",
      "C",
    ),
  );
  parts.push(quad(wall(F.doorCentre - 0.8, 0, F.doorCentre + 0.8, L.housingTop), "#ff7a2f", "D"));
  // the saved entrance and the awning's ground footprint
  const e = env.entrances!.find((x) => x.id === STOREFRONT_BENCHMARK.entranceId)!;
  const ep = project(e.position);
  const eq = {
    x: (ep.x - centre.x) * zoom + box.width / 2,
    y: (ep.y - centre.y) * zoom + box.height / 2,
  };
  parts.push(
    `<circle cx="${eq.x}" cy="${eq.y}" r="14" fill="none" stroke="#fff" stroke-width="4"/><text x="${eq.x + 22}" y="${eq.y + 8}" ${FONT} font-size="24" font-weight="bold" fill="#fff" stroke="#000" stroke-width="5" paint-order="stroke">saved entrance</text>`,
  );
  // nearest saved lamp, if it is on screen
  for (const d of env.dressing.filter((d) => d.kind === "lamp")) {
    const p = project(d.position);
    const q = {
      x: (p.x - centre.x) * zoom + box.width / 2,
      y: (p.y - centre.y) * zoom + box.height / 2,
    };
    if (q.x > 0 && q.x < box.width && q.y > 0 && q.y < box.height)
      parts.push(
        `<circle cx="${q.x}" cy="${q.y}" r="14" fill="#ffe08a" stroke="#000" stroke-width="3"/><text x="${q.x + 20}" y="${q.y + 8}" ${FONT} font-size="24" font-weight="bold" fill="#ffe08a" stroke="#000" stroke-width="5" paint-order="stroke">saved lamp</text>`,
      );
  }
  const shotMeta = await sharp(shot).metadata();
  const probe = toScreen(F.doorCentre, 0, 0);
  // crop to the storefront with generous margin, then enlarge for reading
  const cx = Math.max(0, Math.round(probe.x - 360));
  const cy = Math.max(0, Math.round(probe.y - 520));
  const cw = Math.min(shotMeta.width! - cx, 1500);
  const ch = Math.min(shotMeta.height! - cy, 820);
  const overlaid = await sharp(shot)
    .composite([{ input: svg(shotMeta.width!, shotMeta.height!, parts.join("")), left: 0, top: 0 }])
    .png()
    .toBuffer();
  await sharp(overlaid)
    .extract({ left: cx, top: cy, width: cw, height: ch })
    .jpeg({ quality: 92 })
    .toFile(`${OUT}/context-placement.jpg`);
  await sharp(shot)
    .extract({ left: cx, top: cy, width: cw, height: ch })
    .jpeg({ quality: 92 })
    .toFile(`${OUT}/context-renderer-only.jpg`);
  return { zoom, probe };
}

/* -------------------------------------------------------------------- main */

await mkdir(`${OUT}/guides`, { recursive: true });
for (const a of STOREFRONT_PACK) {
  await sharp(guideSvg(a, false)).png().toFile(`${OUT}/guides/${a.id}-layout.png`);
  await sharp(guideSvg(a, true)).png().toFile(`${OUT}/guides/${a.id}-annotated.png`);
}
const elevation = elevationSvg();
await sharp(elevation.buffer).png().toFile(`${OUT}/storefront-elevation.png`);
if (!process.argv.includes("--no-browser")) {
  const info = await contextPlacement(arg("port", "5180"));
  console.log("context camera zoom", info.zoom.toFixed(3));
}
console.log("guides written to", OUT);
