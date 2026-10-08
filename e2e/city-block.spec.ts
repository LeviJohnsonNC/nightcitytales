/** Matched evidence from the shipping scene-review route. Never creates a campaign. */
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test.use({
  viewport: { width: 1800, height: 1100 },
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});
test.setTimeout(90_000);
test.describe.configure({ retries: 0 });
test.afterEach(async ({ page }, info) => {
  await mkdir(info.outputDir, { recursive: true });
  // Keep diagnostics even when navigation/readiness fails before the first capture.
  await writeFile(
    info.outputPath("diagnostics.json"),
    JSON.stringify(
      {
        url: page.url(),
        errors: info.errors.map((e) => e.message),
      },
      null,
      2,
    ),
  );
});
for (const seed of [8, 7, 0])
  test(`city block seed ${seed}`, async ({ page }, info) => {
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const out = info.outputPath("captures");
    await mkdir(out, { recursive: true });
    const t = Date.now();
    await page.goto(
      `/scene-review?place=intersection&seed=${seed}&adventure=0&actors=1&access=0&night=1&lights=1&reflect=on&reveal=0`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
    // Streaming audio can keep networkidle pending; wait for the actual board instead.
    await expect(page.getByText("Establishing feed", { exact: true })).toBeHidden({
      timeout: 30_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.locator("canvas").screenshot({ path: `${out}/seed${seed}-play.png` });
    const measures = await page.evaluate(() =>
      performance.getEntriesByType("measure").map((x) => ({ name: x.name, duration: x.duration })),
    );
    if (seed === 8) {
      await page.getByRole("button", { name: "Save review", exact: true }).click();
      await page.getByRole("checkbox", { name: "Lights", exact: true }).uncheck();
      await page.waitForTimeout(500);
      await page.locator("canvas").screenshot({ path: `${out}/seed8-lights-off.png` });
      await page.getByRole("checkbox", { name: "Night", exact: true }).uncheck();
      await page.waitForTimeout(500);
      await page.locator("canvas").screenshot({ path: `${out}/seed8-neutral.png` });
      await page.getByRole("checkbox", { name: "Night", exact: true }).check();
      await page.getByRole("checkbox", { name: "Lights", exact: true }).check();
      await page.getByRole("combobox", { name: "Cover", exact: true }).selectOption("destroyed");
      await page.waitForTimeout(800);
      await page.locator("canvas").screenshot({ path: `${out}/seed8-destroyed.png` });
      await page.getByRole("button", { name: "Load review", exact: true }).click();
      await expect(page.getByRole("combobox", { name: "Cover", exact: true })).toHaveValue(
        "intact",
      );
      await expect(
        page.getByText("Restored saved geometry, positions and damage.", { exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(800);
      await page.locator("canvas").screenshot({ path: `${out}/seed8-restored.png` });
    }
    await page
      .getByRole("checkbox", { name: "Show characters / targeting", exact: true })
      .uncheck();
    await page
      .getByRole("checkbox", { name: "Reveal activity behind buildings", exact: true })
      .check();
    await expect(page.getByText("Loading scenery…", { exact: true })).toBeHidden({
      timeout: 30_000,
    });
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
