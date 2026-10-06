/**
 * Matched captures of the intersection's ground: surfaces, markings and how things
 * meet the ground, at the play framing first and close up after.
 *
 *     node tools/scenes/ground-evidence.mjs 5180 docs/evidence/ground-pass/after
 *
 * Every state is reached through the page's own query and pointer, as in play; nothing
 * is retouched. `ONLY=name,name` limits the run.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/ground-pass/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const only = process.env.ONLY?.split(",");
const S7 = "place=intersection&seed=7";
/** The corner's ground: cabinet, sedan, planter, lamp, the annex door and the kerb. */
const CONTACT = "cam=-290,60,2.6";
/** The storefront corner: the vendor cart, the shop's threshold and the crossing. */
const CORNER = "cam=-10,115,2.6";
/** The loading court: its apron, the dumpster and the generator. */
const COURT = "cam=-20,-170,2.6";
const SHOTS = [
  ["seed7-roof-actors-off", `${S7}&actors=0&reveal=0`],
  ["seed7-reveal-actors", `${S7}&actors=1&reveal=1`],
  ["seed7-plan", `${S7}&actors=1&reveal=1`, "plan"],
  ["seed7-target", `${S7}&actors=1&reveal=1`, "target"],
  ["seed7-neutral", `${S7}&actors=0&reveal=0&night=0`],
  ["seed0", "place=intersection&seed=0&actors=0&reveal=0"],
  ["seed0-neutral", "place=intersection&seed=0&actors=0&reveal=0&night=0"],
  ["seed8", "place=intersection&seed=8&actors=0&reveal=0"],
  ["seed8-neutral", "place=intersection&seed=8&actors=0&reveal=0&night=0"],
  ["contact-mixed", `${S7}&actors=0&reveal=0&damage=mixed&${CONTACT}`],
  ["contact-mixed-neutral", `${S7}&actors=0&reveal=0&damage=mixed&night=0&${CONTACT}`],
  ["corner-neutral", `${S7}&actors=0&reveal=0&night=0&${CORNER}`],
  ["court-neutral", `${S7}&actors=0&reveal=0&night=0&${COURT}`],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
for (const [name, query, act] of SHOTS) {
  if (only && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6500);
  const box = async (selector) => (await page.$(selector))?.boundingBox();
  if (act === "plan") {
    // hover then click a square beside the player: the route is previewed, not walked
    const you = await box('g.combat-unit[aria-label*="your character"]');
    await page.mouse.move(you.x + you.width / 2 - 150, you.y + you.height - 50);
    await page.mouse.click(you.x + you.width / 2 - 150, you.y + you.height - 50);
  } else if (act === "target") {
    const rifleman = await box('g.combat-unit[aria-label*="rifleman"]');
    await page.mouse.click(rifleman.x + rifleman.width / 2, rifleman.y + rifleman.height / 2);
    await page.mouse.move(900, 1250);
  }
  await page.waitForTimeout(900);
  const clip = await (await page.$("canvas")).boundingBox();
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 84, clip });
  console.log(name, errors.length ? `errors: ${errors.join(" | ")}` : "ok");
  await page.close();
}
await browser.close();
