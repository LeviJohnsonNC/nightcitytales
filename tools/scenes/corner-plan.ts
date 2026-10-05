/**
 * The saved plan of an intersection drawn over the shipping renderer: structure
 * footprints, the faces the camera can see, entrances, walk zones and routes. For
 * planning and reviewing architectural detail against what is actually saved.
 *
 *     bun run tools/scenes/corner-plan.ts [--port 5180] [--seed 7] [--cam x,y,zoom] [--out file.jpg]
 *
 * It is a screenshot of /scene-review plus a wireframe computed from the scene's own
 * projection and camera: nothing here renders the scene a second time.
 */
import sharp from "sharp";
import { chromium } from "playwright";
import { composeScene, type Point } from "@/engine";
import { battlefieldProjection } from "@/features/play/battlefieldProjection";
import { courtyardCamera } from "@/features/play/courtyard/courtyardPresentation";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const port = arg("port", "5180");
const seed = Number(arg("seed", "7"));
const [cx, cy, cz] = arg("cam", "-10,115,2.2").split(",").map(Number);
const camera = { x: cx!, y: cy!, zoom: cz! };
const out = arg("out", "docs/evidence/architecture-pilot/plan.jpg");
const reveal = arg("reveal", "1");

const arena = composeScene("intersection", seed).layout.arena;
const env = arena.environment!;
const { project, pixelsPerMetre } = battlefieldProjection(arena.extent.width, arena.extent.height);

const browser = await chromium.launch({
  executablePath: process.env["CHROMIUM_PATH"],
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const page = await (
  await browser.newContext({ viewport: { width: 1800, height: 1300 } })
).newPage();
await page.goto(
  `http://127.0.0.1:${port}/scene-review?place=intersection&seed=${seed}&actors=0&reveal=${reveal}&night=0&cam=${camera.x},${camera.y},${camera.zoom}`,
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
const pts = (list: Point[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const rectPts = (r: { x: number; y: number; width: number; height: number }, z = 0) =>
  [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ].map((p) => screen(p, z));
const text = (p: Point, t: string, color: string, size = 18) =>
  `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" font-family="DejaVu Sans" font-size="${size}" font-weight="bold" text-anchor="middle" fill="${color}" stroke="#000" stroke-width="4" paint-order="stroke">${t}</text>`;

const parts: string[] = [];
for (const z of env.zones ?? []) {
  if (z.kind !== "sidewalk" && z.kind !== "aisle") continue;
  parts.push(
    `<polygon points="${pts(rectPts(z.rect))}" fill="none" stroke="${z.kind === "aisle" ? "#7dff8a" : "#5ad7ff"}" stroke-width="1.5" stroke-dasharray="${z.kind === "aisle" ? "6 4" : "2 3"}"/>`,
  );
}
for (const s of env.structures ?? []) {
  if (s.style === "mesh-fence") continue;
  const r = s.rect;
  parts.push(
    `<polygon points="${pts(rectPts(r))}" fill="#ffb84d" fill-opacity="0.12" stroke="#ffb84d" stroke-width="2"/>`,
  );
  // the camera-facing faces: north (y = min) and east (x = max), at the wall foot
  const north = [screen({ x: r.x, y: r.y }), screen({ x: r.x + r.width, y: r.y })];
  const east = [
    screen({ x: r.x + r.width, y: r.y }),
    screen({ x: r.x + r.width, y: r.y + r.height }),
  ];
  for (const [a, b] of [north, east])
    parts.push(
      `<line x1="${a!.x}" y1="${a!.y}" x2="${b!.x}" y2="${b!.y}" stroke="#ff4d6d" stroke-width="4"/>`,
    );
  parts.push(
    text(
      screen({ x: r.x + r.width / 2, y: r.y + r.height / 2 }, s.height ?? 3),
      `${s.id} (${s.style})`,
      "#ffd9a0",
    ),
  );
}
for (const e of env.entrances ?? [])
  parts.push(text(screen(e.position), `◆ ${e.id}`, "#ffffff", 16));
for (const d of env.dressing ?? [])
  parts.push(text(screen(d.position), `· ${d.kind ?? d.id}`, "#c8f7ff", 13));

await sharp(shot)
  .composite([
    {
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(box.width)}" height="${Math.round(box.height)}">${parts.join("")}</svg>`,
      ),
    },
  ])
  .jpeg({ quality: 88 })
  .toFile(out);
console.log("written", out);
