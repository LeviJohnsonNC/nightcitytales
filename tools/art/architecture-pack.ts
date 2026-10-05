/**
 * Guides for the architectural pilot's art pack (`docs/architecture-pack.md`): the
 * two tiling surfaces the shop's neighbours still lack. Everything else in the pilot
 * is drawn in code or reuses a material the game already has.
 *
 *     bun run tools/art/architecture-pack.ts [--port 5180] [--no-browser]
 *
 * Writes docs/architecture-pack/:
 *   guides/<tile>-scale.png   the tile's square at the size Picasso returns, ruled in
 *                             metres, with the size of the grain drawn to scale in one
 *                             corner: the file to attach (the rules are not painted)
 *   context-targets.jpg       the shipping renderer at play zoom with every surface
 *                             each tile will cover outlined: what the tile is for
 *
 * A tile is world-scaled by `surfaceMaterials.ts`: one tile covers `metres` of wall
 * or roof, so the grain's real size is fixed here and checked there.
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { chromium } from "playwright";
import { composeScene, type Point } from "@/engine";
import { battlefieldProjection } from "@/features/play/battlefieldProjection";
import { courtyardCamera } from "@/features/play/courtyard/courtyardPresentation";
import { frontagePilot } from "@/features/play/courtyard/composedEnvironment";
import { exposedSpans, edgeFrame } from "@/features/play/courtyard/frontage";
import { storefrontFor } from "@/features/play/courtyard/storefront";

const OUT = "docs/architecture-pack";
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};

/** The pack: what each tile is, how much of the world one tile covers, its grain. */
export const ARCHITECTURE_PACK = [
  {
    key: "roof-ballast",
    file: "roof-ballast.png",
    metres: 2,
    grain: { label: "ballast stones 20–40 mm", minM: 0.02, maxM: 0.04 },
    covers: "the neighbours' roofs",
  },
  {
    key: "painted-render",
    file: "painted-render.png",
    metres: 4,
    grain: { label: "trowel marks 0.2–0.5 m, hairline cracks", minM: 0.2, maxM: 0.5 },
    covers: "the neighbours' walls",
  },
] as const;

const CANVAS = 1024;
const FONT = `font-family="DejaVu Sans, sans-serif"`;

async function scaleCard(t: (typeof ARCHITECTURE_PACK)[number]) {
  const px = CANVAS / t.metres;
  const parts: string[] = [`<rect width="${CANVAS}" height="${CANVAS}" fill="#8a8f8c"/>`];
  // the metre grid, and a finer 10 cm grid in one metre square
  for (let m = 0; m <= t.metres; m += t.metres <= 2 ? 0.5 : 1)
    parts.push(
      `<line x1="${m * px}" y1="0" x2="${m * px}" y2="${CANVAS}" stroke="#2b3133" stroke-width="${Number.isInteger(m) ? 3 : 1.5}"/>`,
      `<line x1="0" y1="${m * px}" x2="${CANVAS}" y2="${m * px}" stroke="#2b3133" stroke-width="${Number.isInteger(m) ? 3 : 1.5}"/>`,
    );
  for (let c = 0.1; c < 1 - 1e-9; c += 0.1)
    parts.push(
      `<line x1="${c * px}" y1="0" x2="${c * px}" y2="${px}" stroke="#4a5254" stroke-width="0.8"/>`,
      `<line x1="0" y1="${c * px}" x2="${px}" y2="${c * px}" stroke="#4a5254" stroke-width="0.8"/>`,
    );
  // the grain drawn to scale, smallest and largest, in the first metre
  const g = t.grain;
  for (const [k, size] of [g.minM, g.maxM].entries()) {
    const d = size * px;
    const cx = px * 0.25 + k * px * 0.4;
    const cy = px * 0.5;
    parts.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${d / 2}" ry="${(d / 2) * (t.key === "painted-render" ? 0.25 : 0.75)}" fill="#e8e2c8" stroke="#000" stroke-width="2"/>`,
    );
  }
  parts.push(
    `<text x="20" y="${CANVAS - 60}" ${FONT} font-size="30" font-weight="bold" fill="#fff" stroke="#000" stroke-width="5" paint-order="stroke">${t.key}: one tile = ${t.metres} × ${t.metres} m</text>`,
    `<text x="20" y="${CANVAS - 22}" ${FONT} font-size="26" fill="#fff" stroke="#000" stroke-width="5" paint-order="stroke">grain to scale, top left: ${g.label}</text>`,
  );
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}">${parts.join("")}</svg>`,
    ),
  )
    .png()
    .toFile(`${OUT}/guides/${t.key}-scale.png`);
}

async function contextTargets(port: string) {
  const seed = 7;
  const arena = composeScene("intersection", seed).layout.arena;
  const env = arena.environment!;
  const { project, pixelsPerMetre } = battlefieldProjection(
    arena.extent.width,
    arena.extent.height,
  );
  const sf = env.structures
    .map((s) => storefrontFor(s, env, arena.cover ?? []))
    .find((x) => x !== undefined)!;
  const pilot = frontagePilot(sf, env.structures, env.entrances);
  const camera = { x: 60, y: 170, zoom: 1.7 };
  const browser = await chromium.launch({
    executablePath: process.env["CHROMIUM_PATH"],
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });
  const page = await (
    await browser.newContext({ viewport: { width: 1800, height: 1300 } })
  ).newPage();
  await page.goto(
    `http://127.0.0.1:${port}/scene-review?place=intersection&seed=${seed}&actors=0&reveal=0&night=0&cam=${camera.x},${camera.y},${camera.zoom}`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(4000);
  const box = (await (await page.$("canvas"))!.boundingBox())!;
  const shot = await page.screenshot({ clip: box });
  await browser.close();
  const cam = courtyardCamera(box.width, box.height, camera);
  const screen = (w: Point, z = 0) => {
    const p = project(w);
    return {
      x: (p.x - cam.x) * cam.zoom + box.width / 2,
      y: (p.y - z * pixelsPerMetre - cam.y) * cam.zoom + box.height / 2,
    };
  };
  const pts = (l: Point[]) => l.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const parts: string[] = [];
  for (const n of pilot.neighbours) {
    const r = n.rect;
    const roof = [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height },
    ].map((p) => screen(p, n.height));
    parts.push(
      `<polygon points="${pts(roof)}" fill="#ffd34d" fill-opacity="0.18" stroke="#ffd34d" stroke-width="3"/>`,
    );
    for (const edge of ["north", "east"] as const)
      for (const [a, b] of exposedSpans(n, edge, env.structures)) {
        const f = edgeFrame(r, edge);
        const wall = [
          screen(f.world(a, 0), 0),
          screen(f.world(b, 0), 0),
          screen(f.world(b, 0), n.height),
          screen(f.world(a, 0), n.height),
        ];
        parts.push(
          `<polygon points="${pts(wall)}" fill="#5ad7ff" fill-opacity="0.2" stroke="#5ad7ff" stroke-width="3"/>`,
        );
      }
  }
  parts.push(
    `<text x="24" y="40" ${FONT} font-size="26" font-weight="bold" fill="#ffd34d" stroke="#000" stroke-width="5" paint-order="stroke">yellow: roof-ballast (the neighbours' roofs)</text>`,
    `<text x="24" y="76" ${FONT} font-size="26" font-weight="bold" fill="#5ad7ff" stroke="#000" stroke-width="5" paint-order="stroke">blue: painted-render (the neighbours' open walls)</text>`,
  );
  await sharp(shot)
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(box.width)}" height="${Math.round(box.height)}">${parts.join("")}</svg>`,
        ),
      },
    ])
    .jpeg({ quality: 88 })
    .toFile(`${OUT}/context-targets.jpg`);
}

await mkdir(`${OUT}/guides`, { recursive: true });
for (const t of ARCHITECTURE_PACK) await scaleCard(t);
if (!process.argv.includes("--no-browser")) await contextTargets(arg("port", "5180"));
console.log("written", OUT);
