import { describe, expect, it } from "vitest";
import {
  DIAGONAL_COST,
  TILE_METRES,
  arenaFor,
  blockedTiles,
  centreOf,
  combatMoveSquares,
  gridExtent,
  pathTo,
  reachableTiles,
  snapToOpenTile,
  tileKey,
  tileOf,
  type Arena,
} from "../index";

/** 10 x 10 squares of open ground, with one square of cover in the middle. */
const arena: Arena = {
  key: "test",
  label: "test",
  extent: { width: 20, height: 20 },
  playerStart: { x: 1, y: 1 },
  hostileSlots: [],
  cover: [
    {
      id: "crate",
      label: "crate",
      material: "steel",
      thickness: "thin",
      rect: { x: 8, y: 8, width: 2, height: 2 },
    },
  ],
};
const at = (col: number, row: number) => ({ col, row });
const cost = (field: ReturnType<typeof reachableTiles>, col: number, row: number) =>
  field.get(tileKey(at(col, row)))?.cost;

describe("the battlemat lattice", () => {
  it("is 2 m squares, centred on odd metres", () => {
    expect(TILE_METRES).toBe(2);
    expect(gridExtent(arena)).toEqual({ cols: 10, rows: 10 });
    expect(centreOf(at(0, 0))).toEqual({ x: 1, y: 1 });
    expect(centreOf(at(4, 4))).toEqual({ x: 9, y: 9 });
  });
  it("puts a loose metre position in the square that contains it, clamped to the board", () => {
    expect(tileOf(arena, { x: 0, y: 0 })).toEqual(at(0, 0));
    expect(tileOf(arena, { x: 5.9, y: 6.1 })).toEqual(at(2, 3));
    expect(tileOf(arena, { x: -40, y: 400 })).toEqual(at(0, 9));
  });
  it("keeps an odd metre extent as ground rather than half a square", () => {
    expect(gridExtent({ ...arena, extent: { width: 45, height: 60 } })).toEqual({
      cols: 22,
      rows: 30,
    });
  });
  it("blocks the squares intact cover stands on, and frees them when it is destroyed", () => {
    expect([...blockedTiles(arena, {})]).toEqual([tileKey(at(4, 4))]);
    expect(blockedTiles(arena, { crate: 1000 }).size).toBe(0);
    expect(
      blockedTiles({ ...arena, cover: [{ ...arena.cover![0]!, blocksMovement: false }] }, {}).size,
    ).toBe(0);
  });
  it("never leaves a body standing inside cover", () => {
    // The centre of the crate's own square is not somewhere to put anybody.
    expect(snapToOpenTile(arena, {}, { x: 9, y: 9 })).not.toEqual({ x: 9, y: 9 });
    expect(snapToOpenTile(arena, {}, { x: 9, y: 9 })).toEqual({ x: 9, y: 7 });
    expect(snapToOpenTile(arena, { crate: 1000 }, { x: 9, y: 9 })).toEqual({ x: 9, y: 9 });
    expect(snapToOpenTile(arena, {}, { x: 2.4, y: 3.7 })).toEqual({ x: 3, y: 3 });
  });
});

describe("what a Move Action reaches", () => {
  const field = (allowance: number, over: Parameters<typeof reachableTiles>[0] | null = null) =>
    reachableTiles({ arena, cover: {}, from: at(0, 0), allowance, ...(over ?? {}) });

  it("prices an orthogonal step at one square and a diagonal at one and a half", () => {
    const f = field(3);
    expect(cost(f, 1, 0)).toBe(1);
    expect(cost(f, 0, 1)).toBe(1);
    expect(cost(f, 1, 1)).toBe(DIAGONAL_COST);
    expect(cost(f, 3, 0)).toBe(3);
    // Three squares buys two diagonals, not three.
    expect(cost(f, 2, 2)).toBe(3);
    expect(cost(f, 3, 3)).toBeUndefined();
  });
  it("stops exactly at the allowance", () => {
    expect(cost(field(2), 2, 0)).toBe(2);
    expect(cost(field(2), 3, 0)).toBeUndefined();
    expect(field(0).size).toBe(1);
  });
  it("stays on the board", () => {
    const f = reachableTiles({ arena, cover: {}, from: at(0, 0), allowance: 40 });
    expect(f.size).toBe(gridExtent(arena).cols * gridExtent(arena).rows - 1); // minus the crate
    for (const { tile } of f.values()) {
      expect(tile.col).toBeGreaterThanOrEqual(0);
      expect(tile.col).toBeLessThan(10);
    }
  });
  it("walks around cover rather than through it", () => {
    const f = reachableTiles({ arena, cover: {}, from: at(3, 4), allowance: 4 });
    expect(f.has(tileKey(at(4, 4)))).toBe(false);
    expect(cost(f, 5, 4)).toBeGreaterThan(2); // the straight line is 2 squares
  });
  it("will not cut the corner where two blocked squares touch", () => {
    const pinch: Arena = {
      ...arena,
      cover: [
        { ...arena.cover![0]!, id: "a", rect: { x: 2, y: 4, width: 2, height: 2 } },
        { ...arena.cover![0]!, id: "b", rect: { x: 4, y: 2, width: 2, height: 2 } },
      ],
    };
    // (1,1) -> (2,2) is a diagonal between the two crates' corners.
    const f = reachableTiles({ arena: pinch, cover: {}, from: at(1, 1), allowance: 1.5 });
    expect(f.has(tileKey(at(2, 2)))).toBe(false);
  });
  it("treats other bodies as squares nobody may stand on or walk through", () => {
    const f = reachableTiles({
      arena,
      cover: {},
      from: at(0, 0),
      allowance: 2,
      occupied: [centreOf(at(1, 0)), centreOf(at(0, 0))],
    });
    expect(f.has(tileKey(at(1, 0)))).toBe(false);
    expect(f.has(tileKey(at(0, 0)))).toBe(true); // their own square is theirs to leave
    expect(f.has(tileKey(at(2, 0)))).toBe(false); // no route past the body in two squares
  });
  it("hands back the route it actually walked, origin first", () => {
    const f = field(6);
    const path = pathTo(f, at(3, 0))!;
    expect(path[0]).toEqual(at(0, 0));
    expect(path.at(-1)).toEqual(at(3, 0));
    expect(path).toHaveLength(4);
    expect(pathTo(f, at(9, 9))).toBeNull();
  });
});

describe("MOVE, in squares", () => {
  it("is the raw stat, and the printed metres are twice it", () => {
    expect(combatMoveSquares(6, "none")).toBe(6);
    expect(combatMoveSquares(6, "serious")).toBe(6);
    // Mortally Wounded is −6 MOVE with a floor of 1 square (CP:R pg. 186).
    expect(combatMoveSquares(6, "mortal")).toBe(1);
    expect(combatMoveSquares(0, "none")).toBe(0);
  });
});

describe("the courtyard, on the lattice", () => {
  const yard = arenaFor("night_shift_grid");
  it("puts every section on whole squares and every spawn on a centre", () => {
    expect(gridExtent(yard)).toEqual({ cols: 12, rows: 12 });
    expect(blockedTiles(yard, {}).size).toBe(yard.cover!.length);
    for (const point of [yard.playerStart, ...yard.hostileSlots])
      expect(snapToOpenTile(yard, {}, point)).toEqual(point);
  });
});
