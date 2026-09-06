/**
 * Re-encode a directory of place art as WebP, at the two widths the app renders.
 *
 *     node tools/art/webp.mjs public/images/places
 *     node tools/art/webp.mjs public/images/places --check       report, write nothing
 *     node tools/art/webp.mjs public/images/gear --widths=1024,512
 *     node tools/art/webp.mjs public/images/combat/night-shift --lossless --no-resize
 *
 * WHY THIS EXISTS
 * The art arrives as 1536x1024 PNGs of about 2.9MB each. public/images was
 * 978MB across 376 files, and the largest surface any of it is ever drawn into
 * is a modal capped at 896 CSS pixels — the district grid in character creation
 * pulls fifteen megabytes to fill cards 225 pixels wide, and visibly pops in
 * over several seconds on localhost.
 *
 * WHY TWO WIDTHS AND NOT ONE
 * A card is ~225 CSS px and a dossier is ~896. One file either over-serves the
 * grid by five times or under-serves the dossier, so each image is written at
 * both and the markup picks with srcset. SMALL covers cards to 320px on a 2x
 * display; LARGE is the source width, never upscaled.
 *
 * WIDTHS ARE PER DIRECTORY, BECAUSE THE SURFACES DIFFER
 * Places are drawn into a dossier capped at 896 CSS px, so they get 1536/640.
 * Item and cast art only ever appears inside a max-w-lg dialog — 512 px — so
 * 1024/512 covers it at 2x and anything larger is bytes nobody sees. Pass
 * --widths to say which.
 *
 * SPRITE SHEETS ARE LOSSLESS AND UNRESIZED
 * The courtyard textures are atlases sliced into frames by Phaser. Resizing
 * would move the frame boundaries and lossy encoding can bleed colour across
 * them, so --lossless --no-resize re-containers them without touching a pixel.
 *
 * WHY WEBP AND NOT JPEG
 * Cheaper at the same quality, and it keeps an alpha channel. Places carry no
 * transparency, but the gear and weapon art is cutouts that do, and a JPEG pass
 * would silently flatten those onto a solid box. One format for all of it means
 * this script stays usable for the rest of public/images.
 *
 * THIS DELETES THE PNGs, AND GIT IS THE BACKUP
 * Only 16 of the 196 place images have a lossless twin in images/ at the
 * repository root; the other 180 exist nowhere else in the working tree. They
 * are all committed, so every original is recoverable with
 *
 *     git show <commit-before-this>:public/images/places/<slug>.png > out.png
 *
 * and re-running this script against a restored PNG reproduces the WebP exactly.
 * That is the whole safety net — do not run this against art that has never
 * been committed.
 */
import { readdir, stat, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

/** What each directory gets, unless --widths says otherwise. */
const DEFAULT_WIDTHS = [1536, 640];
const LARGE_QUALITY = 80;
const SMALL_QUALITY = 78;

const MB = 1048576;

/**
 * The variants to write for one image.
 *
 * The first width is the full-size file and carries no suffix, so it stays the
 * `src` a browser without srcSet support falls back to. Every other width is
 * suffixed with its own number, which is what the srcSet strings are built from.
 */
function variantsFor(widths) {
  return widths.map((width, index) => ({
    width,
    quality: index === 0 ? LARGE_QUALITY : SMALL_QUALITY,
    suffix: index === 0 ? "" : `-${width}`,
  }));
}

async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function main() {
  const [dir, ...flags] = process.argv.slice(2);
  if (!dir) {
    console.error(
      "usage: node tools/art/webp.mjs <dir> [--check] [--widths=A,B] [--lossless] [--no-resize]",
    );
    process.exit(1);
  }
  const check = flags.includes("--check");
  const lossless = flags.includes("--lossless");
  const noResize = flags.includes("--no-resize");
  const widthFlag = flags.find((f) => f.startsWith("--widths="));
  const widths = widthFlag
    ? widthFlag
        .slice("--widths=".length)
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    : DEFAULT_WIDTHS;
  // One variant, no suffix, when the source is being re-containered rather than
  // resized: a sprite sheet has exactly one useful size.
  const variants = noResize
    ? [{ width: null, quality: LARGE_QUALITY, suffix: "" }]
    : variantsFor(widths);

  const files = (await readdir(dir)).filter((f) => extname(f).toLowerCase() === ".png").sort();
  if (!files.length) {
    console.log(`${dir}: no PNGs. Already converted?`);
    return;
  }

  let before = 0;
  let after = 0;
  let alpha = 0;

  for (const file of files) {
    const source = join(dir, file);
    const slug = basename(file, ".png");
    const image = sharp(source);
    const meta = await image.metadata();
    if (meta.hasAlpha) alpha += 1;
    before += await sizeOf(source);

    for (const variant of variants) {
      let pipeline = sharp(source);
      // withoutEnlargement: a source narrower than the target keeps its own
      // width rather than being blown up into a soft copy of itself.
      if (variant.width)
        pipeline = pipeline.resize({ width: variant.width, withoutEnlargement: true });
      const encoded = pipeline.webp(
        lossless ? { lossless: true, effort: 6 } : { quality: variant.quality, effort: 6 },
      );
      if (check) {
        // Encoded and thrown away, so --check can report the real saving rather
        // than a guess. It is the same encode, so the number is the number.
        after += (await encoded.toBuffer()).length;
        continue;
      }
      const out = join(dir, `${slug}${variant.suffix}.webp`);
      await encoded.toFile(out);
      after += await sizeOf(out);
    }
    if (!check) await unlink(source);
  }

  const pct = before ? Math.round((100 * after) / before) : 0;
  console.log(
    [
      `${dir}`,
      `  ${files.length} images${alpha ? `, ${alpha} with alpha (kept)` : ""}`,
      `  ${lossless ? "lossless" : `quality ${LARGE_QUALITY}/${SMALL_QUALITY}`}, ${
        noResize ? "no resize" : `widths ${widths.join(" and ")}`
      }`,
      `  before ${(before / MB).toFixed(0)}MB  after ${(after / MB).toFixed(0)}MB  (${pct}%)`,
      check
        ? "  --check: nothing written"
        : "  PNGs removed. Recover any of them from git; see the header.",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
