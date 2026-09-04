/**
 * What a place has become.
 *
 * Everything about a location so far has been fixed. `places.gameplay.json`
 * says what it is; `place-beats.json` says what can happen there; the dossier
 * says what it is like. All of it is as true in week forty as it was in week
 * one, which makes the city a backdrop rather than somewhere the character
 * lives.
 *
 * This is the part that moves. A place carries DIALS — police attention on a
 * market, how much of a rooftop the people who work it still hold — and FLAGS
 * from a closed list. Both start at an authored condition and change only
 * because something happened.
 *
 * The load-bearing idea: WHAT WAS WRITTEN IS THE STARTING CONDITION, NOT THE
 * ETERNAL ONE. Minimallism opens as a dead mall with a night market in the west
 * concourse. Bring the law down on it enough times and the market stops, the
 * flag clears, the beat that ran it stops firing, and the entry the player read
 * in week one is history rather than description.
 *
 * Three rules hold the line the rest of the engine holds:
 *
 *  - THE MODEL NEVER WRITES HERE. It reports observations from the vocabulary
 *    it already has (`seen`, `loud`, `killed`, `favour`…) and the engine prices
 *    them against the place. There is no place_delta in the response schema and
 *    there is not going to be one.
 *
 *  - DIALS ARE NOT THE PRESSURE RAIL. `campaign_clocks` means something is
 *    coming for you. A market's police attention is a fact about a market, so
 *    it lives on the place and stays off the rail — but it is the same shape as
 *    a clock and moves through the same helper, because two dial systems in one
 *    codebase is one too many.
 *
 *  - A PLACE WITH NO ROW IS NOT A PLACE WITH NO STATE. It is a place at its
 *    starting condition. Rows are written when something happens, so 156
 *    locations do not become 156 rows per campaign saying nothing.
 *
 * Pure TypeScript: state in, state out, no knowledge of how any of it is stored.
 */
import data from "@/data/atlas/place-state.json";
import { OBSERVATION_COSTS, type Observation } from "./clocks";
import { tagsOf, type PlaceTag } from "./places";
import type { LifeClock } from "./life";

type StateFile = {
  houseRule: boolean;
  note: string;
  dialNote: string;
  dials: Record<
    string,
    { label: string; segments: number; tags: string[]; start: number; meaning: string }
  >;
  flagNote: string;
  flags: Record<string, string>;
  thresholdNote: string;
  thresholds: {
    dial: string;
    at: number;
    sets: string[];
    clears: string[];
    resets: number;
    note: string;
  }[];
  startNote: string;
  places: Record<string, { dials?: Record<string, number>; flags?: string[] }>;
};

const FILE = data as unknown as StateFile;

/** Every dial the city knows about. */
export const PLACE_DIALS: string[] = Object.keys(FILE.dials);

/** Every flag a place may carry. Nothing outside this list is a flag. */
export const PLACE_FLAGS: string[] = Object.keys(FILE.flags);

export function isPlaceDial(value: unknown): value is string {
  return typeof value === "string" && Object.hasOwn(FILE.dials, value);
}

export function isPlaceFlag(value: unknown): value is string {
  return typeof value === "string" && Object.hasOwn(FILE.flags, value);
}

/** What a flag means, for a prompt or a screen. */
export function flagMeaning(flag: string): string | undefined {
  return FILE.flags[flag];
}

/** What a dial is measuring, in words. */
export function dialMeaning(dial: string): string | undefined {
  return FILE.dials[dial]?.meaning;
}

export const PLACE_STATE_IS_HOUSE_RULE: boolean = FILE.houseRule;

// ---------------------------------------------------------------------------
// The state of one place.
// ---------------------------------------------------------------------------

export type PlaceState = {
  placeKey: string;
  /** Filled segments, by dial key. Only dials this place actually has. */
  dials: Record<string, number>;
  flags: string[];
  visits: number;
  firstVisitDay: number | null;
  lastVisitDay: number | null;
};

/** The dials a place has at all, from its tags. */
export function dialsOf(placeKey: string): string[] {
  const tags: PlaceTag[] = tagsOf(placeKey);
  return PLACE_DIALS.filter((dial) => FILE.dials[dial]!.tags.some((tag) => tags.includes(tag)));
}

/**
 * Where a place starts, before anything has happened to it.
 *
 * Tags first, then whatever the writing said about this specific location. A
 * place nobody has written up still has dials, because the ground it stands on
 * says what can go wrong with it.
 */
export function startingState(placeKey: string): PlaceState {
  const dials: Record<string, number> = {};
  for (const dial of dialsOf(placeKey)) dials[dial] = FILE.dials[dial]!.start;
  const authored = FILE.places[placeKey];
  if (authored?.dials) {
    for (const [dial, value] of Object.entries(authored.dials)) {
      if (isPlaceDial(dial)) dials[dial] = clampDial(dial, value);
    }
  }
  return {
    placeKey,
    dials,
    flags: [...(authored?.flags ?? [])].filter(isPlaceFlag),
    visits: 0,
    firstVisitDay: null,
    lastVisitDay: null,
  };
}

export function segmentsOf(dial: string): number {
  return FILE.dials[dial]?.segments ?? 6;
}

function clampDial(dial: string, value: number): number {
  return Math.max(0, Math.min(segmentsOf(dial), Math.round(value)));
}

/** A place's dials in the shape the rest of the app already renders clocks in. */
export function dialClocks(state: PlaceState): LifeClock[] {
  return Object.entries(state.dials).map(([key, filled]) => ({
    key,
    label: FILE.dials[key]?.label ?? key,
    filled,
    segments: segmentsOf(key),
    // Local pressure is felt, not read. The player learns that the market has
    // gone quiet by finding it gone quiet.
    hidden: true,
  }));
}

export function hasFlag(state: PlaceState | undefined, flag: string): boolean {
  return !!state?.flags.includes(flag);
}

// ---------------------------------------------------------------------------
// What moves a dial.
// ---------------------------------------------------------------------------

/**
 * What each observation does to the place it happened in.
 *
 * The same closed vocabulary the pressure engine already prices, read a second
 * way: being loud draws the law to THIS ADDRESS as well as to the character,
 * and doing somebody an actual service is how a place comes to know you.
 *
 * These are pacing numbers, like OBSERVATION_COSTS beside them. No printed rule
 * says what being seen costs a market.
 */
export const PLACE_OBSERVATION_EFFECTS: Partial<
  Record<Observation, Partial<Record<string, number>>>
> = {
  seen: { police_attention: 1 },
  named: { police_attention: 1 },
  witness: { police_attention: 1 },
  loud: { police_attention: 2, goodwill: -1 },
  killed: { police_attention: 3, goodwill: -2, gang_pressure: 1 },
  wounded: { police_attention: 1, goodwill: -1 },
  property: { police_attention: 1, goodwill: -2 },
  burned: { goodwill: -2, gang_pressure: 1 },
  favour: { goodwill: 2, reclaimer_control: 1 },
  clean: { police_attention: -1 },
};

export type PlaceChange = {
  state: PlaceState;
  /** Dials that actually moved, for the ledger. */
  moved: { dial: string; from: number; to: number }[];
  /** Flags this change set or cleared, and why. */
  flagged: { flag: string; set: boolean; note: string }[];
};

/**
 * Fold a turn's observations into one place's state, then let any dial that has
 * crossed do what crossing means.
 *
 * A threshold does not leave the dial full and ringing — it fires, resets to a
 * lower mark, and leaves a flag behind. That is what makes a raid an event in
 * the life of a market rather than a permanent condition of it, and it is the
 * same discipline `fired()` applies to the pressure clocks.
 */
export function applyToPlace(state: PlaceState, observations: Observation[]): PlaceChange {
  const dials = { ...state.dials };
  const flags = new Set(state.flags);
  const flagged: PlaceChange["flagged"] = [];

  for (const observation of observations) {
    if (!OBSERVATION_COSTS[observation]) continue;
    const effects = PLACE_OBSERVATION_EFFECTS[observation];
    if (!effects) continue;
    for (const [dial, delta] of Object.entries(effects)) {
      // Only dials this place has. A rooftop farm has no gang pressure until
      // somebody gives it some, and a bar has never had reclaimer control.
      if (!(dial in dials) || delta === undefined) continue;
      dials[dial] = clampDial(dial, dials[dial]! + delta);
    }
  }

  for (const threshold of FILE.thresholds) {
    const value = dials[threshold.dial];
    if (value === undefined) continue;
    const crossed = threshold.at === 0 ? value <= 0 : value >= threshold.at;
    if (!crossed) continue;
    // Only when this is a change: a dial sitting at its threshold from a
    // previous turn should not fire again every time anybody looks at it.
    const alreadyFired = threshold.sets.every((flag) => flags.has(flag));
    if (alreadyFired) continue;
    for (const flag of threshold.sets) {
      if (!isPlaceFlag(flag) || flags.has(flag)) continue;
      flags.add(flag);
      flagged.push({ flag, set: true, note: threshold.note });
    }
    for (const flag of threshold.clears) {
      if (!flags.has(flag)) continue;
      flags.delete(flag);
      flagged.push({ flag, set: false, note: threshold.note });
    }
    dials[threshold.dial] = clampDial(threshold.dial, threshold.resets);
  }

  const moved = Object.keys(dials)
    .filter((dial) => dials[dial] !== state.dials[dial])
    .map((dial) => ({ dial, from: state.dials[dial] ?? 0, to: dials[dial]! }));

  return {
    state: { ...state, dials, flags: [...flags] },
    moved,
    flagged,
  };
}

/** Somebody was here. */
export function recordVisit(state: PlaceState, day: number): PlaceState {
  return {
    ...state,
    visits: state.visits + 1,
    firstVisitDay: state.firstVisitDay ?? day,
    lastVisitDay: day,
  };
}

/**
 * Whether a beat can still happen here.
 *
 * The link that makes any of this matter. A night market runs while the place
 * is a market; bring the law down on it enough times and the threshold clears
 * `market_open`, the beat stops firing, and the west concourse is somewhere
 * that USED to have a night market.
 */
export const BEAT_REQUIRES: Record<string, string> = {
  night_market: "market_open",
};

/** Flags that stop a place doing anything at all. */
export const SILENCING_FLAGS = ["shut"];

export function beatAllowedAt(
  beatKey: string,
  placeKey: string,
  state?: PlaceState | undefined,
): boolean {
  // No row means nothing has happened here yet, which is not the same as the
  // place being blank: it is the place as written.
  const here = state ?? startingState(placeKey);
  if (SILENCING_FLAGS.some((flag) => here.flags.includes(flag))) return false;
  const required = BEAT_REQUIRES[beatKey];
  return !required || here.flags.includes(required);
}
