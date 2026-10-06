/**
 * Drives /scene-review's own controls over the architectural art pilot (seed 7) and
 * records what each step shows and any page error or failed request:
 *
 *     node tools/scenes/architecture-interaction.mjs 5180 docs/evidence/architecture-art-pilot/interaction
 *
 * Steps: load with a character at the annex's door; reveal on, off; zoom in; pan;
 * night off, on; lights off, on; zoom out; reset; overview. Then the same scene with
 * every /images/architecture/ request refused, to show the fallback (the drawn boxes,
 * bays and door) and that a missing file is not a failure. Nothing is retouched.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/architecture-art-pilot/interaction"] =
  process.argv.slice(2);
await mkdir(out, { recursive: true });
// `SEED=0` (or 8) drives another variation through the same steps, with its own player
const SEED = process.env.SEED ?? "7";
const URL = `http://127.0.0.1:${port}/scene-review?place=intersection&seed=${SEED}&actors=1&framing=play${SEED === "7" ? "&player=9.6,6.4" : ""}&reveal=0`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

async function run(name, blockArt) {
  const page = await (
    await browser.newContext({ viewport: { width: 1600, height: 1250 } })
  ).newPage();
  const errors = [];
  const failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  if (blockArt) await page.route("**/images/architecture/**", (route) => route.abort());
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  const canvas = async () => (await page.$("canvas")).boundingBox();
  const shot = async (step) => {
    await page.waitForTimeout(900);
    await page.screenshot({
      path: `${out}/${name}-${step}.jpg`,
      type: "jpeg",
      quality: 82,
      clip: await canvas(),
    });
    console.log(`${name} ${step}`, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
  };
  const click = async (selector) => {
    await page.click(selector);
    await page.waitForTimeout(250);
  };
  const toggle = async (label) => {
    await page.getByLabel(label, { exact: true }).click();
    await page.waitForTimeout(2500);
  };
  await shot("01-load");
  if (blockArt) {
    await page.context().close();
    return { errors, failed };
  }
  await click('button[aria-label="Reveal activity behind buildings"]');
  await shot("02-reveal-on");
  await click('button[aria-label="Reveal activity behind buildings"]');
  await shot("03-reveal-off");
  for (let i = 0; i < 3; i++) await click('button[aria-label="Zoom in"]');
  await shot("04-zoom-in");
  await click('button[aria-label="Pan battlefield"]');
  const box = await canvas();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 320, y + 260, { steps: 12 });
  await page.mouse.up();
  await shot("05-pan");
  await toggle("Night");
  await shot("06-night-off");
  await toggle("Night");
  await shot("07-night-on");
  await toggle("Lights");
  await shot("08-lights-off");
  await toggle("Lights");
  await shot("09-lights-on");
  for (let i = 0; i < 3; i++) await click('button[aria-label="Zoom out"]');
  await shot("10-zoom-out");
  await click('button[aria-label="Reset camera"]');
  await shot("11-reset");
  await click('button[aria-label="Overview"]');
  await shot("12-overview");
  await page.context().close();
  return { errors, failed };
}

const live = await run("live", false);
const fallback = await run("fallback", true);
await browser.close();
const report = (name, r, allowed) => {
  const unexpected = r.failed.filter((f) => !allowed(f));
  console.log(
    `${name}: ${r.errors.length} page errors, ${unexpected.length} unexpected failed requests` +
      (unexpected.length ? `\n  ${unexpected.join("\n  ")}` : ""),
  );
  return r.errors.length + unexpected.length;
};
// The combat score is hosted by Lovable and is absent from a local dev server.
const hosted = (f) => f.includes("/__l5e/assets-v1/");
const bad =
  report("live", live, hosted) +
  // the fallback refuses the art on purpose (an aborted request has no status)
  report("fallback", fallback, (f) => hosted(f) || f.includes("/images/architecture/"));
process.exit(bad ? 1 : 0);
