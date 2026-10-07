/**
 * The material pilot's matched captures (`courtyard/groundReflection.ts`).
 *
 *     node tools/scenes/material-pilot-evidence.mjs 5180 docs/evidence/material-pilot/revision
 *
 * Every view is taken from the same build as `-baseline` (`reflect=hidden`: built, not
 * shown, so the frame is the ground as it was) and `-pilot` (shown). The play and
 * close-up views are also taken as `-pictures` (the fixtures' reflections alone) and
 * `-glints` (the lights' glints alone), to tell which part does what.
 *
 * Seeds 8, 7 and 0: normal play zoom with characters, the shop lamp close up, lights
 * off, the reveal on, and mixed damage. The framing and viewport are PR 302's
 * (`docs/evidence/material-pilot/2-pilot/`), so its captures set beside these.
 * Unedited canvas captures; `ONLY=a,b` limits the views, `SEEDS=8` the seeds.
 *
 * The cost is `reflection-perf.mjs`.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/material-pilot/current"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const only = process.env.ONLY?.split(",");
const seeds = (process.env.SEEDS ?? "8,7,0").split(",").map(Number);
const LAMP = { 7: "-60,100,3", 0: "-194,-40,3", 8: "-261,-2,3" };
const VIEWS = (seed) => ({
  play: "actors=1&reveal=0",
  close: `actors=0&reveal=0&cam=${LAMP[seed]}`,
  "lights-off": `actors=0&reveal=0&lights=0&cam=${LAMP[seed]}`,
  reveal: "actors=1&reveal=1",
  "mixed-damage": "actors=1&reveal=0&damage=mixed",
});
const VARIANTS = (view) => [
  ["baseline", "hidden"],
  ["pilot", "on"],
  ...(view === "play" || view === "close"
    ? [
        ["pictures", "pictures"],
        ["glints", "glints"],
      ]
    : []),
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
for (const seed of seeds)
  for (const [view, query] of Object.entries(VIEWS(seed))) {
    if (only && !only.includes(view)) continue;
    for (const [variant, mode] of VARIANTS(view)) {
      const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `http://127.0.0.1:${port}/scene-review?place=intersection&seed=${seed}&${query}&reflect=${mode}`,
        { waitUntil: "networkidle" },
      );
      await page.waitForFunction(
        () => performance.getEntriesByName("courtyard-ready").length > 0,
        null,
        { timeout: 120000 },
      );
      await page.waitForTimeout(4000);
      const clip = await (await page.$("canvas")).boundingBox();
      const name = `seed${seed}-${view}-${variant}`;
      await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 88, clip });
      console.log(name, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
      await page.close();
    }
  }
await browser.close();
