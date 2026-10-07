/**
 * Does a dim wall beside a bright window reflect? (`courtyard/groundReflection.ts`)
 *
 *     node tools/scenes/reflection-source-check.mjs 5180
 *
 * Runs in Chromium against the dev server's own module. A synthetic source paints a
 * dim, opaque wall (as a wall under a lamp's wash looks at night) beside a bright window
 * and a pink sign; a second source paints another dim wall overlapping it. Each source's
 * picture is extracted, flipped and stretched (`flipOf`), with the stretch sampled at
 * 2, 8, 24, 96 and 400 depths. The check fails unless:
 *
 * - under the walls, the whole picture (`tight`) and the streak (`stretched`) are exactly
 *   zero at every sample count, alone and summed over both sources;
 * - under the window and the sign, both are visible at every sample count, and the
 *   streak's mean changes by under 10% between sample counts.
 *
 * It also prints what PR 302's rule (stretch first, then subtract the floor divided by
 * the sample count) made of the same wall.
 */
import { chromium } from "playwright";

const [port = "5180"] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/style`, { waitUntil: "networkidle" });
const result = await page.evaluate(async () => {
  const gr = await import("/src/features/play/courtyard/groundReflection.ts");
  // a 40 x 40 m ground at 10 px a metre, asphalt everywhere
  const ground = document.createElement("canvas");
  ground.width = 400;
  ground.height = 400;
  const g = ground.getContext("2d");
  g.fillStyle = "#30363a";
  g.fillRect(0, 0, 400, 400);
  const project = (p) => ({ x: p.x * 10, y: p.y * 10 });
  const line = { a: { x: 0, y: 200 }, b: { x: 400, y: 200 } };
  const extent = [
    { x: 40, y: 80 },
    { x: 360, y: 80 },
    { x: 360, y: 200 },
    { x: 40, y: 200 },
  ];
  // the wall's colour is what a lit wall shows at night: dim, opaque
  const WALL = [62, 64, 72];
  const wallSource = {
    group: "shop",
    ...line,
    extent,
    paint: (ctx) => {
      ctx.fillStyle = `rgb(${WALL.join(",")})`;
      ctx.fillRect(40, 80, 180, 120); // wall: x 40..220
      ctx.fillStyle = "rgb(255,196,120)";
      ctx.fillRect(250, 130, 60, 60); // window: x 250..310
      ctx.fillStyle = "rgb(255,70,140)";
      ctx.fillRect(320, 95, 30, 20); // sign: x 320..350
    },
  };
  // a second dim wall over the same ground, so dim copies could add up across sources
  const overlapSource = {
    group: "shop",
    ...line,
    extent,
    paint: (ctx) => {
      ctx.fillStyle = `rgb(${WALL.join(",")})`;
      ctx.fillRect(40, 80, 180, 120);
    },
  };
  const setupFor = (samples) => ({
    ground,
    origin: { x: 0, y: 0 },
    resolution: 1,
    project,
    ppm: 10,
    sources: [wallSource, overlapSource],
    occluders: [],
    paintClasses: (ctx) => {
      ctx.fillStyle = "rgb(1,0,0)";
      ctx.fillRect(0, 0, 400, 400);
    },
    stretchSamples: samples,
  });
  const columns = (f, x0, x1, which) => {
    let sum = 0;
    let max = 0;
    let n = 0;
    for (let y = 0; y < f.box.h; y++)
      for (let x = 0; x < f.box.w; x++) {
        const gx = f.box.x + x;
        if (gx < x0 || gx >= x1) continue;
        const i = (y * f.box.w + x) * 3;
        const v = f[which][i] + f[which][i + 1] + f[which][i + 2];
        sum += v;
        max = Math.max(max, v);
        n++;
      }
    return { sum, max, mean: n ? sum / n : 0 };
  };
  const rows = [];
  for (const samples of [2, 8, 24, 96, 400]) {
    const layer = new gr.GroundReflection(setupFor(samples));
    const a = layer.flipOf(wallSource);
    const b = layer.flipOf(overlapSource);
    const both = (which, x0, x1) => {
      const ca = columns(a, x0, x1, which);
      const cb = columns(b, x0, x1, which);
      return { sum: ca.sum + cb.sum, max: Math.max(ca.max, cb.max), mean: ca.mean + cb.mean };
    };
    rows.push({
      samples,
      wallTight: both("tight", 45, 215),
      wallStretched: both("stretched", 45, 215),
      windowTight: columns(a, 255, 305, "tight"),
      windowStretched: columns(a, 255, 305, "stretched"),
      signStretched: columns(a, 322, 348, "stretched"),
    });
  }
  // PR 302's rule on the same wall: the stretch summed every copy at 1/n, then took off
  // the floor (then 0.5) divided by n. Where m of the n copies overlap, a channel kept
  // (wall·m − 0.5·255)/n, so it reflected once m·wall exceeded half of white.
  const legacy = [8, 22, 64].map((n) => {
    const covering = n; // under the wall every depth's copy lands on the same columns
    const kept = Math.max(0, (WALL[2] * covering - 0.5 * 255) / n);
    return { samples: n, keptPerChannel: +kept.toFixed(1) };
  });
  return { rows, legacy, floor: gr.REFLECTION.floor };
});
await browser.close();

let failed = false;
console.log(`floor ${result.floor} of full scale, applied to each source's own picture`);
const base = result.rows.find((r) => r.samples === 24);
for (const r of result.rows) {
  const ok =
    r.wallTight.sum === 0 &&
    r.wallStretched.sum === 0 &&
    r.windowTight.max > 0 &&
    r.windowStretched.max > 0 &&
    r.signStretched.max > 0 &&
    Math.abs(r.windowStretched.mean - base.windowStretched.mean) / base.windowStretched.mean < 0.1;
  if (!ok) failed = true;
  console.log(
    `samples ${String(r.samples).padStart(3)}: wall tight ${r.wallTight.sum}, wall streak ${r.wallStretched.sum}; ` +
      `window tight max ${r.windowTight.max.toFixed(0)}, window streak mean ${r.windowStretched.mean.toFixed(1)}, ` +
      `sign streak max ${r.signStretched.max.toFixed(0)} ${ok ? "ok" : "FAIL"}`,
  );
}
for (const l of result.legacy)
  console.log(
    `PR 302's rule, ${l.samples} copies over the wall: ${l.keptPerChannel} of 255 kept per channel`,
  );
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
