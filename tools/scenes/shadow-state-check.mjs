/**
 * Lamp shadows against the complete destruction state (`groundShadows.ts`), checked in a
 * real Chromium against the dev server's own modules.
 *
 *     node tools/scenes/shadow-state-check.mjs 5180
 *
 * 1. A small deterministic case. Two casters, A and B, whose shadows overlap under one
 *    light, with a second light over the same ground.
 *    - States: both standing, A destroyed, B destroyed, both destroyed.
 *    - Every state is reached in both orders and loaded directly.
 *    - What the board shows (the base plus each region's patch) is compared, pixel by
 *      pixel, with a fresh render of the same complete state.
 *    - The old per-prop restore (#299) is computed beside it, to show the failure it had.
 * 2. Seeds 7, 0 and 8 in /scene-review, through the board's own setup (dev only:
 *    `window.__groundLight`): every caster standing, every caster destroyed, every
 *    other one destroyed, and each region's casters destroyed together.
 *
 * 3. The board itself on seed 7: switched live through damage states against a board
 *    loaded directly into each one.
 *
 * Every channel where the board differs from the fresh render is classified
 * (`comparePixels`). The only allowed difference is a channel where rounding leaves the
 * wreck's render below the standing one: a patch only adds light, so the board keeps the
 * standing value there. The check exits non-zero on any other difference.
 */
import { chromium } from "playwright";

const [port = "5180"] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
let failed = false;
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on("pageerror", (e) => {
  failed = true;
  console.log("page error:", e.message);
});

// --- 1. the deterministic case -------------------------------------------------------
await page.goto(`http://127.0.0.1:${port}/scene-review?place=intersection&seed=7&actors=0`, {
  waitUntil: "networkidle",
});
const synthetic = await page.evaluate(async () => {
  const gs = await import("/src/features/play/courtyard/groundShadows.ts");
  const ls = await import("/src/features/play/courtyard/lampShadow.ts");
  const nl = await import("/src/features/play/courtyard/nightLighting.ts");
  const { battlefieldProjection } = await import("/src/features/play/battlefieldProjection.ts");
  const { project } = battlefieldProjection(32, 32);
  // a ground of mid-grey with a fixed grain, at 2 px a scene unit, like the board's
  const base = document.createElement("canvas");
  base.width = 900;
  base.height = 600;
  const b = base.getContext("2d");
  const img = b.createImageData(base.width, base.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 70 + (((i * 2654435761) >>> 0) % 50);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v + 6;
    img.data[i + 3] = 255;
  }
  b.putImageData(img, 0, 0);
  const prepare = (ctx) => {
    ctx.scale(2, 2);
    ctx.translate(-150, -150);
  };
  const square = (x, y, s = 1.76) => [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s },
  ];
  // A in front of the lamp, B straight behind it, so B stands in A's shadow and
  // A's shadow runs into B's
  const lamp = {
    kind: "pool",
    centre: { x: 8, y: 10 },
    radius: 7,
    color: [1, 0.8, 0.56],
    intensity: 0.9,
  };
  const sign = {
    kind: "pool",
    centre: { x: 12, y: 8 },
    radius: 5,
    color: [0.32, 0.8, 0.78],
    intensity: 0.5,
  };
  const casters = [
    { coverId: "A", art: "cargo", body: square(10, 9.2), height: 1.5, wreck: 0.4 },
    { coverId: "B", art: "cargo", body: square(12.1, 9.6), height: 1.5, wreck: 0.4 },
  ];
  const z = new Map([
    [lamp, 4.4],
    [sign, 2.6],
  ]);
  const setup = {
    base,
    prepare,
    project,
    lights: [lamp, sign],
    casters,
    zOf: (l) => z.get(l),
    paintLight: (ctx, l) => nl.paintGroundLight(ctx, project, l),
    gain: 2.6,
  };
  const pixels = (c) => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  const states = { standing: [], A: ["A"], B: ["B"], both: ["A", "B"] };
  const fresh = Object.fromEntries(
    Object.entries(states).map(([k, ids]) => [
      k,
      pixels(gs.renderGroundLight(setup, new Set(ids))),
    ]),
  );
  const shipped = gs.renderGroundLight(setup, new Set());
  const results = [];
  const check = (label, shadows, ids, freshKey) => {
    const composed = pixels(gs.composeGroundLight(shadows, shipped, new Set(ids)));
    results.push({ label, ...gs.comparePixels(composed, fresh[freshKey], fresh.standing) });
  };
  // reached in sequence on one board, in both orders, and back
  for (const order of [
    ["A", "B"],
    ["B", "A"],
  ]) {
    const shadows = new gs.GroundShadows(setup);
    check(`order ${order.join(",")}: standing`, shadows, [], "standing");
    check(`order ${order.join(",")}: ${order[0]} destroyed`, shadows, [order[0]], order[0]);
    check(`order ${order.join(",")}: both destroyed`, shadows, order, "both");
  }
  // loaded directly into each state, on a fresh board
  for (const [k, ids] of Object.entries(states))
    check(`loaded into ${k}`, new gs.GroundShadows(setup), ids, k);
  const shadows = new gs.GroundShadows(setup);
  // the second light is really there: with it, the region is brighter than with the lamp alone
  const lampOnly = pixels(gs.renderGroundLight({ ...setup, lights: [lamp] }, new Set(["A", "B"])));
  const both = fresh.both;
  const r = shadows.regions[0];
  let brighter = 0;
  for (let y = r.box.y; y < r.box.y + r.box.height; y++)
    for (let x = r.box.x; x < r.box.x + r.box.width; x++) {
      const i = (y * base.width + x) * 4;
      if (both[i + 2] > lampOnly[i + 2] + 2) brighter++;
    }
  // the old per-prop restores, each computed as if the other still stood
  const restore = (id) => {
    const now = pixels(gs.renderGroundLight(setup, new Set([id])));
    const s = pixels(shipped);
    return now.map((v, i) => ((i & 3) === 3 ? 255 : Math.max(0, v - s[i])));
  };
  const restoreA = restore("A");
  const restoreB = restore("B");
  const old = pixels(shipped).map((v, i) =>
    (i & 3) === 3 ? 255 : Math.min(255, v + restoreA[i] + restoreB[i]),
  );
  // pixels the old way left too dark, and by how much at most
  let tooDark = 0;
  let darkest = 0;
  for (let i = 0; i < old.length; i += 4) {
    const d = both[i] - old[i];
    if (d > 2) tooDark++;
    if (d > darkest) darkest = d;
  }
  // the overlap, as images: the fresh render with both destroyed, #299's sum, this board's
  // composite, and #299's deficit and this board's difference amplified ten times
  const crop = (data, amplify) => {
    const c = document.createElement("canvas");
    c.width = r.box.width;
    c.height = r.box.height;
    const ctx = c.getContext("2d");
    const out = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const i = ((r.box.y + y) * base.width + r.box.x + x) * 4;
        const o = (y * c.width + x) * 4;
        for (let k = 0; k < 3; k++)
          out.data[o + k] = amplify ? Math.min(255, Math.abs(data[i + k]) * 10) : data[i + k];
        out.data[o + 3] = 255;
      }
    ctx.putImageData(out, 0, 0);
    return c.toDataURL("image/png");
  };
  const composedBoth = pixels(
    gs.composeGroundLight(new gs.GroundShadows(setup), shipped, new Set(["A", "B"])),
  );
  const images = {
    "overlap-1-standing": crop(fresh.standing),
    "overlap-2-fresh-both-destroyed": crop(both),
    "overlap-3-pr299-both-destroyed": crop(old),
    "overlap-4-this-board-both-destroyed": crop(composedBoth),
    "overlap-5-pr299-deficit-x10": crop(
      both.map((v, i) => v - old[i]),
      true,
    ),
    "overlap-6-this-board-difference-x10": crop(
      both.map((v, i) => v - composedBoth[i]),
      true,
    ),
  };
  return {
    images,
    regions: shadows.regions.map((x) => ({ ids: x.ids, box: x.box })),
    results,
    secondLight: { regionPixelsLitBySign: brighter },
    oldMethodBothDestroyed: { pixelsTooDark: tooDark, worstDeficit: darkest },
  };
});
console.log("deterministic case: regions", JSON.stringify(synthetic.regions));
if (process.env.OUT) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(process.env.OUT, { recursive: true });
  for (const [name, url] of Object.entries(synthetic.images))
    await writeFile(`${process.env.OUT}/${name}.png`, Buffer.from(url.split(",")[1], "base64"));
}
for (const r of synthetic.results) {
  console.log(
    `  ${r.label.padEnd(34)} unexplained ${r.unexplained} (max ${r.unexplainedMax}); rounding below standing ${r.rounding} (max ${r.roundingMax})`,
  );
  if (r.unexplained > 0) failed = true;
}
console.log(
  `  second light inside the region: ${synthetic.secondLight.regionPixelsLitBySign} px lit by it`,
);
if (synthetic.secondLight.regionPixelsLitBySign === 0) failed = true;
console.log(
  `  #299's per-prop restores, both destroyed: ${synthetic.oldMethodBothDestroyed.pixelsTooDark} px too dark, worst by ${synthetic.oldMethodBothDestroyed.worstDeficit}/255`,
);
if (synthetic.regions.length !== 1 || synthetic.regions[0].ids.join() !== "A,B") failed = true;

// --- 2. the seeds, through the board's own setup ---------------------------------------
for (const seed of (process.env.SEEDS ?? "7,0,8").split(",").map(Number)) {
  await page.goto(
    `http://127.0.0.1:${port}/scene-review?place=intersection&seed=${seed}&actors=0`,
    {
      waitUntil: "networkidle",
    },
  );
  await page.waitForFunction(() => window.__groundLight, null, { timeout: 30000 });
  const res = await page.evaluate(async () => {
    const gs = await import("/src/features/play/courtyard/groundShadows.ts");
    const { setup, ground, canvas } = window.__groundLight;
    const ids = setup.casters.map((c) => c.coverId);
    const states = {
      standing: [],
      "all destroyed": ids,
      "every other destroyed": ids.filter((_, i) => i % 2),
      ...Object.fromEntries(
        ground.regions
          .filter((r) => r.ids.length > 1)
          .map((r) => [`region ${r.ids.join("+")}`, r.ids]),
      ),
    };
    const out = [];
    for (const [label, d] of Object.entries(states)) {
      const set = new Set(d);
      const a = gs.composeGroundLight(ground, canvas, set);
      const b = gs.renderGroundLight(setup, set);
      const pa = a.getContext("2d").getImageData(0, 0, a.width, a.height).data;
      const pb = b.getContext("2d").getImageData(0, 0, b.width, b.height).data;
      const base = canvas.getContext("2d").getImageData(0, 0, a.width, a.height).data;
      out.push({ label, ...gs.comparePixels(pa, pb, base) });
    }
    return {
      casters: ids.length,
      regions: ground.regions.length,
      shared: ground.regions.filter((r) => r.ids.length > 1).map((r) => r.ids.join("+")),
      out,
    };
  });
  console.log(
    `seed ${seed}: ${res.casters} casters in ${res.regions} regions; shared: ${res.shared.join(", ") || "none"}`,
  );
  for (const r of res.out) {
    console.log(
      `  ${r.label.padEnd(60)} unexplained ${r.unexplained} (max ${r.unexplainedMax}); rounding below standing ${r.rounding} (max ${r.roundingMax})`,
    );
    if (r.unexplained > 0) failed = true;
  }
}
// --- 3. the board itself: a live change against loading straight into the state ------
// Seed 7's shop lamp close up, with the cart and crate's region in view. The board is
// opened intact and switched (the "Cover" control, no reload) through every other
// destroyed, all destroyed and back; each frame is compared with a board loaded
// directly into that state. Unedited canvas pixels.
{
  const cam = "-60,100,3";
  const shot = async (p) => {
    await p.waitForTimeout(1500);
    const clip = await (await p.$("canvas")).boundingBox();
    return p.screenshot({ clip, type: "png" });
  };
  const sharp = (await import("sharp")).default;
  const raw = async (png) => (await sharp(png).raw().toBuffer({ resolveWithObject: true })).data;
  const open = async (damage) => {
    const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await p.goto(
      `http://127.0.0.1:${port}/scene-review?place=intersection&seed=7&actors=0&reveal=0&damage=${damage}&cam=${cam}`,
    );
    await p.waitForFunction(
      () => performance.getEntriesByName("courtyard-ready").length > 0,
      null,
      {
        timeout: 120000,
      },
    );
    await p.waitForTimeout(2000);
    return p;
  };
  const live = await open("intact");
  for (const damage of ["mixed", "destroyed", "intact", "destroyed"]) {
    await live.selectOption("select:near(:text('Cover'))", damage).catch(async () => {
      // the control is the select inside the "Cover" label
      await live.locator("label", { hasText: "Cover" }).locator("select").selectOption(damage);
    });
    const a = await raw(await shot(live));
    const direct = await open(damage);
    const b = await raw(await shot(direct));
    await direct.close();
    let n = 0;
    let max = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const d = Math.abs(a[i] - b[i]);
      if (d) n++;
      if (d > max) max = d;
    }
    console.log(
      `board, switched live to ${damage.padEnd(9)} against loaded directly: ${n} channels differ (max ${max})`,
    );
    if (max > 3) failed = true;
  }
  await live.close();
}
await browser.close();
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
