/**
 * The board on a phone, driven by touch alone (no hover, no keyboard):
 *
 *     node tools/scenes/narrow-touch.mjs 5180 docs/evidence/presentation-2/narrow/after
 *
 * Taps a target, switches to another, dismisses, previews a move and works the
 * camera controls, at 390 x 844. Every step is captured and measured: where the
 * information card sits against the person it is about, the board's controls and
 * the board's edges, and whether a tap just outside the card reaches the board.
 * Prints one JSON line per step; `results.json` holds them all.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/presentation-2/narrow/after"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(
  `http://127.0.0.1:${port}/scene-review?place=intersection&seed=7&actors=1&player=21,4.5&reveal=1`,
  { waitUntil: "networkidle" },
);
await page.evaluate(() =>
  document.querySelector("svg.combat-arena")?.scrollIntoView({ block: "start" }),
);
await page.waitForTimeout(6000);

const results = [];
const rect = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};
async function measure(name, about) {
  await page.waitForTimeout(900);
  const m = await page.evaluate(
    ({ about }) => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const card = document.querySelector(".combat-callout");
      const plate = card?.querySelector(".combat-callout-act");
      const board = document.querySelector("svg.combat-arena");
      const unit = about ? document.querySelector(`g.combat-unit[aria-label*="${about}"]`) : null;
      const controls = [
        ...document.querySelectorAll(
          ".combat-camera button, .combat-actions button, .combat-map-caption, .combat-map-hint",
        ),
      ]
        .filter((b) => b.closest(".combat-callout") === null)
        .map((b) => ({ label: b.getAttribute("aria-label") ?? b.textContent?.trim(), ...box(b) }))
        .filter((b) => b.right > b.left);
      const hit = (a, b) =>
        !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const c = box(plate);
      const b = box(board);
      // the person's figure: the unit's hit area
      const u = box(unit?.querySelector("rect") ?? unit);
      const me = box(document.querySelector('g.combat-unit[aria-label*="your character"] > rect'));
      const lines = plate
        ? [...plate.querySelectorAll("span, em, strong")].map((s) => ({
            text: s.textContent,
            overflow: s.scrollWidth > s.clientWidth + 1,
            right: s.getBoundingClientRect().right,
          }))
        : [];
      return {
        card: c,
        title: plate?.querySelector("strong")?.textContent ?? null,
        coversPerson: hit(c, u),
        coversYou: about?.includes("your character") ? null : hit(c, me),
        coversControls: controls.filter((k) => hit(c, k)).map((k) => k.label),
        insideBoard:
          c && b ? c.left >= b.left - 1 && c.right <= b.right + 1 && c.top >= b.top - 1 : null,
        textClipped: lines.some((l) => l.overflow || (c && l.right > c.right + 1)),
        cardWidth: c ? Math.round(c.right - c.left) : null,
      };
    },
    { about },
  );
  await page.screenshot({ path: `${out}/${name}.png` });
  const row = { step: name, ...m, errors: errors.length };
  results.push(row);
  console.log(JSON.stringify(row));
  return m;
}
const tapUnit = async (label) => {
  const box = await page
    .locator(`g.combat-unit[aria-label*="${label}"] rect`)
    .first()
    .boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
};
const tapButton = async (label) => {
  const b = page.locator(`button[aria-label="${label}"]`);
  if (await b.isEnabled()) await b.tap();
};

await measure("0-rest");
await tapUnit("rifleman");
await measure("1-target", "rifleman");
// switch: another hostile, by tapping them
const hostiles = await page
  .locator('g.combat-unit[aria-label*="Activate to target"]')
  .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const other = hostiles.find((l) => !l.includes("rifleman"));
if (other) {
  const name = other.split(",")[0];
  const box = await page.locator(`g.combat-unit[aria-label="${other}"] rect`).first().boundingBox();
  if (box && box.y > 0 && box.y < 844) {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await measure("2-switch", name);
  } else results.push({ step: "2-switch", skipped: `${name} is off screen` });
}
// a tap on the board just beside the card must reach the board, not the card
const card = await page.locator(".combat-callout .combat-callout-act").boundingBox();
if (card) {
  const x = Math.min(380, card.x + card.width + 14);
  const y = card.y + card.height / 2;
  const target = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el?.closest(".combat-callout") ? "card" : el?.closest("svg") ? "board" : el?.tagName;
    },
    [x, y],
  );
  results.push({ step: "2b-beside-card", x, y, reaches: target });
  console.log(JSON.stringify(results.at(-1)));
}
// dismissal without hover or keyboard
const dismiss = page.locator(".combat-callout-dismiss");
if (await dismiss.count()) {
  await dismiss.tap();
  await measure("3-dismissed");
} else {
  results.push({ step: "3-dismissed", note: "no dismiss control on the card" });
  console.log(JSON.stringify(results.at(-1)));
}
// movement preview: tap ground a few squares from the player
const you = await page
  .locator('g.combat-unit[aria-label*="your character"] rect')
  .first()
  .boundingBox();
await page.touchscreen.tap(you.x + you.width / 2 - 40, you.y + you.height - 6);
await measure("4-move-preview", "your character");
// camera controls
await tapButton("Zoom in");
await measure("5-zoom-in");
await tapButton("Zoom out");
await tapButton("Zoom out");
await measure("6-zoom-out");
await tapButton("Reset camera");
await measure("7-reset");
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
