/**
 * The character creator's soundtrack: every track there is, shuffled.
 *
 * It used to give each part of the creator its own cue — a track for the
 * meet, one for the interview, one for the build — and it did not survive
 * play. A player spends thirty seconds on one step and ten minutes on another,
 * so a cue either cut off before it had gone anywhere or looped until it wore
 * thin. Now the creator is simply scored: the tracks play one after another in
 * a shuffled order, each fading into the next.
 *
 * The playlist is every uploaded file named `music-…`, so a new track joins
 * the rotation by being uploaded; nothing here lists them.
 *
 * Pure apart from reading which files exist. What plays it is `musicDirector.ts`.
 */
import { uploadedAssetNames } from "../art";

/** The file-name prefix that puts a track in the creator's rotation. */
export const TRACK_PREFIX = "music-";

/** Every track in the rotation, by name. Empty until something is uploaded. */
export function playlist(): string[] {
  return uploadedAssetNames(TRACK_PREFIX);
}

/**
 * One round of the rotation: every track once, in a random order. When the
 * last round ended on the track this one would open with, the two swap, so a
 * reshuffle never plays the same track twice in a row.
 */
export function shuffleRound(
  tracks: readonly string[],
  lastPlayed: string | null,
  rng: () => number = Math.random,
): string[] {
  const round = [...tracks];
  for (let i = round.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [round[i], round[j]] = [round[j]!, round[i]!];
  }
  if (round.length > 1 && round[0] === lastPlayed) {
    [round[0], round[1]] = [round[1]!, round[0]!];
  }
  return round;
}
