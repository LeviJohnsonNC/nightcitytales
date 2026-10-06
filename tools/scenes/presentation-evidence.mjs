/**
 * Matched captures of the tactical presentation, driven through the page's own
 * controls, for a before/after comparison:
 *
 *     node tools/scenes/presentation-evidence.mjs 5180 docs/evidence/presentation/after [--video]
 *     node tools/scenes/presentation-evidence.mjs 5181 docs/evidence/presentation/before   # main
 *
 * Every state is reached with the pointer or keyboard, as a player would; nothing is
 * retouched. `--video` also records hover, selection, zoom and pan as one clip.
 */
import { mkdir, rename } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/presentation/after", ...flags] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const PLAY = "place=intersection&seed=7&cam=-10,115,2.2&actors=1&player=21,4.5";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

async function open(query, viewport = { width: 1800, height: 1300 }, video) {
  const context = await browser.newContext({
    viewport,
    ...(video ? { recordVideo: { dir: out, size: { width: 1280, height: 860 } } } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}`, { waitUntil: "networkidle" });
  // the board's art starts when the board is on screen: on a phone it is below the fold
  await page.evaluate(() =>
    document.querySelector("svg.combat-arena")?.scrollIntoView({ block: "center" }),
  );
  await page.waitForTimeout(6000);
  const shot = async (name) => {
    await page.waitForTimeout(800);
    const clip = await (await page.$("canvas")).boundingBox();
    await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 84, clip });
    console.log(name, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
  };
  const centre = async (selector) => {
    const box = await (await page.$(selector)).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  };
  return { page, context, shot, centre, errors };
}

{
  const { shot } = await open(`${PLAY}&reveal=0`);
  await shot("idle-roof-on");
}
{
  const { page, shot, centre } = await open(`${PLAY}&reveal=1`);
  await shot("idle-reveal");
  // movement planning: hover, then click a square to preview the route
  const you = await centre('g.combat-unit[aria-label*="your character"]');
  await page.mouse.move(you.x - 150, you.box.y + you.box.height - 60);
  await shot("plan-hover");
  await page.mouse.click(you.x - 150, you.box.y + you.box.height - 60);
  await shot("plan-preview");
  await page.keyboard.press("Escape");
  // targeting a rifleman whose shot is blocked by the parked car
  const rifleman = await centre('g.combat-unit[aria-label*="rifleman"]');
  await page.mouse.click(rifleman.x, rifleman.y);
  await page.mouse.move(900, 1250);
  await shot("target-blocked");
}
{
  // a crowd: the whole corner at the overview camera, a bystander hovered
  const { page, shot, centre } = await open(
    "place=intersection&seed=7&actors=1&player=21,4.5&reveal=0&framing=overview",
  );
  await shot("crowd-rest");
  const worker = await centre('g.combat-unit[aria-label*="tool bag"]');
  await page.mouse.move(worker.x, worker.y);
  await shot("crowd-hover-bystander");
}
{
  const { page, shot, centre } = await open("place=office&seed=7&actors=1&reveal=1");
  await shot("indoor-rest");
  const hostile = await centre('g.combat-unit[aria-label*="Activate to target"]');
  await page.mouse.move(hostile.x, hostile.y);
  await shot("indoor-hover");
}
{
  const { shot } = await open(`place=intersection&seed=7&actors=1&player=21,4.5&reveal=1`, {
    width: 390,
    height: 844,
  });
  await shot("narrow");
}
if (flags.includes("--video")) {
  const { page, context, centre } = await open(
    `${PLAY}&reveal=0`,
    { width: 1280, height: 860 },
    true,
  );
  const pause = (ms) => page.waitForTimeout(ms);
  await page.evaluate(() =>
    document.querySelector("svg.combat-arena")?.scrollIntoView({ block: "start" }),
  );
  await pause(800);
  const worker = await centre('g.combat-unit[aria-label*="tool bag"]');
  await page.mouse.move(worker.x, worker.y, { steps: 20 });
  await pause(1200);
  const rifleman = await centre('g.combat-unit[aria-label*="rifleman"]');
  await page.mouse.move(rifleman.x, rifleman.y, { steps: 25 });
  await pause(1200);
  await page.mouse.click(rifleman.x, rifleman.y);
  await pause(1200);
  // the camera's own buttons, as far as each will go
  const press = async (label) => {
    const button = page.locator(`button[aria-label="${label}"]`);
    if (await button.isEnabled()) await button.click();
    await pause(700);
  };
  for (let i = 0; i < 3; i++) await press("Zoom in");
  for (let i = 0; i < 5; i++) await press("Zoom out");
  await page.click('button[aria-label="Reveal activity behind buildings"]');
  await pause(1500);
  await page.keyboard.press("Escape");
  await pause(800);
  const video = page.video();
  await context.close();
  // re-encoded small (it is evidence, not footage) where ffmpeg is installed
  if (video) await rename(await video.path(), `${out}/hover-select-zoom.raw.webm`);
  console.log("video ok");
}
await browser.close();
