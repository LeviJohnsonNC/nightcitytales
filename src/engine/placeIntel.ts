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
import { flagMeaning, type PlaceState } from "./placeState";

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

function whatHasHappened(state: PlaceState | undefined): string | null {
  if (!state?.flags.length) return null;
  const said = state.flags.map((flag) => flagMeaning(flag) ?? flag);
  return `Since you have been coming here: ${said.join(" ")}`;
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
            : whatHasHappened(state);
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
