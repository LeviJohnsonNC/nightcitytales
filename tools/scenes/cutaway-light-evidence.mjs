/**
 * Close-ups of seed 0's composed shop side with reveal on and off and the lights on
 * and off, for the cutaway light correction (`paintReturnLight`'s clip).
 *
 *     node tools/scenes/cutaway-light-evidence.mjs 5180 docs/evidence/cutaway-light/after
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/cutaway-light/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
// the display bays on building_0's east face, at 3.5x; actors on, so the reveal cuts
const CAM = "cam=-221,45,3.5";
const SHOTS = [
  ["reveal-lights", `reveal=1&lights=1`],
  ["reveal-lights-off", `reveal=1&lights=0`],
  ["solid-lights", `reveal=0&lights=1`],
  ["solid-lights-off", `reveal=0&lights=0`],
];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
for (const [name, query] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${port}/scene-review?place=intersection&seed=0&actors=1&${query}&${CAM}`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(6500);
  const clip = await (await page.$("canvas")).boundingBox();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 86, clip });
  console.log(name, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
  await page.close();
}
await browser.close();
