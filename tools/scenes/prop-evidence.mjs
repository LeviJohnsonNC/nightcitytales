/**
 * The prop-consistency pass's matched captures: seeds 7, 0 and 8 at play zoom with
 * characters (as saved, lights off, revealed, and with every other cover piece
 * destroyed), close-ups of the painted cars, intact and in mixed damage, and close-ups
 * of round two's merchandise stand and rotated cabinet in every state.
 *
 *     node tools/scenes/prop-evidence.mjs 5180 docs/evidence/prop-consistency/after
 *
 * Unedited canvas captures. `ONLY=a,b` limits.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/prop-consistency/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const only = process.env.ONLY?.split(",");
const at = (seed) => `place=intersection&seed=${seed}`;
// a car's centre at 4x (cam = its projected centre less the view's, see courtyardCamera)
const CARS = [
  ["seed7-car-west", 7, "-65,71"],
  ["seed7-car-thorton", 7, "-195,56"],
  ["seed0-car-thorton", 0, "-117,-124"],
  ["seed8-car-thorton", 8, "-117,101"],
];
// round two (docs/street-props-pack/round-2.md): the stand at r0 (seed 7) and r90 and the
// cabinet at r90 (seed 0), with seed 7's r0 cabinet beside them for comparison
const PROPS = [
  ["seed7-kiosk", 7, "286,15"],
  ["seed0-kiosk", 0, "286,-45"],
  ["seed0-cabinet", 0, "-78,-165"],
  ["seed7-cabinet", 7, "-260,30"],
];
const SHOTS = [
  ...[7, 0, 8].flatMap((seed) => [
    [`seed${seed}-play`, `${at(seed)}&actors=1&reveal=0`],
    [`seed${seed}-lights-off`, `${at(seed)}&actors=1&reveal=0&lights=0`],
    [`seed${seed}-reveal`, `${at(seed)}&actors=1&reveal=1`],
    [`seed${seed}-mixed-damage`, `${at(seed)}&actors=1&reveal=0&damage=mixed`],
  ]),
  ...CARS.flatMap(([name, seed, cam]) => [
    [`close-${name}`, `${at(seed)}&actors=1&reveal=0&cam=${cam},4`],
    [`close-${name}-mixed`, `${at(seed)}&actors=1&reveal=0&damage=mixed&cam=${cam},4`],
    [`close-${name}-damaged`, `${at(seed)}&actors=1&reveal=0&damage=damaged&cam=${cam},4`],
    [`close-${name}-neutral`, `${at(seed)}&actors=1&reveal=0&night=0&cam=${cam},4`],
  ]),
  ...PROPS.flatMap(([name, seed, cam]) => [
    ...["intact", "damaged", "destroyed", "mixed"].map((damage) => [
      `close-${name}-${damage}`,
      `${at(seed)}&actors=1&reveal=0&damage=${damage}&cam=${cam},4`,
    ]),
    [`close-${name}-neutral`, `${at(seed)}&actors=1&reveal=0&night=0&cam=${cam},4`],
    [`close-${name}-lights-off`, `${at(seed)}&actors=1&reveal=0&lights=0&cam=${cam},4`],
    [`close-${name}-reveal`, `${at(seed)}&actors=1&reveal=1&cam=${cam},4`],
  ]),
];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
for (const [name, query] of SHOTS) {
  if (only && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6500);
  const clip = await (await page.$("canvas")).boundingBox();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 84, clip });
  console.log(name, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
  await page.close();
}
await browser.close();
