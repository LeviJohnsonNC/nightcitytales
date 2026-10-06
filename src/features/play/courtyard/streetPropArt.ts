/**
 * The street-prop art (`docs/street-props-pack.md`) in the renderer: painted
 * replacements for the procedural sedan, planter and mailbox cabinet.
 *
 * Each file is one frame per saved 2 m section, made by `tools/art/street-props.ts` at
 * twice the procedural frame's 256 x 320. A sedan's art is padded past its frame
 * (`SEDAN_ART_PAD`) so each half of the car fits whole; the texture carries where its
 * frame sits (`customData.registration`), and the board places, sorts, fades and
 * damages it by its 2 m footprint exactly as before. It replaces the procedural
 * texture under the SAME key. A file that is missing or
 * fails to load leaves the procedural kit in place. Presentation only.
 */
import type Phaser from "phaser";
import { propTexture, type PropCondition, type PropKind } from "./propPresentation";
import { propArtRegistration } from "./streetPropPack";

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
  /** The prop kind, which says how far its art is padded past its 2 m frame. */
  kind: PropKind;
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
          kind,
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
 * at twice the procedural size. Its contact with the ground is the board's contact
 * shade (`contactShade.ts`), made from the art itself: never a shadow in the artwork,
 * and no longer a flat footprint under it.
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
      ctx.drawImage(image, 0, 0);
      texture.refresh();
      // where the 2 m frame sits in padded art: the board reads this to place it
      texture.customData = { ...texture.customData, registration: propArtRegistration(file.kind) };
    }
    scene.textures.remove(file.key);
  }
}
