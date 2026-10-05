/**
 * Draws the street-prop art pack's guides from `streetPropPack.ts`.
 *
 *     bun run tools/scenes/street-prop-guides.ts [--port 5180] [--no-browser]
 *
 * Writes to docs/street-props-pack/:
 *   guides/<id>-layout.png     exact canvas, flat #FF00FF key, the object's volume in
 *                              grey with its edges: the file to attach when generating
 *   guides/<id>-annotated.png  same canvas with heights, sections, the join and the
 *                              front marked, for checking a result by eye (never attach)
 *   guides/sedan-r90-cut.png   how a returned whole-car image is cut into its two
 *                              attackable sections
 *   context-placement.jpg      the shipping /scene-review renderer, neutral light, with
 *                              each prop's guide volume drawn over it through the
 *                              scene's own projection and camera: the registration proof
 *   context-renderer-only.jpg  the same frame without the overlay
 *
 * Nothing here is a second renderer: the placement preview is a screenshot of the
 * shipping one plus a wireframe computed from the same projection and camera.
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { chromium } from "playwright";
import { composeScene, type Point } from "@/engine";
import { battlefieldProjection } from "@/features/play/battlefieldProjection";
import { courtyardCamera } from "@/features/play/courtyard/courtyardPresentation";
import {
  CABINET,
  FRAME,
  PLANTER,
  SEDAN,
  STREET_PROP_BENCHMARK,
  STREET_PROP_PACK,
  framePoint,
  sectionFrameOnGuide,
  sedanCut,
  sedanPoint,
  toGuide,
  type PackGuide,
  type Rotation,
} from "@/features/play/courtyard/streetPropPack";

const OUT = "docs/street-props-pack";
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const FONT = `font-family="DejaVu Sans, sans-serif"`;
const svg = (w: number, h: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const pts = (list: Point[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const poly = (list: Point[], fill: string, stroke = "#1d2327", width = 3, opacity = 1) =>
  `<polygon points="${pts(list)}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const label = (p: Point, text: string, size = 26, anchor = "middle", color = "#ffffff") =>
  `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" ${FONT} font-size="${size}" font-weight="bold" text-anchor="${anchor}" fill="${color}" stroke="#000" stroke-width="5" paint-order="stroke">${text}</text>`;

/**
 * A box in a guide's own metres (x along, y across, z up), drawn as the faces the
 * camera can see: each face is wound outward, and one is kept only if its projection
 * turns the same way as the top's, which is always visible from above. This holds
 * for any `at`, rotated or not, because the projection is parallel.
 */
function boxFaces(
  at: (x: number, y: number, z: number) => Point,
  b: { x0: number; x1: number; y0: number; y1: number },
  z0: number,
  z1: number,
  shades: [string, string, string],
  stroke = "#1d2327",
) {
  type V = [number, number, number];
  const { x0, x1, y0, y1 } = b;
  const faces: { v: V[]; out: V; shade: number }[] = [
    {
      v: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      out: [0, 0, 1],
      shade: 2,
    },
    {
      v: [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      out: [0, -1, 0],
      shade: 0,
    },
    {
      v: [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      out: [0, 1, 0],
      shade: 0,
    },
    {
      v: [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ],
      out: [1, 0, 0],
      shade: 1,
    },
    {
      v: [
        [x0, y0, z0],
        [x0, y1, z0],
        [x0, y1, z1],
        [x0, y0, z1],
      ],
      out: [-1, 0, 0],
      shade: 1,
    },
  ];
  const sub = (a: V, c: V): V => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
  const cross = (a: V, c: V): V => [
    a[1] * c[2] - a[2] * c[1],
    a[2] * c[0] - a[0] * c[2],
    a[0] * c[1] - a[1] * c[0],
  ];
  const area = (q: Point[]) =>
    q.reduce((s, p, i) => {
      const n = q[(i + 1) % q.length]!;
      return s + p.x * n.y - n.x * p.y;
    }, 0);
  const projected = faces.map((f) => {
    const n = cross(sub(f.v[1]!, f.v[0]!), sub(f.v[2]!, f.v[0]!));
    const v = n[0] * f.out[0] + n[1] * f.out[1] + n[2] * f.out[2] < 0 ? [...f.v].reverse() : f.v;
    const q = v.map(([x, y, z]) => at(x, y, z));
    return { q, shade: f.shade, sign: Math.sign(area(q)) };
  });
  const top = projected[0]!.sign;
  return projected
    .slice(1)
    .filter((f) => f.sign === top)
    .concat(projected[0]!)
    .map((f) => poly(f.q, shades[f.shade]!, stroke, 3))
    .join("");
}

const KEY = "#ff00ff";
const BODY: [string, string, string] = ["#6b7478", "#555d61", "#8a9296"];
const GLASS: [string, string, string] = ["#3f4c55", "#34404a", "#56646e"];

function sedanGuideSvg(g: PackGuide, annotated: boolean) {
  const at = (x: number, y: number, z: number) => toGuide(g, sedanPoint(x, y, z, g.rotation));
  const parts: string[] = [`<rect width="${g.canvas}" height="${g.canvas}" fill="${KEY}"/>`];
  // the two saved 2 m sections on the ground: the attackable units
  for (const [i, s] of g.sections.entries()) {
    const o = s.offset;
    const d = (
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ] as const
    ).map(([x, y]) => {
      const p = framePoint(x, y, 0, g.rotation);
      return toGuide(g, { x: p.x + o.x, y: p.y + o.y });
    });
    parts.push(poly(d, i === 0 ? "#c9a7c9" : "#b9a0d6", "#5b3e5b", 3, 0.55));
  }
  // wheels: dark discs standing at the four contact points
  for (const x of SEDAN.wheel.centres)
    for (const y of SEDAN.wheel.y) {
      const c = at(x, y, SEDAN.wheel.radius);
      const r = SEDAN.wheel.radius * FRAME.pxPerMetreUp * g.scale;
      parts.push(
        `<ellipse cx="${c.x}" cy="${c.y}" rx="${r * 0.62}" ry="${r}" fill="#1b2023" stroke="#000" stroke-width="2"/>`,
      );
    }
  // lower body: sill to hood, the whole length
  parts.push(boxFaces(at, SEDAN.body, SEDAN.sill, SEDAN.hood, BODY));
  // glasshouse: glass band then roof
  parts.push(boxFaces(at, SEDAN.cabin, SEDAN.hood, SEDAN.glassBottom, BODY));
  parts.push(boxFaces(at, SEDAN.cabin, SEDAN.glassBottom, SEDAN.glassTop, GLASS));
  parts.push(boxFaces(at, SEDAN.cabin, SEDAN.glassTop, SEDAN.roof, BODY));
  // the windscreen: a sloped glass plane from the bonnet up to the roof's front edge
  const w = SEDAN.windscreenFoot;
  parts.push(
    poly(
      [
        at(w, SEDAN.cabin.y0, SEDAN.hood),
        at(w, SEDAN.cabin.y1, SEDAN.hood),
        at(SEDAN.cabin.x0, SEDAN.cabin.y1, SEDAN.roof),
        at(SEDAN.cabin.x0, SEDAN.cabin.y0, SEDAN.roof),
      ],
      GLASS[2],
    ),
  );
  // the join between the two sections, across the whole car, on its visible faces
  const j = SEDAN.join;
  parts.push(
    `<polyline points="${pts([
      at(j, SEDAN.body.y0, 0),
      at(j, SEDAN.body.y0, SEDAN.hood),
      at(
        j,
        SEDAN.cabin.y0,
        SEDAN.hood +
          ((j - SEDAN.windscreenFoot) / (SEDAN.cabin.x0 - SEDAN.windscreenFoot)) *
            (SEDAN.roof - SEDAN.hood),
      ),
      at(
        j,
        SEDAN.cabin.y1,
        SEDAN.hood +
          ((j - SEDAN.windscreenFoot) / (SEDAN.cabin.x0 - SEDAN.windscreenFoot)) *
            (SEDAN.roof - SEDAN.hood),
      ),
    ])}" fill="none" stroke="#ff3b30" stroke-width="5" stroke-dasharray="14 8"/>`,
  );
  if (annotated) {
    const S = SEDAN;
    parts.push(label(at(0.2, S.body.y0 - 0.3, 0.2), "FRONT", 30, "middle", "#ffe08a"));
    parts.push(label(at(1, 1, 0.1), "ENGINE section 2 m", 24));
    parts.push(label(at(3, 1, 0.1), "CABIN section 2 m", 24));
    parts.push(
      label(at(j, S.body.y0 - 0.15, S.roof + 0.25), "join x = 2 m", 24, "middle", "#ff8c84"),
    );
    // heights, as a legend: wheels, sill, bonnet, glass band, roof
    [
      `wheels: radius ${S.wheel.radius} m, centres ${S.wheel.centres.join(" / ")} m from the front`,
      `sill ${S.sill} m · bonnet ${S.hood} m · glass ${S.glassBottom}–${S.glassTop} m · roof ${S.roof} m`,
      `windscreen from ${S.windscreenFoot} m to ${S.cabin.x0} m along the car`,
      `wrecked: everything under ${S.wreckedMax} m`,
    ].forEach((t, i) => parts.push(label({ x: 24, y: 44 + i * 34 }, t, 24, "start", "#d8f3ff")));
    parts.push(
      label(
        { x: g.canvas / 2, y: g.canvas - 24 },
        `${g.id}: car 3.74 × 1.6 m in two 2 m sections, rotation ${g.rotation}, ${(g.scale * 64).toFixed(0)} px per metre across the ground`,
        22,
      ),
    );
  }
  return svg(g.canvas, g.canvas, parts.join(""));
}

function singleGuideSvg(g: PackGuide, annotated: boolean) {
  const at = (x: number, y: number, z: number) =>
    toGuide(g, framePoint(x, y, z, g.rotation as Rotation));
  const parts: string[] = [`<rect width="${g.canvas}" height="${g.canvas}" fill="${KEY}"/>`];
  const ground = (
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ] as const
  ).map(([x, y]) => at(x, y, 0));
  parts.push(poly(ground, "#c9a7c9", "#5b3e5b", 3, 0.55));
  if (g.id === "planter") {
    parts.push(boxFaces(at, PLANTER.body, 0, PLANTER.rim, BODY));
    const inner = { x0: 0.28, x1: 1.72, y0: 0.28, y1: 1.72 };
    parts.push(boxFaces(at, inner, PLANTER.rim, PLANTER.soil, ["#3d3a32", "#33302a", "#4a4637"]));
    // the foliage envelope: shrubs never rise past it
    parts.push(
      boxFaces(
        at,
        inner,
        PLANTER.soil,
        PLANTER.foliageMax,
        ["#5c6b4d", "#4d5b40", "#6f7f5d"],
        "#2c3626",
      ),
    );
  } else {
    parts.push(boxFaces(at, CABINET.body, 0, CABINET.height, BODY));
  }
  if (annotated) {
    if (g.id === "planter") {
      parts.push(
        label(at(1.95, 0.12, PLANTER.rim), `rim ${PLANTER.rim} m`, 22, "start", "#d8f3ff"),
      );
      parts.push(
        label(
          at(1.95, 0.28, PLANTER.foliageMax),
          `foliage ≤ ${PLANTER.foliageMax} m`,
          22,
          "start",
          "#d8f3ff",
        ),
      );
      parts.push(
        label(
          { x: g.canvas / 2, y: g.canvas - 20 },
          "planter: 1.76 m square concrete box, one image for both rotations",
          20,
        ),
      );
    } else {
      parts.push(
        label(at(1, CABINET.body.y0 - 0.25, 0.3), "DOORS FACE THIS WAY", 22, "middle", "#ffe08a"),
      );
      parts.push(
        label(
          at(1.95, CABINET.body.y0, CABINET.height),
          `${CABINET.height} m`,
          22,
          "start",
          "#d8f3ff",
        ),
      );
      parts.push(
        label(
          { x: g.canvas / 2, y: g.canvas - 20 },
          "cabinet: 1.76 × 0.9 × 1.52 m steel, doors toward the street",
          20,
        ),
      );
    }
  }
  return svg(g.canvas, g.canvas, parts.join(""));
}

function cutSvg(g: PackGuide) {
  const cut = sedanCut(g);
  const parts: string[] = [`<rect width="${g.canvas}" height="${g.canvas}" fill="#20262a"/>`];
  parts.push(poly(cut.keep["sedan-engine"]!, "#3aa0ff", "#3aa0ff", 4, 0.25));
  parts.push(poly(cut.keep["sedan-cabin"]!, "#ffb13a", "#ffb13a", 4, 0.25));
  const near = cut.nearer;
  parts.push(poly(cut.keep[near]!, "none", "#ffffff", 5, 0));
  for (const [i] of g.sections.entries()) {
    const f = sectionFrameOnGuide(g, i);
    parts.push(
      `<rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" fill="none" stroke="${i ? "#ffb13a" : "#3aa0ff"}" stroke-width="3" stroke-dasharray="10 8"/>`,
    );
  }
  parts.push(
    label(
      { x: g.canvas / 2, y: 46 },
      `${g.id}: ${near} is nearer the camera and keeps the overlap`,
      26,
    ),
  );
  parts.push(
    label(
      { x: g.canvas / 2, y: 84 },
      "blue: engine volume · orange: cabin volume · dashed: each section's 256×320 frame",
      22,
    ),
  );
  return svg(g.canvas, g.canvas, parts.join(""));
}

/* ------------------------------------------------------- context placement */

async function contextPlacement(port: string) {
  const B = STREET_PROP_BENCHMARK;
  const arena = composeScene(B.recipe, B.seed).layout.arena;
  const cover = (id: string) => arena.cover!.find((c) => c.id === id)!.rect;
  const { project, pixelsPerMetre } = battlefieldProjection(
    arena.extent.width,
    arena.extent.height,
  );
  const camera = { x: -70, y: 20, zoom: 2.4 };
  const browser = await chromium.launch({
    executablePath: process.env["CHROMIUM_PATH"],
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });
  const page = await (
    await browser.newContext({ viewport: { width: 2000, height: 1400 } })
  ).newPage();
  await page.goto(
    `http://127.0.0.1:${port}/scene-review?place=${B.recipe}&seed=${B.seed}&actors=0&reveal=0&night=0&cam=${camera.x},${camera.y},${camera.zoom}`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(4000);
  const box = (await (await page.$("canvas"))!.boundingBox())!;
  const shot = await page.screenshot({ clip: box });
  await browser.close();
  const cam = courtyardCamera(box.width, box.height, camera);
  const screen = (w: Point, z: number) => {
    const p = project(w);
    return {
      x: (p.x - cam.x) * cam.zoom + box.width / 2,
      y: (p.y - z * pixelsPerMetre - cam.y) * cam.zoom + box.height / 2,
    };
  };
  const parts: string[] = [];
  // the sedan: car metres -> world, through the section rotation
  const engine = cover(B.sedan.cover[0]);
  const carWorld = (x: number, y: number): Point =>
    B.sedan.rotation === 90
      ? { x: engine.x + 2 - y, y: engine.y + x }
      : { x: engine.x + x, y: engine.y + y };
  const car = (x: number, y: number, z: number) => screen(carWorld(x, y), z);
  // the join crosses the windscreen: its height there
  const joinZ =
    SEDAN.hood +
    ((SEDAN.join - SEDAN.windscreenFoot) / (SEDAN.cabin.x0 - SEDAN.windscreenFoot)) *
      (SEDAN.roof - SEDAN.hood);
  parts.push(
    boxFaces(car, SEDAN.body, SEDAN.sill, SEDAN.hood, ["none", "none", "none"], "#ffe14a"),
  );
  parts.push(
    boxFaces(car, SEDAN.cabin, SEDAN.hood, SEDAN.roof, ["none", "none", "none"], "#ffe14a"),
  );
  parts.push(
    poly(
      [
        car(SEDAN.windscreenFoot, SEDAN.cabin.y0, SEDAN.hood),
        car(SEDAN.windscreenFoot, SEDAN.cabin.y1, SEDAN.hood),
        car(SEDAN.cabin.x0, SEDAN.cabin.y1, SEDAN.roof),
        car(SEDAN.cabin.x0, SEDAN.cabin.y0, SEDAN.roof),
      ],
      "none",
      "#ffe14a",
    ),
  );
  parts.push(
    `<polyline points="${pts([car(2, SEDAN.body.y0, 0), car(2, SEDAN.body.y0, SEDAN.hood), car(2, SEDAN.cabin.y0, joinZ), car(2, SEDAN.cabin.y1, joinZ)])}" fill="none" stroke="#ff3b30" stroke-width="4" stroke-dasharray="10 6"/>`,
  );
  parts.push(label(car(2, -0.6, SEDAN.roof + 0.4), "sedan (2 sections)", 26, "middle", "#ffe14a"));
  for (const id of B.planter.cover as readonly string[]) {
    const r = cover(id);
    const at = (x: number, y: number, z: number) => screen({ x: r.x + x, y: r.y + y }, z);
    parts.push(boxFaces(at, PLANTER.body, 0, PLANTER.rim, ["none", "none", "none"], "#7dff8a"));
  }
  {
    const r = cover(B.planter.cover[0]);
    parts.push(label(screen({ x: r.x + 1, y: r.y + 1 }, 1.4), "planters", 26, "middle", "#7dff8a"));
  }
  {
    const r = cover(B.cabinet.cover[0]);
    const at = (x: number, y: number, z: number) => screen({ x: r.x + x, y: r.y + y }, z);
    parts.push(boxFaces(at, CABINET.body, 0, CABINET.height, ["none", "none", "none"], "#5ad7ff"));
    parts.push(label(at(1, 0.4, CABINET.height + 0.35), "cabinet", 26, "middle", "#5ad7ff"));
  }
  const overlay = svg(Math.round(box.width), Math.round(box.height), parts.join(""));
  await sharp(shot)
    .composite([{ input: overlay, left: 0, top: 0 }])
    .jpeg({ quality: 90 })
    .toFile(`${OUT}/context-placement.jpg`);
  await sharp(shot).jpeg({ quality: 90 }).toFile(`${OUT}/context-renderer-only.jpg`);
}

/* -------------------------------------------------------------------- main */

await mkdir(`${OUT}/guides`, { recursive: true });
for (const g of STREET_PROP_PACK) {
  const draw = g.id.startsWith("sedan") ? sedanGuideSvg : singleGuideSvg;
  await sharp(draw(g, false)).png().toFile(`${OUT}/guides/${g.id}-layout.png`);
  await sharp(draw(g, true)).png().toFile(`${OUT}/guides/${g.id}-annotated.png`);
  if (g.id.startsWith("sedan"))
    await sharp(cutSvg(g)).png().toFile(`${OUT}/guides/${g.id}-cut.png`);
}
if (!process.argv.includes("--no-browser")) await contextPlacement(arg("port", "5180"));
console.log("guides written to", OUT);
