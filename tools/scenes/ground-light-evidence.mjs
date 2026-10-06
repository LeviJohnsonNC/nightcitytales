/**
 * The ground-light pilot's matched captures: seeds 7, 0 and 8 at normal play zoom
 * with characters (as saved, revealed, lights off, mixed damage), a close-up of each
 * seed's shop lamp (intact, destroyed, lights off), and a reference camera on seed 7.
 * Run once per stage against a server on that stage's code:
 *
 *     node tools/scenes/ground-light-evidence.mjs 5180 docs/evidence/ground-light/2-shadows
 *
 * `PERF=1` instead samples frame times on each seed's play shot while zooming, for
 * a fixed time, and writes `perf.json`: the renderer string, the frames actually
 * sampled and their distribution. Unedited canvas captures; `ONLY=a,b` limits.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/ground-light/current"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const only = process.env.ONLY?.split(",");
const perfMode = process.env.PERF === "1";
const at = (seed) => `place=intersection&seed=${seed}`;
// each seed's shop lamp, the scene's strongest light, at 3x (its projected head less
// the view's half: `courtyardCamera`)
const LAMP = { 7: "-60,100,3", 0: "-194,-40,3", 8: "-261,-2,3" };
const SHOTS = [
  ...[7, 0, 8].flatMap((seed) => [
    [`seed${seed}-play`, `${at(seed)}&actors=1&reveal=0`],
    [`seed${seed}-reveal`, `${at(seed)}&actors=1&reveal=1`],
    [`seed${seed}-lights-off`, `${at(seed)}&actors=1&reveal=0&lights=0`],
    [`seed${seed}-mixed-damage`, `${at(seed)}&actors=1&reveal=0&damage=mixed`],
    [`close-seed${seed}-lamp`, `${at(seed)}&actors=0&reveal=0&cam=${LAMP[seed]}`],
    [
      `close-seed${seed}-lamp-destroyed`,
      `${at(seed)}&actors=0&reveal=0&damage=destroyed&cam=${LAMP[seed]}`,
    ],
    [
      `close-seed${seed}-lamp-mixed`,
      `${at(seed)}&actors=0&reveal=0&damage=mixed&cam=${LAMP[seed]}`,
    ],
    [
      `close-seed${seed}-lamp-lights-off`,
      `${at(seed)}&actors=0&reveal=0&lights=0&cam=${LAMP[seed]}`,
    ],
  ]),
  // the reference comparison camera, kept apart from gameplay framing
  ["reference-seed7", `${at(7)}&actors=0&reveal=0&cam=-30,140,4.5`],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const perf = {};
for (const [name, query] of SHOTS) {
  if (only && !only.includes(name)) continue;
  if (perfMode && !/^seed\d-play$/.test(name)) continue;
  const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const started = Date.now();
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6500);
  if (perfMode) {
    const renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : (gl?.getParameter(gl.RENDERER) ?? "none");
    });
    await page.evaluate(() => {
      window.__frames = [];
      window.__sampling = true;
      let last = performance.now();
      const tick = (t) => {
        window.__frames.push(t - last);
        last = t;
        if (window.__sampling) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // the same interaction every run: zoom in twice, out three times, then settle
    for (const label of ["Zoom in", "Zoom in", "Zoom out", "Zoom out", "Zoom out"]) {
      const b = page.locator(`button[aria-label="${label}"]`);
      if (await b.isEnabled()) await b.click();
      await page.waitForTimeout(1200);
    }
    await page.waitForTimeout(4000);
    const frames = await page.evaluate(() => {
      window.__sampling = false;
      return window.__frames.slice(5);
    });
    frames.sort((a, b) => a - b);
    const q = (p) => +frames[Math.min(frames.length - 1, Math.floor(frames.length * p))].toFixed(1);
    perf[name] = {
      renderer,
      loadMs: Date.now() - started,
      frames: frames.length,
      meanMs: +(frames.reduce((s, f) => s + f, 0) / frames.length).toFixed(1),
      p10Ms: q(0.1),
      p50Ms: q(0.5),
      p90Ms: q(0.9),
      p99Ms: q(0.99),
      maxMs: +frames.at(-1).toFixed(1),
    };
    console.log("perf", name, JSON.stringify(perf[name]));
  } else {
    const clip = await (await page.$("canvas")).boundingBox();
    await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 86, clip });
  }
  console.log(name, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
  await page.close();
}
if (perfMode) await writeFile(`${out}/perf.json`, JSON.stringify(perf, null, 2));
await browser.close();
