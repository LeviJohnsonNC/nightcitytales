/**
 * What the ground you are standing on is doing today.
 *
 * Until now every Life situation came from the character — their rent, their
 * wounds, their empty magazine, somebody they had neglected — or from a person
 * deciding to move (worldTick.ts). Nothing came from WHERE THEY WERE. A player
 * living in Rancho Coronado and a player living in the Exec Zone met the same
 * situations in different prose, which is another way of saying the city was
 * scenery.
 *
 * This is the fourth source. It is deliberately shaped like the other three:
 *
 *  - The beats are AUTHORED, in `src/data/atlas/place-beats.json`, and anchored
 *    either to a named venue ("the carwash is selling drinking water") or to a
 *    TAG, so a beat written once is true of every place in the city that has
 *    the ground for it rather than only where somebody wrote a venue up.
 *
 *  - Selection is DETERMINISTIC. No die is rolled here, on purpose: the world
 *    tick, the wire and the street are already three rolls a night, and a
 *    fourth would quietly raise the rate at which the city does something to
 *    you. A beat is simply true on some days and not on others, and which days
 *    is a function of the campaign, the place and the beat.
 *
 *  - The model DRESSES the winner. Beats go into the same funnel as everything
 *    else (mergeSituations → ageSituations → selectSituation), where they are
 *    scored against rent and wounds and people and usually lose. That is the
 *    intended outcome: most evenings, where you are is not the loudest thing in
 *    your life.
 *
 * Pure TypeScript. Position and a clock in, candidate situations out.
 */
import data from "@/data/atlas/place-beats.json";
import { partOfDay } from "./clock";
import { DISTRICTS, getDistrict, getPlace } from "./geography";
import { tagsOf } from "./places";
import { beatAllowedAt, type PlaceState } from "./placeState";
import type { LifeCategory, LifeSituation } from "./life";

type BeatFile = {
  houseRule: boolean;
  note: string;
  cap: number;
  capNote: string;
  beats: {
    key: string;
    places?: string[];
    tags?: string[];
    districts?: string[];
    category: string;
    title: string;
    summary: string;
    severity: number;
    everyDays: number;
    parts?: string[];
    /** The mark it wears on the map, when it asks for one. See placeSignals.ts. */
    signal?: string;
  }[];
};

const FILE = data as unknown as BeatFile;

export type PlaceBeat = BeatFile["beats"][number];

/** Every authored beat, in file order. */
export const PLACE_BEATS: PlaceBeat[] = FILE.beats;

/**
 * How many place beats may be live at once.
 *
 * Two. They still have to win the funnel to be shown, but a place that offers
 * four things the moment you arrive is a quest board, and the whole argument
 * for this feature is that it is not one.
 */
export const MAX_PLACE_BEATS: number = FILE.cap;

/** The prefix every beat's situation key carries, so the merge can find them. */
export const PLACE_BEAT_PREFIX = "place_";

export function isPlaceBeatKey(key: string): boolean {
  return key.startsWith(PLACE_BEAT_PREFIX);
}

/** The situation key for one beat at one place. Stable for the campaign's life. */
export function placeBeatKey(placeKey: string, beatKey: string): string {
  return `${PLACE_BEAT_PREFIX}${placeKey}_${beatKey}`;
}

// ---------------------------------------------------------------------------
// Which days a beat is true on.
// ---------------------------------------------------------------------------

/**
 * A stable number for a string. FNV-1a, which is not a cryptographic anything
 * and does not need to be: all it has to do is spread beats across the calendar
 * the same way every time the same campaign asks.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Whether this beat is true at this place today.
 *
 * Every beat carries a period — "about every nine days" — and each beat at each
 * place in each campaign gets its own offset within it. So two campaigns do not
 * share a calendar, the water truck and the night market do not fail on the
 * same day, and the same campaign asked twice about the same day gets the same
 * answer, which is what lets the situation persist across a reload instead of
 * flickering.
 */
export function beatIsLive(beat: PlaceBeat, placeKey: string, day: number, seed: string): boolean {
  const period = Math.max(1, Math.floor(beat.everyDays));
  const offset = hash(`${seed}:${placeKey}:${beat.key}`) % period;
  return (day + offset) % period === 0;
}

/** Whether the hour suits it. A night market is not a morning. */
export function beatFitsHour(beat: PlaceBeat, minute: number): boolean {
  return !beat.parts?.length || beat.parts.includes(partOfDay(minute));
}

// ---------------------------------------------------------------------------
// Where a beat can happen.
// ---------------------------------------------------------------------------

/** Every location in a district a given beat could be anchored to. */
function anchorsIn(beat: PlaceBeat, districtKey: string): string[] {
  const district = getDistrict(districtKey);
  if (!district) return [];
  if (beat.districts?.length && !beat.districts.includes(district.key)) return [];
  const out: string[] = [];
  for (const place of district.locations) {
    if (beat.places?.includes(place.key)) {
      out.push(place.key);
      continue;
    }
    if (beat.tags?.length && beat.tags.some((tag) => tagsOf(place.key).includes(tag))) {
      out.push(place.key);
    }
  }
  return out;
}

/**
 * The places a beat may actually be tested at in a district today.
 *
 * A beat anchored to a NAMED VENUE is tested there: the water truck fails at
 * the carwash or it does not.
 *
 * A beat anchored to a TAG gets ONE anchor for the whole district, chosen from
 * the ground that qualifies. This is not a detail. Half of North Heywood is
 * container housing, so testing the beat at each of eleven addresses gives it
 * eleven chances a day and "the water pressure has gone again" becomes a
 * fixture of the neighbourhood rather than an event in it. One district, one
 * chance, and which address it happens at moves around the district over time.
 */
function anchorsFor(beat: PlaceBeat, districtKey: string, day: number, seed: string): string[] {
  const all = anchorsIn(beat, districtKey);
  if (all.length <= 1 || beat.places?.length) return all;
  // Which address, this time round. Keyed on the period rather than the day so
  // it does not wander mid-event, and so a beat lasting into a second day is
  // still happening in the same place.
  const period = Math.max(1, Math.floor(beat.everyDays));
  const round = Math.floor(day / period);
  const pick = hash(`${seed}:${districtKey}:${beat.key}:${round}`) % all.length;
  return [all[pick]!];
}

/** Every district any of this beat's anchors sit in. For tests and tooling. */
export function districtsForBeat(beat: PlaceBeat): string[] {
  return DISTRICTS.filter((d) => anchorsIn(beat, d.key).length).map((d) => d.key);
}

// ---------------------------------------------------------------------------
// The whole derivation.
// ---------------------------------------------------------------------------

export type PlaceBeatInput = {
  /** The district the character is standing in. */
  districtKey: string;
  /** The exact venue, when they are standing in one rather than just nearby. */
  placeKey?: string | undefined;
  day: number;
  /** Minutes into the day, for beats that only make sense at some hours. */
  minute: number;
  /**
   * Something stable and per-campaign — the campaign id will do. Two campaigns
   * in the same district should not be handed the same week.
   */
  seed: string;
  /**
   * What has happened to these places, by key, when the campaign knows. A place
   * with no entry is a place at its starting condition — not a blank one.
   *
   * This is the link that makes state matter: a night market runs while the
   * place is still a market, and stops when the law has been through enough
   * times to close it.
   */
  places?: Record<string, PlaceState> | undefined;
};

/**
 * The beats that are true where this character is standing, right now.
 *
 * Anchored to a venue but true across its DISTRICT: a character is usually
 * somewhere in Rancho Coronado rather than standing in the carwash, and "the
 * water truck did not make it, the carwash is selling drinking water" is news
 * about the district you live in. `atPlace` says which of the two it is, so the
 * narrator knows whether the player is looking at this or hearing about it.
 */
export function derivePlaceBeats(input: PlaceBeatInput): LifeSituation[] {
  const district = getDistrict(input.districtKey);
  if (!district) return [];

  const candidates: { situation: LifeSituation; atPlace: boolean }[] = [];

  for (const beat of PLACE_BEATS) {
    if (!beatFitsHour(beat, input.minute)) continue;
    for (const placeKey of anchorsFor(beat, district.key, input.day, input.seed)) {
      if (!beatIsLive(beat, placeKey, input.day, input.seed)) continue;
      if (!beatAllowedAt(beat.key, placeKey, input.places?.[placeKey])) continue;
      const place = getPlace(placeKey);
      if (!place) continue;
      const atPlace = input.placeKey === placeKey;
      candidates.push({
        atPlace,
        situation: {
          key: placeBeatKey(placeKey, beat.key),
          category: beat.category as LifeCategory,
          title: beat.title,
          summary: beat.summary,
          status: "live",
          severity: beat.severity,
          data: {
            placeKey,
            placeName: place.name,
            districtKey: district.key,
            beat: beat.key,
            atPlace,
            ...(beat.signal ? { signal: beat.signal } : {}),
          },
        },
      });
    }
  }

  // Loudest first, then somewhere the character is actually standing, then a
  // stable key order so the same day always produces the same board.
  candidates.sort(
    (a, b) =>
      b.situation.severity - a.situation.severity ||
      Number(b.atPlace) - Number(a.atPlace) ||
      a.situation.key.localeCompare(b.situation.key),
  );
  // One instance of a beat at a time. A tag beat can anchor to twenty places in
  // a district — half of North Heywood is container housing — and "the water
  // pressure has gone again" being true at two addresses on the same evening
  // reads as a bug rather than as a neighbourhood.
  const seen = new Set<string>();
  const chosen: LifeSituation[] = [];
  for (const candidate of candidates) {
    const beatKey = String(candidate.situation.data?.["beat"]);
    if (seen.has(beatKey)) continue;
    seen.add(beatKey);
    chosen.push(candidate.situation);
    if (chosen.length >= MAX_PLACE_BEATS) break;
  }
  return chosen;
}

/** True when the beats are what they claim to be: a tunable house rule. */
export const PLACE_BEATS_ARE_HOUSE_RULE: boolean = FILE.houseRule;

/**
 * What is on across a set of districts, for the map.
 *
 * The beats a campaign PERSISTS are only ever the ones where the character is
 * standing — those are situations, and a situation you are not present for is
 * not yours. But the map wants to say that the night market is running in
 * Rancho Coronado while you are drinking in Little Europe, and that is a fact
 * about the city rather than a situation of yours: the derivation is
 * deterministic, so it can be asked about anywhere without anything being
 * written down.
 *
 * Which districts to pass is the caller's rule, and the one this game uses is
 * districts the character KNOWS. You do not hear what is happening in a
 * neighbourhood you have never been to, and going somewhere new quietly makes
 * the map a little more useful for the rest of the campaign.
 */
export function cityBeats(input: {
  districtKeys: string[];
  day: number;
  minute: number;
  seed: string;
  places?: Record<string, PlaceState> | undefined;
}): LifeSituation[] {
  const seen = new Set<string>();
  const out: LifeSituation[] = [];
  for (const districtKey of input.districtKeys) {
    for (const beat of derivePlaceBeats({
      districtKey,
      day: input.day,
      minute: input.minute,
      seed: input.seed,
      places: input.places,
    })) {
      if (seen.has(beat.key)) continue;
      seen.add(beat.key);
      out.push(beat);
    }
  }
  return out;
}
