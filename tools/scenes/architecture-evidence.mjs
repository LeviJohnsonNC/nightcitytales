/**
 * Unedited browser captures of the architectural pilot and the r0 sedan seam, at
 * fixed cameras, for before/after comparison:
 *
 *     node tools/scenes/architecture-evidence.mjs 5180 docs/evidence/architecture-pilot/after
 *     node tools/scenes/architecture-evidence.mjs 5181 docs/evidence/architecture-pilot/before   # main
 *
 * `ONLY=name,name` limits the run. Nothing is composited or retouched.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/architecture-pilot/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });

const S7 = "place=intersection&seed=7";
/** The reproducible gameplay framing of the corner, used since the night pass. */
const PLAY = `${S7}&cam=-10,115,2.2`;
const SHOP = `${S7}&cam=40,150,5`;
const BLOCK = `${S7}&cam=150,230,2.2`;
const CROSSING = `${S7}&cam=-150,-60,4`;
/** The annex across the street: its bays and its roller shutter (the window and shutter art). */
const ANNEX = `${S7}&cam=-170,40,3.2`;
const ANNEX_CLOSE = `${S7}&cam=-218,-36,6`;
/** The neighbouring block's three rooftop units (the roof-unit art), close. */
const ROOFS = `${S7}&cam=79,159,5`;
const SHOTS = [
  ["play-night", `${PLAY}&actors=0&reveal=0`],
  ["play-night-reveal", `${PLAY}&actors=1&player=21,4.5&reveal=1`],
  ["play-night-actors", `${PLAY}&actors=1&player=21,4.5&reveal=0`],
  ["play-neutral", `${PLAY}&actors=0&reveal=0&night=0`],
  ["play-neutral-reveal", `${PLAY}&actors=0&reveal=1&night=0`],
  ["play-lights-off", `${PLAY}&actors=0&reveal=0&lights=0`],
  ["shop-close-night", `${SHOP}&actors=0&reveal=0`],
  ["shop-close-neutral", `${SHOP}&actors=0&reveal=0&night=0`],
  ["block-neutral", `${BLOCK}&actors=0&reveal=0&night=0`],
  ["block-night", `${BLOCK}&actors=0&reveal=0`],
  ["crossing-neutral", `${CROSSING}&actors=0&reveal=0&night=0`],
  ["annex-neutral", `${ANNEX}&actors=0&reveal=0&night=0`],
  ["annex-night", `${ANNEX}&actors=0&reveal=0`],
  ["annex-lights-off", `${ANNEX}&actors=0&reveal=0&lights=0`],
  ["annex-close-neutral", `${ANNEX_CLOSE}&actors=0&reveal=0&night=0`],
  ["annex-close-night", `${ANNEX_CLOSE}&actors=0&reveal=0`],
  ["annex-reveal-behind", `${ANNEX}&actors=1&player=6,9&reveal=1&night=0`],
  ["annex-reveal-door", `${ANNEX}&actors=1&player=9.6,6.4&reveal=1&night=0`],
  ["annex-actor-front", `${ANNEX}&actors=1&player=9.6,4.2&reveal=0`],
  ["roofs-neutral", `${ROOFS}&actors=0&reveal=0&night=0`],
  ["roofs-night", `${ROOFS}&actors=0&reveal=0`],
  ["seed-0", `place=intersection&seed=0&actors=0&reveal=0`, { scenic: true }],
  ["seed-0-neutral", `place=intersection&seed=0&actors=0&reveal=0&night=0`, { scenic: true }],
  ["seed-1", `place=intersection&seed=1&actors=0&reveal=0`, { scenic: true }],
  ["seed-4", `place=intersection&seed=4&actors=0&reveal=0`, { scenic: true }],
  ["seed-8", `place=intersection&seed=8&actors=0&reveal=0`, { scenic: true }],
  ["seed-8-neutral", `place=intersection&seed=8&actors=0&reveal=0&night=0`, { scenic: true }],
  ["r0-sedans-seed-0", `place=intersection&seed=0&actors=0&reveal=0&night=0&cam=-215,-95,4`],
  // the planter and cabinet wrecks, alone and with a character beside, behind and on them
  ["wrecks-kerb", `${S7}&cam=-205,-10,5&actors=0&reveal=0&night=0&damage=destroyed`],
  ["wrecks-kerb-night", `${S7}&cam=-205,-10,5&actors=0&reveal=0&damage=destroyed`],
  [
    "wrecks-behind",
    `${S7}&cam=-205,-10,5&actors=1&player=7.4,10.6&reveal=0&night=0&damage=destroyed`,
  ],
  [
    "wrecks-beside",
    `${S7}&cam=-205,-10,5&actors=1&player=10.6,8.6&reveal=0&night=0&damage=destroyed`,
  ],
  ["wrecks-on", `${S7}&cam=-205,-10,5&actors=1&player=9,9&reveal=0&night=0&damage=destroyed`],
  [
    "wrecks-cabinet-behind",
    `${S7}&cam=-205,-10,5&actors=1&player=8.6,1.4&reveal=0&night=0&damage=destroyed`,
  ],
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
