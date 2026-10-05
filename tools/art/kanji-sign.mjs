/**
 * Rasterise the storefront's kanji sign: 深夜市場 ("Night Market"), the sign in the
 * reference frame, as a white-on-transparent mask.
 *
 *     node tools/art/kanji-sign.mjs            write public/images/signs/shenye-ichiba.webp
 *     node tools/art/kanji-sign.mjs --check    render and report, write nothing
 *
 * WHY A MASK AND NOT RUNTIME TEXT
 * Canvas text needs a CJK font on the player's machine, and many have none, so
 * the sign would draw empty boxes. Generated lettering is unreliable, and the art
 * rules bar readable text in generated art. So the glyphs are drawn here, once,
 * from a real font, into a picture the renderer treats as geometry: it tints it,
 * lights it and glows it in code, which a baked picture of a lit sign could not do.
 *
 * WHAT IT DOES
 * Four 256 px cells in a row, 1024 x 256. The font's strokes are about 8.5% of the
 * em; an SVG stroke in the background colour eats 4.5 px off every edge, leaving a
 * monoline of about 13 px (5%), which reads as neon tube rather than printed type.
 *
 * FONT
 * IPAGothic (the `fonts-ipafont-gothic` package, IPA Font License 1.0). Only the
 * rasterised result is committed, not the font; the licence allows that.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const TEXT = "深夜市場";
const CELL = 256;
const STROKE = 9;
const OUT = "public/images/signs/shenye-ichiba.webp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL * TEXT.length}" height="${CELL}">
  <rect width="100%" height="100%" fill="#000"/>
  ${[...TEXT]
    .map(
      (ch, i) =>
        `<text x="${i * CELL + CELL / 2}" y="${CELL * 0.82}" font-family="IPAGothic, 'IPAゴシック'" font-size="${CELL * 0.92}" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="${STROKE}" paint-order="stroke fill">${ch}</text>`,
    )
    .join("\n  ")}
</svg>`;

// `paint-order` is not honoured by every rasteriser, so draw the stroke over the
// fill explicitly: fill first, then the same text stroked in black on top.
const layered = svg.replace(/paint-order="stroke fill"/g, 'paint-order="normal"');

const grey = await sharp(Buffer.from(layered))
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height } = grey.info;
const lit = grey.data.reduce((n, v) => n + (v > 127 ? 1 : 0), 0);
// The white of each glyph becomes the alpha of a white image.
const rgba = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;
  rgba[i * 4 + 3] = grey.data[i];
}
const coverage = lit / (width * height);
console.log(`${TEXT}: ${width}x${height}, ${(coverage * 100).toFixed(1)}% lit`);
if (coverage < 0.04 || coverage > 0.3) {
  console.error("The glyphs did not render (missing font?) or are not thin: check the font.");
  process.exit(1);
}
if (!process.argv.includes("--check")) {
  await mkdir("public/images/signs", { recursive: true });
  const encoded = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .webp({ quality: 95, alphaQuality: 100, effort: 6 })
    .toBuffer();
  await writeFile(OUT, encoded);
  console.log(`wrote ${OUT} (${(encoded.length / 1024).toFixed(1)} KB)`);
}
