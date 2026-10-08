/** A small cached alpha mask in the prop texture's original coordinates. */
export interface SceneryMask {
  cells: Uint8Array;
  size: number;
  left: number;
  top: number;
  width: number;
  height: number;
  flipX: boolean;
}

/** Screen-space silhouette overlap; never changes movement or shot blocking. */
export function sceneryOccludes(
  scenery: { x: number; y: number; depth: number; displayWidth: number; displayHeight: number },
  unit: { x: number; y: number; visible: boolean; depth?: number },
  height: number,
  mask?: SceneryMask,
) {
  const overlaps =
    unit.visible &&
    (unit.depth ?? unit.y) < scenery.depth &&
    unit.y > scenery.y - scenery.displayHeight &&
    unit.y - height < scenery.y &&
    Math.abs(unit.x - scenery.x) < scenery.displayWidth / 2 + 12;
  if (!overlaps || !mask) return overlaps;
  // Test the actor's head/torso against actual ink, not the empty rectangle around
  // an open cart. A narrow post or canopy fringe must not ghost the entire stall.
  // No canvas readbacks occur here; the mask is cached once with the texture.
  let blocked = 0;
  const columns = 7,
    rows = 9;
  for (let y = 0; y < rows; y++) {
    const py = unit.y - height * (0.95 - (y / (rows - 1)) * 0.7);
    for (let x = 0; x < columns; x++) {
      const px = unit.x + height * 0.14 * ((2 * x) / (columns - 1) - 1);
      let u = (px - mask.left) / mask.width;
      const v = (py - mask.top) / mask.height;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      if (mask.flipX) u = 1 - u;
      const ix = Math.min(mask.size - 1, Math.floor(u * mask.size));
      const iy = Math.floor(v * mask.size);
      if (mask.cells[iy * mask.size + ix]) blocked++;
    }
  }
  return blocked / (columns * rows) >= 0.2;
}
