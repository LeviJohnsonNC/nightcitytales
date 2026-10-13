/**
 * Who is already standing in a place, decided before the narrator writes.
 *
 * A walk-on used to be chosen after the prose: the narrator named a role, said
 * a gender "only when the fiction already makes it plain", and the interface
 * picked a face from forty pictures that differ in nothing but role and sex. A
 * paragraph about "her" could sit over a man, and the narrator never learned
 * which face the player was shown. This reverses it. A place's tags
 * (`walkon-places.json`) name the roles that work there, the campaign and the
 * place pick which of them are in and which face each one is, and the Life
 * packet tells the narrator who they are ("Also here"). The picture then
 * follows the words because the words were written to the picture.
 *
 * Deterministic and stored nowhere: the same campaign at the same place always
 * has the same people, so "the bartender at Skiv's" is the same woman on every
 * visit, the idiom `haunts.ts` and `resolveFlavorGender` already use.
 *
 * Presentation data. It moves no die, DV or price; it only says who is there.
 */
import PLACES from "@/data/cast/walkon-places.json";
import { seenAsLine, tagsOf } from "@/engine";
import { flavorArt, flavorSubjectLabel, resolveFlavorGender, type FlavorGender } from "./flavorArt";

/** The most people the narrator is told are here. A room, not a roll call. */
export const MAX_ALSO_HERE = 2;

const BY_TAG = PLACES.tags as Record<string, string[]>;
const SELLERS = new Set<string>(PLACES.sellers);

export type AmbientPerson = {
  /** The walk-on id the narrator tags them with. */
  subject: string;
  gender: FlavorGender;
  /** "woman, older": how they read, from the picture. */
  seenAs: string;
};

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The roles that could be here, most important first.
 *
 * A place's tags are authored in order of what it mostly is, so its first tag's
 * roles come first: a bar always has its bartender. A seed only reorders roles
 * that share a tag, which is what keeps one fence from always having the pawn
 * broker and the next always the junk dealer.
 */
function candidates(placeKey: string, seed: string, hasKeeper: boolean): string[] {
  const roles: string[] = [];
  for (const tag of tagsOf(placeKey)) {
    const here = [...(BY_TAG[tag] ?? [])].sort(
      (a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`) || a.localeCompare(b),
    );
    for (const role of here) if (!roles.includes(role)) roles.push(role);
  }
  return roles.filter((role) => !(hasKeeper && SELLERS.has(role)));
}

/**
 * The walk-on roles this place has in it, as ids. `resolveWalkOns` uses this to
 * ignore a gender the narrator asks for on any of them: who they are was
 * settled, and told to it, before it wrote.
 */
export function ambientSubjectsAt(placeKey: string, seed: string, hasKeeper: boolean): string[] {
  return candidates(placeKey, seed, hasKeeper).slice(0, MAX_ALSO_HERE);
}

/** The people in the room, with the face each one is. Empty for a place with none of the roles. */
export function ambientPeople(placeKey: string, seed: string, hasKeeper: boolean): AmbientPerson[] {
  const out: AmbientPerson[] = [];
  for (const subject of ambientSubjectsAt(placeKey, seed, hasKeeper)) {
    const gender = resolveFlavorGender(subject, undefined, `${seed}:${subject}`);
    if (!gender) continue;
    const art = flavorArt(subject, gender);
    const seenAs = art ? seenAsLine(art.look) : null;
    if (seenAs) out.push({ subject, gender, seenAs });
  }
  return out;
}

/**
 * One packet line apiece: `"dive-bar-tender" (Dive Bar Tender): woman, older`. A
 * person the character has already learned the name of says so, so the narrator keeps
 * calling them that rather than making up another.
 */
export function alsoHereLines(
  people: readonly AmbientPerson[],
  known: ReadonlyMap<string, string> = new Map(),
): string[] {
  return people.map((p) => {
    const name = known.get(p.subject);
    return (
      `"${p.subject}" (${flavorSubjectLabel(p.subject)}): ${p.seenAs}` +
      (name ? `; the character knows them as ${name}` : "")
    );
  });
}
