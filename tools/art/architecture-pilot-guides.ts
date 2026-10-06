/**
 * Guides for the architectural art pilot (`docs/architecture-pilot.md`), drawn from
 * `architecturePack.ts`, and screenshots of where each asset goes.
 *
 *     bun run tools/art/architecture-pilot-guides.ts [--port 5180] [--no-browser]
 *
 * Writes docs/architecture-pilot/:
 *   guides/<asset>-layout.png     exact canvas, the shape to fill: ATTACH this
 *   guides/<asset>-annotated.png  the same with sizes and names: for review, never attach
 *   destination-roof-unit.jpg     the shipping renderer, play zoom, the units outlined
 *   destination-frontage.jpg      the same, the annex's bays and shutter outlined
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { chromium } from "playwright";
import { composeScene, type Point } from "@/engine";
import { battlefieldProjection } from "@/features/play/battlefieldProjection";
import { courtyardCamera } from "@/features/play/courtyard/courtyardPresentation";
import { framePoint } from "@/features/play/courtyard/streetPropPack";
import {
  ARCHITECTURE_PILOT as P,
  BAY,
  ROOF_UNIT,
  SHUTTER,
  SHUTTER_ASSEMBLY,
  centredRegion,
} from "@/features/play/courtyard/architecturePack";

const OUT = "docs/architecture-pilot";
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const KEY = "#ff00ff";
const FONT = `font-family="DejaVu Sans, sans-serif"`;
const svg = (w: number, h: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const pts = (l: Point[]) => l.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const poly = (l: Point[], fill: string, stroke = "#1d2327", width = 3) =>
  `<polygon points="${pts(l)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke = "#1d2327",
  width = 3,
) =>
  `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const label = (p: Point, text: string, size = 26, anchor = "middle", color = "#ffffff") =>
  `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" ${FONT} font-size="${size}" font-weight="bold" text-anchor="${anchor}" fill="${color}" stroke="#000" stroke-width="5" paint-order="stroke">${text}</text>`;

/* ------------------------------------------------------------- the roof unit */

/** The unit's geometry on its canvas: frame pixels fitted into the 3:2 square. */
export function roofUnitGuide() {
  const { width: W, height: H } = P.roofUnit.canvas;
  const h = ROOF_UNIT.height;
  const corners = [0, h].flatMap((z) =>
    (
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ] as const
    ).map(([x, y]) => framePoint(x, y, z)),
  );
  const x0 = Math.min(...corners.map((p) => p.x));
  const x1 = Math.max(...corners.map((p) => p.x));
  const y0 = Math.min(...corners.map((p) => p.y));
  const y1 = Math.max(...corners.map((p) => p.y));
  const scale = Math.min((W * 0.8) / (x1 - x0), (H * 0.8) / (y1 - y0));
  const origin = {
    x: (W - (x1 - x0) * scale) / 2 - x0 * scale,
    y: (H - (y1 - y0) * scale) / 2 - y0 * scale,
  };
  const at = (x: number, y: number, z: number) => {
    const p = framePoint(x, y, z);
    return { x: origin.x + p.x * scale, y: origin.y + p.y * scale };
  };
  return { at, scale, origin, W, H };
}

function roofUnitSvg(annotated: boolean) {
  const { at, W, H, scale } = roofUnitGuide();
  const h = ROOF_UNIT.height;
  const parts = [`<rect width="${W}" height="${H}" fill="${KEY}"/>`];
  // the roof it stands on: its 2 m footprint
  parts.push(poly([at(0, 0, 0), at(2, 0, 0), at(2, 2, 0), at(0, 2, 0)], "#c9a7c9", "#5b3e5b"));
  // the two faces the camera sees, and the top
  parts.push(poly([at(0, 0, 0), at(2, 0, 0), at(2, 0, h), at(0, 0, h)], "#6b7478"));
  parts.push(poly([at(2, 0, 0), at(2, 2, 0), at(2, 2, h), at(2, 0, h)], "#555d61"));
  parts.push(poly([at(0, 0, h), at(2, 0, h), at(2, 2, h), at(0, 2, h)], "#8a9296"));
  if (annotated) {
    // the recessed fan's ring on top, and a service panel on the east face
    const c = at(1, 1, h);
    const r = 0.62 * 64 * scale;
    parts.push(
      `<ellipse cx="${c.x}" cy="${c.y}" rx="${r}" ry="${r / Math.sqrt(3)}" fill="none" stroke="#ffe08a" stroke-width="4" stroke-dasharray="14 8"/>`,
    );
    parts.push(
      poly(
        [at(2, 0.35, 0.08), at(2, 1.25, 0.08), at(2, 1.25, h - 0.08), at(2, 0.35, h - 0.08)],
        "none",
        "#7dff8a",
        4,
      ),
    );
    parts.push(label(at(1, 1, h + 0.35), "recessed fan, guarded", 24, "middle", "#ffe08a"));
    parts.push(label(at(2.3, 0.8, 0.2), "service panel", 22, "start", "#7dff8a"));
    parts.push(label(at(0.6, -0.35, 0.1), "NORTH face: louvres", 22, "middle", "#d8f3ff"));
    parts.push(label(at(2.15, -0.15, 0), "front corner", 22, "start", "#ffffff"));
    [
      `roof unit: 2 × 2 m footprint, ${h.toFixed(2)} m tall (8 px in the scene)`,
      "true isometric, the same view as the cars: two sides and the top",
      "nothing outside the grey; no roof, shadow or light painted",
    ].forEach((t, i) => parts.push(label({ x: 24, y: 44 + i * 34 }, t, 24, "start", "#d8f3ff")));
  }
  return svg(W, H, parts.join(""));
}

/* --------------------------------------------------------------- the window */

function windowSvg(annotated: boolean) {
  const { width: W, height: H } = P.window.canvas;
  const r = centredRegion(P.window.canvas, P.window.region.aspect);
  const m = r.height / (BAY.head - BAY.sill);
  const parts = [`<rect width="${W}" height="${H}" fill="#3a3f42"/>`];
  // the strips either side are cut away: a plain hatch, painted over by anything
  parts.push(rect(r.x, r.y, r.width, r.height, "#8a9296"));
  const f = BAY.frame * m;
  // the frame and its centre mullion
  parts.push(rect(r.x, r.y, r.width, f, "#4f585c", "none", 0));
  parts.push(rect(r.x, r.y + r.height - f, r.width, f, "#4f585c", "none", 0));
  parts.push(rect(r.x, r.y, f, r.height, "#4f585c", "none", 0));
  parts.push(rect(r.x + r.width - f, r.y, f, r.height, "#4f585c", "none", 0));
  const mid = r.x + r.width / 2;
  parts.push(
    rect(mid - (BAY.mullion * m) / 2, r.y, BAY.mullion * m, r.height, "#4f585c", "none", 0),
  );
  if (annotated) {
    parts.push(
      label(
        { x: W / 2, y: r.y + r.height / 2 - 20 },
        "GLASS: a dim room behind it",
        30,
        "middle",
        "#ffe08a",
      ),
      label(
        { x: W / 2, y: r.y + r.height / 2 + 24 },
        `${BAY.width} × ${(BAY.head - BAY.sill).toFixed(2)} m opening`,
        26,
      ),
      label({ x: r.x / 2, y: H / 2 }, "cut", 24),
      label({ x: W - r.x / 2, y: H / 2 }, "cut", 24),
      label(
        { x: W / 2, y: r.y + f + 40 },
        `frame ${Math.round(BAY.frame * 100)} cm, mullion ${Math.round(BAY.mullion * 100)} cm`,
        22,
        "middle",
        "#d8f3ff",
      ),
    );
  }
  return svg(W, H, parts.join(""));
}

/* -------------------------------------------------------------- the shutter */

function shutterSvg(annotated: boolean) {
  const { width: W, height: H } = P.shutter.canvas;
  const r = centredRegion(P.shutter.canvas, P.shutter.region.aspect);
  const m = r.width / SHUTTER_ASSEMBLY.width;
  const parts = [`<rect width="${W}" height="${H}" fill="${KEY}"/>`];
  const groundY = r.y + r.height;
  const openTop = groundY - SHUTTER.opening.height * m;
  const o0 = r.x + SHUTTER.housingOverhang * m;
  const o1 = o0 + SHUTTER.opening.width * m;
  // housing front, over the head, the assembly's full width
  parts.push(rect(r.x, r.y, r.width, SHUTTER.housingHeight * m, "#6b7478"));
  // guide rails either side of the opening
  for (const x of [o0 - SHUTTER.rail * m, o1])
    parts.push(rect(x, openTop, SHUTTER.rail * m, SHUTTER.opening.height * m, "#555d61"));
  // the curtain in the opening, and its bottom bar
  parts.push(rect(o0, openTop, o1 - o0, SHUTTER.opening.height * m, "#8a9296"));
  parts.push(
    rect(o0, groundY - SHUTTER.bottomBar * m, o1 - o0, SHUTTER.bottomBar * m, "#4f585c", "none", 0),
  );
  if (annotated) {
    parts.push(
      label(
        { x: W / 2, y: r.y + (SHUTTER.housingHeight * m) / 2 + 9 },
        "HOUSING front (code adds its top and depth)",
        22,
      ),
      label(
        { x: W / 2, y: (openTop + groundY) / 2 - 20 },
        "CURTAIN: slats every 0.2 m",
        28,
        "middle",
        "#ffe08a",
      ),
      label(
        { x: W / 2, y: (openTop + groundY) / 2 + 20 },
        `${SHUTTER.opening.width} × ${SHUTTER.opening.height} m opening`,
        24,
      ),
      label({ x: o0 - 30, y: openTop + 60 }, "rail", 20, "end"),
      label({ x: W / 2, y: groundY + 50 }, "ground line: the curtain's bottom bar rests on it", 22),
    );
  }
  return svg(W, H, parts.join(""));
}

/* ------------------------------------------------------- destination shots */

async function destinations(port: string) {
  const seed = 7;
  const arena = composeScene("intersection", seed).layout.arena;
  const env = arena.environment!;
  const { project, pixelsPerMetre } = battlefieldProjection(
    arena.extent.width,
    arena.extent.height,
  );
  const browser = await chromium.launch({
    executablePath: process.env["CHROMIUM_PATH"],
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });
  const shot = async (
    camera: { x: number; y: number; zoom: number },
    draw: (screen: (w: Point, z?: number) => Point) => string[],
    file: string,
  ) => {
    const page = await (
      await browser.newContext({ viewport: { width: 1800, height: 1300 } })
    ).newPage();
    await page.goto(
      `http://127.0.0.1:${port}/scene-review?place=intersection&seed=${seed}&actors=0&reveal=0&night=0&cam=${camera.x},${camera.y},${camera.zoom}`,
      { waitUntil: "networkidle" },
    );
    await page.waitForTimeout(4000);
    const box = (await (await page.$("canvas"))!.boundingBox())!;
    const png = await page.screenshot({ clip: box });
    await page.context().close();
    const cam = courtyardCamera(box.width, box.height, camera);
    const screen = (w: Point, z = 0) => {
      const p = project(w);
      return {
        x: (p.x - cam.x) * cam.zoom + box.width / 2,
        y: (p.y - z * pixelsPerMetre - cam.y) * cam.zoom + box.height / 2,
      };
    };
    await sharp(png)
      .composite([
        { input: svg(Math.round(box.width), Math.round(box.height), draw(screen).join("")) },
      ])
      .jpeg({ quality: 88 })
      .toFile(`${OUT}/${file}`);
  };
  const shops = env.structures.filter((s) => s.style === "shop");
  const storefront = shops.find((s) => s.attachments?.some((a) => a.id === "shop-canopy"));
  const units = shops
    .filter((s) => s !== storefront)
    .flatMap((s) =>
      Array.from({ length: Math.min(3, Math.floor((s.rect.width - 1) / 3)) }, (_, i) => ({
        s,
        x: s.rect.x + 0.5 + i * 3,
        y: s.rect.y + Math.min(3, s.rect.height - 2.5),
      })),
    );
  await shot(
    { x: -10, y: 115, zoom: 2.2 },
    (screen) => [
      ...units.map(({ s, x, y }) => {
        const top = s.height + ROOF_UNIT.height;
        return `<polygon points="${pts([screen({ x, y }, top), screen({ x: x + 2, y }, top), screen({ x: x + 2, y: y + 2 }, top), screen({ x, y: y + 2 }, top)])}" fill="none" stroke="#ffd34d" stroke-width="3"/>`;
      }),
      label(
        { x: 24, y: 40 },
        "yellow: every plain rooftop box the roof-unit sprite replaces",
        24,
        "start",
        "#ffd34d",
      ),
    ],
    "destination-roof-unit.jpg",
  );
  const annex = shops.find((s) => s.id === "building_1")!;
  const r = annex.rect;
  const faceAt = (sAlong: number, z: number, screen: (w: Point, z?: number) => Point) =>
    screen({ x: r.x + r.width, y: r.y + sAlong }, z);
  const quad = (
    a: number,
    b: number,
    z0: number,
    z1: number,
    screen: (w: Point, z?: number) => Point,
  ) =>
    pts([
      faceAt(a, z0, screen),
      faceAt(b, z0, screen),
      faceAt(b, z1, screen),
      faceAt(a, z1, screen),
    ]);
  await shot(
    { x: -170, y: 40, zoom: 3.2 },
    (screen) => [
      ...[0.5, 6.5].map(
        (s0) =>
          `<polygon points="${quad(s0, s0 + BAY.width, BAY.sill, BAY.head, screen)}" fill="none" stroke="#5ad7ff" stroke-width="3"/>`,
      ),
      `<polygon points="${quad(5 - 0.8 - 0.12, 5 + 0.8 + 0.12, 0, SHUTTER_ASSEMBLY.height, screen)}" fill="none" stroke="#ff7ad9" stroke-width="3"/>`,
      label({ x: 24, y: 40 }, "blue: the annex's window bays (window art)", 24, "start", "#5ad7ff"),
      label(
        { x: 24, y: 76 },
        "pink: its roller shutter at the saved entrance (shutter art)",
        24,
        "start",
        "#ff7ad9",
      ),
    ],
    "destination-frontage.jpg",
  );
  await browser.close();
}

await mkdir(`${OUT}/guides`, { recursive: true });
for (const [name, draw] of [
  ["roof-unit", roofUnitSvg],
  ["window", windowSvg],
  ["shutter", shutterSvg],
] as const) {
  await sharp(draw(false)).png().toFile(`${OUT}/guides/${name}-layout.png`);
  await sharp(draw(true)).png().toFile(`${OUT}/guides/${name}-annotated.png`);
}
if (!process.argv.includes("--no-browser")) await destinations(arg("port", "5180"));
console.log("written", OUT);
