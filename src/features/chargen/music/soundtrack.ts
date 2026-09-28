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
 * the rotation by being uploaded; nothing here lists them. A `-v2`, `-v3` on
 * the end is another take of the same song (`songOf`).
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
 * Which song a track is a take of. `music-badlands-highway-v2` is a second
 * take of `music-badlands-highway`: both play, never one straight after the
 * other, and they share one written prompt.
 */
export function songOf(track: string): string {
  return track.replace(/-v\d+$/, "");
}

/**
 * One round of the rotation: every track once, in a random order, with no two
 * takes of the same song back to back — including across rounds, so a round
 * never opens with a take of the song the last one ended on.
 *
 * Drawn a track at a time rather than shuffled and patched: at each draw, any
 * track whose song is not the one just played may come next, unless one song
 * has so many takes left that it has to go now or end the round doubled up.
 * If a song has more takes than everything else can separate, the rest of
 * them do play together; nothing is dropped.
 */
export function shuffleRound(
  tracks: readonly string[],
  lastPlayed: string | null,
  rng: () => number = Math.random,
): string[] {
  const left = [...tracks];
  const round: string[] = [];
  let previous = lastPlayed === null ? null : songOf(lastPlayed);
  while (left.length > 0) {
    const counts = new Map<string, number>();
    for (const t of left) counts.set(songOf(t), (counts.get(songOf(t)) ?? 0) + 1);
    // A song holding more than half of what is left must be spaced out now.
    const crowded = [...counts].find(([song, n]) => song !== previous && n * 2 > left.length);
    const allowed = left.filter((t) =>
      crowded ? songOf(t) === crowded[0] : songOf(t) !== previous,
    );
    const pool = allowed.length > 0 ? allowed : left;
    const pick = pool[Math.floor(rng() * pool.length)]!;
    left.splice(left.indexOf(pick), 1);
    round.push(pick);
    previous = songOf(pick);
  }
  return round;
}
