/**
 * Night City as ground, not as points.
 *
 * `src/data/atlas/night-city-map.json` holds the city as a raster: one cell per
 * 20x20 block of the atlas map, each carrying the district that occupies it or
 * nothing where there is water, badlands or open page. It was traced from the
 * red dotted district boundaries the Night City Atlas prints over its own map
 * (see tools/atlas/trace_districts.py), so the shapes are the publisher's.
 *
 * This is what makes a direction answerable. A district is an interlocking,
 * irregular shape; asking which of two centre points lies further west says
 * nothing useful about which district you reach by walking west. Walking west
 * is a walk, so the engine walks it, cell by cell, and stops at the water.
 */
import raster from "@/data/atlas/night-city-map.json";

export type MapPoint = { x: number; y: number };

type RasterFile = {
  source: { note: string; cellPixels: number; masterWidth: number; masterHeight: number };
  grid: { width: number; height: number };
  districts: string[];
  runs: Array<[number, number]>;
};

const RASTER = raster as RasterFile;

export const GRID_WIDTH = RASTER.grid.width;
export const GRID_HEIGHT = RASTER.grid.height;

/** District keys by raster value. Value 0 means "not part of any district". */
const KEYS: string[] = RASTER.districts;

/** The run-length encoded grid, unpacked once. */
const CELLS: Uint8Array = (() => {
  const cells = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  let at = 0;
  for (const [value, length] of RASTER.runs) {
    cells.fill(value, at, at + length);
    at += length;
  }
  return cells;
})();

const VALUE_BY_KEY = new Map<string, number>(KEYS.map((key, i) => [key, i + 1]));

/** How much of the map one cell covers, as a percentage. Useful as a step size. */
export const CELL_SIZE_PERCENT = 100 / GRID_WIDTH;

function valueAt(column: number, row: number): number {
  if (column < 0 || row < 0 || column >= GRID_WIDTH || row >= GRID_HEIGHT) return 0;
  return CELLS[row * GRID_WIDTH + column]!;
}

function columnOf(x: number): number {
  return Math.floor((x / 100) * GRID_WIDTH);
}

function rowOf(y: number): number {
  return Math.floor((y / 100) * GRID_HEIGHT);
}

/** The district covering a point, or undefined where the city is not. */
export function districtAtPoint(point: MapPoint): string | undefined {
  const value = valueAt(columnOf(point.x), rowOf(point.y));
  return value ? KEYS[value - 1] : undefined;
}

/**
 * The district covering a point, allowing for a spot right on the waterline.
 * A dock, a pier and a bridge approach all sit on cells the trace reads as
 * water; the venue is still in a district, and this is which one.
 */
export function districtNearPoint(point: MapPoint, searchCells = 4): string | undefined {
  const here = districtAtPoint(point);
  if (here) return here;
  const column = columnOf(point.x);
  const row = rowOf(point.y);
  for (let ring = 1; ring <= searchCells; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        // Only the newly added edge of the square, so nearer rings win.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const value = valueAt(column + dx, row + dy);
        if (value) return KEYS[value - 1];
      }
    }
  }
  return undefined;
}

/** Whether a point is anywhere in the city at all, rather than water or edge. */
export function isCity(point: MapPoint): boolean {
  return districtAtPoint(point) !== undefined;
}

/** Every district that shares a border with this one. */
export function adjacentDistricts(key: string): string[] {
  const value = VALUE_BY_KEY.get(key);
  if (!value) return [];
  const found = new Set<number>();
  for (let row = 0; row < GRID_HEIGHT; row++) {
    for (let column = 0; column < GRID_WIDTH; column++) {
      if (valueAt(column, row) !== value) continue;
      for (const [dx, dy] of NEIGHBOUR_OFFSETS) {
        const other = valueAt(column + dx, row + dy);
        if (other && other !== value) found.add(other);
      }
    }
  }
  return [...found].map((v) => KEYS[v - 1]!);
}

const NEIGHBOUR_OFFSETS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export type WalkLeg = {
  /** The district this stretch of the walk crosses. */
  key: string;
  /** Where the walk entered it, and how far along the heading that was. */
  from: MapPoint;
  reached: number;
};

export type Walk = {
  /** Districts crossed, in the order they were walked through. */
  legs: WalkLeg[];
  /** The last point on the heading that is still in the city. */
  end: MapPoint;
  /** How far the walk got, as a percentage of the map's width. */
  distance: number;
  /** Why it stopped: the water's edge, or the edge of the mapped city. */
  stoppedBy: "water" | "edge";
};

/**
 * Walk from a point along a heading until the city runs out.
 *
 * The unit vector is in map space, where y grows southwards, so north is
 * {x: 0, y: -1}. Distances come back as a percentage of the map's width, the
 * same scale every other coordinate here uses.
 */
export function walk(from: MapPoint, heading: MapPoint): Walk {
  const step = CELL_SIZE_PERCENT / 2;
  const aspect = GRID_HEIGHT / GRID_WIDTH;
  const legs: WalkLeg[] = [];
  let end = from;
  let distance = 0;
  let stoppedBy: Walk["stoppedBy"] = "edge";
  let current: string | undefined = districtNearPoint(from);
  if (current) legs.push({ key: current, from, reached: 0 });

  // Twice the map's diagonal is further than any walk inside it can go.
  const limit = 200 * aspect;
  for (let travelled = step; travelled <= limit; travelled += step) {
    const point = {
      x: from.x + heading.x * travelled,
      // A percentage of the width is a smaller share of the height, so a step
      // south has to be scaled or the walk drifts.
      y: from.y + (heading.y * travelled) / aspect,
    };
    if (point.x < 0 || point.y < 0 || point.x > 100 || point.y > 100) {
      stoppedBy = "edge";
      break;
    }
    const here = districtAtPoint(point);
    if (!here) {
      // One empty cell can be a bridge deck or a sliver of canal drawn between
      // two blocks. Look ahead before calling the walk finished.
      const beyond = lookAhead(from, heading, travelled, step, aspect);
      if (!beyond) {
        stoppedBy = isWaterAhead(point) ? "water" : "edge";
        break;
      }
      continue;
    }
    end = point;
    distance = travelled;
    if (here !== current) {
      legs.push({ key: here, from: point, reached: travelled });
      current = here;
    }
  }
  return { legs, end, distance, stoppedBy };
}

/** Whether the city picks up again a short way further along the heading. */
function lookAhead(
  from: MapPoint,
  heading: MapPoint,
  travelled: number,
  step: number,
  aspect: number,
): boolean {
  // A bridge or a drawn-in channel is at most a few cells wide.
  for (let ahead = step; ahead <= CELL_SIZE_PERCENT * 3; ahead += step) {
    const point = {
      x: from.x + heading.x * (travelled + ahead),
      y: from.y + (heading.y * (travelled + ahead)) / aspect,
    };
    if (point.x < 0 || point.y < 0 || point.x > 100 || point.y > 100) return false;
    if (districtAtPoint(point)) return true;
  }
  return false;
}

/**
 * Water, or the end of the mapped world. The raster does not record which, so
 * this reads it off position: everything inside the drawn map that is not a
 * district is water, and the city is nowhere near the page edges.
 */
function isWaterAhead(point: MapPoint): boolean {
  return point.x > 2 && point.x < 98 && point.y > 2 && point.y < 98;
}
