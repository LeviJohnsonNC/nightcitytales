/**
 * Bake the street sedan's paint variants from its existing art (`sedanPaint.ts`).
 *
 *     bun run tools/art/sedan-paint.ts            write public/images/street-props/*-<paint>.webp
 *     bun run tools/art/sedan-paint.ts --check    measure and report, write nothing
 *
 * For every intact and damaged section frame, in both rotations, and every paint but
 * the art's own beige: mask the body paint and recolour inside it, keeping each
 * pixel's luminance. Wrecks are burned to bare metal and keep their art.
 *
 * WHAT IS CHECKED
 *   coverage  the share of the opaque frame the mask takes as paint. An intact half is
 *             mostly body, a damaged one less (holes, glass, rust): outside 25-85% the
 *             mask has found something other than the body, and nothing is written.
 *   alpha     unchanged, pixel for pixel: a paint never moves an edge.
 */
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { repaint, SEDAN_PAINT_ORDER } from "@/features/play/courtyard/sedanPaint";

const DIR = "public/images/street-props";
const check = process.argv.includes("--check");
let failed = false;
for (const section of ["sedan-engine", "sedan-cabin"])
  for (const condition of ["intact", "damaged"])
    for (const rot of ["", "-90"]) {
      const name = `${section}-${condition}${rot}`;
      const { data, info } = await sharp(readFileSync(`${DIR}/${name}.webp`))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (const paint of SEDAN_PAINT_ORDER) {
        if (paint === "beige") continue;
        const rgba = new Uint8Array(data);
        const coverage = repaint(rgba, info.width, info.height, paint);
        const alphaKept = rgba.every((v, i) => i % 4 !== 3 || v === data[i]);
        const ok = coverage >= 0.25 && coverage <= 0.85 && alphaKept;
        console.log(
          `${`${name}-${paint}`.padEnd(32)} paint ${(coverage * 100).toFixed(1)}% of the frame${ok ? "" : "  FAIL"}`,
        );
        if (!ok) failed = true;
        if (!check && ok)
          await writeFile(
            `${DIR}/${name}-${paint}.webp`,
            await sharp(Buffer.from(rgba), {
              raw: { width: info.width, height: info.height, channels: 4 },
            })
              .webp({ quality: 86, alphaQuality: 100, effort: 6 })
              .toBuffer(),
          );
      }
    }
if (failed) process.exit(1);
