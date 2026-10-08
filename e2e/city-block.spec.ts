/** Matched evidence from the shipping scene-review route. Never creates a campaign. */
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test.use({
  viewport: { width: 1800, height: 1100 },
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});
test.setTimeout(180_000);
for (const seed of [8, 7, 0])
  test(`city block seed ${seed}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const out = "e2e/.results/city-block";
    await mkdir(out, { recursive: true });
    const t = Date.now();
    await page.goto(
      `/scene-review?place=intersection&seed=${seed}&adventure=0&actors=1&access=0&night=1&lights=1&reflect=on&reveal=0`,
      { waitUntil: "networkidle" },
    );
    await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
    // GPU texture preparation and font loading settle before a repeatable capture.
    await page.waitForTimeout(5000);
    await page.locator("canvas").screenshot({ path: `${out}/seed${seed}-play.png` });
    const measures = await page.evaluate(() =>
      performance.getEntriesByType("measure").map((x) => ({ name: x.name, duration: x.duration })),
    );
    if (seed === 8) {
      await page.getByRole("button", { name: "Save review", exact: true }).click();
      await page.getByLabel("Lights", { exact: true }).uncheck();
      await page.waitForTimeout(500);
      await page.locator("canvas").screenshot({ path: `${out}/seed8-lights-off.png` });
      await page.getByLabel("Night", { exact: true }).uncheck();
      await page.waitForTimeout(500);
      await page.locator("canvas").screenshot({ path: `${out}/seed8-neutral.png` });
      await page.getByLabel("Night", { exact: true }).check();
      await page.getByLabel("Lights", { exact: true }).check();
      await page.getByLabel("Cover", { exact: true }).selectOption("destroyed");
      await page.waitForTimeout(800);
      await page.locator("canvas").screenshot({ path: `${out}/seed8-destroyed.png` });
      await page.getByRole("button", { name: "Load review", exact: true }).click();
      await page.waitForTimeout(800);
      await page.locator("canvas").screenshot({ path: `${out}/seed8-restored.png` });
    }
    await page.getByLabel("Show characters / targeting", { exact: true }).uncheck();
    await page.getByLabel("Reveal activity behind buildings", { exact: true }).check();
    await page.waitForTimeout(1500);
    await page.locator("canvas").screenshot({ path: `${out}/seed${seed}-reveal.png` });
    await writeFile(
      `${out}/seed${seed}-metrics.json`,
      JSON.stringify({ seed, totalMs: Date.now() - t, measures, errors }, null, 2),
    );
    expect(errors).toEqual([]);
    if (seed === 7) {
      await page.setViewportSize({ width: 700, height: 850 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${out}/compact.png` });
    }
  });
