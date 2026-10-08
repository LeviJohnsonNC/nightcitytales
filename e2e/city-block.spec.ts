/** Matched evidence from the shipping scene-review route. Never creates a campaign. */
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test.use({
  viewport: { width: 1800, height: 1100 },
  // Keep API/network traces without repeatedly copying this image-heavy scene.
  trace: { mode: "retain-on-failure", screenshots: false, snapshots: false, sources: false },
  launchOptions: {
    // CI has no hardware GPU. Rasterize staging canvases on the CPU to avoid
    // GPU readback stalls while slicing atlases; the shipping scene still uses WebGL.
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-accelerated-2d-canvas",
    ],
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
    // Seed 8 captures six states plus save/load and damage controls. Its baseline
    // takes ~88s on the software GPU; the two-state seeds retain the 90s budget.
    // Keep the workflow's five-minute global cap and zero retries.
    test.setTimeout(seed === 8 ? 120_000 : 90_000);
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    const errors: string[] = [];
    const report = (kind: string, detail: string) =>
      console.log(`[city-block seed=${seed} ${kind}] ${detail}`);
    page.on("pageerror", (e) => {
      errors.push(e.message);
      report("pageerror", e.stack ?? e.message);
    });
    page.on("crash", () => report("crash", "Chromium renderer process crashed"));
    const warnings = new Set<string>();
    page.on("console", (message) => {
      if (warnings.has(message.text())) return;
      warnings.add(message.text());
      if (["error", "warning"].includes(message.type()))
        report(message.type(), message.text().slice(0, 1200));
    });
    page.on("requestfailed", (request) =>
      report("requestfailed", `${request.url()} ${request.failure()?.errorText}`),
    );
    page.on("response", (response) => {
      if (response.status() >= 400) report("http", `${response.status()} ${response.url()}`);
    });
    await page.addInitScript(() => {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (entry.name.startsWith("courtyard-"))
            console.warn(
              `[renderer timing] ${entry.name} ${Math.round(entry.startTime)}ms +${Math.round(entry.duration)}ms`,
            );
      }).observe({ entryTypes: ["mark", "measure"] });
    });
    const out = info.outputPath("captures");
    await mkdir(out, { recursive: true });
    const capture = async (name: string) => {
      const started = Date.now();
      report("capture-start", name);
      await test.step(`capture ${name}`, async () => {
        await page.locator("canvas").screenshot({ path: `${out}/${name}.png` });
      });
      report("capture", `${name} ${Date.now() - started}ms`);
    };
    const t = Date.now();
    await page.goto(
      `/scene-review?place=intersection&seed=${seed}&adventure=0&actors=1&access=0&night=1&lights=1&reflect=on&reveal=0`,
      { waitUntil: "domcontentloaded" },
    );
    report("navigation", `${Date.now() - t}ms`);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
    report("ready", `${Date.now() - t}ms`);
    // Streaming audio can keep networkidle pending; wait for the actual board instead.
    await expect(page.getByText("Establishing feed", { exact: true })).toBeHidden({
      timeout: 30_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await capture(`seed${seed}-play`);
    const measures = await page.evaluate(() =>
      performance.getEntriesByType("measure").map((x) => ({ name: x.name, duration: x.duration })),
    );
    if (seed === 8) {
      await page.getByRole("button", { name: "Save review", exact: true }).click();
      await page.getByRole("checkbox", { name: "Lights", exact: true }).uncheck();
      await page.waitForTimeout(500);
      await capture(`seed8-lights-off`);
      await page.getByRole("checkbox", { name: "Night", exact: true }).uncheck();
      await page.waitForTimeout(500);
      await capture(`seed8-neutral`);
      await page.getByRole("checkbox", { name: "Night", exact: true }).check();
      await page.getByRole("checkbox", { name: "Lights", exact: true }).check();
      await page.getByRole("combobox", { name: "Cover", exact: true }).selectOption("destroyed");
      await page.waitForTimeout(800);
      await capture(`seed8-destroyed`);
      await page.getByRole("button", { name: "Load review", exact: true }).click();
      await expect(page.getByRole("combobox", { name: "Cover", exact: true })).toHaveValue(
        "intact",
      );
      await expect(
        page.getByText("Restored saved geometry, positions and damage.", { exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(800);
      await capture(`seed8-restored`);
    }
    // Reveal on the existing combat board. Switching actors off mounts a second
    // renderer, rebuilding every atlas and surface and changing camera framing.
    const reveal = page.getByRole("button", {
      name: "Reveal activity behind buildings",
      exact: true,
    });
    await reveal.click();
    await expect(reveal).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1500);
    await capture(`seed${seed}-reveal`);
    await writeFile(
      `${out}/seed${seed}-metrics.json`,
      JSON.stringify({ seed, totalMs: Date.now() - t, measures, errors }, null, 2),
    );
    expect(errors).toEqual([]);
    if (seed === 7 || seed === 8) {
      await page.setViewportSize({ width: 700, height: 850 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${out}/compact.png` });
    }
  });
