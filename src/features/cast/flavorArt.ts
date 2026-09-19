/**
 * Stock portraits for walk-on roles that are not part of the standing cast —
 * a bartender, a beat cop — with no dossier of their own, just a face to put
 * next to a name the GM invents in passing.
 *
 * Pure: no React, no fetching. Mirrors npcArtwork()'s two-width convention
 * one directory over (public/images/flavor instead of public/images/cast).
 */
import FLAVOR_ART from "@/data/cast/flavor-art.json";

export type FlavorGender = "male" | "female";

interface FlavorArtEntry {
  id: string;
  type: "person";
  subject: string;
  gender: FlavorGender;
}

const ENTRIES = FLAVOR_ART.entries as FlavorArtEntry[];

/** The narrow width flavor art is also encoded at. See tools/art/webp.mjs. */
const NARROW_WIDTH = 512;

export interface FlavorArtwork {
  src: string;
  srcSet: string;
  alt: string;
}

function artworkFor(entry: FlavorArtEntry): FlavorArtwork {
  const base = `/images/flavor/${entry.id}`;
  return {
    src: `${base}.webp`,
    srcSet: `${base}-${NARROW_WIDTH}.webp ${NARROW_WIDTH}w, ${base}.webp 1024w`,
    alt: entry.subject.replace(/-/g, " "),
  };
}

/**
 * The art for a walk-on subject, keyed by its stable slug (e.g. "dive-bar-tender").
 *
 * `gender` narrows to a specific variant. Left out, or asking for one this
 * subject does not have on file, picks uniformly at random among whatever
 * variants DO exist — a caller that does not know or care which gender still
 * gets a face rather than nothing, and a subject with only one variant always
 * returns that one.
 */
export function flavorArt(subject: string, gender?: FlavorGender): FlavorArtwork | undefined {
  const variants = ENTRIES.filter((e) => e.subject === subject);
  if (variants.length === 0) return undefined;
  const matching = gender ? variants.filter((e) => e.gender === gender) : [];
  const pool = matching.length > 0 ? matching : variants;
  return artworkFor(pool[Math.floor(Math.random() * pool.length)]!);
}

/** Every subject slug with at least one variant on file, for content tooling. */
export const FLAVOR_SUBJECTS: string[] = [...new Set(ENTRIES.map((e) => e.subject))].sort();
