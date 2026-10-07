/**
 * What the shop corner's reflections cost (`courtyard/groundReflection.ts`), measured on
 * identical scenes with them not built, built and hidden, and shown.
 *
 *     node tools/scenes/reflection-perf.mjs [port] [out.json] [--chrome] [--headed]
 *         [--runs 3] [--seeds 8,7,0] [--modes skip,hidden,on]
 *
 * Each run opens the shop lamp's close-up (no characters) and reports:
 *
 * - **Scene ready** (`courtyard-ready`, ms since navigation) and the composed scene's
 *   build (`courtyard-environment`).
 * - **Construction**: reading the surface (`ground-reflection-build`). None when skipped.
 * - **First render**: the first state's layers (`ground-reflection-render`), at load.
 * - **Damage changes**, switched live with the scene review's "Cover" control: the
 *   first time each new state is reached (mixed, then destroyed) and a state seen before
 *   (intact, then mixed again). For each: the renders it caused and the longest frame in
 *   the 2.5 s after it. The same switches run in every mode, so the difference between
 *   modes is the reflections' share of the frame.
 * - **Retained**: the layers' boxes, every cached layer canvas, the per-source pictures
 *   and the surface arrays, in bytes; and the textures uploaded.
 *
 * `--chrome` runs the installed Google Chrome with its real GPU (no Playwright browser
 * download needed): use it on a Mac. Without it, Chromium on software GL, where only
 * relative numbers mean anything. Damage cost is measured here, never inferred from the
 * idle and zoom benchmark (`scene-perf.mjs`).
 */
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const option = (n, fallback) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : fallback;
};
const valued = new Set(["--runs", "--seeds", "--modes"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !valued.has(argv[i - 1]));
const [port = "5180", out] = positional;
const runs = Number(option("--runs", "3"));
const seeds = option("--seeds", "8,7,0").split(",").map(Number);
const modes = option("--modes", "skip,hidden,on").split(",");
const LAMP = { 7: "-60,100,3", 0: "-194,-40,3", 8: "-261,-2,3" };

const browser = await chromium.launch(
  flag("--chrome")
    ? { channel: "chrome", headless: !flag("--headed") }
    : {
        executablePath: process.env.CHROMIUM_PATH,
        headless: !flag("--headed"),
        args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
      },
);

const measures = (page, name) =>
  page.evaluate((n) => performance.getEntriesByName(n).map((e) => +e.duration.toFixed(1)), name);

const results = [];
let renderer = "";
for (const seed of seeds)
  for (const mode of modes)
    for (let run = 1; run <= runs; run++) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `http://127.0.0.1:${port}/scene-review?place=intersection&seed=${seed}&actors=0&reveal=0&cam=${LAMP[seed]}&reflect=${mode}`,
      );
      await page.waitForFunction(
        () => performance.getEntriesByName("courtyard-ready").length > 0,
        null,
        { timeout: 120000 },
      );
      await page.waitForTimeout(2500);
      const row = await page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return {
          sceneReadyMs: Math.round(performance.getEntriesByName("courtyard-ready")[0].startTime),
          environmentMs: Math.round(
            performance.getEntriesByName("courtyard-environment")[0]?.duration ?? NaN,
          ),
          renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "none",
        };
      });
      renderer = row.renderer;
      delete row.renderer;
      row.seed = seed;
      row.mode = mode;
      row.run = run;
      row.constructionMs = (await measures(page, "ground-reflection-build"))[0] ?? null;
      row.firstRenderMs = (await measures(page, "ground-reflection-render"))[0] ?? null;
      row.switches = [];
      for (const [damage, kind] of [
        ["mixed", "first"],
        ["destroyed", "first"],
        ["intact", "repeat"],
        ["mixed", "repeat"],
      ]) {
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
        row.switches.push({
          damage,
          kind,
          renderMs: (await measures(page, "ground-reflection-render")).slice(before),
          longestFrameMs: Math.round(Math.max(...frames)),
        });
      }
      row.retained = await page.evaluate(() => window.__groundReflection?.retained() ?? null);
      row.errors = errors;
      results.push(row);
      const s = row.switches
        .map(
          (w) => `${w.damage}(${w.kind}) ${w.renderMs.join("+") || "-"} ms / ${w.longestFrameMs}`,
        )
        .join("; ");
      console.log(
        `seed ${seed} ${mode.padEnd(6)} run ${run}: ready ${row.sceneReadyMs} (environment ${row.environmentMs}); ` +
          `construction ${row.constructionMs ?? "-"}; first render ${row.firstRenderMs ?? "-"}; ${s}` +
          (row.retained
            ? `; retained ${(row.retained.layerBytes / 1e6).toFixed(2)} MB layers, ${(row.retained.flipBytes / 1e6).toFixed(2)} MB pictures, ${(row.retained.surfaceBytes / 1e6).toFixed(2)} MB surface`
            : "") +
          (errors.length ? `; errors: ${errors.join(" | ")}` : ""),
      );
      await page.close();
    }
await browser.close();
const kind = /swiftshader|llvmpipe|software/i.test(renderer) ? "software" : "hardware";
console.log(`renderer: ${renderer} (${kind})`);
if (out) await writeFile(out, JSON.stringify({ renderer, kind, results }, null, 2));
