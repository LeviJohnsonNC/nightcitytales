/**
 * The annex's shutter and windows at a series of camera zooms, cropped to the same
 * world rectangle and scaled to one size, to tell a texture's baked aliasing (fixed at
 * every zoom) from the renderer's sampling (changing with zoom):
 *
 *     node tools/scenes/architecture-zoom-series.mjs 5180 out/dir [name]
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/corner-finish/zoom", name = "shutter"] =
  process.argv.slice(2);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
for (const zoom of [1.6, 2.2, 3.2, 4.4, 6]) {
  const page = await (
    await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  ).newPage();
  await page.goto(
    `http://127.0.0.1:${port}/scene-review?place=intersection&seed=7&actors=0&reveal=0&night=0&cam=-212,-34,${zoom}`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(3500);
  const box = await (await page.$("canvas")).boundingBox();
  // a fixed world window around the shutter: its size on screen grows with the zoom
  const k = (Math.min(box.width / 1100, box.height / 680) * zoom) / 9.8;
  const w = 520 * k;
  const h = 560 * k;
  await page.screenshot({
    path: `${out}/${name}-zoom-${zoom}.png`,
    clip: {
      x: box.x + box.width / 2 - w / 2,
      y: box.y + box.height / 2 - h / 2,
      width: w,
      height: h,
    },
  });
  console.log(name, zoom, "ok");
  await page.context().close();
}
await browser.close();
