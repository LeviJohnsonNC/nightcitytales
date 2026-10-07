/**
 * The material pilot's matched captures and its cost (`courtyard/groundReflection.ts`).
 *
 *     node tools/scenes/material-pilot-evidence.mjs 5180 docs/evidence/material-pilot/2-pilot
 *
 * Every view is taken twice from the same build: `reflect=0` (the ground as it was) and
 * the pilot. Seeds 7, 0 and 8: normal play zoom with characters, the shop lamp close up,
 * lights off, the reveal on, and mixed damage. Unedited canvas captures; `ONLY=a,b`
 * limits the views, `SEEDS=7` the seeds.
 *
 * `PERF=1` instead measures, per seed: when the board is ready, how long reading the
 * surface took (`ground-reflection-build`) and the first render (`ground-reflection-
 * render`); then, on a live board, each damage switch's first render and the longest
 * frame around it, and that a state seen before is not rendered again. Writes
 * `perf.json`. `BASE=1` takes the same measurements with `reflect=0`, for the switch's
 * own cost without the pilot. Software GL here: only relative numbers mean anything.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/material-pilot/current"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const only = process.env.ONLY?.split(",");
const seeds = (process.env.SEEDS ?? "7,0,8").split(",").map(Number);
const LAMP = { 7: "-60,100,3", 0: "-194,-40,3", 8: "-261,-2,3" };
const VIEWS = (seed) => ({
  play: "actors=1&reveal=0",
  close: `actors=0&reveal=0&cam=${LAMP[seed]}`,
  "lights-off": `actors=0&reveal=0&lights=0&cam=${LAMP[seed]}`,
  reveal: "actors=1&reveal=1",
  "mixed-damage": "actors=1&reveal=0&damage=mixed",
});

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const open = async (query) => {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/scene-review?place=intersection&${query}`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(
    () => performance.getEntriesByName("courtyard-ready").length > 0,
    null,
    { timeout: 120000 },
  );
  return { page, errors };
};
const measures = (page, name) =>
  page.evaluate((n) => performance.getEntriesByName(n).map((e) => Math.round(e.duration)), name);

if (process.env.PERF !== "1") {
  for (const seed of seeds)
    for (const [view, query] of Object.entries(VIEWS(seed))) {
      if (only && !only.includes(view)) continue;
      for (const [variant, flag] of [
        ["baseline", "&reflect=0"],
        ["pilot", ""],
      ]) {
        const { page, errors } = await open(`seed=${seed}&${query}${flag}`);
        await page.waitForTimeout(4000);
        const clip = await (await page.$("canvas")).boundingBox();
        const name = `seed${seed}-${view}-${variant}`;
        await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 88, clip });
        console.log(name, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
        await page.close();
      }
    }
} else {
  const perf = {};
  for (const seed of seeds) {
    const base = process.env.BASE === "1" ? "&reflect=0" : "";
    const { page, errors } = await open(`seed=${seed}&actors=0&reveal=0&cam=${LAMP[seed]}${base}`);
    await page.waitForTimeout(2500);
    const row = await page.evaluate(() => ({
      sceneReadyMs: Math.round(performance.getEntriesByName("courtyard-ready")[0].startTime),
      environmentMs: Math.round(
        performance.getEntriesByName("courtyard-environment")[0]?.duration ?? NaN,
      ),
      renderer: (() => {
        const gl = document.createElement("canvas").getContext("webgl");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "none";
      })(),
    }));
    row.buildMs = (await measures(page, "ground-reflection-build"))[0];
    row.firstRenderMs = (await measures(page, "ground-reflection-render"))[0];
    row.switches = [];
    for (const damage of ["mixed", "destroyed", "intact", "mixed"]) {
      const before = (await measures(page, "ground-reflection-render")).length;
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
      await page.locator("label", { hasText: "Cover" }).locator("select").selectOption(damage);
      await page.waitForTimeout(2500);
      const frames = await page.evaluate(() => {
        window.__sampling = false;
        return window.__frames.slice(1);
      });
      const renders = (await measures(page, "ground-reflection-render")).slice(before);
      row.switches.push({
        damage,
        renderMs: renders,
        longestFrameMs: Math.round(Math.max(...frames)),
      });
    }
    row.errors = errors;
    perf[`seed${seed}`] = row;
    console.log(`seed ${seed}`, JSON.stringify(row));
    await page.close();
  }
  await writeFile(
    `${out}/${process.env.BASE === "1" ? "perf-baseline" : "perf"}.json`,
    JSON.stringify(perf, null, 2),
  );
}
await browser.close();
