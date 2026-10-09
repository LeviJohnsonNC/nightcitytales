/** A cached material treatment for painted street props, before scene lighting.
 * Alpha/registration never change. Large material boundaries retain their contrast;
 * small chips and studio highlights are quieter against the painted architecture.
 */
import type Phaser from "phaser";

const NEIGHBOURS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

export function finishPropPixels(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  equipment: boolean,
) {
  const out = new Uint8ClampedArray(src);
  const luma = (i: number) => src[i]! * 0.2126 + src[i + 1]! * 0.7152 + src[i + 2]! * 0.0722;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!src[i + 3]) continue;
      const centre = luma(i);
      let sum = centre,
        weight = 1;
      // A range-limited cross averages tiny surface flecks, never opposing faces or
      // transparent padding. It does not soften silhouettes or move an edge.
      for (const [dx, dy] of NEIGHBOURS) {
        const xx = x + dx!,
          yy = y + dy!;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const j = (yy * width + xx) * 4;
        if (src[j + 3]! < 128) continue;
        const v = luma(j),
          w = Math.max(0, 1 - Math.abs(v - centre) / 36);
        sum += v * w;
        weight += w;
      }
      const local = centre + (sum / weight - centre) * (equipment ? 0.7 : 0.4);
      // A smooth highlight shoulder removes the bright studio-silver look. Dark
      // crevices stay dark; body colours remain distinct (including sedan paints).
      const shoulder = 150;
      const toned =
        local > shoulder ? shoulder + (local - shoulder) / (1 + (local - shoulder) / 115) : local;
      const saturation = equipment ? 0.7 : 0.9;
      const gain = equipment ? 0.91 : 0.97;
      for (let c = 0; c < 3; c++) out[i + c] = (toned + (src[i + c]! - centre) * saturation) * gain;
    }
  return out;
}

export function finishStreetProps(scene: Phaser.Scene) {
  for (const key of scene.textures.getTextureKeys()) {
    if (
      !/^prop-(cargo|generator|dumpster|barrier|pallet|truck-|sedan-|food-cart|planter|mailboxes|shop-display)/.test(
        key,
      )
    )
      continue;
    const texture = scene.textures.get(key);
    const canvas = texture.getSourceImage();
    if (!(canvas instanceof HTMLCanvasElement)) continue;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    data.data.set(
      finishPropPixels(data.data, canvas.width, canvas.height, /^prop-(cargo|generator)/.test(key)),
    );
    ctx.putImageData(data, 0, 0);
    (texture as Phaser.Textures.CanvasTexture).refresh();
  }
}
