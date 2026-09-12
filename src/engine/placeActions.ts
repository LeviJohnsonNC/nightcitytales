/**
 * What there is to do where you are standing.
 *
 * Step two made a place able to put a SITUATION in front of the character.
 * This is the other half, and the quieter one: the ordinary business of being
 * somewhere. Buy vegetables. Have a drink. Fill your bottles. Ask around.
 *
 * It exists because of a specific failure mode. A map you can travel on, with
 * events that sometimes fire, still leaves the commonest outcome — you go
 * somewhere and nothing in particular is happening — as a dead end, and a game
 * whose quiet moments are dead ends will manufacture noise to avoid them.
 * Jack 'N' the Green on an ordinary afternoon is workers tending the beds and
 * music from an old speaker: you can talk to them, buy vegetables, and leave.
 * That has to be a supported thing to do rather than a gap in the content.
 *
 * Three rules:
 *
 *  - EVERY ACTION NAMES A VENUE. Not "eat" but "Get something to eat · Yum
 *    Seng". A named counter at a named place is the whole difference between
 *    this and a Socialize button.
 *
 *  - ACTIONS COME FROM TAGS, so the entire city answers rather than the few
 *    places somebody has written up. Every one of the 156 locations has tags,
 *    so every one of them offers whatever its ground supports.
 *
 *  - THEY ARE SHORTCUTS, NEVER THE MENU. `PRODUCT.md` is explicit that the
 *    moment suggestions become the options, this is a dialogue tree with
 *    latency. These speed up the common verb; the freeform line is still where
 *    the strange thing happens.
 *
 * Prices are house rules, flagged as such in the data and anchored to the
 * published cost ladder. Anything the engine already prices — a repair, a
 * ripperdoc's bill — is left unpriced here for the engine to answer.
 *
 * Pure TypeScript: a position in, a short list out.
 */
import data from "@/data/atlas/place-actions.json";
import { getDistrict, getPlace } from "./geography";
import { rungsFromLocalExpert } from "./placeIntel";
import { tagsOf, type PlaceTag } from "./places";
import { SILENCING_FLAGS, type PlaceState } from "./placeState";

type ActionFile = {
  houseRule: boolean;
  note: string;
  costNote: string;
  cap: number;
  capNote: string;
  actions: {
    key: string;
    tags: string[];
    label: string;
    description: string;
    minutes: number;
    cost: number | null;
    /** Only offered as a shortcut to somebody who knows the area. */
    local?: boolean;
  }[];
};

const FILE = data as unknown as ActionFile;

/** Every verb the city knows, before any of them is attached to a place. */
export const PLACE_ACTION_TEMPLATES = FILE.actions;

/**
 * How many things a place offers at once. Five.
 *
 * A location that lists everything it could conceivably support is a menu, and
 * the player stops reading menus.
 */
export const MAX_PLACE_ACTIONS: number = FILE.cap;

/** True when these are what they claim to be: tunable house rules. */
export const PLACE_ACTIONS_ARE_HOUSE_RULE: boolean = FILE.houseRule;

/** One thing to do, at one named place. */
export type PlaceAction = {
  /** Unique for this offer: the verb and the venue it is offered at. */
  key: string;
  /** The verb's own key, so a caller can branch on what kind of thing it is. */
  action: string;
  label: string;
  description: string;
  placeKey: string;
  placeName: string;
  minutes: number;
  /**
   * What it costs, when it is a thing with a price. Null means the engine
   * decides — a repair, a doctor's bill, whatever the stall is asking tonight —
   * and the player is told before they commit rather than after.
   */
  cost: number | null;
  /** True when the character is standing in this place rather than nearby. */
  here: boolean;
};

/** The verbs a place's own ground supports. */
function templatesFor(tags: PlaceTag[]): ActionFile["actions"] {
  return FILE.actions.filter((template) => template.tags.some((tag) => tags.includes(tag)));
}

export type PlaceActionInput = {
  /** The district the character is in. */
  districtKey: string;
  /** The venue they are standing in, when they are standing in one. */
  placeKey?: string | undefined;
  /**
   * What has happened to these places. A shut place sells nothing: the counter
   * a beat closed should not still be offering to serve you.
   *
   * Also how a stranger earns a `local` action: having been somewhere is
   * knowing it is there.
   */
  places?: Record<string, PlaceState> | undefined;
  /**
   * How much of a local the character is in this district.
   *
   * Some doors are only found by people who know the area — the unlicensed
   * surgery, the fence, the bunk nobody writes your name down for. Those are
   * flagged `local` in the data and offered as a SHORTCUT only to somebody who
   * knows this neighbourhood. Zero, or omitted, and the list is what a stranger
   * would find, which is what every caller got before this existed.
   *
   * Read through `placeIntel`'s own ladder rather than against a number of its
   * own: the rung that tells a local which doors are around here is the same
   * one that lets them walk up to them.
   */
  localExpertLevel?: number | undefined;
};

/**
 * Whether this character knows the area well enough to be shown its quiet doors.
 *
 * Three ways in, and all of them are "you already know this place is here":
 *
 *  - STANDING IN IT. You are at the door; there is nothing left to find out.
 *    This is not a concession, it is what the gate is about — being a stranger
 *    costs you knowing WHERE the quiet doors are, never the ability to act once
 *    you are at one. Without it, a building whose only business is a quiet one
 *    became a dead pin for every stranger, which is the exact failure the whole
 *    module was written against.
 *  - BEING A LOCAL in the district, through `placeIntel`'s own ladder.
 *  - HAVING BEEN HERE BEFORE. A fence you have already bought from is not a
 *    secret again next week.
 */
function knowsTheseDoors(args: {
  here: boolean;
  localExpertLevel: number;
  placeKey: string;
  places?: Record<string, PlaceState> | undefined;
}): boolean {
  if (args.here) return true;
  if (rungsFromLocalExpert(args.localExpertLevel).includes("neighbourhood")) return true;
  return (args.places?.[args.placeKey]?.visits ?? 0) > 0;
}

/**
 * What is worth doing from where the character is standing.
 *
 * Standing IN somewhere puts that place's own business first — you are at the
 * counter, so the counter is the offer. Everything else is the district around
 * them, which is what makes a district somewhere to be rather than a label on
 * a pin: a character in Rancho Coronado with nothing happening can still go and
 * buy vegetables at Jack 'N' the Green, because that is a real place that is
 * really there and really sells them.
 */
export function placeActions(input: PlaceActionInput): PlaceAction[] {
  const district = getDistrict(input.districtKey);
  if (!district) return [];

  const out: PlaceAction[] = [];
  const seen = new Set<string>();
  const localExpertLevel = input.localExpertLevel ?? 0;

  const offer = (placeKey: string, here: boolean, only?: "local" | "ordinary") => {
    const place = getPlace(placeKey);
    if (!place) return;
    // Somewhere the law closed is not open for business.
    if (SILENCING_FLAGS.some((flag) => input.places?.[placeKey]?.flags.includes(flag))) return;
    const known = knowsTheseDoors({
      here,
      localExpertLevel,
      placeKey,
      ...(input.places ? { places: input.places } : {}),
    });
    for (const template of templatesFor(tagsOf(placeKey))) {
      const isLocal = template.local === true;
      if (only === "local" && !isLocal) continue;
      if (only === "ordinary" && isLocal) continue;
      // A door you would have to know somebody to find. Still on the map, still
      // reachable by travelling there or by being sent — just not handed to a
      // stranger as a shortcut.
      if (isLocal && !known) continue;
      // One offer of a verb at a time. Six bars in a district is not six
      // chances to have a drink, it is one drink and a choice of bar, and the
      // choice of bar is the map's job rather than this list's.
      if (seen.has(template.key)) continue;
      seen.add(template.key);
      out.push({
        key: `${template.key}@${place.key}`,
        action: template.key,
        label: template.label,
        description: template.description,
        placeKey: place.key,
        placeName: place.name,
        minutes: template.minutes,
        cost: template.cost,
        here,
      });
    }
  };

  // Where they are standing, first and in full.
  if (input.placeKey) offer(input.placeKey, true);

  // Then the rest of the district, in the atlas's own order, which is
  // alphabetical by name and therefore stable — but the quiet doors first.
  //
  // The cap is five, and without this the ordering silently undid the gate:
  // a local's fence sat behind "fill your bottles" and never made the list, so
  // knowing the neighbourhood swapped one ordinary verb for another instead of
  // buying anything. The shortcut worth having is the one a stranger could not
  // have found, so it goes above the one they could.
  for (const pass of ["local", "ordinary"] as const) {
    for (const place of district.locations) {
      if (place.key === input.placeKey) continue;
      offer(place.key, false, pass);
    }
  }

  return out.slice(0, MAX_PLACE_ACTIONS);
}

/**
 * How an action reads when the player picks it.
 *
 * Written as something the character does at a named place, because that is
 * what goes to the narrator: it dresses an action the engine has already
 * decided is possible here, rather than being asked whether it is.
 */
export function describePlaceAction(action: PlaceAction): string {
  return `${action.label} at ${action.placeName}.`;
}
