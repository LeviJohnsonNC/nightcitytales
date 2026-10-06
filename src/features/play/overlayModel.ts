/**
 * How loud the movement overlay is, by what the player is doing.
 *
 * Presentation only. The squares, their costs and which of them see a target are
 * the engine's (`moveField`, `firingTiles`); this decides how much of that is drawn,
 * so that at rest the street is not covered by a lattice of equally bright squares:
 *
 *   rest    the edge of reachable ground, and a breath of fill inside it
 *   plan    every reachable square, the route and the destination
 *   aim     the squares that can see the target; the rest faded
 *   target  only the edge: the target and the line of sight are the point
 *
 * The edge is drawn wherever a reachable square meets one that is not, so it is the
 * Move Action's real cost boundary, never a decoration.
 */
import { TILE_METRES, tileKey, type Point, type SceneStructure, type Tile } from "@/engine";
import { buildingHidesGround } from "./courtyard/activityReveal";

export type OverlayMode = "rest" | "plan" | "aim" | "target";

export function overlayMode(interaction: string): OverlayMode {
  switch (interaction) {
    case "move-hover":
    case "move-preview":
      return "plan";
    case "find-firing-position":
      return "aim";
    case "target-hover":
    case "target-selected":
      return "target";
    default:
      return "rest";
  }
}

/** Fill and line strength per mode, one table for both renderers. */
export const OVERLAY = {
  rest: { fill: 0.035, square: 0, edge: 0.6 },
  plan: { fill: 0.075, square: 0.16, edge: 0.75 },
  aim: { fill: 0.05, square: 0.12, edge: 0.4 },
  target: { fill: 0, square: 0, edge: 0.35 },
} as const satisfies Record<OverlayMode, { fill: number; square: number; edge: number }>;

/**
 * The outline of a set of squares, in metres: every side of a square whose
 * neighbour across it is not in the set.
 */
export function squaresOutline(tiles: readonly Tile[]): [Point, Point][] {
  const inside = new Set(tiles.map(tileKey));
  const T = TILE_METRES;
  const edges: [Point, Point][] = [];
  for (const t of tiles) {
    const x = t.col * T;
    const y = t.row * T;
    const has = (col: number, row: number) => inside.has(tileKey({ col, row }));
    if (!has(t.col, t.row - 1))
      edges.push([
        { x, y },
        { x: x + T, y },
      ]);
    if (!has(t.col + 1, t.row))
      edges.push([
        { x: x + T, y },
        { x: x + T, y: y + T },
      ]);
    if (!has(t.col, t.row + 1))
      edges.push([
        { x: x + T, y: y + T },
        { x, y: y + T },
      ]);
    if (!has(t.col - 1, t.row))
      edges.push([
        { x, y: y + T },
        { x, y },
      ]);
  }
  return edges;
}

/**
 * The edge of the board as drawn over a scenic street: its four sides, less every
 * stretch that stands inside a building or behind one as the camera sees it.
 *
 * The outline is an overlay, drawn above the art. Where the board's edge crossed a
 * building it was printed across the footprint and the roof as a dashed line, which
 * read as a road marking inside the building. Nobody stands there, so nothing is lost.
 * A building cut away for the reveal hides nothing behind it, but still its footprint.
 * Fences and interior walls hide nothing.
 */
export function boardOutline(
  extent: { width: number; height: number },
  structures: readonly SceneStructure[],
  cutAway: ReadonlySet<string> = new Set(),
  step = 0.1,
): [Point, Point][] {
  const solid = structures.filter((s) => s.style !== "interior-wall" && s.style !== "mesh-fence");
  const hidden = (p: Point) =>
    solid.some((s) => {
      const r = s.rect;
      const inside = p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
      return inside || (!cutAway.has(s.id) && buildingHidesGround(s, p));
    });
  const { width: w, height: h } = extent;
  const sides: [Point, Point][] = [
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
    ],
    [
      { x: w, y: 0 },
      { x: w, y: h },
    ],
    [
      { x: w, y: h },
      { x: 0, y: h },
    ],
    [
      { x: 0, y: h },
      { x: 0, y: 0 },
    ],
  ];
  const runs: [Point, Point][] = [];
  for (const [a, b] of sides) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(length / step));
    const at = (i: number) => ({
      x: a.x + ((b.x - a.x) * i) / n,
      y: a.y + ((b.y - a.y) * i) / n,
    });
    let start: number | null = null;
    for (let i = 0; i <= n; i++) {
      const shown = !hidden(at(i));
      if (shown && start === null) start = i;
      if ((!shown || i === n) && start !== null) {
        const end = shown ? i : i - 1;
        if (end > start) runs.push([at(start), at(end)]);
        start = null;
      }
    }
  }
  return runs;
}
