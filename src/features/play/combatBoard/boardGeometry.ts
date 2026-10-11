/** Pure helpers the tactical board draws and frames with (`CombatBoard.tsx`). */
import { TILE_METRES, type Point, type Tile } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";

export const points = (path: Point[]) => path.map((p) => `${p.x},${p.y}`).join(" ");
/** The four ground corners of one battlemat square, in metres. */
export const squareCorners = (tile: Tile): Point[] => {
  const x = tile.col * TILE_METRES,
    y = tile.row * TILE_METRES;
  return [
    { x, y },
    { x: x + TILE_METRES, y },
    { x: x + TILE_METRES, y: y + TILE_METRES },
    { x, y: y + TILE_METRES },
  ];
};

export const framingPoints = (encounter: LiveEncounter | null) =>
  encounter
    ? Object.values(encounter.state.combatants).flatMap((actor) =>
        !actor.defeated && encounter.data[actor.id]
          ? [{ ...encounter.data[actor.id]!.position }]
          : [],
      )
    : [];
