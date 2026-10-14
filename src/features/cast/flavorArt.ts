/**
 * Stock portraits for walk-on roles that are not part of the standing cast —
 * a bartender, a beat cop — with no dossier of their own, just a face to put
 * next to a name the GM invents in passing.
 *
 * Pure: no React, no fetching. Mirrors npcArtwork()'s two-width convention
 * one directory over (public/images/flavor instead of public/images/cast).
 */
import FLAVOR_ART from "@/data/cast/flavor-art.json";
import type { Look } from "@/engine";

export type FlavorGender = "male" | "female";

interface FlavorArtEntry {
  id: string;
  type: "person";
  subject: string;
  gender: FlavorGender;
  /** How old the person in the picture looks. Read through `ageBand` for the narrator. */
  age: number;
  /** The square (in the 1024x683 scene) that holds the head and shoulders. */
  face: { x: number; y: number; size: number };
}

const ENTRIES = FLAVOR_ART.entries as FlavorArtEntry[];

/** The narrow width flavor art is also encoded at. See tools/art/webp.mjs. */
const NARROW_WIDTH = 512;

export interface FlavorArtwork {
  /** The catalog id of this variant: what a stored walk-on remembers its face by. */
  id: string;
  src: string;
  srcSet: string;
  alt: string;
  /** The 256px square cut from `face` (tools/art/flavor-faces.mjs): what sits beside a line of narration. */
  faceSrc: string;
  /** What the picture shows, for the caption: sex and the band of age. */
  look: Look;
}

function artworkFor(entry: FlavorArtEntry): FlavorArtwork {
  const base = `/images/flavor/${entry.id}`;
  return {
    id: entry.id,
    src: `${base}.webp`,
    srcSet: `${base}-${NARROW_WIDTH}.webp ${NARROW_WIDTH}w, ${base}.webp 1024w`,
    alt: entry.subject.replace(/-/g, " "),
    faceSrc: `${base}-face.webp`,
    look: { sex: entry.gender, age: entry.age },
  };
}

/**
 * The art for a walk-on subject, keyed by its stable slug (e.g. "dive-bar-tender").
 *
 * A subject can have several faces for one gender: the original, then a young and
 * an older one. `face` is the id of the one wanted, which a walk-on remembers; a
 * face that does not exist, or is the other gender, is ignored. `gender` narrows
 * to a gender, and left out (or asking for one this subject does not have) it falls
 * back to whatever exists. With neither, or when nothing is named, the answer is
 * the first variant on file, which is the original: never a die, so a face a
 * legacy walk-on was stored without is the same face on every render.
 */
export function flavorArt(
  subject: string,
  gender?: FlavorGender,
  face?: string,
): FlavorArtwork | undefined {
  const variants = ENTRIES.filter((e) => e.subject === subject);
  if (variants.length === 0) return undefined;
  const named = face ? variants.find((e) => e.id === face) : undefined;
  if (named && (!gender || named.gender === gender)) return artworkFor(named);
  const matching = gender ? variants.filter((e) => e.gender === gender) : [];
  const pool = matching.length > 0 ? matching : variants;
  return artworkFor(pool[0]!);
}

/** Every subject slug with at least one variant on file, for content tooling. */
export const FLAVOR_SUBJECTS: string[] = [...new Set(ENTRIES.map((e) => e.subject))].sort();

/** "dive-bar-tender" -> "Dive Bar Tender", for printing the subject list in a prompt. */
export function flavorSubjectLabel(subject: string): string {
  return subject
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Stable number for a string. FNV-1a, same as haunts.ts/placeBeats.ts use. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Every gender this subject has a variant for, in file order, each once. */
export function flavorGenders(subject: string): FlavorGender[] {
  return [...new Set(ENTRIES.filter((e) => e.subject === subject).map((e) => e.gender))];
}

/**
 * Which of a subject's faces (for one gender) a walk-on gets, deterministically.
 *
 * The same seed always gives the same face, so "the bartender at this place" is the
 * same woman on every visit, and the narrator's "Seen as" line, written before the
 * turn, is about the face the player is then shown. Undefined only when the subject
 * has no art for that gender.
 */
export function pickFlavorFace(
  subject: string,
  gender: FlavorGender,
  seed: string,
): string | undefined {
  const ids = ENTRIES.filter((e) => e.subject === subject && e.gender === gender).map((e) => e.id);
  return ids.length > 0 ? ids[hash(seed) % ids.length] : undefined;
}

/**
 * Which gender a walk-on mention of `subject` actually gets, deterministically.
 *
 * The model may say which gender it meant; if that gender has no art for this
 * subject, or it said nothing, the same seed always resolves to the same
 * gender for this subject — so "the bartender at Skiv's Counter" doesn't
 * flip between visits, the same idiom `haunts.ts` uses for "is he here?".
 * Undefined only when the subject has no art at all.
 */
export function resolveFlavorGender(
  subject: string,
  requested: FlavorGender | undefined,
  seed: string,
): FlavorGender | undefined {
  const genders = flavorGenders(subject);
  if (genders.length === 0) return undefined;
  if (requested && genders.includes(requested)) return requested;
  return genders[hash(seed) % genders.length];
}
