/**
 * How the intersection performs, measured apart from the benchmark's own waits.
 *
 *     node tools/scenes/scene-perf.mjs [port] [out.json]
 *
 * For seeds 7, 0 and 8 at play framing with characters, each run reports:
 *
 * - **Scene ready.** The board's own `courtyard-ready` mark, in ms since navigation
 *   began. This is when the scene is drawn and playable, not when this script stopped
 *   waiting. `environment` is the composed scene's build alone (`courtyard-environment`).
 * - **Idle.** Frame times over a fixed few seconds with nothing touched.
 * - **Zooming.** Frame times while the board zooms in twice and out three times.
 *
 * Each frame set gives the frames actually sampled and their distribution. The
 * renderer's own string is recorded and labelled `software` when it is SwiftShader or
 * llvmpipe: only relative numbers mean anything there.
 *
 * Options:
 *
 * - `--chrome`: run in the installed Google Chrome with its real GPU. No Playwright
 *   browser download is needed. Use this on a Mac.
 * - `--headed`: show the window.
 * - `--runs N`: runs per seed (default 3).
 * - `--seeds 7,0,8`.
 *
 * On a Mac:
 *
 *     bun install && bun run dev            # note the port it prints, e.g. 5173
 *     node tools/scenes/scene-perf.mjs 5173 perf-mac.json --chrome --headed
 */
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const positional = argv.filter(
  (a, i) =>
    !a.startsWith("--") &&
    !argv[i - 1]?.startsWith("--runs") &&
    !argv[i - 1]?.startsWith("--seeds"),
);
const [port = "5180", out] = positional;
const runs = Number(option("--runs", "3"));
const seeds = option("--seeds", "7,0,8").split(",").map(Number);
const useChrome = flag("--chrome");

const browser = await chromium.launch(
  useChrome
    ? { channel: "chrome", headless: !flag("--headed") }
    : {
        executablePath: process.env.CHROMIUM_PATH,
        headless: !flag("--headed"),
        args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
      },
);

const stats = (frames) => {
  const f = [...frames].sort((a, b) => a - b);
  const q = (p) => +f[Math.min(f.length - 1, Math.floor(f.length * p))].toFixed(1);
  return {
    frames: f.length,
    meanMs: +(f.reduce((s, v) => s + v, 0) / f.length).toFixed(1),
    p50Ms: q(0.5),
    p90Ms: q(0.9),
    p99Ms: q(0.99),
    maxMs: +f.at(-1).toFixed(1),
  };
};

const results = [];
let renderer = "";
for (const seed of seeds)
  for (let run = 1; run <= runs; run++) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `http://127.0.0.1:${port}/scene-review?place=intersection&seed=${seed}&actors=1&reveal=0`,
    );
    // wait for the board's own mark, however long it takes; nothing below is timed from here
    await page.waitForFunction(
      () => performance.getEntriesByName("courtyard-ready").length > 0,
      null,
      {
        timeout: 120000,
      },
    );
    const ready = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        sceneReadyMs: Math.round(performance.getEntriesByName("courtyard-ready")[0].startTime),
        environmentMs: Math.round(
          performance.getEntriesByName("courtyard-environment")[0]?.duration ?? NaN,
        ),
        renderer: ext
          ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : (gl?.getParameter(gl.RENDERER) ?? "none"),
      };
    });
    renderer = ready.renderer;
    const sample = async (during, ms) => {
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
      await during();
      await page.waitForTimeout(ms);
      return page.evaluate(() => {
        window.__sampling = false;
        // the first deltas span the sampler's own start
        return window.__frames.slice(2);
      });
    };
    // let the first frames after ready settle before sampling
    await page.waitForTimeout(1000);
    const idle = await sample(async () => {}, 5000);
    const zooming = await sample(async () => {
      for (const label of ["Zoom in", "Zoom in", "Zoom out", "Zoom out", "Zoom out"]) {
        const b = page.locator(`button[aria-label="${label}"]`);
        if (await b.isEnabled()) await b.click();
        await page.waitForTimeout(800);
      }
    }, 1000);
    const row = {
      seed,
      run,
      sceneReadyMs: ready.sceneReadyMs,
      environmentMs: ready.environmentMs,
      idle: stats(idle),
      zooming: stats(zooming),
      errors,
    };
    results.push(row);
    console.log(
      `seed ${seed} run ${run}: ready ${row.sceneReadyMs} ms (environment ${row.environmentMs} ms); ` +
        `idle ${row.idle.frames} frames p50 ${row.idle.p50Ms} p90 ${row.idle.p90Ms} p99 ${row.idle.p99Ms} ms; ` +
        `zooming ${row.zooming.frames} frames p50 ${row.zooming.p50Ms} p90 ${row.zooming.p90Ms} p99 ${row.zooming.p99Ms} ms` +
        (errors.length ? `; errors: ${errors.join(" | ")}` : ""),
    );
    await page.close();
  }
await browser.close();
const kind = /swiftshader|llvmpipe|software/i.test(renderer) ? "software" : "hardware";
console.log(`renderer: ${renderer} (${kind})`);
if (out) await writeFile(out, JSON.stringify({ renderer, kind, results }, null, 2));
