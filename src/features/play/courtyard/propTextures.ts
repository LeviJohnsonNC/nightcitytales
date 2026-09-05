import type Phaser from "phaser";
import type { PropKind, PropCondition } from "./propPresentation";
import { propTexture } from "./propPresentation";
import { clearMatte } from "./characterTextures";

export function propSource(kind: PropKind) {
  return kind.startsWith("truck-") ? "vehicle-states" : `${kind}-states`;
}

/** Crop inspected atlas cells once; preserve supplied alpha and key opaque light mattes. */
export function createPropTextures(scene: Phaser.Scene, kinds: PropKind[]) {
  for (const kind of kinds) {
    const source = scene.textures
      .get(`source-${propSource(kind)}`)
      .getSourceImage() as HTMLImageElement;
    const vehicle = kind.startsWith("truck-");
    const conditions: PropCondition[] = ["intact", "damaged", "wrecked"];
    conditions.forEach((condition, index) => {
      const columns = vehicle ? 2 : 3,
        rows = vehicle ? 3 : 1;
      const col = vehicle ? (kind === "truck-cab" ? 1 : 0) : index;
      const row = vehicle ? index : 0;
      const sx = Math.round((source.width * col) / columns),
        sy = Math.round((source.height * row) / rows);
      const width = Math.round((source.width * (col + 1)) / columns) - sx;
      const height = Math.round((source.height * (row + 1)) / rows) - sy;
      const cell = document.createElement("canvas");
      cell.width = width;
      cell.height = height;
      const ctx = cell.getContext("2d")!;
      ctx.drawImage(source, sx, sy, width, height, 0, 0, width, height);
      clearMatte(ctx, width, height);
      const rgba = ctx.getImageData(0, 0, width, height).data;
      let left = width,
        top = height,
        right = 0,
        bottom = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          if (rgba[(y * width + x) * 4 + 3]! < 128) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      if (right <= left || bottom <= top) throw new Error(`Empty prop: ${kind}/${condition}`);
      const h = Math.round((256 * (bottom - top + 1)) / (right - left + 1));
      const texture = scene.textures.createCanvas(propTexture(kind, condition), 256, h)!;
      texture.context.drawImage(cell, left, top, right - left + 1, bottom - top + 1, 0, 0, 256, h);
      texture.refresh();
    });
  }
  for (const source of new Set(kinds.map(propSource))) scene.textures.remove(`source-${source}`);
}
