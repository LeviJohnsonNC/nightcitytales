/**
 * Unedited browser captures of the seed-7 storefront corner at night, through the
 * shared renderer in /scene-review, at one repeatable gameplay framing:
 *
 *     bunx vite dev --host 127.0.0.1 --port 5180
 *     node tools/scenes/storefront-night.mjs 5180 docs/evidence/storefront-night
 *
 * The framing is a fixed camera (`cam=`) and a fixed spot for the review character
 * (`player=`), both query parameters of the review page, so every shot is the same
 * view of the same scene with one switch changed. Nothing is composited or
 * retouched; `ONLY=name,name` limits the run.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/storefront-night"] = process.argv.slice(2);
await mkdir(out, { recursive: true });

/** The corner: the storefront, the pavement beside it and the edge of the crossing. */
export const CORNER = "place=intersection&seed=7&actors=1&player=30.3,1.6&cam=-10,115,2.2";
/** The entrance, the awning and the streetlight, closer than play: detail, not framing. */
const CLOSE = "place=intersection&seed=7&actors=1&player=30.3,1.6&cam=-30,140,4.5";
/** The blade sign with the review character standing just in front of it. */
const BLADE = "place=intersection&seed=7&actors=1&player=28.6,2.6&cam=10,135,3.6";
/** The same camera with no characters: nothing fades, the scenery alone. */
const SCENERY = "place=intersection&seed=7&actors=0&cam=-10,115,2.2";
const SHOTS = [
  ["scenery-solid", `${SCENERY}&reveal=0`],
  ["scenery-reveal", `${SCENERY}&reveal=1`],
  ["scenery-solid-lights-off", `${SCENERY}&reveal=0&lights=0`],
  ["corner-solid", `${CORNER}&reveal=0`],
  ["corner-reveal", `${CORNER}&reveal=1`],
  ["corner-solid-lights-off", `${CORNER}&reveal=0&lights=0`],
  ["corner-reveal-lights-off", `${CORNER}&reveal=1&lights=0`],
  ["corner-solid-neutral", `${CORNER}&reveal=0&night=0`],
  ["corner-reveal-neutral", `${CORNER}&reveal=1&night=0`],
  ["corner-solid-no-overlays", `${CORNER}&reveal=0`, { overlays: false }],
  ["corner-reveal-no-overlays", `${CORNER}&reveal=1`, { overlays: false }],
  ["corner-reveal-damaged", `${CORNER}&reveal=1&damage=destroyed`],
  ["blade-actor-solid", `${BLADE}&reveal=0`],
  ["blade-actor-reveal", `${BLADE}&reveal=1`],
  ["closeup-reveal", `${CLOSE}&reveal=1`],
  ["closeup-solid", `${CLOSE}&reveal=0`],
  ["closeup-reveal-lights-off", `${CLOSE}&reveal=1&lights=0`],
  [
    "overview-solid",
    "place=intersection&seed=7&actors=0&framing=overview&reveal=0",
    { scenic: true },
  ],
  [
    "overview-reveal",
    "place=intersection&seed=7&actors=0&framing=overview&reveal=1",
    { scenic: true },
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
  if (step.overlays === false) {
    // The tactical layer is the SVG over the art (labels, rings, bars, the HUD over the
    // stage); hiding it shows the scene alone. The art itself is untouched.
    await page.addStyleTag({
      content:
        ".combat-stage > svg, .combat-stage > :not(.courtyard-canvas):not(canvas) { visibility: hidden !important; }",
    });
    await page.waitForTimeout(400);
  }
  const clip = await (await page.$("canvas")).boundingBox();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 90, clip });
  console.log(name, errors.length ? `errors: ${errors[0]}` : "ok");
  await page.context().close();
}
await browser.close();
