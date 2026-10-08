import { isInteriorProp, createInteriorPropTextures } from "./interiorPropArt";
import type Phaser from "phaser";
import type { PropKind, PropCondition } from "./propPresentation";
import { propTexture } from "./propPresentation";
import { clearMatte } from "./characterTextures";

/** Opaque ink excludes padding and soft ground shadows from actor fading. */
export function propInkBounds(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  const pixels = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  return propInk(pixels, width, height);
}

/** Build bounds and a 64×64 silhouette together from one texture readback. */
export function propInk(pixels: Uint8ClampedArray, width: number, height: number) {
  const size = 64;
  const covered = new Uint32Array(size * size);
  const totals = new Uint32Array(size * size);
  let left = width,
    top = height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const cell = Math.floor((y * size) / height) * size + Math.floor((x * size) / width);
      totals[cell] = totals[cell]! + 1;
      if (pixels[(y * width + x) * 4 + 3]! < 128) continue;
      covered[cell] = covered[cell]! + 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  const cells = Uint8Array.from(covered, (n, i) => (n > 0 && n / totals[i]! >= 0.35 ? 1 : 0));
  if (left === width) return { left: 0, top: 0, right: 0, bottom: 0, cells, size };
  return {
    cells,
    size,
    left: left / width,
    top: top / height,
    right: (right + 1) / width,
    bottom: (bottom + 1) / height,
  };
}

export function propSource(kind: PropKind) {
  if (isInteriorProp(kind)) return "procedural-interior";
  if (kind.startsWith("sedan-") || kind === "food-cart") return "street-props";
  return kind.startsWith("truck-") ? "vehicle-states" : `${kind}-states`;
}

/** Crop inspected atlas cells once; preserve supplied alpha and key opaque light mattes. */
export function createPropTextures(
  scene: Phaser.Scene,
  kinds: PropKind[],
  /** False where the board draws each prop's contact shade (`contactShade.ts`). */
  bakedShadow = true,
) {
  for (const kind of kinds) {
    if (isInteriorProp(kind)) {
      createInteriorPropTextures(scene, kind, 0, bakedShadow);
      createInteriorPropTextures(scene, kind, 90, bakedShadow);
      continue;
    }
    const source = scene.textures
      .get(`source-${propSource(kind)}`)
      .getSourceImage() as HTMLImageElement;
    const vehicle = kind.startsWith("truck-");
    const conditions: PropCondition[] = ["intact", "damaged", "wrecked"];
    conditions.forEach((condition, index) => {
      const street = propSource(kind) === "street-props";
      const columns = vehicle ? 2 : 3,
        rows = vehicle || street ? 3 : 1;
      const col = street
        ? ["sedan-engine", "sedan-cabin", "food-cart"].indexOf(kind)
        : vehicle
          ? kind === "truck-cab"
            ? 1
            : 0
          : index;
      const row = vehicle || street ? index : 0;
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
      // Preserve cell coordinates across conditions. Ground registration lives in
      // explicit asset metadata rather than a new alpha crop on every HP state.
      const h = Math.round((256 * height) / width);
      const texture = scene.textures.createCanvas(propTexture(kind, condition), 256, h)!;
      texture.context.drawImage(cell, 0, 0, width, height, 0, 0, 256, h);
      texture.refresh();
    });
  }
  for (const source of new Set(kinds.filter((k) => !isInteriorProp(k)).map(propSource)))
    scene.textures.remove(`source-${source}`);
}
