/**
 * The street-prop art (`docs/street-props-pack.md`) in the renderer: painted
 * replacements for the procedural sedan, planter and mailbox cabinet.
 *
 * Each file is one 512 x 640 frame per saved 2 m section, made by
 * `tools/art/street-props.ts` to exactly the procedural frame's registration (twice its
 * 256 x 320), so it replaces the procedural texture under the SAME key and the board
 * places, sorts, fades and damages it exactly as before. A file that is missing or
 * fails to load leaves the procedural kit in place. Presentation only.
 */
import type Phaser from "phaser";
import { propTexture, type PropCondition, type PropKind } from "./propPresentation";
import { interiorPropPoint } from "./interiorPropArt";

const CONDITIONS: readonly PropCondition[] = ["intact", "damaged", "wrecked"];

/**
 * What exists, and which texture keys each file serves. The sedan has its own art per
 * rotation (never mirrored); the planter is square and symmetric, so one image serves
 * both; the mailbox cabinet has art for rotation 0 only, and a rotated one keeps the
 * procedural kit until its own image exists.
 */
const COVERAGE: Record<string, readonly (0 | 90)[]> = {
  "sedan-engine": [0, 90],
  "sedan-cabin": [0, 90],
  planter: [0, 90],
  mailboxes: [0],
};

export interface StreetPropFile {
  /** Loader key, and the file under /images/street-props/. */
  key: string;
  url: string;
  /** The texture keys this file replaces. */
  textures: string[];
}

/** The files a scene with these prop kinds can use. */
export function streetPropFiles(kinds: readonly PropKind[]): StreetPropFile[] {
  const files: StreetPropFile[] = [];
  for (const kind of new Set(kinds)) {
    const rotations = COVERAGE[kind];
    if (!rotations) continue;
    for (const condition of CONDITIONS) {
      const own90 = kind.startsWith("sedan-");
      for (const rotation of rotations) {
        // the planter's single file serves rotation 90 too
        if (rotation === 90 && !own90) continue;
        const name = `${kind}-${condition}${rotation === 90 ? "-90" : ""}`;
        const textures = [propTexture(kind, condition) + (rotation === 90 ? "-90" : "")];
        if (!own90 && rotations.includes(90)) textures.push(propTexture(kind, condition) + "-90");
        files.push({
          key: `streetprop-${name}`,
          url: `/images/street-props/${name}.webp`,
          textures,
        });
      }
    }
  }
  return files;
}

/**
 * Swap each loaded file in for the procedural texture it replaces. The frame is drawn
 * at twice the procedural size with the procedural kit's own soft contact shadow under
 * it: the shadow is the renderer's, never the artwork's.
 */
export function applyStreetPropArt(scene: Phaser.Scene, files: readonly StreetPropFile[]) {
  for (const file of files) {
    if (!scene.textures.exists(file.key)) continue;
    const image = scene.textures.get(file.key).getSourceImage() as CanvasImageSource & {
      width: number;
      height: number;
    };
    for (const key of file.textures) {
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const texture = scene.textures.createCanvas(key, image.width, image.height)!;
      const ctx = texture.context;
      const k = image.width / 256;
      // the procedural kit's contact shadow: the footprint inset 0.1 m, at the same alpha
      const corner = (x: number, y: number) => {
        const p = interiorPropPoint(x, y);
        return { x: p.x * k, y: p.y * k };
      };
      ctx.beginPath();
      [corner(0.1, 0.1), corner(1.9, 0.1), corner(1.9, 1.9), corner(0.1, 1.9)].forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.fillStyle = "rgba(0,0,0,.23)";
      ctx.fill();
      ctx.drawImage(image, 0, 0);
      texture.refresh();
    }
    scene.textures.remove(file.key);
  }
}
