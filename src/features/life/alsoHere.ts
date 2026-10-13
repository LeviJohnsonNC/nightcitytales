/**
 * The walk-ons standing at the character's feet, asked of one function by both
 * halves of a Life turn: the context says who they are before the narrator
 * writes, and the apply step resolves the faces it tags against the same
 * answer. They share a seed (`campaign:location`) so they cannot disagree.
 */
import { shopsAt } from "@/engine";
import {
  alsoHereLines,
  ambientPeople,
  ambientSubjectsAt,
  type AmbientPerson,
} from "@/features/cast/ambientPeople";

export type AlsoHere = {
  /** Also the seed `resolveWalkOns` is given, so a face is never re-picked on a later render. */
  seed: string;
  people: AmbientPerson[];
  subjects: string[];
  lines: string[];
};

export function alsoHereAt(
  campaignId: string,
  locationKey: string,
  /** Names the character has learned here (`knownWalkOnNames`), told to the narrator with each line. */
  known?: ReadonlyMap<string, string>,
): AlsoHere {
  const seed = `${campaignId}:${locationKey}`;
  // A named keeper already staffs the counter; a second clerk would be invented.
  const hasKeeper = shopsAt(locationKey).some((shop) => shop.keeper);
  const people = ambientPeople(locationKey, seed, hasKeeper);
  return {
    seed,
    people,
    subjects: ambientSubjectsAt(locationKey, seed, hasKeeper),
    lines: alsoHereLines(people, known),
  };
}
