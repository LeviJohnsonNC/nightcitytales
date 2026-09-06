/**
 * Re-encode a directory of place art as WebP, at the two widths the app renders.
 *
 *     node tools/art/webp.mjs public/images/places
 *     node tools/art/webp.mjs public/images/places --check   (report, write nothing)
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

/** Card-sized. Covers a 320 CSS px card on a 2x display. */
const SMALL = { width: 640, quality: 78, suffix: "-640" };
/** Full-sized. The source width, so nothing is ever upscaled. */
const LARGE = { width: 1536, quality: 80, suffix: "" };

const MB = 1048576;

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
    console.error("usage: node tools/art/webp.mjs <dir> [--check]");
    process.exit(1);
  }
  const check = flags.includes("--check");

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

    for (const variant of [LARGE, SMALL]) {
      const encoded = sharp(source)
        // withoutEnlargement: a source narrower than the target keeps its own
        // width rather than being blown up into a soft copy of itself.
        .resize({ width: variant.width, withoutEnlargement: true })
        .webp({ quality: variant.quality, effort: 6 });
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
