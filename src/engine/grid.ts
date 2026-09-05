/**
 * The tactical grid — where a body may stand, and what walking there costs.
 *
 * Positions stay in metres everywhere else in the engine, because that is what
 * the printed Range DV table is read at (see battlefield.ts). This module adds
 * the OTHER half of the printed geometry: CP:R pg. 168 sizes a battlemat square
 * at 2 m and spends a Move Action as "a number of squares equal to their MOVE",
 * so the board is a lattice of 2 m tiles and MOVE is counted in tiles.
 *
 * The split matters. Quantising a POSITION changes nothing about a shot: the
 * distance between two tile centres is still measured in metres and still read
 * off the printed step function. Quantising MOVEMENT is the printed rule. So
 * range stays continuous and movement becomes discrete, which is exactly how
 * the book is written.
 *
 * Pure: no React, no backend, no randomness.
 */
import type { Arena, Point } from "./battlefield";
import { coverDestroyed, type CoverDamage } from "./cover";

/** One battlemat square (CP:R pg. 168). Also one attackable cover section. */
export const TILE_METRES = 2;

/**
 * HOUSE RULE. The book allows a diagonal step and prices it like any other
 * square, which lets a MOVE 6 character cover 17 m diagonally while covering 12
 * m straight — and the Range DV those two positions read is measured, not
 * counted, so the discrepancy is visible in play. A diagonal costs 1.5 squares
 * here. It is the only invented number in this module; everything else is
 * printed.
 */
export const DIAGONAL_COST = 1.5;
export const ORTHOGONAL_COST = 1;

export type Tile = { col: number; row: number };
/** `"col,row"`. Stable, and the key of every map in this module. */
export type TileKey = string;

export const tileKey = (tile: Tile): TileKey => `${tile.col},${tile.row}`;

/** How many whole tiles fit. A board with an odd metre extent keeps the
 * remainder as unreachable ground rather than half a square. */
export function gridExtent(arena: Arena): { cols: number; rows: number } {
  return {
    cols: Math.floor(arena.extent.width / TILE_METRES),
    rows: Math.floor(arena.extent.height / TILE_METRES),
  };
}

/** The metre position of a tile's centre — where a body actually stands. */
export function centreOf(tile: Tile): Point {
  return {
    x: tile.col * TILE_METRES + TILE_METRES / 2,
    y: tile.row * TILE_METRES + TILE_METRES / 2,
  };
}

/** The tile a metre position falls in, clamped onto the board. */
export function tileOf(arena: Arena, point: Point): Tile {
  const { cols, rows } = gridExtent(arena);
  return {
    col: Math.max(0, Math.min(cols - 1, Math.floor(point.x / TILE_METRES))),
    row: Math.max(0, Math.min(rows - 1, Math.floor(point.y / TILE_METRES))),
  };
}

/** Put a loose metre position on the nearest tile centre. Positions persisted
 * before the grid existed come back through here rather than being migrated. */
export function snapToGrid(arena: Arena, point: Point): Point {
  return centreOf(tileOf(arena, point));
}

/**
 * The nearest square a body can actually occupy.
 *
 * snapToGrid alone can put somebody inside a crate — a legacy position, or an
 * arena whose slots were authored before the lattice. This walks outward to the
 * closest open square instead.
 */
export function snapToOpenTile(arena: Arena, damage: CoverDamage, point: Point): Point {
  const blocked = blockedTiles(arena, damage);
  const start = tileOf(arena, point);
  if (!blocked.has(tileKey(start))) return centreOf(start);
  let best: Point | null = null;
  let bestGap = Infinity;
  for (const tile of tilesFor(arena)) {
    if (blocked.has(tileKey(tile))) continue;
    const centre = centreOf(tile);
    const gap = (centre.x - point.x) ** 2 + (centre.y - point.y) ** 2;
    if (gap < bestGap) {
      bestGap = gap;
      best = centre;
    }
  }
  return best ?? centreOf(start);
}

export function tilesFor(arena: Arena): Tile[] {
  const { cols, rows } = gridExtent(arena);
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) tiles.push({ col, row });
  }
  return tiles;
}

/**
 * Tiles a body cannot stand on: intact cover that blocks movement.
 *
 * Membership is decided by the tile's CENTRE, so an authored 2 m section that
 * sits on the lattice claims exactly the one square it occupies, and a legacy
 * piece straddling two squares claims both rather than leaving a body standing
 * inside a crate.
 */
export function blockedTiles(arena: Arena, damage: CoverDamage): Set<TileKey> {
  const obstacles = (arena.cover ?? []).filter(
    (piece) => piece.blocksMovement !== false && !coverDestroyed(piece, damage),
  );
  const blocked = new Set<TileKey>();
  for (const tile of tilesFor(arena)) {
    const c = centreOf(tile);
    if (
      obstacles.some(
        (piece) =>
          c.x > piece.rect.x &&
          c.x < piece.rect.x + piece.rect.width &&
          c.y > piece.rect.y &&
          c.y < piece.rect.y + piece.rect.height,
      )
    )
      blocked.add(tileKey(tile));
  }
  return blocked;
}

export type ReachedTile = {
  tile: Tile;
  /** Squares spent getting here — orthogonal steps 1, diagonal steps 1.5. */
  cost: number;
  /** The tile stepped from, or null for the origin. */
  from: TileKey | null;
};
/** Every tile reachable within an allowance, and how each was reached. */
export type ReachField = Map<TileKey, ReachedTile>;

const STEPS = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 },
  { col: 1, row: 1 },
  { col: 1, row: -1 },
  { col: -1, row: 1 },
  { col: -1, row: -1 },
];

/**
 * Dijkstra out from a tile, stopping at the Move allowance.
 *
 * A diagonal step also needs both of the squares it cuts between to be clear,
 * so nobody slips through the corner where two crates touch.
 */
export function reachableTiles(input: {
  arena: Arena;
  cover: CoverDamage;
  from: Tile;
  /** Squares, not metres. */
  allowance: number;
  /** Where other bodies are standing. Nobody shares a square. */
  occupied?: Point[];
}): ReachField {
  const { cols, rows } = gridExtent(input.arena);
  const blocked = blockedTiles(input.arena, input.cover);
  const origin = tileKey(input.from);
  // Their own square is theirs to leave; everybody else's is not somewhere to
  // stop, and not somewhere to walk through either — a body is in the way.
  for (const point of input.occupied ?? []) {
    const key = tileKey(tileOf(input.arena, point));
    if (key !== origin) blocked.add(key);
  }
  const field: ReachField = new Map([[origin, { tile: input.from, cost: 0, from: null }]]);
  if (!(input.allowance > 0)) return field;
  const open = new Set<TileKey>([origin]);
  const settled = new Set<TileKey>();
  const passable = (tile: Tile) =>
    tile.col >= 0 &&
    tile.row >= 0 &&
    tile.col < cols &&
    tile.row < rows &&
    !blocked.has(tileKey(tile));
  while (open.size) {
    let nearest: TileKey | null = null;
    for (const key of open) {
      if (nearest === null || field.get(key)!.cost < field.get(nearest)!.cost) nearest = key;
    }
    open.delete(nearest!);
    settled.add(nearest!);
    const here = field.get(nearest!)!;
    for (const step of STEPS) {
      const next = { col: here.tile.col + step.col, row: here.tile.row + step.row };
      const key = tileKey(next);
      if (settled.has(key) || !passable(next)) continue;
      const diagonal = step.col !== 0 && step.row !== 0;
      if (
        diagonal &&
        !(
          passable({ col: next.col, row: here.tile.row }) &&
          passable({ col: here.tile.col, row: next.row })
        )
      )
        continue;
      const cost = here.cost + (diagonal ? DIAGONAL_COST : ORTHOGONAL_COST);
      if (cost > input.allowance + 1e-9) continue;
      const known = field.get(key);
      if (known && known.cost <= cost) continue;
      field.set(key, { tile: next, cost, from: nearest! });
      open.add(key);
    }
  }
  return field;
}

/** The tiles walked to reach one square, origin first. Null when unreached. */
export function pathTo(field: ReachField, tile: Tile): Tile[] | null {
  const path: Tile[] = [];
  let key: TileKey | null = tileKey(tile);
  while (key) {
    const reached: ReachedTile | undefined = field.get(key);
    if (!reached) return null;
    path.unshift(reached.tile);
    key = reached.from;
  }
  return path.length ? path : null;
}
