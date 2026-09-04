/**
 * Where the people you know actually are.
 *
 * The standing cast have existed since week one with names, dossiers and
 * grudges, and no address. They were reachable — a fixer calls, a landlord
 * knocks — but they were never anywhere, so the city and the cast were two
 * systems that never touched. You could not run into Razor. You could only be
 * contacted by him.
 *
 * A haunt fixes that with the smallest thing that works. Each of the six keeps
 * one or two places, drawn from ground that suits them: a ripperdoc at a
 * ripperdoc's, a fixer where people drink, a landlord in the building they own
 * a piece of. Whether they are in is a PROBABILITY BY PART OF DAY, not a
 * schedule — nobody needs to simulate six people's diaries to answer the only
 * question the game ever asks, which is "is he here?".
 *
 * Two rules keep it from becoming a notification tray of its own:
 *
 *  - ONE FACE PER ARRIVAL. However many people keep a place, you meet at most
 *    one, on the same discipline as one person moving per day.
 *
 *  - PRESENCE IS NOT A SITUATION. Razor being at the Forlorn Hope means that if
 *    you go there, he is there. It does not generate a beat, put anything on
 *    the board, or ask anything of you. Somebody being somewhere is the texture
 *    that makes the place a place; the world tick still owns people ACTING.
 *
 * Deterministic, like the beats: the same campaign asked about the same evening
 * gives the same answer, so the map can say who is where without persisting
 * anything and without rolling a die nobody asked for.
 *
 * Pure TypeScript. People and a clock in, at most one name out.
 */
import { partOfDay } from "./clock";
import { CAST_ROLES, type CastRole } from "./cast";
import { DISTRICTS, getDistrict, getPlace } from "./geography";
import { placesWithTag, tagsOf, type PlaceTag } from "./places";

/**
 * The ground each of the six keeps.
 *
 * Read down the list and it should sound like the person: the fixer is where
 * people drink and deal, the ripperdoc is at a ripperdoc's, the landlord is in
 * the building, the enemy is on somebody's turf. Ordered — the first tag that
 * finds a place wins, so a fixer prefers a bar to a market.
 */
export const HAUNT_TAGS: Record<CastRole, PlaceTag[]> = {
  fixer: ["bar", "club", "market", "crowd"],
  ripperdoc: ["ripperdoc", "clinic", "hospital"],
  landlord: ["housing", "container_housing", "hotel"],
  friend: ["bar", "food", "farm", "park"],
  enemy: ["gang_turf", "derelict", "warehouse", "bar"],
  old_flame: ["club", "restaurant", "studio", "leisure"],
};

/**
 * How likely each of them is to be at their haunt, by part of day.
 *
 * House-rule pacing numbers, and deliberately not high: a person who is always
 * in is furniture. An absent entry means never — a landlord is not in the
 * lobby at four in the morning, and a fixer is not holding court over
 * breakfast.
 */
export const HAUNT_PRESENCE: Record<CastRole, Partial<Record<string, number>>> = {
  fixer: { evening: 0.7, night: 0.4, afternoon: 0.2 },
  ripperdoc: { morning: 0.5, afternoon: 0.6, evening: 0.3 },
  landlord: { morning: 0.4, afternoon: 0.5, evening: 0.3 },
  friend: { evening: 0.5, afternoon: 0.35, morning: 0.15 },
  enemy: { night: 0.4, evening: 0.3, afternoon: 0.15 },
  old_flame: { evening: 0.4, night: 0.35 },
};

/** How many places one person keeps. Two: somewhere they work, somewhere else. */
export const MAX_HAUNTS = 2;

// ---------------------------------------------------------------------------

/** Stable number for a string. FNV-1a, same as the beats use. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The places one person keeps, in the part of town the character lives in.
 *
 * Home first and by some distance: a cast you can only meet by crossing the
 * city is a cast you never meet. When the character's own district has no
 * suitable ground the search widens to the whole city rather than leaving
 * somebody nowhere.
 */
export function hauntsFor(role: CastRole, homeDistrictKey: string, seed: string): string[] {
  const home = getDistrict(homeDistrictKey);
  const out: string[] = [];

  for (const tag of HAUNT_TAGS[role]) {
    if (out.length >= MAX_HAUNTS) break;
    const local = home?.locations.filter((p) => tagsOf(p.key).includes(tag)) ?? [];
    const candidates = local.length ? local.map((p) => p.key) : [];
    if (!candidates.length) continue;
    const pick = candidates[hash(`${seed}:${role}:${tag}`) % candidates.length]!;
    if (!out.includes(pick)) out.push(pick);
  }

  // Nothing at home suits them. Somebody with no address at all is worse than
  // somebody with an address across town.
  if (!out.length) {
    for (const tag of HAUNT_TAGS[role]) {
      const anywhere = placesWithTag(tag);
      if (!anywhere.length) continue;
      const pick = anywhere[hash(`${seed}:${role}:${tag}:city`) % anywhere.length]!;
      out.push(pick.key);
      break;
    }
  }
  return out;
}

/** What the presence check needs to know about somebody. */
export type HauntPerson = {
  key: string;
  name: string;
  role: CastRole;
  /** Their places. Given rather than derived, so a caller can override them. */
  haunts: string[];
};

/**
 * Whether this person is in, right now.
 *
 * Realized deterministically from the campaign, the person, the place and the
 * hour, so it is stable across a reload and across the two callers that ask
 * (the turn, and the map) without a die being rolled or a row being written.
 */
export function isAtHaunt(args: {
  person: HauntPerson;
  placeKey: string;
  day: number;
  minute: number;
  seed: string;
}): boolean {
  const { person, placeKey, day, minute, seed } = args;
  if (!person.haunts.includes(placeKey)) return false;
  const chance = HAUNT_PRESENCE[person.role][partOfDay(minute)] ?? 0;
  if (chance <= 0) return false;
  const roll = hash(`${seed}:${person.key}:${placeKey}:${day}:${partOfDay(minute)}`) % 1000;
  return roll < Math.round(chance * 1000);
}

export type WhoIsAtInput = {
  /** The venue being asked about. A district is not a place to run into somebody. */
  placeKey: string;
  people: HauntPerson[];
  day: number;
  minute: number;
  seed: string;
};

/**
 * The one person you run into here, or nobody.
 *
 * Ties break toward whoever the character has the strongest feelings about,
 * because that is the meeting worth having: an enemy in the bar is a scene, and
 * an acquaintance in the bar is a sentence.
 */
export function whoIsAt(input: WhoIsAtInput): HauntPerson | null {
  const present = input.people.filter((person) =>
    isAtHaunt({
      person,
      placeKey: input.placeKey,
      day: input.day,
      minute: input.minute,
      seed: input.seed,
    }),
  );
  if (!present.length) return null;
  return present.sort((a, b) => a.key.localeCompare(b.key))[0] ?? null;
}

/**
 * Everybody who is somewhere the player could go and find them, for the map.
 *
 * One entry per person, never one per place: somebody who keeps two bars is in
 * at most one of them tonight.
 */
export function peopleAtHaunts(input: {
  people: HauntPerson[];
  day: number;
  minute: number;
  seed: string;
}): { name: string; placeKey: string }[] {
  const out: { name: string; placeKey: string }[] = [];
  for (const person of input.people) {
    for (const placeKey of person.haunts) {
      if (!getPlace(placeKey)) continue;
      if (
        !isAtHaunt({ person, placeKey, day: input.day, minute: input.minute, seed: input.seed })
      ) {
        continue;
      }
      out.push({ name: person.name, placeKey });
      break;
    }
  }
  return out;
}

/** Every role the haunts know about, for tests and tooling. */
export const HAUNT_ROLES: CastRole[] = [...CAST_ROLES];

/** Every district that could host a haunt for this role. For tests. */
export function districtsHosting(role: CastRole): string[] {
  return DISTRICTS.filter((d) =>
    d.locations.some((p) => HAUNT_TAGS[role].some((tag) => tagsOf(p.key).includes(tag))),
  ).map((d) => d.key);
}
