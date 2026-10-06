/**
 * The intersection's buildings, as the player meets them, for an audit of the
 * residential and industrial masses beside the finished shop:
 *
 *     node tools/scenes/building-audit.mjs 5180 docs/evidence/building-pilot/after
 *
 * Seeds 7, 0 and 8, each at the gameplay framing and the overview, at night and
 * neutral, plus any `cam=` close-ups named in CLOSE. Unedited canvas captures.
 * `ONLY=name,name` limits the run.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/building-pilot/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const BASE = "place=intersection&actors=1&reveal=0";
const SHOTS = [];
for (const seed of [7, 0, 8]) {
  SHOTS.push([`seed${seed}-play`, `${BASE}&seed=${seed}`]);
  SHOTS.push([`seed${seed}-play-neutral`, `${BASE}&seed=${seed}&night=0`]);
  SHOTS.push([`seed${seed}-overview`, `${BASE}&seed=${seed}&framing=overview`]);
  SHOTS.push([`seed${seed}-overview-neutral`, `${BASE}&seed=${seed}&framing=overview&night=0`]);
}
// seed 7 with its characters, the buildings cut away for them and not
SHOTS.push(["seed7-play-reveal", `place=intersection&actors=1&reveal=1&seed=7`]);
SHOTS.push(["seed7-play-reveal-neutral", `place=intersection&actors=1&reveal=1&seed=7&night=0`]);
// close-ups: detail, judged only after the play framing
const CLOSE_UPS = [
  ["residential-close", "cam=-290,60,2.6"],
  ["industrial-close", "cam=330,40,2.6"],
  ["loading-close", "cam=-20,-170,2.6"],
  ["residential-window", "cam=-330,-20,5"],
  ["industrial-door", "cam=-80,-190,5"],
];
for (const [name, cam] of CLOSE_UPS) {
  SHOTS.push([`${name}-neutral`, `place=intersection&seed=7&actors=0&reveal=0&night=0&${cam}`]);
  SHOTS.push([`${name}-night`, `place=intersection&seed=7&actors=0&reveal=0&${cam}`]);
}
for (const [name, query] of JSON.parse(process.env.CLOSE ?? "[]")) SHOTS.push([name, query]);
const only = process.env.ONLY?.split(",");

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
