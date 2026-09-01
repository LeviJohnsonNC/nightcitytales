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

/** Look up what a piece of narration text is naming, if anything. */
export function resolvePlaceMention(text: string): PlaceMention | undefined {
  const needle = text.trim().toLowerCase();
  for (const district of DISTRICTS) {
    if (district.name.toLowerCase() === needle) return { kind: "district", district };
  }
  for (const district of DISTRICTS) {
    for (const place of district.locations) {
      if (place.name.toLowerCase() === needle) return { kind: "place", place, district };
    }
  }
  return undefined;
}
