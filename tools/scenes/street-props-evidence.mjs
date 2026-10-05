/**
 * Unedited browser captures of the painted street props in the shared renderer, at
 * fixed cameras, for before/after comparison:
 *
 *     node tools/scenes/street-props-evidence.mjs 5180 docs/evidence/street-props/after
 *     node tools/scenes/street-props-evidence.mjs 5181 docs/evidence/street-props/before   # main
 *
 * `ONLY=name,name` limits the run. Nothing is composited or retouched.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/street-props/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });

const BASE = "place=intersection&seed=7";
/** The three props and the shop corner in one gameplay-zoom frame. */
const STREET = `${BASE}&cam=-55,60,2.2`;
/** The sedan up close; the cabinet and planter up close. */
const SEDAN = `${BASE}&cam=-25,40,5`;
const KERB = `${BASE}&cam=-205,-10,5`;
const SHOTS = [
  ["street-night", `${STREET}&actors=0&reveal=0`],
  ["street-night-actors", `${STREET}&actors=1&player=21,4.5&reveal=1`],
  ["street-neutral", `${STREET}&actors=0&reveal=0&night=0`],
  ["street-lights-off", `${STREET}&actors=0&reveal=0&lights=0`],
  ["street-damaged", `${STREET}&actors=0&reveal=0&damage=damaged`],
  ["street-destroyed", `${STREET}&actors=0&reveal=0&damage=destroyed`],
  ["sedan-close", `${SEDAN}&actors=0&reveal=0`],
  ["sedan-close-neutral", `${SEDAN}&actors=0&reveal=0&night=0`],
  ["sedan-close-damaged", `${SEDAN}&actors=0&reveal=0&damage=damaged`],
  ["sedan-close-destroyed", `${SEDAN}&actors=0&reveal=0&damage=destroyed`],
  ["sedan-actor-behind", `${SEDAN}&actors=1&player=19.6,10.8&reveal=0`],
  ["kerb-close", `${KERB}&actors=0&reveal=0`],
  ["kerb-close-neutral", `${KERB}&actors=0&reveal=0&night=0`],
  ["kerb-close-destroyed", `${KERB}&actors=0&reveal=0&damage=destroyed`],
  ["overview", `${BASE}&actors=0&framing=overview&reveal=0`, { scenic: true }],
];
const ONLY = process.env.ONLY?.split(",");

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
for (const [name, query, step = {}] of SHOTS) {
  if (ONLY && !ONLY.includes(name)) continue;
  const page = await (
    await browser.newContext({
      viewport: step.scenic ? { width: 2000, height: 1400 } : { width: 1800, height: 1300 },
    })
  ).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  const clip = await (await page.$("canvas")).boundingBox();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82, clip });
  console.log(name, errors.length ? `errors: ${errors[0]}` : "ok");
  await page.context().close();
}
await browser.close();
