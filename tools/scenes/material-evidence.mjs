/**
 * Unedited browser captures of the shared /scene-review renderer, for the
 * surface-material pass. Run it once against a checkout without the change and
 * once with it, on two dev servers:
 *
 *     bunx vite dev --host 127.0.0.1 --port 5180        # the branch
 *     node tools/scenes/material-evidence.mjs 5180 docs/evidence/materials-1/after
 *
 * It only drives the page's own controls (zoom, pan, query string); nothing is
 * composited or retouched. Needs a Chromium: PLAYWRIGHT_BROWSERS_PATH or
 * CHROMIUM_PATH.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/materials-1/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });

const BASE = "place=intersection&seed=7";
// zoom: clicks of "Zoom in"; pan: drag in px with the Pan tool; diagram: toggle the overlay off
const ONLY = process.env.ONLY?.split(",");
const SHOTS = [
  ["overview-reveal", `${BASE}&actors=0&framing=overview&reveal=1`],
  ["overview-solid", `${BASE}&actors=0&framing=overview&reveal=0`],
  [
    "corner-actors-reveal",
    `${BASE}&actors=1&framing=play&reveal=1`,
    { zoom: 2, pan: [-330, -330] },
  ],
  ["corner-actors-solid", `${BASE}&actors=1&framing=play&reveal=0`, { zoom: 2, pan: [-330, -330] }],
  ["annex-shutter-solid", `${BASE}&actors=1&framing=play&reveal=0`, { zoom: 5, pan: [450, -100] }],
  [
    "annex-shutter-diagram",
    `${BASE}&actors=1&framing=play&reveal=0`,
    { zoom: 5, pan: [450, -100], diagram: true },
  ],
  [
    "corner-damaged",
    `${BASE}&actors=1&framing=play&reveal=1&damage=damaged`,
    { zoom: 2, pan: [-330, -330] },
  ],
  [
    "corner-destroyed",
    `${BASE}&actors=1&framing=play&reveal=1&damage=destroyed`,
    { zoom: 2, pan: [-330, -330] },
  ],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
for (const [name, query, step = {}] of SHOTS) {
  if (ONLY && !ONLY.includes(name)) continue;
  const page = await (
    await browser.newContext({ viewport: { width: 1600, height: 1250 } })
  ).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  for (let i = 0; i < (step.zoom ?? 0); i++) {
    await page.click('button[aria-label="Zoom in"]');
    await page.waitForTimeout(150);
  }
  if (step.pan) {
    await page.click('button[aria-label="Pan battlefield"]');
    const box = await (await page.$("canvas")).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + step.pan[0], y + step.pan[1], { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  // The diagram replaces the canvas, so the frame is taken before it is toggled.
  const clip = await (await page.$("canvas")).boundingBox();
  if (step.diagram) {
    await page.getByRole("button", { name: "Diagram view" }).click();
    await page.getByRole("button", { name: "Scenic view" }).waitFor();
  }
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `${out}/${name}.jpg`,
    type: "jpeg",
    quality: 92,
    clip,
  });
  console.log(name, errors.length ? `errors: ${errors[0]}` : "ok");
  await page.context().close();
}
await browser.close();
