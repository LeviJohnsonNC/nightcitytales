/**
 * Where a starting character lives.
 *
 * Cyberpunk RED prints one line about this (Core p.109): you rent a Cargo
 * Container for 1,000eb a month, in the Overcrowded Suburbs or the Combat Zone.
 * `lifestyle.ts` next door reads that verbatim and is the authority on it —
 * the container, the rent, the Lifestyle and the two categories all come from
 * there and none of them are touched here.
 *
 * What this module adds is an ADDRESS. "Overcrowded Suburbs" and "Combat Zone"
 * are categories of district, and the atlas already knows which districts are
 * in them, which buildings in those districts are made of freight containers,
 * and what each one is like. So the printed choice can stay exactly what it is
 * while the player finds out that it means Eagle Rock Stadium — a football
 * field somebody filled with shipping containers — rather than a phrase.
 *
 * NOTHING HERE IS A RULE. Every option this offers already satisfies the
 * printed one; picking a building is a way of being in a category, not an
 * addition to it. There is no rent difference between addresses, because the
 * rulebook prints one number and this is not in the business of inventing a
 * second. What differs between them is who your neighbours are, who arrives
 * when you are loud, and what is within walking distance — all of which the
 * engine already computes for every location in the city.
 *
 * DERIVED, NOT LISTED. Which districts count as which category is a query over
 * the atlas rather than a hand-kept list, so the answer cannot drift from the
 * map: a district with nowhere to put a container is not offered, which is why
 * nobody is invited to park one in the Executive Zone.
 *
 * Pure TypeScript. Data in, plain objects out, no dice, no React.
 */
import suggestionData from "@/data/atlas/home-suggestions.json";
import {
  DISTRICTS,
  districtOfPlace,
  getDistrict,
  getPlace,
  isCombatZone,
  travelMinutes,
  type District,
} from "./geography";
import { startingLifestylePlan, type LifestyleChoice, STARTING_LOCATIONS } from "./lifestyle";
import { PLACE_ACTION_TEMPLATES } from "./placeActions";
import {
  districtProfile,
  hasTag,
  placesWithTag,
  tagsOf,
  type PlaceProfile,
  type PlaceTag,
} from "./places";

// ---------------------------------------------------------------------------
// The two printed categories.
// ---------------------------------------------------------------------------

/**
 * The categories, straight from the rules file via `lifestyle.ts`.
 *
 * Not redeclared here. If the rules data ever prints a third, it arrives on its
 * own and `districtsInCategory` decides what it means; a category this module
 * cannot place returns nothing rather than guessing.
 */
export const HOME_CATEGORIES: string[] = STARTING_LOCATIONS;

export function isHomeCategory(value: unknown): value is string {
  return typeof value === "string" && HOME_CATEGORIES.includes(value);
}

/** The tag that makes somewhere a place a rented cargo container could be. */
const CONTAINER_TAG = "container_housing";

/**
 * Which areas of the city the Overcrowded Suburbs means.
 *
 * The atlas describes `mainland` as "the overpacked suburbs, struggling to
 * rebuild in the Time of the Red", which is the printed phrase almost word for
 * word. `southside` is included with it because the sprawl does not stop at the
 * area boundary: Rancho Coronado is the most literally suburban ground in the
 * game — a mall, a stadium, and a district the atlas describes in the language
 * of consumer suburbia — and excluding it would mean the category could not
 * offer the place that best answers to it.
 */
const SUBURB_AREAS = ["mainland", "southside"];

function matchesCategory(district: District, category: string): boolean {
  if (category === "Combat Zone") return isCombatZone(district.key);
  if (category === "Overcrowded Suburbs") return SUBURB_AREAS.includes(district.area);
  return false;
}

/**
 * Somewhere in this district a rented container could actually be.
 *
 * This is the filter that keeps the whole thing honest without a list of
 * exclusions to maintain. The Executive Zone and Charter Hill are in the
 * suburbs by area and have nowhere to put a container, so they are not offered,
 * and nobody had to write down that a thousand eurobucks does not buy a
 * driveway on Charter Hill.
 */
export function homesIn(districtKeyOrCode: string): PlaceProfile[] {
  return placesWithTag(CONTAINER_TAG, districtKeyOrCode);
}

/** The districts this category can actually put a character in. */
export function districtsInCategory(category: string): District[] {
  if (!isHomeCategory(category)) return [];
  return DISTRICTS.filter((d) => matchesCategory(d, category) && homesIn(d.key).length > 0);
}

/** Every address the two printed categories offer between them. */
export function everyStartingHome(): PlaceProfile[] {
  const seen = new Set<string>();
  const out: PlaceProfile[] = [];
  for (const category of HOME_CATEGORIES) {
    for (const district of districtsInCategory(category)) {
      for (const home of homesIn(district.key)) {
        if (seen.has(home.key)) continue;
        seen.add(home.key);
        out.push(home);
      }
    }
  }
  return out;
}

/**
 * Whether this address is one the category actually offers.
 *
 * The check a saved choice is held to. A district can belong to both categories
 * — New Westbrook is a combat zone AND a suburb — so this asks whether the
 * pairing is offered rather than which single category an address belongs to.
 */
export function homeIsInCategory(placeKey: string, category: string): boolean {
  const district = districtOfPlace(placeKey);
  if (!district) return false;
  return (
    districtsInCategory(category).some((d) => d.key === district.key) &&
    hasTag(placeKey, CONTAINER_TAG)
  );
}

// ---------------------------------------------------------------------------
// The Exec, who is given somewhere instead of renting it.
// ---------------------------------------------------------------------------

/**
 * The corporate housing a starting Exec's Role Ability hands them.
 *
 * Their Teamwork Rank 2 grants a Corporate Conapt, and the atlas names ten
 * buildings that exist for exactly that: housing a corporation puts its own
 * people in. Choosing between them decides whose badge is in the lobby, which
 * is a fact about the character rather than a rule about the housing — the rent
 * is nothing at every one of them, as the rules file says.
 *
 * `luxury_housing` is filtered out, and that filter is the printed ladder
 * rather than taste: a gated community of duplexes is what the Exec's ability
 * grants at Rank 7, not at the Rank 4 every character starts at.
 */
export function execHomes(): PlaceProfile[] {
  return placesWithTag("corp_housing").filter((p) => !p.tags.includes("luxury_housing"));
}

export function isExecHome(placeKey: string): boolean {
  return execHomes().some((p) => p.key === placeKey);
}

// ---------------------------------------------------------------------------
// What choosing it would mean.
// ---------------------------------------------------------------------------

export type HomePreview = {
  placeKey: string;
  placeName: string;
  districtKey: string;
  districtName: string;
  /** The atlas's own one-liner for the building. */
  blurb: string;
  /** Who claims the ground, from the district's printed gang list. */
  gangs: string[];
  /** "NCPD (in theory), nobody comes." Read off the printed security provider. */
  ifItGoesLoud: string | null;
  wealth: string | null;
  crowd: string | null;
  /** A few things there are to do in the district, as named venues. */
  nearby: { label: string; placeName: string }[];
  /** Minutes to somewhere worth measuring against, on foot-and-transit defaults. */
  travel: { to: string; name: string; minutes: number }[];
};

/**
 * Places the whole city can be measured against.
 *
 * Three fixed points rather than a computed "interestingness", so the number a
 * player compares between two addresses always means the same thing. The
 * Afterlife because every edgerunner ends up there, City Hall because that is
 * where the city administers itself, and the Night Market because that is where
 * you buy what you need.
 */
const LANDMARK_PLACES = ["b1", "g4", "x5"];

/** How many verbs to show for the district. Enough to say what living there is like. */
const NEARBY_SHOWN = 4;

/**
 * Somewhere in the district that is not the character's own front door.
 *
 * A home with nothing around it is a real answer — the Reclamation Zone has
 * four locations and a character living in one of them genuinely does not have
 * much within walking distance — so an empty list is left empty rather than
 * padded back out with the home itself.
 */

/** What living here would actually be like, from what the engine already holds. */
export function homePreview(placeKey: string): HomePreview | null {
  const place = getPlace(placeKey);
  const district = districtOfPlace(placeKey);
  if (!place || !district) return null;
  const profile = districtProfile(district.key);

  // Deliberately asked for WITHOUT the home as the standing place. placeActions
  // puts wherever you are standing first and in full, which is right when you
  // are standing in it and wrong here: "within walking distance" listing your
  // own container stack three times says nothing about the neighbourhood. Asked
  // district-wide, it spreads across venues instead.
  // Built from the district's LOCATIONS rather than from placeActions, on
  // purpose. placeActions answers "what is there to do from where I stand",
  // which is capped at five for the whole district and offers each verb once —
  // so a venue with many tags takes three of the slots and the list describes
  // one building instead of a neighbourhood. This asks the other question:
  // which places are near you, and what is each one for.
  const nearby: HomePreview["nearby"] = [];
  for (const location of district.locations) {
    if (location.key === placeKey) continue;
    const verb = PLACE_ACTION_TEMPLATES.find((template) =>
      template.tags.some((tag) => tagsOf(location.key).includes(tag as PlaceTag)),
    );
    if (!verb) continue;
    nearby.push({ label: verb.label, placeName: location.name });
    if (nearby.length >= NEARBY_SHOWN) break;
  }

  const travel: HomePreview["travel"] = [];
  for (const to of LANDMARK_PLACES) {
    if (to === placeKey) continue;
    const target = getPlace(to);
    if (!target) continue;
    travel.push({ to, name: target.name, minutes: travelMinutes(placeKey, to) });
  }

  return {
    placeKey: place.key,
    placeName: place.name,
    districtKey: district.key,
    districtName: district.name,
    blurb: place.blurb,
    gangs: district.gangs,
    ifItGoesLoud: profile ? `${profile.response.who}, ${profile.response.label}.` : null,
    wealth: profile?.wealth ?? null,
    crowd: profile?.crowd ?? null,
    nearby,
    travel,
  };
}

// ---------------------------------------------------------------------------
// What the Lifepath already said about this.
// ---------------------------------------------------------------------------

type SuggestionFile = {
  houseRule: boolean;
  note: string;
  ruleNote: string;
  matchNote: string;
  suggestions: { startsWith: string; districts: string[]; line: string }[];
};

const SUGGESTIONS = suggestionData as unknown as SuggestionFile;

/** True when the suggestions are what they claim to be: a tunable house rule. */
export const HOME_SUGGESTIONS_ARE_HOUSE_RULE: boolean = SUGGESTIONS.houseRule;

/** Why they exist, and why they may not filter anything. */
export const HOME_SUGGESTIONS_RULE_NOTE: string = SUGGESTIONS.ruleNote;

export type HomeSuggestion = {
  /** District keys the Lifepath answer points at. Never a restriction. */
  districts: string[];
  /** One line, in the house voice, saying why. */
  line: string;
};

/**
 * Which districts this character's childhood points at, if any.
 *
 * A SUGGESTION. The caller highlights these and prints the line; every other
 * district stays exactly as pickable as it was. Returns null for an answer the
 * table does not print, for a character who has not answered yet, and for one
 * whose answer names nowhere the category can offer.
 */
export function suggestedHome(
  childhoodEnvironment: string | null | undefined,
): HomeSuggestion | null {
  if (!childhoodEnvironment) return null;
  const answer = childhoodEnvironment.trim();
  const row = SUGGESTIONS.suggestions.find((s) => answer.startsWith(s.startsWith));
  if (!row) return null;
  const districts = row.districts.filter((key) => getDistrict(key));
  if (!districts.length) return null;
  return { districts, line: row.line };
}

/**
 * The same thing, narrowed to what this category can actually offer.
 *
 * A childhood in a corporate starscraper points at Charter Hill, which has
 * nowhere to put a container: the honest answer there is to say nothing rather
 * than to highlight somewhere the player cannot choose.
 */
export function suggestedHomeIn(
  childhoodEnvironment: string | null | undefined,
  category: string,
): HomeSuggestion | null {
  const suggestion = suggestedHome(childhoodEnvironment);
  if (!suggestion) return null;
  const offered = new Set(districtsInCategory(category).map((d) => d.key));
  const districts = suggestion.districts.filter((key) => offered.has(key));
  return districts.length ? { districts, line: suggestion.line } : null;
}

// ---------------------------------------------------------------------------
// Holding a saved choice to the map.
// ---------------------------------------------------------------------------

/**
 * Whether a stored choice names ground that is really offered.
 *
 * `validateLifestyle` in `lifestyle.ts` asks whether the fields are filled in,
 * because that is a question about the printed rule. This asks whether what
 * they are filled in WITH exists and is on the menu, which is a question about
 * the atlas — a district key from an older build, a building that lost its
 * container housing, or an Exec pointed at somewhere no corporation owns all
 * come back here rather than reaching a campaign.
 */
export function validateStartingHome(
  choice: LifestyleChoice,
  roleId: string | null = null,
): string[] {
  const plan = startingLifestylePlan(roleId);
  const violations: string[] = [];

  if (plan.requiresLocation) {
    if (choice.location && !isHomeCategory(choice.location)) {
      violations.push(`"${choice.location}" is not one of the printed starting locations.`);
    }
    if (choice.placeKey && choice.location && !homeIsInCategory(choice.placeKey, choice.location)) {
      const place = getPlace(choice.placeKey);
      violations.push(
        `${place?.name ?? choice.placeKey} is not somewhere you can rent a ${plan.housingName} in the ${choice.location}.`,
      );
    }
  } else if (choice.placeKey && !isExecHome(choice.placeKey)) {
    const place = getPlace(choice.placeKey);
    violations.push(`${place?.name ?? choice.placeKey} is not corporate housing.`);
  }

  if (choice.districtKey && !getDistrict(choice.districtKey)) {
    violations.push(`"${choice.districtKey}" is not a district on the map.`);
  }
  if (choice.placeKey) {
    const district = districtOfPlace(choice.placeKey);
    if (!district) {
      violations.push(`"${choice.placeKey}" is not a location on the map.`);
    } else if (choice.districtKey && district.key !== choice.districtKey) {
      violations.push(`${getPlace(choice.placeKey)?.name} is not in ${district.name}.`);
    }
  }
  return violations;
}

/**
 * The address a campaign should open at, for a character who has chosen one.
 *
 * The whole point of the step. Before this existed the choice reached the
 * character sheet and the portrait prompt and nowhere else, so a player who
 * picked the Combat Zone woke up in Little Europe — the campaign fell back to
 * the atlas's default start because nothing ever set its location. Null when
 * the character has no valid address, and the caller keeps its own default.
 */
export function startingPositionFor(
  choice: LifestyleChoice,
  roleId: string | null = null,
): string | null {
  if (!choice.placeKey) return null;
  if (validateStartingHome(choice, roleId).length) return null;
  return getPlace(choice.placeKey) ? choice.placeKey : null;
}
