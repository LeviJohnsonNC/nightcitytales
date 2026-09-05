import type Phaser from "phaser";
import { CHARACTER_FRAME } from "./characterAnimation";

/** Key only the edge-connected light matte, retaining enclosed bright armor detail. */
export function clearMatte(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = ctx.getImageData(0, 0, width, height);
  const visited = new Uint8Array(width * height),
    queue = new Int32Array(width * height);
  let head = 0,
    tail = 0;
  const add = (index: number) => {
    if (index < 0 || index >= visited.length || visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    if (Math.min(pixels.data[offset]!, pixels.data[offset + 1]!, pixels.data[offset + 2]!) < 205)
      return;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    add(y * width);
    add(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++]!;
    pixels.data[index * 4 + 3] = 0;
    if (index % width) add(index - 1);
    if (index % width < width - 1) add(index + 1);
    add(index - width);
    add(index + width);
  }
  ctx.putImageData(pixels, 0, 0);
}

/** Normalize contact points once at upload; frame swaps then allocate nothing. */
export function createCharacterAtlas(scene: Phaser.Scene, key: "mercenary" | "hostile") {
  const source = scene.textures.get(`source-${key}-animation`).getSourceImage() as HTMLImageElement;
  const atlas = scene.textures.createCanvas(
    key,
    8 * CHARACTER_FRAME.size,
    4 * CHARACTER_FRAME.size,
  )!;
  // Authored crop boundaries preserve the wide prone poses and the fourth row's heads.
  const xs = [0, 181, 362, 543, 724, 905, 1086, key === "hostile" ? 1210 : 1230, 1448];
  const ys = [0, 287, 543, 790, 1086];
  for (let row = 0; row < 4; row++) {
    let standingHeight = 1;
    for (let col = 0; col < 8; col++) {
      const x = Math.round((xs[col]! / 1448) * source.width),
        y = Math.round((ys[row]! / 1086) * source.height);
      const width = Math.round((xs[col + 1]! / 1448) * source.width) - x,
        height = Math.round((ys[row + 1]! / 1086) * source.height) - y;
      const cell = document.createElement("canvas");
      cell.width = width;
      cell.height = height;
      const ctx = cell.getContext("2d")!;
      ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
      clearMatte(ctx, width, height);
      const rgba = ctx.getImageData(0, 0, width, height).data;
      let top = height,
        bottom = 0,
        left = width,
        right = 0;
      for (let py = 0; py < height; py++)
        for (let px = 0; px < width; px++) {
          if (rgba[(py * width + px) * 4 + 3]! < 128) continue;
          top = Math.min(top, py);
          bottom = Math.max(bottom, py);
          left = Math.min(left, px);
          right = Math.max(right, px);
        }
      if (top >= bottom) throw new Error(`Empty character animation cell: ${key} ${row}/${col}`);
      if (col === 0) standingHeight = bottom - top;
      const scale = CHARACTER_FRAME.height / standingHeight;
      // Use the torso, rather than the gun or the moving feet, to register upright frames.
      let torsoTotal = 0,
        torsoRows = 0;
      for (
        let py = Math.round(top + (bottom - top) * 0.35);
        py < top + (bottom - top) * 0.6;
        py++
      ) {
        let a = width,
          b = -1;
        for (let px = 0; px < width; px++)
          if (rgba[(py * width + px) * 4 + 3]! > 128) {
            a = Math.min(a, px);
            b = px;
          }
        if (b >= a) {
          torsoTotal += (a + b) / 2;
          torsoRows++;
        }
      }
      const anchorX =
        col === 7 ? (left + right) / 2 : torsoRows ? torsoTotal / torsoRows : width / 2;
      const anchorY = col === 7 ? (top + bottom) / 2 : bottom;
      const dx = col * 128 + 64 - anchorX * scale,
        dy = row * 128 + CHARACTER_FRAME.foot - anchorY * scale;
      atlas.context.save();
      atlas.context.beginPath();
      atlas.context.rect(col * 128, row * 128, 128, 128);
      atlas.context.clip();
      atlas.context.drawImage(cell, dx, dy, width * scale, height * scale);
      atlas.context.restore();
      atlas.add(row * 8 + col, 0, col * 128, row * 128, 128, 128);
    }
  }
  atlas.refresh();
  scene.textures.remove(`source-${key}-animation`);
}
