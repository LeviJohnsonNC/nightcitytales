/**
 * Night City geography — the canonical map of the city as the game knows it.
 *
 * Pure TypeScript, like the rest of the engine: no React, no backend, no
 * feature imports. Every district, location, city manager, security provider
 * and gang here is transcribed from the official Night City Atlas (v1.01) into
 * `src/data/atlas/night-city.json`. Nothing in this module invents a place, a
 * name or a boundary; if a value is missing it is missing from that file.
 *
 * District SHAPES live next door, in `src/data/atlas/night-city-map.json`, and
 * are reached through `./cityGrid`. They were traced from the red dotted
 * boundaries the atlas prints over its own map, so they are the publisher's
 * lines too. Anything about direction, extent or "how far can I get" is decided
 * by walking that ground rather than by comparing two points.
 *
 * The only house rule is travel time, which the atlas does not print. It lives
 * in the `travel` block of the same JSON, flagged `houseRule: true`, so it is
 * tuned there rather than in code.
 */
import atlas from "@/data/atlas/night-city.json";
import {
  adjacentDistricts,
  borderingDistricts,
  districtNearPoint,
  nearestCity,
  routeBetween,
  walk,
  type Route,
  type Walk,
} from "./cityGrid";

export type AreaKey = "island" | "northside" | "mainland" | "southside";

export type Area = {
  key: AreaKey;
  name: string;
  blurb: string;
};

export type MapPoint = { x: number; y: number };

export type Place = {
  /** Lowercased location code, e.g. "b1". Stable key used in persistence. */
  key: string;
  /** Printed code, e.g. "B1". */
  code: string;
  name: string;
  blurb: string;
  /** Percentage coordinates on the stitched atlas map, when we could place it. */
  map?: MapPoint;
};

export type District = {
  /** District letter, e.g. "B". */
  code: string;
  /** Stable snake_case key, e.g. "upper_marina". */
  key: string;
  name: string;
  area: AreaKey;
  blurb: string;
  cityManager: string;
  security: string;
  gangs: string[];
  locations: Place[];
  map: MapPoint;
};

/** How fast one way of getting about the city is. A house rule, held in data. */
export type TravelModeRule = {
  label: string;
  kmh: number;
  /** Minutes spent before moving at all — hailing a cab and waiting for it. */
  readyMinutes: number;
  /** Minutes added for each bridge the route crosses. */
  spanMinutes: number;
};

export type MapImage = {
  image: string;
  width: number;
  height: number;
  note: string;
};

/**
 * A named piece of the city's geography — a bridge, a bay, the canal, the rock
 * offshore. The map prints these names; the atlas's location list does not, so
 * before this existed the player could read "San Morro Bridge" off the map and
 * the engine had never heard of it.
 */
export type Landmark = {
  key: string;
  name: string;
  kind: "bridge" | "bay" | "canal" | "reservoir" | "island";
  /** Where you are standing when you are at it. */
  districtKey: string;
  map: MapPoint;
  /** For a bridge, the district at each end. */
  connects?: string[];
};

/**
 * A major road. The map prints these names in black on the yellow carriageway;
 * the minor streets it sets in outlined white lettering, which no reader of the
 * image has managed to transcribe, so they are not here.
 */
export type Street = {
  key: string;
  name: string;
  /** Every district the road is labelled in, in the order the map labels them. */
  districts: string[];
  /** The points where the map writes the name. A road is a line; these are on it. */
  marks: MapPoint[];
};

type AtlasFile = {
  areas: Area[];
  districts: District[];
  landmarks: Landmark[];
  streets: Street[];
  map: MapImage;
  travel: {
    houseRule: boolean;
    note: string;
    scale: { metresPerPercent: number; metresPerBlock: number; note: string };
    modes: Record<string, TravelModeRule>;
    defaultMode: string;
    withinDistrictPercent: number;
    withinDistrictNote: string;
    defaultStart: string;
    defaultStartNote: string;
  };
  source: { title: string; publisher: string; note: string };
};

const ATLAS = atlas as unknown as AtlasFile;

export const AREAS: Area[] = ATLAS.areas;
export const DISTRICTS: District[] = ATLAS.districts;
export const LANDMARKS: Landmark[] = ATLAS.landmarks;
export const STREETS: Street[] = ATLAS.streets;
export const MAP_IMAGE: MapImage = ATLAS.map;

/**
 * The map is taller than it is wide, and every coordinate here is a percentage
 * of its own axis. One percent down the page is therefore a longer step than one
 * percent across it, so anything measuring a distance or a bearing has to put
 * both onto the same ruler first. This is that ruler: percentages of the width.
 */
const ASPECT = MAP_IMAGE.height / MAP_IMAGE.width;

function inWidthUnits(point: MapPoint): MapPoint {
  return { x: point.x, y: point.y * ASPECT };
}
export const ATLAS_SOURCE = ATLAS.source;

const DISTRICT_BY_KEY = new Map<string, District>();
const DISTRICT_BY_CODE = new Map<string, District>();
const PLACE_BY_KEY = new Map<string, { place: Place; district: District }>();
const LANDMARK_BY_KEY = new Map<string, Landmark>(LANDMARKS.map((l) => [l.key, l]));
const STREET_BY_KEY = new Map<string, Street>(STREETS.map((s) => [s.key, s]));

for (const district of DISTRICTS) {
  DISTRICT_BY_KEY.set(district.key, district);
  DISTRICT_BY_CODE.set(district.code.toUpperCase(), district);
  for (const place of district.locations) {
    PLACE_BY_KEY.set(place.key, { place, district });
  }
}

/** A district by key ("kabuki") or printed code ("O"). Undefined when unknown. */
export function getDistrict(keyOrCode: string): District | undefined {
  const raw = keyOrCode.trim();
  return (
    DISTRICT_BY_KEY.get(raw.toLowerCase().replace(/\s+/g, "_")) ??
    DISTRICT_BY_CODE.get(raw.toUpperCase())
  );
}

/** A named location by its code key ("b1"). Undefined when unknown. */
export function getPlace(key: string): Place | undefined {
  return PLACE_BY_KEY.get(key.trim().toLowerCase())?.place;
}

/** A named piece of geography by its key ("san_morro_bridge"). */
export function getLandmark(key: string): Landmark | undefined {
  return LANDMARK_BY_KEY.get(key.trim().toLowerCase());
}

/**
 * How far to look for ground, in grid cells, when a point lands on water. Four
 * cells is about a city block: enough to pull a spot off a pier or a bridge
 * approach, and not enough to move it somewhere the player would not recognise.
 */
const SHORE_SEARCH_CELLS = 4;

/**
 * How far to look for the shore of a named stretch of water. The map prints a
 * bay's name across the middle of the bay, so the shore is genuinely a few
 * hundred metres off — 200 m for San Morro Bay, 560 m for Laguna Reservoir.
 * Thirty-two cells covers the widest of them and stops well short of anywhere
 * that could be called somewhere else.
 */
const SHORE_REACH_CELLS = 32;

/**
 * Whether a landmark is somewhere a character can actually get to. An island in
 * the bay is not: Morro Rock is on the map, and reaching it needs a boat nobody
 * has written rules for yet.
 */
export function isReachable(landmark: Landmark): boolean {
  return landmark.kind !== "island";
}

/**
 * Whether a landmark is water. A bay, the canal and the reservoir are named on
 * the map and are perfectly good things to go and see, but nobody stands on
 * them: the map point is where the name is printed, out in the middle.
 */
export function isWater(landmark: Landmark): boolean {
  return landmark.kind === "bay" || landmark.kind === "canal" || landmark.kind === "reservoir";
}

/**
 * Where a character stands when they go to a landmark.
 *
 * For a bridge that is the bridge itself. For water it is the nearest shore on
 * the side the atlas files the landmark under, which is what "let's go and see
 * San Morro Bay" actually means. Nothing here can return a spot that is not
 * ground: if no shore is close enough the landmark has no standing point, and
 * the caller falls back to the district.
 */
export function standingPointFor(landmark: Landmark): MapPoint | undefined {
  if (!isWater(landmark)) return nearestCity(landmark.map, SHORE_SEARCH_CELLS);
  return (
    nearestCity(landmark.map, SHORE_REACH_CELLS, landmark.districtKey) ??
    nearestCity(landmark.map, SHORE_REACH_CELLS)
  );
}

/**
 * A point pulled onto ground somebody could stand on.
 *
 * Every position the engine commits goes through this. A walk already stops on
 * dry land, so in practice it changes nothing — it is here so that a coordinate
 * arriving from anywhere else (a landmark printed over a bay, an older saved
 * game, a future data slip) cannot put a character in the water.
 */
export function groundedPoint(point: MapPoint): MapPoint | undefined {
  return nearestCity(point, SHORE_SEARCH_CELLS);
}

/** A major road by its key ("republic_way"). */
export function getStreet(key: string): Street | undefined {
  return STREET_BY_KEY.get(key.trim().toLowerCase());
}

/** The major roads running through a district. */
export function streetsIn(districtKeyOrCode: string): Street[] {
  const district = getDistrict(districtKeyOrCode);
  if (!district) return [];
  return STREETS.filter((s) => s.districts.includes(district.key));
}

/** Where a road meets a district: the point the map labels it at there. */
export function streetPointIn(street: Street, districtKey: string): MapPoint | undefined {
  const at = street.districts.indexOf(districtKey);
  return at >= 0 ? street.marks[at] : street.marks[0];
}

/** Every named landmark that stands in a district. */
export function landmarksIn(districtKeyOrCode: string): Landmark[] {
  const district = getDistrict(districtKeyOrCode);
  if (!district) return [];
  return LANDMARKS.filter(
    (l) => l.districtKey === district.key || l.connects?.includes(district.key),
  );
}

/** The district a location sits in. */
export function districtOfPlace(key: string): District | undefined {
  return PLACE_BY_KEY.get(key.trim().toLowerCase())?.district;
}

/** Every named location inside a district. */
export function placesIn(districtKeyOrCode: string): Place[] {
  return getDistrict(districtKeyOrCode)?.locations ?? [];
}

/** The area a district belongs to. */
export function areaOf(districtKeyOrCode: string): Area | undefined {
  const district = getDistrict(districtKeyOrCode);
  if (!district) return undefined;
  return AREAS.find((a) => a.key === district.area);
}

/**
 * A campaign's position: always a district, optionally a named venue inside it.
 * `placeKey` is a location code key; `districtKey` is the district's key.
 */
export type Position = {
  districtKey: string;
  placeKey?: string;
  /** Set when the character is at a named piece of geography rather than a venue. */
  landmarkKey?: string;
  /** Set when the character is out on a named road rather than at an address. */
  streetKey?: string;
  /**
   * Exactly where they are standing, when that is not a named place. A district
   * is a kilometre across; "in Little Europe" and "on the waterfront at the
   * western edge of Little Europe" are not the same spot, and a walk between
   * them takes a quarter of an hour.
   */
  point?: MapPoint;
};

/**
 * How a position is written down. A stored location is a place key — a district,
 * a venue, a landmark, a road — optionally followed by an exact point:
 *
 *     little_europe                  the district, no finer
 *     a8                             Greta's
 *     little_europe@27.42,42.26      the waterfront at its western edge
 *
 * Every value written before points existed still reads correctly, which is why
 * the point rides along on the same column rather than beside it.
 */
const POINT_MARK = "@";

/** Write a position down: the place, and the exact spot when there is one. */
export function positionKey(place: string, point?: MapPoint | null): string {
  if (!point) return place;
  return `${place}${POINT_MARK}${point.x.toFixed(3)},${point.y.toFixed(3)}`;
}

/** The place half of a stored location, without any point. */
export function placeKeyOf(stored: string | null | undefined): string | undefined {
  if (!stored) return undefined;
  const place = stored.split(POINT_MARK)[0]!.trim().toLowerCase();
  return place || undefined;
}

function parsePoint(text: string): MapPoint | undefined {
  const [x, y] = text.split(",").map((n) => Number.parseFloat(n));
  if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  if (x < 0 || x > 100 || y < 0 || y > 100) return undefined;
  return { x, y };
}

/** Resolve a stored location string ("b1" or "upper_marina") into a Position. */
export function resolvePosition(stored: string | null | undefined): Position | undefined {
  if (!stored) return undefined;
  const raw = stored.trim().toLowerCase();

  const mark = raw.indexOf(POINT_MARK);
  if (mark >= 0) {
    const point = parsePoint(raw.slice(mark + 1));
    const base = resolvePosition(raw.slice(0, mark));
    if (!point) return base;
    // The district comes from where they actually are, so the two halves of a
    // stored location can never contradict each other.
    const districtKey = districtNearPoint(point) ?? base?.districtKey;
    if (!districtKey) return base;
    // The name in front of the mark still says what the spot is — the shore of
    // San Morro Bay is on the shore and is still San Morro Bay.
    return {
      districtKey,
      point,
      ...(base?.placeKey ? { placeKey: base.placeKey } : {}),
      ...(base?.landmarkKey ? { landmarkKey: base.landmarkKey } : {}),
      ...(base?.streetKey ? { streetKey: base.streetKey } : {}),
    };
  }

  const value = raw;
  const entry = PLACE_BY_KEY.get(value);
  if (entry) return { districtKey: entry.district.key, placeKey: entry.place.key };
  const landmark = LANDMARK_BY_KEY.get(value);
  if (landmark) return { districtKey: landmark.districtKey, landmarkKey: landmark.key };
  const street = STREET_BY_KEY.get(value);
  if (street) return { districtKey: street.districts[0]!, streetKey: street.key };
  const district = getDistrict(value);
  return district ? { districtKey: district.key } : undefined;
}

/** "The Afterlife, Upper Marina (The Island)" — the header line for a position. */
export function describePosition(stored: string | null | undefined): string {
  const position = resolvePosition(stored);
  if (!position) return "Somewhere in Night City";
  const district = getDistrict(position.districtKey);
  if (!district) return "Somewhere in Night City";
  const area = areaOf(district.key);
  const landmark = position.landmarkKey ? getLandmark(position.landmarkKey) : undefined;
  const here =
    (position.placeKey ? getPlace(position.placeKey)?.name : undefined) ??
    // You are never on the bay, so say where you are: looking at it.
    (landmark
      ? isWater(landmark)
        ? `the shore of ${landmark.name}`
        : landmark.name
      : undefined) ??
    (position.streetKey ? getStreet(position.streetKey)?.name : undefined);
  const tail = `${district.name}${area ? ` (${area.name})` : ""}`;
  if (here) return `${here}, ${tail}`;
  // Standing somewhere in a district that is a kilometre across. Say which part
  // of it, when they are far enough from the middle for that to mean something.
  const quarter = position.point ? quarterOf(position.point, district) : undefined;
  return quarter ? `${quarter} ${tail}` : tail;
}

/**
 * "the west of" — which part of a district a point is in, or nothing when it is
 * near enough to the middle that naming a quarter would be false precision.
 */
function quarterOf(point: MapPoint, district: District): string | undefined {
  const a = inWidthUnits(district.map);
  const b = inWidthUnits(point);
  const dx = b.x - a.x;
  const dy = -(b.y - a.y);
  if (Math.hypot(dx, dy) < QUARTER_MIN_OFFSET) return undefined;
  const degrees = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  const order: Compass[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const heading = order[Math.round(degrees / 45) % 8]!;
  return `the ${COMPASS_NAMES[heading]} of`;
}

/**
 * How far from a district's own map point a spot has to be before it counts as
 * being in one part of it rather than just in it, as a percentage of the map's
 * width. Two blocks; less than that and "the west of" is noise.
 */
const QUARTER_MIN_OFFSET = 2.7;

/**
 * A district counts as a combat zone when the atlas gives it no city manager
 * or names it a combat zone in its own description. The atlas is the authority;
 * we read it rather than keeping a second list.
 */
export function isCombatZone(districtKeyOrCode: string): boolean {
  const district = getDistrict(districtKeyOrCode);
  if (!district) return false;
  if (!district.cityManager) return true;
  return /combat zone/i.test(district.blurb) || /combat zone/i.test(district.name);
}

const DEFAULT_START_DISTRICT: string = ATLAS.travel.defaultStart;

/** The ways of getting about that the atlas's house rules define. */
export const TRAVEL_MODES: string[] = Object.keys(ATLAS.travel.modes);
export const DEFAULT_MODE: string = ATLAS.travel.defaultMode;

/** "on foot", "by cab" — how to say a mode in a sentence. */
export function modeLabel(mode: string): string {
  return ATLAS.travel.modes[mode]?.label ?? mode;
}

/** "walking", "cab", "taxi" -> a mode the rules know. Undefined when unclear. */
export function parseMode(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  const raw = input.trim().toLowerCase();
  if (!raw) return undefined;
  if (/\b(foot|walk|walking|walked|hoof|stroll)\b/.test(raw)) return "foot";
  if (/\b(cab|taxi|car|drive|driving|drove|ride|rode|bike|motorbike)\b/.test(raw)) return "cab";
  return TRAVEL_MODES.includes(raw) ? raw : undefined;
}

function modeRule(mode: string | null | undefined): TravelModeRule {
  const rules = ATLAS.travel.modes;
  return rules[mode ?? ""] ?? rules[ATLAS.travel.defaultMode]!;
}

/** Map distance to minutes, at the speed the mode moves. */
function minutesFor(percent: number, rule: TravelModeRule): number {
  const metres = percent * ATLAS.travel.scale.metresPerPercent;
  return metres / ((rule.kmh * 1000) / 60);
}

/**
 * Two spots closer together than this are the same spot: a tenth of a block, and
 * nobody spends a minute crossing it. A percentage of the map's width.
 */
const SAME_SPOT = 0.15;

export type Trip = {
  minutes: number;
  mode: string;
  /** The districts crossed on the way, when the trip leaves this one. */
  route?: Route;
};

/**
 * What a trip actually costs.
 *
 * The city is a graph of districts joined by streets and bridges, so a trip is a
 * route through it and its price is the distance covered at the speed of
 * whatever the character is travelling by, plus what it costs to get going and
 * to cross each span. All of it is a house rule and all of it lives in the
 * atlas JSON's `travel` block, which says so.
 */
export function travelTrip(
  from: string | null | undefined,
  to: string,
  mode: string | null | undefined = undefined,
): Trip {
  const chosen = mode && ATLAS.travel.modes[mode] ? mode : ATLAS.travel.defaultMode;
  const rule = modeRule(chosen);
  const a = resolvePosition(from);
  const b = resolvePosition(to);
  if (!b) return { minutes: 0, mode: chosen };
  const origin = a?.districtKey ?? DEFAULT_START_DISTRICT;

  if (origin === b.districtKey) {
    // Still in the same district, which is a kilometre across. When both ends
    // are pinned to a spot, the distance between those spots is what the trip
    // costs; a walk to the far edge is not the same as crossing the road.
    const here = mapPointOf(from);
    const there = mapPointOf(to);
    const apart =
      here && there ? Math.hypot(there.x - here.x, (there.y - here.y) * ASPECT) : undefined;
    if (apart !== undefined) {
      if (apart < SAME_SPOT) return { minutes: 0, mode: chosen };
      return {
        minutes: Math.max(1, Math.round(minutesFor(apart, rule) + rule.readyMinutes)),
        mode: chosen,
      };
    }
    const minutes = minutesFor(ATLAS.travel.withinDistrictPercent, rule) + rule.readyMinutes;
    return { minutes: Math.round(minutes), mode: chosen };
  }

  const route = routeBetween(origin, b.districtKey);
  if (!route) return { minutes: Math.round(rule.readyMinutes), mode: chosen };
  const minutes =
    minutesFor(route.lengthPercent, rule) +
    rule.readyMinutes +
    route.spans.length * rule.spanMinutes;
  return { minutes: Math.round(minutes), mode: chosen, route };
}

/** Just the minutes, for the callers that only want the price. */
export function travelMinutes(
  from: string | null | undefined,
  to: string,
  mode: string | null | undefined = undefined,
): number {
  return travelTrip(from, to, mode).minutes;
}

/** The way from one place to another, as districts and the joins between them. */
export function routeTo(from: string | null | undefined, to: string): Route | undefined {
  const a = resolvePosition(from)?.districtKey ?? DEFAULT_START_DISTRICT;
  const b = resolvePosition(to)?.districtKey;
  return b ? routeBetween(a, b) : undefined;
}

/**
 * Where a character stands when nothing has said otherwise. A house rule, held
 * in the atlas JSON beside the travel table rather than hardcoded here.
 */
export const DEFAULT_START: string = ATLAS.travel.defaultStart;

/** Whether a destination exists on the map at all. Unknown places are refused. */
export function canTravel(to: string): boolean {
  return resolvePosition(to) !== undefined;
}

/**
 * Resolve whatever the narrator called the destination — a stored key ("b1"),
 * a printed code ("B1", "O"), a district name ("Kabuki") or a venue name
 * ("The Afterlife") — into a canonical stored location key. Undefined when the
 * name is not on the map; nothing here guesses.
 */
export function resolveDestination(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  const raw = input.trim();
  if (!raw) return undefined;

  const direct = resolvePosition(raw);
  if (direct) return direct.placeKey ?? direct.districtKey;

  const needle = raw.toLowerCase().replace(/^the\s+/, "");
  const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, "");

  for (const district of DISTRICTS) {
    if (norm(district.name) === needle) return district.key;
  }
  for (const district of DISTRICTS) {
    for (const place of district.locations) {
      if (norm(place.name) === needle) return place.key;
    }
  }
  for (const landmark of LANDMARKS) {
    if (norm(landmark.name) === needle) return landmark.key;
  }
  for (const street of STREETS) {
    if (norm(street.name) === needle) return street.key;
  }
  return undefined;
}

/**
 * The destinations worth putting in front of the narrator: the venues underfoot,
 * the named geography within reach, every district, and anywhere the character
 * has already been.
 *
 * This is a prompt list, not a gate. The engine resolves a destination against
 * the whole atlas, so a player naming somewhere they have never been still gets
 * taken there — the list exists so the narrator has good options to hand, not to
 * fence the player in.
 */
export function reachableDestinations(
  from: string | null | undefined,
  known: readonly string[] = [],
): Array<{ key: string; name: string }> {
  const out: Array<{ key: string; name: string }> = [];
  const seen = new Set<string>();
  const add = (key: string, name: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, name });
  };

  const here = resolvePosition(from);
  if (here) {
    for (const place of placesIn(here.districtKey)) add(place.key, place.name);
    for (const landmark of landmarksIn(here.districtKey)) {
      if (isReachable(landmark)) add(landmark.key, landmark.name);
    }
    for (const street of streetsIn(here.districtKey)) add(street.key, street.name);
  }
  // Somewhere they have stood before, they can name and go back to.
  for (const stored of known) {
    const position = resolvePosition(stored);
    if (!position) continue;
    if (position.placeKey) {
      const place = getPlace(position.placeKey);
      if (place) add(place.key, place.name);
    } else if (position.landmarkKey) {
      const landmark = getLandmark(position.landmarkKey);
      if (landmark) add(landmark.key, landmark.name);
    }
  }
  for (const landmark of LANDMARKS) {
    if (isReachable(landmark)) add(landmark.key, landmark.name);
  }
  for (const district of DISTRICTS) add(district.key, district.name);
  return out;
}

// ---------------------------------------------------------------------------
// The compass. Direction is geometry, and geometry belongs in the engine: the
// coordinates below are the atlas's own printed positions, so "west" means the
// same thing to the model, the map pin and the ledger.
// ---------------------------------------------------------------------------

export type Compass = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

const COMPASS_NAMES: Record<Compass, string> = {
  N: "north",
  NE: "northeast",
  E: "east",
  SE: "southeast",
  S: "south",
  SW: "southwest",
  W: "west",
  NW: "northwest",
};

/** "west" -> "W". Accepts full words, abbreviations and casing. */
export function parseDirection(input: string | null | undefined): Compass | undefined {
  if (!input) return undefined;
  const raw = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!raw) return undefined;
  for (const [code, name] of Object.entries(COMPASS_NAMES)) {
    if (raw === name || raw === code.toLowerCase()) return code as Compass;
  }
  return undefined;
}

/** The plain English name of a heading. */
export function directionName(direction: Compass): string {
  return COMPASS_NAMES[direction];
}

/**
 * The map point for a stored location: the exact spot when one was written
 * down, otherwise its own pin, otherwise its district's.
 *
 * This is what the pin renders on, so it is the last place a character can be
 * put somewhere they could not be. An exact spot comes first — it is the most
 * that is known about where they are — and anything that would land in open
 * water gives way to the district instead.
 */
export function mapPointOf(stored: string | null | undefined): MapPoint | undefined {
  const position = resolvePosition(stored);
  const district = position ? getDistrict(position.districtKey)?.map : undefined;
  if (!position) return undefined;
  const named = (): MapPoint | undefined => {
    if (position.point) return position.point;
    if (position.placeKey) return getPlace(position.placeKey)?.map;
    if (position.landmarkKey) {
      const landmark = getLandmark(position.landmarkKey);
      // A bay's pin is the middle of the bay, where its name is printed. Where
      // you would be standing is the shore.
      if (landmark) return standingPointFor(landmark) ?? landmark.map;
    }
    if (position.streetKey) {
      const street = getStreet(position.streetKey);
      return street ? streetPointIn(street, position.districtKey) : undefined;
    }
    return undefined;
  };
  const point = named();
  if (!point) return district;
  // A dock, a pier or a bridge approach sits on a cell the trace reads as
  // water, and belongs there. Somewhere with no city near it at all does not.
  return districtNearPoint(point) ? point : district;
}

/** Compass bearing in degrees clockwise from north. Map y grows southwards. */
export function bearingBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | undefined {
  const start = mapPointOf(from);
  const end = mapPointOf(to);
  if (!start || !end) return undefined;
  const a = inWidthUnits(start);
  const b = inWidthUnits(end);
  const dx = b.x - a.x;
  const dy = -(b.y - a.y);
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return undefined;
  const degrees = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/** Which way one place lies from another. Undefined when they are the same spot. */
export function directionBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): Compass | undefined {
  const bearing = bearingBetween(from, to);
  if (bearing === undefined) return undefined;
  const order: Compass[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(bearing / 45) % 8;
  return order[index];
}

/** Straight-line distance as a percentage of the map's diagonal. */
export function mapDistance(
  from: string | null | undefined,
  to: string | null | undefined,
): number | undefined {
  const start = mapPointOf(from);
  const end = mapPointOf(to);
  if (!start || !end) return undefined;
  const a = inWidthUnits(start);
  const b = inWidthUnits(end);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export type Neighbour = {
  key: string;
  name: string;
  direction: Compass;
  minutes: number;
  distance: number;
};

/**
 * The districts this one actually borders, each tagged with its heading and
 * travel time. Sharing a boundary is the test, not being a short hop away
 * across a bay: this is the list the narrator is told to describe directions
 * from, and "north, 25 min" should mean somewhere you can walk to.
 */
export function neighboursOf(from: string | null | undefined, limit = 6): Neighbour[] {
  const here = resolvePosition(from);
  if (!here) return [];
  const out: Neighbour[] = [];
  for (const key of adjacentDistricts(here.districtKey)) {
    const district = getDistrict(key);
    const direction = directionBetween(here.districtKey, key);
    const distance = mapDistance(here.districtKey, key);
    if (!district || !direction || distance === undefined) continue;
    out.push({
      key,
      name: district.name,
      direction,
      minutes: travelMinutes(from, key),
      distance,
    });
  }
  out.sort((a, b) => a.distance - b.distance);
  return out.slice(0, limit);
}

/** How the eight headings point in map space, where y grows southwards. */
const DIRECTION_VECTORS: Record<Compass, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  NE: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  E: { x: 1, y: 0 },
  SE: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  S: { x: 0, y: 1 },
  SW: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  W: { x: -1, y: 0 },
  NW: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
};

/**
 * Set off from a location on a heading and see how far the city lets you get.
 * This is the walk itself: which districts it passes through, where it ends,
 * and whether it ended at the water or at the edge of the map.
 */
export function walkFrom(
  from: string | null | undefined,
  direction: Compass,
  goFar?: number,
): Walk | undefined {
  const origin = mapPointOf(from);
  if (!origin) return undefined;
  return walk(origin, DIRECTION_VECTORS[direction], goFar);
}

/**
 * The districts that genuinely lie that way and that you can actually get to,
 * nearest first.
 *
 * Two things have to hold. The district has to actually bear that way — the
 * test is `directionBetween`, the same function that names a heading, so a
 * district is west of here exactly when the engine would call it west. There is
 * one definition of direction and this is it; a wider cone would let "go west"
 * pick somewhere the engine itself calls southwest, which is how this went
 * wrong before. And a route has to exist across the city's streets and bridges,
 * so a heading cannot pick somewhere on the far side of a bay with no way over.
 *
 * The route is what makes this different from marching in a straight line: the
 * water stops a walk, and a bridge does not stop a journey.
 */
export function districtsInDirection(
  from: string | null | undefined,
  direction: Compass,
): Array<{ key: string; name: string; reach: number; minutes: number }> {
  const start = mapPointOf(from);
  if (!start) return [];
  const origin = inWidthUnits(start);
  const here = resolvePosition(from)?.districtKey;
  const vector = DIRECTION_VECTORS[direction];
  const out: Array<{ key: string; name: string; reach: number; minutes: number }> = [];
  for (const district of DISTRICTS) {
    if (district.key === here) continue;
    const point = inWidthUnits(district.map);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    if (Math.hypot(dx, dy) < 0.01) continue;
    if (directionBetween(from, district.key) !== direction) continue;
    if (!routeTo(from, district.key)) continue;
    const reach = dx * vector.x + dy * vector.y;
    out.push({
      key: district.key,
      name: district.name,
      reach,
      minutes: travelMinutes(from, district.key),
    });
  }
  out.sort((a, b) => a.reach - b.reach);
  return out;
}

/**
 * Where "as far east as I can go" ends up: the district furthest along the
 * heading that the city can actually carry you to. Undefined when the heading
 * leads nowhere, which is when the walk to the edge takes over.
 */
export function furthestInDirection(
  from: string | null | undefined,
  direction: Compass,
): string | undefined {
  const candidates = districtsInDirection(from, direction);
  return candidates.length ? candidates[candidates.length - 1]!.key : undefined;
}

/** The first district that way — one step along the heading. */
export function nextInDirection(
  from: string | null | undefined,
  direction: Compass,
): string | undefined {
  const candidates = districtsInDirection(from, direction);
  return candidates.length ? candidates[0]!.key : undefined;
}

/**
 * What stops you heading that way, when nothing does: the water, or the edge of
 * the map. Only meaningful when the heading yields no district at all.
 */
export function limitInDirection(
  from: string | null | undefined,
  direction: Compass,
): "water" | "edge" | undefined {
  const stoppedBy = walkFrom(from, direction)?.stoppedBy;
  // With no distance asked for a walk never "arrives"; it runs until stopped.
  return stoppedBy === "arrived" ? undefined : stoppedBy;
}

/**
 * How far a walk has to cover before it counts as having gone somewhere, as a
 * percentage of the map's width. Below this the character is already standing
 * at the edge and heading that way is not a move.
 */
const WALK_WORTH_TAKING = 2;

/** A city block, as a percentage of the map's width. Measured, not guessed. */
export const BLOCK_PERCENT =
  ATLAS.travel.scale.metresPerBlock / ATLAS.travel.scale.metresPerPercent;

/** Turn a distance in blocks into one in percent of the map's width. */
export function blocksToPercent(blocks: number): number {
  return blocks * BLOCK_PERCENT;
}

export type TravelIntent = {
  from: string | null | undefined;
  /** How they said they were getting there: "walk", "cab". Cab if unsaid. */
  mode?: string | null | undefined;
  /**
   * How far they said to go, in city blocks. Set when the player put a distance
   * on it — "about seven blocks", "a couple of streets down". The heading then
   * carries them that far rather than to the next district.
   */
  blocks?: number | null | undefined;
  /** A name the narrator proposed, if any. */
  destination?: string | null | undefined;
  /** A heading the player asked for, if any. */
  direction?: string | null | undefined;
  /** "far" means as far as the city allows in that heading. */
  extent?: "near" | "far" | null | undefined;
};

export type Arrival = {
  ok: true;
  to: string;
  direction?: Compass;
  minutes: number;
  /** How they travelled, and what it was priced as. */
  mode: string;
  /** The districts crossed and the bridges taken, when the trip leaves this one. */
  route?: Route;
  /**
   * Set when the heading ran out before any district did: the character
   * walked as far that way as the city allows and is standing at the edge
   * of it. The narration is told, so "as far west as I can" reads as
   * arriving at the waterfront rather than as nothing happening.
   */
  stoppedAt?: "water" | "edge" | "arrived";
  /** How far the trip covered on the ground, in city blocks, when it was a walk along a heading. */
  blocks?: number;
};

export type TravelDecision = Arrival | { ok: false; reason: string };

/**
 * Decide a move. When the player named a heading the engine picks the district;
 * when the narrator named a place as well, the bearing has to agree with the
 * heading or the move is refused. The model proposes, the engine decides.
 */
export function resolveTravelIntent(intent: TravelIntent): TravelDecision {
  const direction = parseDirection(intent.direction);
  const mode = parseMode(intent.mode) ?? DEFAULT_MODE;
  const arrive = (to: string, heading?: Compass): Arrival => {
    const trip = travelTrip(intent.from, to, mode);
    return {
      ok: true,
      to,
      minutes: trip.minutes,
      mode: trip.mode,
      ...(heading ? { direction: heading } : {}),
      ...(trip.route ? { route: trip.route } : {}),
    };
  };
  const asked = intent.destination?.trim();
  const named = asked ? resolveDestination(asked) : undefined;

  // Some of the map is on the map without being somewhere you can walk to.
  const landmark = named ? getLandmark(named) : undefined;
  if (landmark && !isReachable(landmark)) {
    return {
      ok: false,
      reason: `${landmark.name} is out in the water. There is no getting to it on foot or by cab.`,
    };
  }

  // A destination was named and it is not on the map. That is the answer, and
  // it stays the answer even when a heading came with it: quietly dropping the
  // name and setting off on the heading instead lands the character somewhere
  // nobody asked to go, which is worse than being told the place is unknown.
  if (asked && !named) {
    return {
      ok: false,
      reason: `"${asked}" is not a place on the Night City map.`,
    };
  }

  // Somewhere was named, so that is where they are going. A heading offered
  // alongside it is how the player pictured the way there, not a condition on
  // it — "south to the Pacifica Bridge" is a request for the bridge, and
  // refusing it because the bridge is south-EAST is answering the wrong
  // question. The true heading is reported back instead.
  if (named) {
    // Going to see a bay means going to its shore. Writing the shore down as
    // part of the position is what stops the pin from ending up in the water.
    const shore = landmark ? standingPointFor(landmark) : undefined;
    const to = shore ? positionKey(named, shore) : named;
    return arrive(to, directionBetween(intent.from, named) ?? undefined);
  }

  if (direction) {
    const here = resolvePosition(intent.from)?.districtKey;

    // A distance was asked for. Go that far along the heading and stop, which
    // is the only way "about seven blocks south" can mean seven blocks.
    if (intent.blocks && intent.blocks > 0 && here) {
      const wanted = blocksToPercent(intent.blocks);
      const journey = bestWayAlong(intent.from, direction, wanted);
      // Asking for seven blocks and getting a cell and a half is not a short
      // trip, it is a refusal wearing a trip's clothes: the cab still charges
      // the seven minutes it takes to turn up. Say the water is there instead.
      // A journey that covers a block or more is a real one however short of
      // the asking it falls, so only the standing-still case is refused.
      const gotNowhere = !journey || journey.distance < Math.min(BLOCK_PERCENT, wanted);
      if (gotNowhere) {
        return {
          ok: false,
          reason: `There is no going ${directionName(direction)} from here — ${edgeName(journey?.stoppedBy)} is right there.`,
        };
      }
      const end = groundedPoint(journey.end) ?? journey.end;
      const landed = districtNearPoint(end) ?? here;
      return {
        ...arrive(positionKey(landed, end), journey.heading),
        ...(journey.stoppedBy === "arrived" ? {} : { stoppedAt: journey.stoppedBy }),
        blocks: Math.round((journey.distance / BLOCK_PERCENT) * 10) / 10,
      };
    }

    const picked =
      intent.extent === "far"
        ? furthestInDirection(intent.from, direction)
        : nextInDirection(intent.from, direction);
    if (!picked) {
      // No district that way, but that does not mean no walk. A district is
      // wide, and heading for its far edge is a real thing to do: the character
      // crosses it and fetches up against the water or the city limits, and
      // ends up standing there rather than back where they started.
      const journey = walkFrom(intent.from, direction);
      if (journey && here && journey.distance >= WALK_WORTH_TAKING) {
        const end = groundedPoint(journey.end) ?? journey.end;
        const landed = districtNearPoint(end) ?? here;
        return {
          ...arrive(positionKey(landed, end), direction),
          stoppedAt: journey.stoppedBy,
          blocks: Math.round((journey.distance / BLOCK_PERCENT) * 10) / 10,
        };
      }
      return {
        ok: false,
        reason: `There is no going ${directionName(direction)} from here — ${edgeName(journey?.stoppedBy)} is right there.`,
      };
    }
    return arrive(picked, direction);
  }

  return { ok: false, reason: "Nowhere was named and no heading was given." };
}

/**
 * Going a set distance a given way, allowing for the fact that streets do not
 * run in perfect compass lines.
 *
 * Straight is tried first. If the water cuts it short — and on a coast that
 * bends, due south from the waterfront is cut short almost at once — the two
 * neighbouring headings are tried too, and the one that gets furthest wins. The
 * heading it actually took comes back with it, so nothing claims to have gone
 * due south when it went south-east.
 */
function bestWayAlong(
  from: string | null | undefined,
  direction: Compass,
  goFar: number,
): (Walk & { heading: Compass }) | undefined {
  const order: Compass[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const at = order.indexOf(direction);
  const straight = walkFrom(from, direction, goFar);
  if (!straight) return undefined;
  if (straight.stoppedBy === "arrived") return { ...straight, heading: direction };

  let best: Walk & { heading: Compass } = { ...straight, heading: direction };
  for (const step of [-1, 1]) {
    const heading = order[(at + step + 8) % 8]!;
    const tried = walkFrom(from, heading, goFar);
    if (!tried) continue;
    // Only worth taking if it genuinely gets further along.
    if (tried.distance > best.distance + SAME_SPOT) best = { ...tried, heading };
    if (best.stoppedBy === "arrived") break;
  }
  return best;
}

/** What stopped a walk, said the way a person would say it. */
function edgeName(stoppedBy: Walk["stoppedBy"] | undefined): string {
  return stoppedBy === "water" ? "the water" : "the edge of the city";
}

/**
 * Every match key for narration linking: district names first, then location
 * names. Longest first so "Night City Firestation #2" beats "Night City".
 */
export const PLACE_MATCH_KEYS: string[] = (() => {
  const keys = new Set<string>();
  for (const district of DISTRICTS) {
    keys.add(district.name);
    for (const place of district.locations) keys.add(place.name);
  }
  for (const landmark of LANDMARKS) keys.add(landmark.name);
  for (const street of STREETS) keys.add(street.name);
  return [...keys].filter((k) => k.length >= 4).sort((a, b) => b.length - a.length);
})();

export type PlaceMention =
  | { kind: "district"; district: District }
  | { kind: "place"; place: Place; district: District }
  | { kind: "landmark"; landmark: Landmark; district: District }
  | { kind: "street"; street: Street; district: District };

/** Curly and straight apostrophes are the same character for lookups. */
function normalizeName(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'");
}

/** Look up what a piece of narration text is naming, if anything. */
export function resolvePlaceMention(text: string): PlaceMention | undefined {
  const needle = normalizeName(text);
  for (const district of DISTRICTS) {
    if (normalizeName(district.name) === needle) return { kind: "district", district };
  }
  for (const district of DISTRICTS) {
    for (const place of district.locations) {
      if (normalizeName(place.name) === needle) return { kind: "place", place, district };
    }
  }
  for (const landmark of LANDMARKS) {
    if (normalizeName(landmark.name) !== needle) continue;
    const district = getDistrict(landmark.districtKey);
    if (district) return { kind: "landmark", landmark, district };
  }
  for (const street of STREETS) {
    if (normalizeName(street.name) !== needle) continue;
    const district = getDistrict(street.districts[0]!);
    if (district) return { kind: "street", street, district };
  }
  return undefined;
}
