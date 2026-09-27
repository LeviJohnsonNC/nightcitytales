/**
 * Which piece of music belongs to which part of making a character.
 *
 * Five cues, each a file the player's soundtrack is uploaded as. The creator
 * is one long scene with a shape — a quiet, dangerous room; a conversation; the
 * people who are waiting; the montage of becoming somebody; the reveal — and
 * the music follows the shape rather than the page.
 *
 * Pure: a step in, a cue out. What plays it is `musicDirector.ts`.
 */
import type { ChargenStep } from "../steps";

export type Cue = "meet" | "interview" | "people" | "build" | "reveal";

/** The uploaded file each cue plays, by name. A missing file is silence. */
export const CUE_FILES: Record<Cue, string> = {
  meet: "music-meet.mp3",
  interview: "music-interview.mp3",
  people: "music-people.mp3",
  build: "music-build.mp3",
  reveal: "music-reveal.mp3",
};

/** The reveal plays once and carries into night one; everything else loops. */
export function cueLoops(cue: Cue): boolean {
  return cue !== "reveal";
}

/** The cue for a step. The people chapter of the Lifepath overrides this from inside it. */
export function cueForStep(step: ChargenStep): Cue {
  switch (step) {
    case "fixer":
      return "meet";
    case "role":
    case "method":
    case "lifepath":
      return "interview";
    case "review":
      return "reveal";
    default:
      return "build";
  }
}
