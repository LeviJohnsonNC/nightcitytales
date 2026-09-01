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

/** One join between two districts: a street you cross, or a span you take. */
export type Border = {
  districts: [string, string];
  kind: "land" | "span";
  /** The bridge carrying a span, by landmark key. */
  via?: string;
  /** Distance between the two districts' map points, as a percentage of width. */
  lengthPercent: number;
};

type RasterFile = {
  source: { note: string; cellPixels: number; masterWidth: number; masterHeight: number };
  grid: { width: number; height: number };
  districts: string[];
  borders: Border[];
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

/**
 * Every join between two districts, traced from the map: where their ground
 * meets, plus the bridges the map names. This is the whole of how the city
 * connects, so a trip across town is a route through it rather than a hop.
 */
export const BORDERS: Border[] = RASTER.borders;

const EDGES = new Map<string, Border[]>();
for (const border of BORDERS) {
  for (const key of border.districts) {
    const list = EDGES.get(key);
    if (list) list.push(border);
    else EDGES.set(key, [border]);
  }
}

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

/** The other district at the far end of a join. */
function acrossFrom(border: Border, key: string): string {
  return border.districts[0] === key ? border.districts[1] : border.districts[0];
}

/**
 * Every district you can get to from this one without passing through a third:
 * its neighbours on the ground, and anywhere a bridge reaches directly.
 */
export function adjacentDistricts(key: string): string[] {
  return (EDGES.get(key) ?? []).map((border) => acrossFrom(border, key));
}

/** Only the districts whose ground actually touches this one. */
export function borderingDistricts(key: string): string[] {
  return (EDGES.get(key) ?? [])
    .filter((border) => border.kind === "land")
    .map((border) => acrossFrom(border, key));
}

export type Route = {
  /** The districts passed through, starting where you are and ending where you go. */
  districts: string[];
  /** The joins taken, in order. */
  borders: Border[];
  /** Total distance as a percentage of the map's width. */
  lengthPercent: number;
  /** The bridges crossed, by landmark key, in the order they were taken. */
  spans: string[];
};

/**
 * The shortest way from one district to another across the city's joins.
 *
 * Plain Dijkstra over 24 nodes — the graph is small enough that nothing cleverer
 * would earn its keep. Undefined only if the two are not connected at all, which
 * the trace refuses to produce.
 */
export function routeBetween(from: string, to: string): Route | undefined {
  if (!VALUE_BY_KEY.has(from) || !VALUE_BY_KEY.has(to)) return undefined;
  if (from === to) return { districts: [from], borders: [], lengthPercent: 0, spans: [] };

  const best = new Map<string, number>([[from, 0]]);
  const cameBy = new Map<string, Border>();
  const settled = new Set<string>();

  for (;;) {
    let here: string | undefined;
    let bestSoFar = Infinity;
    for (const [key, cost] of best) {
      if (!settled.has(key) && cost < bestSoFar) {
        here = key;
        bestSoFar = cost;
      }
    }
    if (here === undefined) return undefined;
    if (here === to) break;
    settled.add(here);
    for (const border of EDGES.get(here) ?? []) {
      const next = acrossFrom(border, here);
      const cost = bestSoFar + border.lengthPercent;
      if (cost < (best.get(next) ?? Infinity)) {
        best.set(next, cost);
        cameBy.set(next, border);
      }
    }
  }

  const districts = [to];
  const borders: Border[] = [];
  let walk = to;
  while (walk !== from) {
    const border = cameBy.get(walk);
    if (!border) return undefined;
    borders.unshift(border);
    walk = acrossFrom(border, walk);
    districts.unshift(walk);
  }
  return {
    districts,
    borders,
    lengthPercent: best.get(to) ?? 0,
    spans: borders.filter((b) => b.kind === "span").map((b) => b.via!),
  };
}

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
