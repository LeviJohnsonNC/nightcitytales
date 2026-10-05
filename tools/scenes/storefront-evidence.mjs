/**
 * Unedited browser captures of the shared /scene-review renderer for the storefront
 * corner of intersection seed 7. Run against a checkout without the change and one
 * with it, on two dev servers:
 *
 *     bunx vite dev --host 127.0.0.1 --port 5180        # the branch
 *     node tools/scenes/storefront-evidence.mjs 5180 docs/evidence/storefront/after
 *     node tools/scenes/storefront-evidence.mjs 5181 docs/evidence/storefront/before   # main
 *
 * It drives only the page's own controls (zoom, pan, the zoom slider, the query
 * string); nothing is composited or retouched. Shots that need the lights toggle are
 * skipped on a build that has none (they fail to differ, which is the point).
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/storefront/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });

const BASE = "place=intersection&seed=7";
const PLAY = `${BASE}&actors=1&framing=play`;
// zoom: clicks of "Zoom in"; pan: drag in px with the Pan tool; slider: scenic view zoom
const SHOTS = [
  ["corner-actors-reveal", `${PLAY}&reveal=1`, { zoom: 2, pan: [-330, -330] }],
  ["corner-actors-solid", `${PLAY}&reveal=0`, { zoom: 2, pan: [-330, -330] }],
  ["closeup-actors-reveal", `${PLAY}&reveal=1`, { zoom: 5, pan: [220, -550] }],
  ["closeup-actors-solid", `${PLAY}&reveal=0`, { zoom: 5, pan: [220, -550] }],
  ["closeup-access-reveal", `${PLAY}&access=1&reveal=1`, { zoom: 5, pan: [220, -550] }],
  ["closeup-access-solid", `${PLAY}&access=1&reveal=0`, { zoom: 5, pan: [220, -550] }],
  ["scenic-reveal", `${BASE}&actors=0&framing=overview&reveal=1`, { slider: "1.6" }],
  ["scenic-solid", `${BASE}&actors=0&framing=overview&reveal=0`, { slider: "1.6" }],
  [
    "scenic-reveal-lights-off",
    `${BASE}&actors=0&framing=overview&reveal=1&lights=0`,
    { slider: "1.6" },
  ],
  [
    "scenic-solid-lights-off",
    `${BASE}&actors=0&framing=overview&reveal=0&lights=0`,
    { slider: "1.6" },
  ],
  ["corner-damaged", `${PLAY}&reveal=1&damage=damaged`, { zoom: 2, pan: [-330, -330] }],
  ["corner-destroyed", `${PLAY}&reveal=1&damage=destroyed`, { zoom: 2, pan: [-330, -330] }],
];
const ONLY = process.env.ONLY?.split(",");

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
for (const [name, query, step = {}] of SHOTS) {
  if (ONLY && !ONLY.includes(name)) continue;
  const scenic = step.slider !== undefined;
  const page = await (
    await browser.newContext({
      viewport: scenic ? { width: 2400, height: 1700 } : { width: 1600, height: 1250 },
    })
  ).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  if (scenic) {
    await page.$eval(
      'input[aria-label="Scenery zoom"]',
      (el, v) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      step.slider,
    );
    await page.waitForTimeout(1500);
  }
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
  await page.waitForTimeout(800);
  const clip = await (await page.$("canvas")).boundingBox();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 92, clip });
  console.log(name, errors.length ? `errors: ${errors[0]}` : "ok");
  await page.context().close();
}
await browser.close();
