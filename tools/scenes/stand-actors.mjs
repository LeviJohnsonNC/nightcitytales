/**
 * The merchandise stand with people round it, on the shipping renderer in /scene-review:
 * a character directly behind and beside the stand at r0 (seed 7) and r90 (seed 0),
 * selected and targeted, with the reveal on and off; and a route planned through the
 * cleared footprint of a destroyed stand.
 *
 *     node tools/scenes/stand-actors.mjs 5180 docs/evidence/ground-light/stand-actors
 *
 * A scene-review demonstration: it submits no combat action and writes no campaign.
 * A unit is clicked at its torso, the part a person behind the stand still shows: their
 * feet are drawn behind the stand, where a click is the stand's own square.
 * It records, for each case, what the board says (the unit's label, the target card)
 * and where the unit's marker sits, beside an unedited canvas capture.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const [port = "5180", out = "docs/evidence/ground-light/stand-actors"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const only = process.env.ONLY?.split(",");

/** The board's projection for a 32 m arena (`battlefieldProjection`): metres to scene units. */
const project = (x, y) => ({ x: 134.3078 + 12.9904 * (x + y), y: 340 + 7.5 * (x - y) });
// the stand's tile centre, and squares round it: "behind" is straight up the screen from
// it (the same x + y, smaller x - y), "beside" is level with it (the same x - y)
const CASES = [
  {
    name: "seed7-r0",
    seed: 7,
    stand: [29, 25],
    behind: [27, 27],
    beside: [27, 23],
    front: [31, 21],
    across: [31, 27],
  },
  {
    name: "seed0-r90",
    seed: 0,
    stand: [25, 29],
    behind: [23, 31],
    beside: [23, 27],
    front: [27, 25],
    across: [27, 31],
  },
];
const cam = ([x, y]) => {
  const p = project(x, y);
  return `${Math.round(p.x - 550)},${Math.round(p.y - 370)},3.5`;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const report = [];

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/scene-review?${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6500);
  /** A metre position on the board, in page pixels. */
  const at = async ([x, y]) => {
    const p = project(x, y);
    return page.evaluate(
      ([sx, sy]) => {
        const svg = document.querySelector("svg.combat-arena");
        const pt = svg.createSVGPoint();
        pt.x = sx;
        pt.y = sy;
        const q = pt.matrixTransform(svg.getScreenCTM());
        return { x: q.x, y: q.y };
      },
      [p.x, p.y],
    );
  };
  const shot = async (name) => {
    await page.waitForTimeout(800);
    const clip = await (await page.$("canvas")).boundingBox();
    await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 86, clip });
  };
  /** What the board says about a unit: its label, and whether its marker is on the board. */
  const unit = async (match) =>
    page.evaluate((match) => {
      const canvas = document.querySelector("canvas").getBoundingClientRect();
      const g = [...document.querySelectorAll("g.combat-unit")].find((u) =>
        (u.getAttribute("aria-label") ?? "").toLowerCase().includes(match),
      );
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return {
        label: g.getAttribute("aria-label"),
        // its marker's centre is on the board's canvas
        onBoard:
          r.width > 0 &&
          r.left + r.width / 2 > canvas.left &&
          r.left + r.width / 2 < canvas.right &&
          r.top + r.height / 2 > canvas.top &&
          r.top + r.height / 2 < canvas.bottom,
      };
    }, match);
  const card = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[role=dialog], .combat-callout, [class*=callout]")]
        .map((e) => e.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" | "),
    );
  return { page, errors, at, shot, unit, card };
}

for (const c of CASES) {
  for (const reveal of [0, 1]) {
    const base = `place=intersection&seed=${c.seed}&actors=1&reveal=${reveal}&cam=${cam(c.stand)}`;
    // 1. you, directly behind the stand, then beside it: drawn, and selectable
    for (const where of ["behind", "beside"]) {
      const name = `${c.name}-you-${where}-reveal${reveal}`;
      if (only && !only.includes(name)) continue;
      const { page, errors, at, shot, unit } = await open(`${base}&player=${c[where].join(",")}`);
      await shot(`${name}`);
      const you = await at(c[where]);
      await page.mouse.click(you.x, you.y - 20);
      await shot(`${name}-selected`);
      report.push({ name, you: await unit("your character"), errors: [...errors] });
      await page.close();
    }
    // 2. a hostile directly behind the stand, then beside it, targeted from in front
    for (const where of ["behind", "beside"]) {
      const name = `${c.name}-foe-${where}-reveal${reveal}`;
      if (only && !only.includes(name)) continue;
      const { page, errors, at, shot, unit, card } = await open(
        `${base}&player=${c.front.join(",")}&foe=${c[where].join(",")}`,
      );
      const foe = await at(c[where]);
      await page.mouse.move(foe.x, foe.y - 55);
      await shot(`${name}-hover`);
      const hovered = await card();
      await page.mouse.click(foe.x, foe.y - 55);
      await page.mouse.move(40, 40);
      await shot(`${name}-target`);
      report.push({
        name,
        foe: await unit("rifle"),
        hoverCard: hovered,
        targetCard: await card(),
        errors: [...errors],
      });
      await page.close();
    }
  }
  // 3. a route planned across the stand's square: round it while it stands, through its
  // cleared footprint once it is destroyed
  for (const damage of ["intact", "destroyed"]) {
    const name = `${c.name}-route-${damage}`;
    if (only && !only.includes(name)) continue;
    const { page, errors, at, shot, unit } = await open(
      `place=intersection&seed=${c.seed}&actors=1&reveal=1&damage=${damage}&cam=${cam(c.stand)}&player=${c.beside.join(",")}`,
    );
    const you = await at(c.beside);
    await page.mouse.click(you.x, you.y - 20);
    const to = await at(c.across);
    await page.mouse.move(to.x, to.y);
    await shot(`${name}-hover`);
    await page.mouse.click(to.x, to.y);
    await shot(`${name}-preview`);
    report.push({ name, you: await unit("your character"), errors: [...errors] });
    await page.close();
  }
}
await browser.close();
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
for (const r of report) console.log(r.name, r.errors.length ? `errors: ${r.errors}` : "ok");
