import type Phaser from "phaser";
import { CHARACTER_FRAME } from "./characterAnimation";

// Inspected opaque body bounds in each 512px cell. Exclude isolated alpha specks;
// the crouched worker's separate bag is inside the same crop. Sources are unresized.
const CROPS = [
  [
    [184, 17, 192, 475],
    [159, 209, 203, 241],
    [42, 314, 421, 151],
  ],
  [
    [144, 17, 257, 469],
    [96, 179, 275, 247],
    [44, 298, 419, 167],
  ],
] as const;

/** Two workers × standing/crouching/prone. Preserve pose scale relative to standing. */
export function createCivilianAtlas(scene: Phaser.Scene) {
  const source = scene.textures.get("source-workers").getSourceImage() as HTMLImageElement;
  if (source.width !== 1536 || source.height !== 1024)
    throw new Error("Civilian atlas dimensions changed; inspect crop metadata before shipping");
  const atlas = scene.textures.createCanvas("civilian", 3 * 128, 2 * 128)!;
  CROPS.forEach((poses, row) => {
    const scale = CHARACTER_FRAME.height / poses[0][3];
    poses.forEach(([x, y, w, h], col) => {
      const cell = document.createElement("canvas");
      cell.width = w;
      cell.height = h;
      const ctx = cell.getContext("2d")!;
      ctx.drawImage(source, col * 512 + x, row * 512 + y, w, h, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h);
      // A low-opacity generated light halo is not part of a body's silhouette.
      for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i]! < 128) pixels.data[i] = 0;
      ctx.putImageData(pixels, 0, 0);
      const width = w * scale,
        height = h * scale;
      const bottom = CHARACTER_FRAME.foot + (col === 2 ? height / 2 : 0);
      atlas.context.drawImage(
        cell,
        col * 128 + 64 - width / 2,
        row * 128 + bottom - height,
        width,
        height,
      );
      atlas.add(row * 3 + col, 0, col * 128, row * 128, 128, 128);
    });
  });
  atlas.refresh();
  scene.textures.remove("source-workers");
}
