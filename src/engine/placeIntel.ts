/**
 * What you know about somewhere, because you have been there.
 *
 * The feeling this exists for: a job names a building, and instead of reading
 * "Mission Map #17" the player thinks *I know that building — the elevator is
 * dead, there is a way onto the roof from the container stacks, and the
 * Alligators run the carwash across the road.*
 *
 * The tempting way to build that is a die modifier: familiar ground, +1. This
 * does not do that, deliberately. Cyberpunk RED's DVs are printed and a
 * home-field bonus is an invented rule; `PRODUCT.md` lists "a number appears in
 * prose that no engine module produced" as the worst smell in the codebase.
 * The rules-legal route to a +1 is a Complementary Skill Check, which is the
 * player's to attempt rather than the world's to hand over.
 *
 * So FAMILIARITY PAYS IN INFORMATION. Visits unlock, one rung at a time and in
 * a fixed order, facts the engine already holds about the place: what is there,
 * who claims it, who comes when you are loud, and what has happened to it since
 * you first walked past. That is the same ladder the cast dossiers use, pointed
 * at a building instead of a person, and it changes decisions without touching
 * a die.
 *
 * Every rung is READ, never written: each one comes from the atlas, from the
 * gameplay tags, or from the campaign's own row for the place. Nothing here can
 * state something that is not already true somewhere else.
 *
 * Pure TypeScript.
 */
import { districtOfPlace, getPlace } from "./geography";
import { districtProfile, tagMeaning, tagsOf } from "./places";
import { flagMeaning, startingState, type PlaceState } from "./placeState";

/**
 * How many visits each rung costs.
 *
 * Walking past tells you what the place is. Coming back tells you who runs the
 * street. Knowing it properly takes more than an errand.
 */
export const INTEL_LADDER = [
  { visits: 1, rung: "what" },
  { visits: 2, rung: "who" },
  { visits: 4, rung: "law" },
  { visits: 6, rung: "state" },
] as const;

export type IntelRung = (typeof INTEL_LADDER)[number]["rung"];

export type PlaceIntel = {
  placeKey: string;
  placeName: string;
  /** How many rungs this character has actually earned. */
  visits: number;
  /** One line per rung, in ladder order. Empty for somewhere never visited. */
  known: string[];
};

/** Which rungs this many visits has opened. */
export function rungsFor(visits: number): IntelRung[] {
  return INTEL_LADDER.filter((step) => visits >= step.visits).map((step) => step.rung);
}

function whatItIs(placeKey: string): string | null {
  const tags = tagsOf(placeKey);
  const meanings = tags.map((tag) => tagMeaning(tag)).filter((m): m is string => !!m);
  if (!meanings.length) return null;
  return `What it is: ${meanings.slice(0, 3).join("; ")}.`;
}

function whoClaimsIt(placeKey: string): string | null {
  const district = districtOfPlace(placeKey);
  if (!district?.gangs.length) return null;
  return `Who claims this ground: ${district.gangs.join(", ")}.`;
}

function whoComes(placeKey: string): string | null {
  const district = districtOfPlace(placeKey);
  const profile = district ? districtProfile(district.key) : undefined;
  if (!profile) return null;
  return `If it goes loud: ${profile.response.who}, ${profile.response.label}.`;
}

/**
 * What has CHANGED here, which is not the same as what is true here.
 *
 * The rung says "since you have been coming here", so it has to be measured
 * against how the place started rather than read off the flags it happens to
 * carry. A market is flagged `market_open` from the moment the city is built;
 * reporting that as news told a player who had earned this rung that trade runs
 * here as usual, which they could see, and which had not happened.
 *
 * Both directions count, and the second one is the point. When a raid clears
 * `market_open` the flag simply vanishes from the list, so the one moment this
 * whole system exists for — the market you have been shopping at for six weeks
 * is gone — produced no line at all.
 */
function whatHasHappened(placeKey: string, state: PlaceState | undefined): string | null {
  if (!state) return null;
  const started = new Set(startingState(placeKey).flags);
  const now = new Set(state.flags);
  const said: string[] = [];
  for (const flag of state.flags) {
    if (!started.has(flag)) said.push(flagMeaning(flag) ?? flag);
  }
  for (const flag of started) {
    if (!now.has(flag)) said.push(flagGone(flag));
  }
  if (!said.length) return null;
  return `Since you have been coming here: ${said.join(" ")}`;
}

/**
 * What it means that a flag the place started with is no longer set.
 *
 * A closed vocabulary like the flags themselves. Anything not named here is
 * reported as the plain fact that it has stopped being true, which is honest
 * and readable rather than a gap.
 */
const FLAG_GONE: Record<string, string> = {
  market_open: "The trade that ran here has stopped.",
  gang_extortion: "Whoever was taking a cut of everything is no longer taking it.",
  power_out: "The power has come back.",
  raided: "The law has stopped coming through.",
  locked_down: "Access is no longer being checked the way it was.",
  under_audit: "Whoever was going through the records has finished.",
};

function flagGone(flag: string): string {
  return FLAG_GONE[flag] ?? `That is no longer true: ${flagMeaning(flag) ?? flag}`;
}

/**
 * What this character knows about this place.
 *
 * A place they have never been returns no lines at all — not a blank readout, a
 * genuinely empty one, because the briefing should say nothing rather than say
 * that nothing is known.
 */
export function placeIntel(placeKey: string, state?: PlaceState | undefined): PlaceIntel | null {
  const place = getPlace(placeKey);
  if (!place) return null;
  const visits = state?.visits ?? 0;
  const rungs = rungsFor(visits);
  const lines: string[] = [];

  for (const rung of rungs) {
    const line =
      rung === "what"
        ? whatItIs(placeKey)
        : rung === "who"
          ? whoClaimsIt(placeKey)
          : rung === "law"
            ? whoComes(placeKey)
            : whatHasHappened(placeKey, state);
    if (line) lines.push(line);
  }

  return { placeKey, placeName: place.name, visits, known: lines };
}

/** "You have been to the Greenbox Storage Units four times." */
export function describeFamiliarity(intel: PlaceIntel): string | null {
  if (!intel.visits) return null;
  return intel.visits === 1
    ? `You have been to ${intel.placeName} once.`
    : `You have been to ${intel.placeName} ${intel.visits} times.`;
}

// ---------------------------------------------------------------------------
// How well they know it, for the narrator.
// ---------------------------------------------------------------------------

/**
 * How a place should be described, given how often the character has been.
 *
 * Not a number for the model to restate. The bands exist because the SAME place
 * needs writing three different ways: somewhere new has to be established,
 * somewhere familiar should not be established again, and somewhere they
 * practically live is furniture they would not look at twice.
 *
 * Before this existed the narrator was told nothing at all, so every arrival
 * read as a first arrival — the character who lives at Eagle Rock Stadium had
 * their own front door introduced to them every night. Handing the narrator the
 * written canon made that worse rather than better: with a fixed body of facts
 * to reach for, it would recite the same ones every visit.
 */
export type PlaceStanding = "first" | "returning" | "known";

export type PlaceFamiliarity = {
  placeKey: string;
  visits: number;
  standing: PlaceStanding;
  /** Days since they were last here. Null on a first visit. */
  daysSince: number | null;
  /** The rungs their visits have earned, same as placeIntel. */
  known: string[];
};

/**
 * The bands, read off the intel ladder rather than invented beside it.
 *
 * `known` is the ladder's own top rung — the point at which the engine already
 * considers somebody to know a place properly, and the number newCampaign uses
 * to say a character knows the building they live in.
 */
const KNOWS_IT_WELL: number = INTEL_LADDER[INTEL_LADDER.length - 1]!.visits;

export function standingFor(visits: number): PlaceStanding {
  if (visits >= KNOWS_IT_WELL) return "known";
  return visits <= 1 ? "first" : "returning";
}

/**
 * What the narrator should know about how familiar this place is.
 *
 * Null for somewhere the atlas does not have. A place with no stored state is
 * somewhere they have never been, which is a real answer rather than a gap.
 */
export function placeFamiliarity(
  placeKey: string,
  state: PlaceState | undefined,
  today: number,
): PlaceFamiliarity | null {
  const place = getPlace(placeKey);
  if (!place) return null;
  const visits = state?.visits ?? 0;
  const last = state?.lastVisitDay ?? null;
  return {
    placeKey,
    visits,
    standing: standingFor(visits),
    // The visit being made now is already recorded by the time a turn renders,
    // so "today" is the common case and reads as no gap at all.
    daysSince: last === null ? null : Math.max(0, today - last),
    known: placeIntel(placeKey, state)?.known ?? [],
  };
}
