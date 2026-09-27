/**
 * What the game makes of the atlas.
 *
 * `geography.ts` next door is the city as the publisher printed it: districts,
 * locations, security providers, gangs, coordinates. It invents nothing, which
 * is the whole reason it can be trusted. But a location the game can only
 * describe is a location the game cannot play, and until now that is all any of
 * the 156 of them have been.
 *
 * This module is the other half: the same places, read as ground a character
 * stands on. What is here, who comes when you are loud, what kind of fight this
 * would be. It is a HOUSE RULE, and it lives in its own file
 * (`src/data/atlas/places.gameplay.json`, flagged `houseRule: true`) exactly as
 * the travel times do, so it can be tuned in data rather than in code and so
 * the atlas itself stays untouched.
 *
 * Three things, and nothing else:
 *
 *  - TAGS say what a place is, from a closed list. `bar`, `ripperdoc`,
 *    `container_housing`, `gang_turf`. Written for composition: a beat that
 *    wants somewhere to buy water asks for `water`, not for a location key, so
 *    the whole city can answer rather than the five places somebody has
 *    written up.
 *
 *  - A DISTRICT PROFILE says what the surrounding streets are like. Its
 *    response tier is read off the atlas's own printed security provider — the
 *    Exec Zone answers to Lazarus, Rancho Coronado to "NCPD (in theory)" — so
 *    who comes when the street notices you is published data rather than an
 *    invention.
 *
 *  - An ARENA follows from the tags, so where a fight starts decides its
 *    geometry: a club interior at a bar, a parking structure at a garage.
 *
 * Pure TypeScript, like everything else in here. Data in, plain objects out, no
 * dice, no React, no knowledge of how any of it is stored.
 */
import gameplay from "@/data/atlas/places.gameplay.json";
import { ARENA_KEYS, DEFAULT_ARENA_KEY } from "./battlefield";
import {
  DISTRICTS,
  getDistrict,
  getPlace,
  isCombatZone,
  travelTrip,
  type District,
} from "./geography";

// ---------------------------------------------------------------------------
// The file.
// ---------------------------------------------------------------------------

type GameplayFile = {
  houseRule: boolean;
  note: string;
  responseNote: string;
  responseTiers: Record<string, { label: string; heat: number; minutes: number }>;
  tags: Record<string, string>;
  arenaByTag: [string, string][];
  districts: Record<string, { response: string; wealth: string; crowd: string }>;
  places: Record<string, { tags: string[] }>;
};

const DATA = gameplay as unknown as GameplayFile;

/** Every tag the city may be described with. Nothing else is a tag. */
export const PLACE_TAGS: string[] = Object.keys(DATA.tags);

export function isPlaceTag(value: unknown): value is PlaceTag {
  return typeof value === "string" && Object.hasOwn(DATA.tags, value);
}

export type PlaceTag = string;

/** What a tag means, written for a prompt to be handed rather than to guess. */
export function tagMeaning(tag: PlaceTag): string | undefined {
  return DATA.tags[tag];
}

// ---------------------------------------------------------------------------
// Who comes when the street notices you.
// ---------------------------------------------------------------------------

export const RESPONSE_TIERS = ["none", "slow", "prompt", "immediate"] as const;
export type ResponseTier = (typeof RESPONSE_TIERS)[number];

export function isResponseTier(value: unknown): value is ResponseTier {
  return typeof value === "string" && (RESPONSE_TIERS as readonly string[]).includes(value);
}

export type Response = {
  tier: ResponseTier;
  /** "before you finish", "nobody comes". */
  label: string;
  /**
   * What noise here costs, as a multiplier on the heat an observation carries.
   * Zero means the city genuinely does not notice, which is the point of the
   * districts the atlas itself files under "NCPD (in theory)".
   */
  heat: number;
  /** Roughly how long they take. Zero when nobody is coming. */
  minutes: number;
  /** WHO comes, in the atlas's own words: "Militech", "Aldecaldo Peacekeepers". */
  who: string;
};

export const WEALTH_LEVELS = ["poor", "mixed", "rich"] as const;
export type Wealth = (typeof WEALTH_LEVELS)[number];

export const CROWD_LEVELS = ["empty", "steady", "busy"] as const;
export type Crowd = (typeof CROWD_LEVELS)[number];

/**
 * A district as ground rather than as an entry: what the streets are like, and
 * what happens if you make noise on them.
 *
 * Half of it is the atlas's own (`who`, `gangs`, `combatZone`) and half is the
 * house rule beside it. They are returned together because no caller has ever
 * wanted one without the other.
 */
export type DistrictProfile = {
  key: string;
  name: string;
  response: Response;
  wealth: Wealth;
  crowd: Crowd;
  gangs: string[];
  combatZone: boolean;
};

function responseFor(tier: string, who: string): Response {
  const row = DATA.responseTiers[tier];
  if (!row || !isResponseTier(tier)) {
    throw new Error(`places: "${tier}" is not a response tier.`);
  }
  return { tier, label: row.label, heat: row.heat, minutes: row.minutes, who };
}

/** The profile for a district, by key ("kabuki") or printed code ("O"). */
export function districtProfile(keyOrCode: string): DistrictProfile | undefined {
  const district = getDistrict(keyOrCode);
  if (!district) return undefined;
  const row = DATA.districts[district.key];
  if (!row) return undefined;
  return {
    key: district.key,
    name: district.name,
    // The security provider is transcribed from the atlas. Who is paid to come
    // is who comes; the tier only says how fast and how much it costs you.
    response: responseFor(row.response, district.security),
    wealth: row.wealth as Wealth,
    crowd: row.crowd as Crowd,
    gangs: district.gangs,
    combatZone: isCombatZone(district.key),
  };
}

/**
 * What noise costs here, as a multiplier on an observation's heat.
 *
 * One is the ordinary city. A district nobody polices returns zero, and the
 * caller is expected to multiply rather than to branch: the difference between
 * the Exec Zone and Rancho Coronado should be a number the pressure engine
 * applies, not a special case somebody remembered to write.
 */
export function heatMultiplier(districtKeyOrCode: string): number {
  return districtProfile(districtKeyOrCode)?.response.heat ?? 1;
}

// ---------------------------------------------------------------------------
// Locations.
// ---------------------------------------------------------------------------

export type PlaceProfile = {
  key: string;
  name: string;
  districtKey: string;
  tags: PlaceTag[];
};

/** The gameplay profile for a location, by its code key ("x5"). */
export function placeProfile(key: string): PlaceProfile | undefined {
  const place = getPlace(key);
  if (!place) return undefined;
  const row = DATA.places[place.key];
  if (!row) return undefined;
  const district = DISTRICTS.find((d) => d.locations.some((l) => l.key === place.key));
  if (!district) return undefined;
  return { key: place.key, name: place.name, districtKey: district.key, tags: row.tags };
}

/** The tags on a location, or none for a place that has no profile. */
export function tagsOf(key: string): PlaceTag[] {
  return placeProfile(key)?.tags ?? [];
}

export function hasTag(key: string, tag: PlaceTag): boolean {
  return tagsOf(key).includes(tag);
}

/**
 * Everywhere in the city carrying a tag, optionally within one district.
 *
 * This is the lookup the rest of the feature is for. "Somewhere to buy water in
 * this district" is a question the whole atlas can answer, so a beat written
 * once works in every district that has the ground for it rather than only
 * where somebody has authored a venue.
 */
export function placesWithTag(tag: PlaceTag, districtKeyOrCode?: string): PlaceProfile[] {
  const only = districtKeyOrCode ? getDistrict(districtKeyOrCode)?.key : undefined;
  if (districtKeyOrCode && !only) return [];
  const out: PlaceProfile[] = [];
  for (const district of DISTRICTS) {
    if (only && district.key !== only) continue;
    for (const place of district.locations) {
      if (DATA.places[place.key]?.tags.includes(tag)) {
        out.push({
          key: place.key,
          name: place.name,
          districtKey: district.key,
          tags: DATA.places[place.key]!.tags,
        });
      }
    }
  }
  return out;
}

/** Every district that has somewhere tagged this way. */
export function districtsWithTag(tag: PlaceTag): District[] {
  const keys = new Set(placesWithTag(tag).map((p) => p.districtKey));
  return DISTRICTS.filter((d) => keys.has(d.key));
}

// ---------------------------------------------------------------------------
// Asking for a KIND of place.
// ---------------------------------------------------------------------------

/**
 * Words people use for a kind of place that are not the tag's own name.
 *
 * Small on purpose. The narrator is asked to name the tag itself (`seek`), so
 * this only has to catch the player's own words when it does not — "go find a
 * bar and order a drink" was refused as "a bar is not a place on the map",
 * which is true of every bar and the opposite of what was asked. Nothing here
 * adds a place: it only says which tag a word is reaching for.
 */
const KIND_WORDS: Record<string, PlaceTag> = {
  pub: "bar",
  dive: "bar",
  nightclub: "club",
  noodles: "food",
  diner: "restaurant",
  doc: "clinic",
  doctor: "clinic",
  medic: "clinic",
  ripper: "ripperdoc",
  store: "shop",
  motel: "hotel",
  mechanic: "garage",
};

/**
 * What "somewhere to ___" is reaching for. Verbs, so only ever read as the
 * whole of a phrase: "order a drink" in the middle of a sentence is not a
 * request to be taken to a bar.
 */
const SOMEWHERE_TO: Record<string, PlaceTag> = {
  drink: "bar",
  eat: "food",
  sleep: "hotel",
  shop: "shop",
};

/**
 * The tag a phrase is asking for, when it names a kind rather than a place.
 *
 * "a bar", "somewhere to eat", "the nearest clinic". Returns undefined for a
 * proper name, and for anything that does not reduce to one kind: guessing
 * between two is choosing for the player.
 */
export function tagNamed(text: string | null | undefined): PlaceTag | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase().replace(/[^a-z\s_-]/g, " ");
  const verb = lower.match(/\bsomewhere\s+to\s+([a-z]+)\s*$/)?.[1];
  if (verb && SOMEWHERE_TO[verb]) return SOMEWHERE_TO[verb];
  const phrase = lower
    .replace(/\b(?:a|an|some|the|any|nearest|closest|nearby|local|good|decent|cheap)\b/g, " ")
    .replace(/\bsomewhere\s+(?:to|for|with)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!phrase) return undefined;
  return tagOfWord(phrase) ?? tagOfWord(phrase.replace(/ /g, "_"));
}

function tagOfWord(word: string): PlaceTag | undefined {
  const singular = word.endsWith("s") ? word.slice(0, -1) : undefined;
  if (Object.hasOwn(DATA.tags, word)) return word;
  if (singular && Object.hasOwn(DATA.tags, singular)) return singular;
  return KIND_WORDS[word];
}

/**
 * The kinds of place a sentence mentions, in the order it mentions them.
 *
 * For reading the player's own words when a trip could not be resolved from
 * what the narrator proposed. Each kind appears once.
 */
export function tagsMentioned(text: string | null | undefined): PlaceTag[] {
  if (!text) return [];
  const out: PlaceTag[] = [];
  for (const word of text.toLowerCase().split(/[^a-z_]+/)) {
    const tag = word ? tagOfWord(word) : undefined;
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/** A place of some kind, and how long it is on foot from where somebody stands. */
export type NearbyPlace = PlaceProfile & { minutes: number };

/**
 * How much further a place the character already knows may be before a closer
 * stranger wins. A HOUSE RULE, and a guess: people go back to the bar they know
 * rather than the one that is two minutes nearer, but not across town for it.
 */
export const KNOWN_PLACE_PULL_MINUTES = 10;

/**
 * Every place of a kind, nearest first, measured on foot from `from`.
 *
 * `known` is the places the character has stood in. Among the ones within
 * `KNOWN_PLACE_PULL_MINUTES` of the nearest, a known one comes first.
 *
 * Measured on foot because "nearest" is a question about the city, not about
 * whether a cab turns up; the trip itself is priced however they actually go.
 */
export function nearestWithTag(
  from: string | null | undefined,
  tag: PlaceTag,
  opts: { known?: readonly string[]; limit?: number } = {},
): NearbyPlace[] {
  const known = new Set(opts.known ?? []);
  const found = placesWithTag(tag)
    .map((p) => ({ ...p, minutes: travelTrip(from, p.key, "foot").minutes }))
    .sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name));
  const nearest = found[0];
  if (nearest && known.size) {
    const pull = found.find(
      (p) => known.has(p.key) && p.minutes <= nearest.minutes + KNOWN_PLACE_PULL_MINUTES,
    );
    if (pull && pull !== nearest) {
      found.splice(found.indexOf(pull), 1);
      found.unshift(pull);
    }
  }
  return found.slice(0, opts.limit ?? found.length);
}

// ---------------------------------------------------------------------------
// Where a fight would happen.
// ---------------------------------------------------------------------------

/**
 * The arena a fight at this location starts in.
 *
 * The tags are read in the file's order, most specific ground first, so a bar
 * that is also busy is a club interior rather than a street. Anything the list
 * does not speak to falls back to open ground, which is what the encounter
 * engine already does when nobody names an arena.
 */
export function arenaForPlace(key: string): string {
  const tags = tagsOf(key);
  for (const [tag, arena] of DATA.arenaByTag) {
    if (tags.includes(tag) && ARENA_KEYS.includes(arena)) return arena;
  }
  return DEFAULT_ARENA_KEY;
}

// ---------------------------------------------------------------------------

/** True when the gameplay layer is what it claims to be: a tunable house rule. */
export const PLACES_ARE_HOUSE_RULE: boolean = DATA.houseRule;

/** Why this file exists, for anyone reading it in a prompt or a test failure. */
export const PLACES_NOTE: string = DATA.note;
