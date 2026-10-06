/**
 * The atmosphere pilot's matched captures: the same cameras at every stage, so each
 * stage's change can be seen on its own.
 *
 *     node tools/scenes/atmosphere-evidence.mjs 5180 docs/evidence/atmosphere/1-baseline [query-extra]
 *
 * `query-extra` (e.g. `night=0`) is appended to every shot, for a stage that is a
 * query switch rather than a code state. Unedited canvas captures. `ONLY=a,b` limits.
 * `PERF=1` also samples frame times while panning and zooming, and prints them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/atmosphere/1-baseline", extra = ""] =
  process.argv.slice(2);
await mkdir(out, { recursive: true });
const only = process.env.ONLY?.split(",");
const S7 = "place=intersection&seed=7";
/** About the reference's character size and corner coverage; not the play camera. */
const COMPARE = "cam=-10,115,2.2&player=21,4.5";
/** The storefront close: bright areas must keep their material. */
const CLOSE = "cam=-30,140,4.5&player=30.3,1.6";
const SHOTS = [
  // the actors board keeps its own play camera; the overview is the empty scene's
  ["compare-reveal", `${S7}&actors=1&reveal=1&${COMPARE}`],
  ["compare-solid", `${S7}&actors=1&reveal=0&${COMPARE}`],
  ["play-solid", `${S7}&actors=1&reveal=0`],
  ["play-reveal", `${S7}&actors=1&reveal=1`],
  ["play-lights-off", `${S7}&actors=1&reveal=0&lights=0`],
  ["overview", `${S7}&actors=0&reveal=0&framing=overview`],
  ["close-storefront", `${S7}&actors=0&reveal=0&${CLOSE}`],
  ["seed0-play", "place=intersection&seed=0&actors=1&reveal=0"],
  ["seed8-play", "place=intersection&seed=8&actors=1&reveal=0"],
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
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}${extra ? `&${extra}` : ""}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(6500);
  const loaded = Date.now() - started;
  const clip = await (await page.$("canvas")).boundingBox();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 84, clip });
  if (process.env.PERF && name === "play-solid") {
    // frame times while the camera's own buttons pan and zoom: the same steps each run
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
    console.log("perf", JSON.stringify(perf[name]));
  }
  console.log(name, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
  await page.close();
}
if (Object.keys(perf).length) await writeFile(`${out}/perf.json`, JSON.stringify(perf, null, 2));
await browser.close();
