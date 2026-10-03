/** Screen-space silhouette overlap; never changes movement or shot blocking. */
export function sceneryOccludes(
  scenery: { x: number; y: number; depth: number; displayWidth: number; displayHeight: number },
  unit: { x: number; y: number; visible: boolean },
  height: number,
) {
  return (
    unit.visible &&
    unit.y < scenery.depth &&
    unit.y > scenery.y - scenery.displayHeight &&
    unit.y - height < scenery.y &&
    Math.abs(unit.x - scenery.x) < scenery.displayWidth / 2 + 12
  );
}
