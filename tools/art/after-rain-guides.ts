/** Reproducible production guides; no browser and no generated scene imagery. */
import sharp from "sharp";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { CITY_FIXTURES as F } from "../../src/features/play/courtyard/cityFixtures";
const OUT = "docs/night-market-after-rain";
await mkdir(`${OUT}/guides`, { recursive: true });
const W = 1024,
  H = 1536;
const bg = "#f0eee8";
const svg = (body: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="1024" height="1536" fill="${bg}"/>${body}</svg>`,
  );
const line = (x1: number, y1: number, x2: number, y2: number, color = "#415b65", width = 3) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = "#263e49") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
const text = (x: number, y: number, s: string, size = 24) =>
  `<text x="${x}" y="${y}" fill="#182f3b" font-family="Arial,sans-serif" font-size="${size}">${s}</text>`;
const poly = (ps: number[][], fill: string) =>
  `<polygon points="${ps.map((p) => p.join(",")).join(" ")}" fill="${fill}" stroke="#263e49" stroke-width="3"/>`;
const emit = (body: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="1024" height="1536" fill="black"/>${body}</svg>`,
  );
const entries: { id: string; title: string; size: string }[] = [];
async function save(
  id: string,
  title: string,
  size: string,
  body: string,
  labels: string,
  mask?: string,
) {
  await sharp(svg(body)).png().toFile(`${OUT}/guides/${id}-layout.png`);
  await sharp(svg(body + text(55, 64, title, 32) + text(55, 108, size, 23) + labels))
    .png()
    .toFile(`${OUT}/guides/${id}-annotated.png`);
  if (mask) await sharp(emit(mask)).png().toFile(`${OUT}/guides/${id}-emission-guide.png`);
  entries.push({ id, title, size });
}
// Orthographic ±30-degree axes, vertical heights. Large calm margin for reliable registration.
for (const rotation of [0, 90]) {
  const scale = 160,
    origin = [220, 1260];
  const p = (x: number, y: number, z: number): number[] => {
    if (rotation) [x, y] = [-y, x];
    return [
      origin[0]! + (((x + y) * Math.sqrt(3)) / 2) * scale,
      origin[1]! + (x - y) * 0.5 * scale - z * scale,
    ];
  };
  const l = (a: number[], b: number[], c = "#415b65", w = 3) =>
    line(a[0]!, a[1]!, b[0]!, b[1]!, c, w);
  const plane = (a: number, b: number, z0: number, z1: number, fill: string, y = 0) =>
    poly([p(a, y, z0), p(b, y, z0), p(b, y, z1), p(a, y, z1)], fill);
  let b =
    l(p(0, 0, 0), p(0, 0, F.mast), "#52636a", 30) +
    l(p(-0.03, -0.01, 0), p(-0.03, -0.01, F.mast), "#a8b1ad", 7);
  b += l(p(0, 0, 0), p(0, 0, 0.32), "#43545b", 48);
  b += l(p(0, 0, F.mast), p(F.arm, 0, F.mast), "#52636a", 23);
  b += l(p(0, 0, F.mast + 0.5), p(F.arm * 0.72, 0, F.mast), "#6e807d", 6);
  let mask = "";
  for (const s of [F.arm * 0.45, F.arm]) {
    b += l(p(s, 0, F.mast), p(s, 0, F.mast - 0.35), "#37494f", 8);
    b += plane(s - 0.2, s + 0.2, F.signalBottom, F.mast - 0.24, "#b69c55");
    b += plane(s - 0.15, s + 0.15, F.signalBottom + 0.05, F.mast - 0.3, "#23363e", 0.035);
    for (let i = 0; i < 3; i++) {
      const z = F.mast - 0.5 - i * 0.27,
        q = p(s, 0.1, z);
      b += `<ellipse cx="${q[0]}" cy="${q[1]}" rx="13" ry="16" fill="${["#b46251", "#bea263", "#698579"][i]}" stroke="#1c3039" stroke-width="4"/>`;
      if (!i) mask += `<ellipse cx="${q[0]}" cy="${q[1]}" rx="11" ry="14" fill="white"/>`;
      b += plane(s - 0.14, s + 0.14, z + 0.055, z + 0.13, "#617273", 0.09);
    }
  }
  b += l(p(0, 0, F.mast - 0.6), p(-0.7, 0, F.mast - 0.45), "#52636a", 14);
  b += plane(-0.95, -0.5, F.mast - 0.57, F.mast - 0.43, "#99a391");
  mask += plane(-0.9, -0.54, F.mast - 0.58, F.mast - 0.55, "white").replace(
    /stroke="#[a-f0-9]+"/g,
    'stroke="white"',
  );
  b += l(p(-0.4, -0.3, 0), p(0.4, 0.3, 0), "#d88b35", 2);
  await save(
    `signal-r${rotation}`,
    `SIGNAL MAST / ${rotation}°`,
    `5.4 m mast · 3.8 m arm · signal bottoms 4.12 m`,
    b,
    text(55, 1450, "Orange cross = fixed ground anchor; do not include in final art."),
    mask,
  );
}
for (const rotation of [0, 90]) {
  const scale = 335,
    origin = [rotation ? 630 : 460, 1300];
  const p = (x: number, y: number, z: number): number[] => {
    if (rotation) [x, y] = [-y, x];
    return [
      origin[0]! + (((x + y) * Math.sqrt(3)) / 2) * scale,
      origin[1]! + (x - y) * 0.5 * scale - z * scale,
    ];
  };
  const P = F.panel,
    h = P.width / 2;
  let b = line(
    ...(p(0, 0, 0) as [number, number]),
    ...(p(0, 0, P.bottom) as [number, number]),
    "#52636a",
    45,
  );
  b += poly([p(-h, 0, P.bottom), p(h, 0, P.bottom), p(h, 0, P.top), p(-h, 0, P.top)], "#617680");
  b += poly(
    [p(h, 0, P.bottom), p(h, P.depth, P.bottom), p(h, P.depth, P.top), p(h, 0, P.top)],
    "#344752",
  );
  b += poly(
    [p(-h, 0, P.top), p(h, 0, P.top), p(h, P.depth, P.top), p(-h, P.depth, P.top)],
    "#a3b0ae",
  );
  const panel = [
    p(-h + 0.1, 0.025, P.bottom + 0.17),
    p(h - 0.1, 0.025, P.bottom + 0.17),
    p(h - 0.1, 0.025, P.top - 0.17),
    p(-h + 0.1, 0.025, P.top - 0.17),
  ];
  b += poly(panel, "#399db2");
  b += line(
    ...(p(-0.2, 0, 0) as [number, number]),
    ...(p(0.2, 0, 0) as [number, number]),
    "#d88b35",
    2,
  );
  await save(
    `transit-r${rotation}`,
    `TRANSIT DISPLAY / ${rotation}°`,
    `1.05 × 0.18 m plate · 2.95 m top · 0.95 m underside`,
    b,
    text(55, 1440, "Blue = replaceable printed panel; retain the four corners exactly."),
    poly(panel, "white").replace(/stroke="#[a-f0-9]+"/g, 'stroke="white"'),
  );
}
// Face-plane assets are supplied front-on. Runtime supplies the isometric transform.
{
  const scale = 440,
    left = 107,
    top = 218,
    w = 1.84 * scale,
    h = 2.5 * scale;
  let b = rect(left, top, w, h, "#778889");
  b += rect(left + 0.12 * scale, top + 0.3 * scale, 1.6 * scale, 2.2 * scale, "#536e75");
  for (let i = 1; i < 19; i++)
    b += line(
      left + 0.12 * scale,
      top + (0.3 + (i * 2.2) / 19) * scale,
      left + 1.72 * scale,
      top + (0.3 + (i * 2.2) / 19) * scale,
      "#a5b0a8",
      2,
    );
  b += rect(left, top, 1.84 * scale, 0.3 * scale, "#a3aea6");
  await save(
    "repair-shutter",
    "REPAIR SHOP / CLOSED SHUTTER",
    "1.60 × 2.20 m opening · 1.84 × 2.50 m assembly",
    b,
    text(70, 1450, "Front-on elevation. No perspective; no light cast onto the ground."),
  );
}
{
  const scale = 440,
    left = 107,
    top = 218;
  let b = rect(left, top, 1.84 * scale, 2.5 * scale, "#8c806c");
  b += rect(left + 0.12 * scale, top + 0.3 * scale, 1.6 * scale, 2.2 * scale, "#344a44");
  const glass = rect(left + 0.27 * scale, top + 0.48 * scale, 1.3 * scale, 1.25 * scale, "#b6a278");
  b += glass;
  b += rect(left + 0.89 * scale, top + 0.3 * scale, 0.06 * scale, 2.2 * scale, "#766d50");
  b += rect(left + 0.27 * scale, top + 1.88 * scale, 1.3 * scale, 0.43 * scale, "#244038");
  b += line(
    left + 1.4 * scale,
    top + 1.56 * scale,
    left + 1.4 * scale,
    top + 1.78 * scale,
    "#c9b26b",
    12,
  );
  await save(
    "residential-door",
    "RESIDENTIAL / GLAZED ENTRANCE",
    "1.60 × 2.20 m doorway · 1.84 × 2.50 m surround",
    b,
    text(70, 1450, "Front-on elevation. Glass is a shallow occupied vestibule, not open access."),
    rect(left + 0.27 * scale, top + 0.48 * scale, 1.3 * scale, 1.25 * scale, "white", "white") +
      rect(left + 0.89 * scale, top + 0.48 * scale, 0.06 * scale, 1.25 * scale, "black", "black"),
  );
}
{
  const scale = 490,
    left = 292,
    top = 220;
  let b = rect(left + 0.06 * scale, top + 0.05 * scale, 0.68 * scale, 0.18 * scale, "#7f8a81");
  b += rect(left + 0.53 * scale, top + 0.2 * scale, 0.16 * scale, 1.72 * scale, "#7e8c89");
  b += rect(left, top + 0.56 * scale, 0.85 * scale, 0.62 * scale, "#adb0a2");
  for (let z = 0.62; z < 1.1; z += 0.065)
    b += line(
      left + 0.08 * scale,
      top + z * scale,
      left + 0.66 * scale,
      top + z * scale,
      "#435658",
      9,
    );
  b += line(
    left + 0.14 * scale,
    top + 1.2 * scale,
    left + 0.14 * scale,
    top + 2.1 * scale,
    "#9b8867",
    14,
  );
  b += rect(left + 0.26 * scale, top + 1.56 * scale, 0.32 * scale, 0.37 * scale, "#566766");
  await save(
    "market-services",
    "MARKET / WALL SERVICE ASSEMBLY",
    "0.90 × 2.10 m envelope · wall-mounted, shallow relief",
    b,
    text(55, 1440, "Front-on. Keep open space outside the equipment transparent."),
  );
}
await copyFile("docs/evidence/atmosphere/reference.jpg", `${OUT}/style-reference.jpg`);
await writeFile(
  `${OUT}/manifest.json`,
  JSON.stringify(
    {
      canvas: [W, H],
      background: bg,
      units: "metres",
      projection: "orthographic 30 degrees, verticals vertical",
      assets: entries,
    },
    null,
    2,
  ) + "\n",
);
const thumbs = await Promise.all(
  entries.map(async (e, i) => ({
    input: await sharp(`${OUT}/guides/${e.id}-annotated.png`).resize(256, 384).toBuffer(),
    left: (i % 4) * 256,
    top: Math.floor(i / 4) * 384,
  })),
);
await sharp({ create: { width: 1024, height: 768, channels: 3, background: bg } })
  .composite(thumbs)
  .png()
  .toFile(`${OUT}/guide-overview.png`);
console.log(`Wrote ${entries.length} registered guides, masks and contact sheet.`);
