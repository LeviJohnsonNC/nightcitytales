/**
 * Night City geography — the canonical map of the city as the game knows it.
 *
 * Pure TypeScript, like the rest of the engine: no React, no backend, no
 * feature imports. Every district, location, city manager, security provider
 * and gang here is transcribed from the official Night City Atlas (v1.01) into
 * `src/data/atlas/night-city.json`. Nothing in this module invents a place, a
 * name or a boundary; if a value is missing it is missing from that file.
 *
 * The only house rule is travel time, which the atlas does not print. It lives
 * in the `travel` block of the same JSON, flagged `houseRule: true`, so it is
 * tuned there rather than in code.
 */
import atlas from "@/data/atlas/night-city.json";

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

export type MapImage = {
  image: string;
  width: number;
  height: number;
  note: string;
};

type AtlasFile = {
  areas: Area[];
  districts: District[];
  map: MapImage;
  travel: {
    houseRule: boolean;
    note: string;
    withinDistrict: number;
    betweenDistrictsSameArea: number;
    betweenAreas: number;
    acrossCity: number;
    defaultStart: string;
    defaultStartNote: string;
  };
  source: { title: string; publisher: string; note: string };
};

const ATLAS = atlas as unknown as AtlasFile;

export const AREAS: Area[] = ATLAS.areas;
export const DISTRICTS: District[] = ATLAS.districts;
export const MAP_IMAGE: MapImage = ATLAS.map;
export const ATLAS_SOURCE = ATLAS.source;

const DISTRICT_BY_KEY = new Map<string, District>();
const DISTRICT_BY_CODE = new Map<string, District>();
const PLACE_BY_KEY = new Map<string, { place: Place; district: District }>();

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
};

/** Resolve a stored location string ("b1" or "upper_marina") into a Position. */
export function resolvePosition(stored: string | null | undefined): Position | undefined {
  if (!stored) return undefined;
  const value = stored.trim().toLowerCase();
  const entry = PLACE_BY_KEY.get(value);
  if (entry) return { districtKey: entry.district.key, placeKey: entry.place.key };
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
  const venue = position.placeKey ? getPlace(position.placeKey)?.name : undefined;
  const tail = `${district.name}${area ? ` (${area.name})` : ""}`;
  return venue ? `${venue}, ${tail}` : tail;
}

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

/**
 * House-rule travel time in minutes between two stored locations. Same venue is
 * free; same district is a short hop; crossing areas costs more. Values come
 * from the atlas JSON `travel` block, which is labelled as a house rule.
 */
export function travelMinutes(from: string | null | undefined, to: string): number {
  const t = ATLAS.travel;
  const a = resolvePosition(from);
  const b = resolvePosition(to);
  if (!b) return 0;
  if (!a) return t.betweenDistrictsSameArea;
  if (a.districtKey === b.districtKey) {
    return a.placeKey === b.placeKey ? 0 : t.withinDistrict;
  }
  const areaA = getDistrict(a.districtKey)?.area;
  const areaB = getDistrict(b.districtKey)?.area;
  if (areaA === areaB) return t.betweenDistrictsSameArea;
  if (areaA === "island" || areaB === "island") return t.betweenAreas;
  return t.acrossCity;
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
  return undefined;
}

/**
 * The destinations a Life turn is allowed to name: every district, plus the
 * named venues in the district the character is standing in. The list the model
 * gets, and the list the engine checks against.
 */
export function reachableDestinations(from: string | null | undefined): Array<{
  key: string;
  name: string;
}> {
  const out: Array<{ key: string; name: string }> = [];
  const here = resolvePosition(from);
  if (here) {
    for (const place of placesIn(here.districtKey)) out.push({ key: place.key, name: place.name });
  }
  for (const district of DISTRICTS) out.push({ key: district.key, name: district.name });
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

/** The map point for a stored location: its own pin, or its district's. */
export function mapPointOf(stored: string | null | undefined): MapPoint | undefined {
  const position = resolvePosition(stored);
  if (!position) return undefined;
  if (position.placeKey) {
    const point = getPlace(position.placeKey)?.map;
    if (point) return point;
  }
  return getDistrict(position.districtKey)?.map;
}

/** Compass bearing in degrees clockwise from north. Map y grows southwards. */
export function bearingBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | undefined {
  const a = mapPointOf(from);
  const b = mapPointOf(to);
  if (!a || !b) return undefined;
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
  const a = mapPointOf(from);
  const b = mapPointOf(to);
  if (!a || !b) return undefined;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export type Neighbour = {
  key: string;
  name: string;
  direction: Compass;
  minutes: number;
  distance: number;
};

/** The nearest districts, each tagged with its heading and travel time. */
export function neighboursOf(from: string | null | undefined, limit = 6): Neighbour[] {
  const here = resolvePosition(from);
  if (!here) return [];
  const out: Neighbour[] = [];
  for (const district of DISTRICTS) {
    if (district.key === here.districtKey) continue;
    const direction = directionBetween(from, district.key);
    const distance = mapDistance(from, district.key);
    if (!direction || distance === undefined) continue;
    out.push({
      key: district.key,
      name: district.name,
      direction,
      minutes: travelMinutes(from, district.key),
      distance,
    });
  }
  out.sort((a, b) => a.distance - b.distance);
  return out.slice(0, limit);
}

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
 * Every district that genuinely lies in a heading (within 45 degrees of it),
 * nearest first. Anything that would move you backwards is not a candidate.
 */
export function districtsInDirection(
  from: string | null | undefined,
  direction: Compass,
): Array<{ key: string; name: string; reach: number; minutes: number }> {
  const origin = mapPointOf(from);
  if (!origin) return [];
  const here = resolvePosition(from);
  const vector = DIRECTION_VECTORS[direction];
  const out: Array<{ key: string; name: string; reach: number; minutes: number }> = [];
  for (const district of DISTRICTS) {
    if (here && district.key === here.districtKey) continue;
    const dx = district.map.x - origin.x;
    const dy = district.map.y - origin.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.01) continue;
    const reach = dx * vector.x + dy * vector.y;
    // cos(45 degrees) — the same wedge the eight-point compass divides into.
    if (reach / length < Math.SQRT1_2 - 1e-9) continue;
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

/** The district furthest along a heading — "as far west as I can go". */
export function furthestInDirection(
  from: string | null | undefined,
  direction: Compass,
): string | undefined {
  const candidates = districtsInDirection(from, direction);
  return candidates.length ? candidates[candidates.length - 1]!.key : undefined;
}

/** The nearest district along a heading — one step that way. */
export function nextInDirection(
  from: string | null | undefined,
  direction: Compass,
): string | undefined {
  const candidates = districtsInDirection(from, direction);
  return candidates.length ? candidates[0]!.key : undefined;
}

export type TravelIntent = {
  from: string | null | undefined;
  /** A name the narrator proposed, if any. */
  destination?: string | null | undefined;
  /** A heading the player asked for, if any. */
  direction?: string | null | undefined;
  /** "far" means as far as the city allows in that heading. */
  extent?: "near" | "far" | null | undefined;
};

export type TravelDecision =
  { ok: true; to: string; direction?: Compass; minutes: number } | { ok: false; reason: string };

/**
 * Decide a move. When the player named a heading the engine picks the district;
 * when the narrator named a place as well, the bearing has to agree with the
 * heading or the move is refused. The model proposes, the engine decides.
 */
export function resolveTravelIntent(intent: TravelIntent): TravelDecision {
  const direction = parseDirection(intent.direction);
  const named = intent.destination ? resolveDestination(intent.destination) : undefined;

  if (direction) {
    if (named) {
      const bearing = directionBetween(intent.from, named);
      if (bearing && bearing !== direction) {
        return {
          ok: false,
          reason: `${describePosition(named)} lies ${directionName(bearing)} of here, not ${directionName(direction)}.`,
        };
      }
      if (bearing === direction) {
        return { ok: true, to: named, direction, minutes: travelMinutes(intent.from, named) };
      }
    }
    const picked =
      intent.extent === "far"
        ? furthestInDirection(intent.from, direction)
        : nextInDirection(intent.from, direction);
    if (!picked) {
      return {
        ok: false,
        reason: `There is nothing further ${directionName(direction)} of here — that way is water or the city limits.`,
      };
    }
    return { ok: true, to: picked, direction, minutes: travelMinutes(intent.from, picked) };
  }

  if (!named) {
    return {
      ok: false,
      reason: `"${intent.destination ?? "there"}" is not a place on the Night City map.`,
    };
  }
  const bearing = directionBetween(intent.from, named);
  const decision: TravelDecision = {
    ok: true,
    to: named,
    minutes: travelMinutes(intent.from, named),
  };
  return bearing ? { ...decision, direction: bearing } : decision;
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
  return [...keys].filter((k) => k.length >= 4).sort((a, b) => b.length - a.length);
})();

export type PlaceMention =
  { kind: "district"; district: District } | { kind: "place"; place: Place; district: District };

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
  return undefined;
}
