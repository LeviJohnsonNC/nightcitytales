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
import { adjacentDistricts, walk, type Walk } from "./cityGrid";

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

type AtlasFile = {
  areas: Area[];
  districts: District[];
  landmarks: Landmark[];
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
export const LANDMARKS: Landmark[] = ATLAS.landmarks;
export const MAP_IMAGE: MapImage = ATLAS.map;
export const ATLAS_SOURCE = ATLAS.source;

const DISTRICT_BY_KEY = new Map<string, District>();
const DISTRICT_BY_CODE = new Map<string, District>();
const PLACE_BY_KEY = new Map<string, { place: Place; district: District }>();
const LANDMARK_BY_KEY = new Map<string, Landmark>(LANDMARKS.map((l) => [l.key, l]));

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
 * Whether a landmark is somewhere a character can actually get to. An island in
 * the bay is not: Morro Rock is on the map, and reaching it needs a boat nobody
 * has written rules for yet.
 */
export function isReachable(landmark: Landmark): boolean {
  return landmark.kind !== "island";
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
};

/** Resolve a stored location string ("b1" or "upper_marina") into a Position. */
export function resolvePosition(stored: string | null | undefined): Position | undefined {
  if (!stored) return undefined;
  const value = stored.trim().toLowerCase();
  const entry = PLACE_BY_KEY.get(value);
  if (entry) return { districtKey: entry.district.key, placeKey: entry.place.key };
  const landmark = LANDMARK_BY_KEY.get(value);
  if (landmark) return { districtKey: landmark.districtKey, landmarkKey: landmark.key };
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
  const here =
    (position.placeKey ? getPlace(position.placeKey)?.name : undefined) ??
    (position.landmarkKey ? getLandmark(position.landmarkKey)?.name : undefined);
  const tail = `${district.name}${area ? ` (${area.name})` : ""}`;
  return here ? `${here}, ${tail}` : tail;
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
    const same = a.placeKey === b.placeKey && a.landmarkKey === b.landmarkKey;
    return same ? 0 : t.withinDistrict;
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
  for (const landmark of LANDMARKS) {
    if (norm(landmark.name) === needle) return landmark.key;
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

/** The map point for a stored location: its own pin, or its district's. */
export function mapPointOf(stored: string | null | undefined): MapPoint | undefined {
  const position = resolvePosition(stored);
  if (!position) return undefined;
  if (position.placeKey) {
    const point = getPlace(position.placeKey)?.map;
    if (point) return point;
  }
  if (position.landmarkKey) {
    const point = getLandmark(position.landmarkKey)?.map;
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
export function walkFrom(from: string | null | undefined, direction: Compass): Walk | undefined {
  const origin = mapPointOf(from);
  if (!origin) return undefined;
  return walk(origin, DIRECTION_VECTORS[direction]);
}

/**
 * The districts you would actually walk into heading that way, in the order you
 * reach them. Nothing is here because its centre point happens to lie at the
 * right bearing; everything is here because the walk goes through it.
 */
export function districtsInDirection(
  from: string | null | undefined,
  direction: Compass,
): Array<{ key: string; name: string; reach: number; minutes: number }> {
  const journey = walkFrom(from, direction);
  if (!journey) return [];
  const here = resolvePosition(from)?.districtKey;
  const out: Array<{ key: string; name: string; reach: number; minutes: number }> = [];
  for (const leg of journey.legs) {
    if (leg.key === here) continue;
    if (out.some((d) => d.key === leg.key)) continue;
    const district = getDistrict(leg.key);
    if (!district) continue;
    out.push({
      key: leg.key,
      name: district.name,
      reach: leg.reached,
      minutes: travelMinutes(from, leg.key),
    });
  }
  return out;
}

/**
 * Where "as far west as I can go" ends up: the last district the walk reaches
 * before the water or the city limits. Undefined when the very next step off
 * this spot already leaves the city.
 */
export function furthestInDirection(
  from: string | null | undefined,
  direction: Compass,
): string | undefined {
  const candidates = districtsInDirection(from, direction);
  return candidates.length ? candidates[candidates.length - 1]!.key : undefined;
}

/** The first district the walk crosses into — one step that way. */
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
  return walkFrom(from, direction)?.stoppedBy;
}

/**
 * How far a walk has to cover before it counts as having gone somewhere, as a
 * percentage of the map's width. Below this the character is already standing
 * at the edge and heading that way is not a move.
 */
const WALK_WORTH_TAKING = 2;

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
  | {
      ok: true;
      to: string;
      direction?: Compass;
      minutes: number;
      /**
       * Set when the heading ran out before any district did: the character
       * walked as far that way as the city allows and is standing at the edge
       * of it. The narration is told, so "as far west as I can" reads as
       * arriving at the waterfront rather than as nothing happening.
       */
      stoppedAt?: "water" | "edge";
    }
  | { ok: false; reason: string };

/**
 * Decide a move. When the player named a heading the engine picks the district;
 * when the narrator named a place as well, the bearing has to agree with the
 * heading or the move is refused. The model proposes, the engine decides.
 */
export function resolveTravelIntent(intent: TravelIntent): TravelDecision {
  const direction = parseDirection(intent.direction);
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
      // No district that way, but that does not mean no walk. A district is
      // wide, and heading for its far edge is a real thing to do: the character
      // crosses it and fetches up against the water or the city limits.
      const journey = walkFrom(intent.from, direction);
      const here = resolvePosition(intent.from)?.districtKey;
      if (journey && here && journey.distance >= WALK_WORTH_TAKING) {
        return {
          ok: true,
          to: here,
          direction,
          minutes: travelMinutes(intent.from, here),
          stoppedAt: journey.stoppedBy,
        };
      }
      const edge = journey?.stoppedBy === "water" ? "the water" : "the edge of the city";
      return {
        ok: false,
        reason: `There is no going ${directionName(direction)} from here — ${edge} is right there.`,
      };
    }
    return { ok: true, to: picked, direction, minutes: travelMinutes(intent.from, picked) };
  }

  if (!named) {
    return { ok: false, reason: "Nowhere was named and no heading was given." };
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
  for (const landmark of LANDMARKS) keys.add(landmark.name);
  return [...keys].filter((k) => k.length >= 4).sort((a, b) => b.length - a.length);
})();

export type PlaceMention =
  | { kind: "district"; district: District }
  | { kind: "place"; place: Place; district: District }
  | { kind: "landmark"; landmark: Landmark; district: District };

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
  return undefined;
}
