/**
 * The streetfront pass's matched captures: the same cameras before and after, for the
 * shop's composed side (`streetfront.ts`) and its neighbours' frontage.
 *
 *     node tools/scenes/streetfront-evidence.mjs 5180 docs/evidence/streetfront/after
 *
 * Normal play zoom with characters on seeds 7, 0 and 8, roof on and revealed and with
 * the lights off; close-ups of the composed faces; and, apart from those, the
 * reference comparison camera. Unedited canvas captures. `ONLY=a,b` limits; `PERF=1`
 * samples frame times on the seed 7 and seed 0 play shots while the camera zooms.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/streetfront/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const only = process.env.ONLY?.split(",");
const at = (seed) => `place=intersection&seed=${seed}`;
const SHOTS = [
  ...[7, 0, 8].flatMap((seed) => [
    [`seed${seed}-play`, `${at(seed)}&actors=1&reveal=0`],
    [`seed${seed}-reveal`, `${at(seed)}&actors=1&reveal=1`],
    [`seed${seed}-lights-off`, `${at(seed)}&actors=1&reveal=0&lights=0`],
  ]),
  // close-ups of the composed faces: the shop's side in seed 0, its corner in seed 7,
  // and the neighbour's board in seed 8 (cam = the face's centre, at 3x)
  ["close-seed0-side", `${at(0)}&actors=0&reveal=0&cam=-286,75,3`],
  ["close-seed7-corner", `${at(7)}&actors=0&reveal=0&cam=230,230,3`],
  ["close-seed8-neighbour", `${at(8)}&actors=0&reveal=0&cam=-377,50,3`],
  // the reference comparison camera: not the gameplay camera
  ["reference-camera-seed7", `${at(7)}&actors=1&reveal=0&cam=-10,115,2.2&player=21,4.5`],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const perf = {};
for (const [name, query] of SHOTS) {
  if (only && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const started = Date.now();
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6500);
  const loaded = Date.now() - started;
  const clip = await (await page.$("canvas")).boundingBox();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 84, clip });
  if (process.env.PERF && (name === "seed7-play" || name === "seed0-play")) {
    await page.evaluate(() => {
      window.__frames = [];
      let last = performance.now();
      const tick = (t) => {
        window.__frames.push(t - last);
        last = t;
        if (window.__frames.length < 600) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    for (const label of ["Zoom in", "Zoom in", "Zoom out", "Zoom out", "Zoom out"]) {
      const b = page.locator(`button[aria-label="${label}"]`);
      if (await b.isEnabled()) await b.click();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(3000);
    const frames = await page.evaluate(() => window.__frames.slice(5));
    frames.sort((a, b) => a - b);
    const q = (p) => frames[Math.floor(frames.length * p)];
    perf[name] = {
      loadMs: loaded,
      frames: frames.length,
      medianMs: +q(0.5).toFixed(1),
      p95Ms: +q(0.95).toFixed(1),
    };
    console.log("perf", name, JSON.stringify(perf[name]));
  }
  console.log(name, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
  await page.close();
}
if (Object.keys(perf).length) await writeFile(`${out}/perf.json`, JSON.stringify(perf, null, 2));
await browser.close();
