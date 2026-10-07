/**
 * The soundtrack: two playlists, each one shuffled.
 *
 * It used to give each part of the creator its own cue — a track for the
 * meet, one for the interview, one for the build — and it did not survive
 * play. A player spends thirty seconds on one step and ten minutes on another,
 * so a cue either cut off before it had gone anywhere or looped until it wore
 * thin. Now the creator is simply scored: the tracks play one after another in
 * a shuffled order, each fading into the next.
 *
 * They are told apart by file name, so a new track joins one by being
 * uploaded. `music-…` is NIGHT SHIFT, the original score, all of it
 * instrumental, and the one NCAmp opens on. `radio-…` is RADIO FREE NIGHT CITY,
 * the songs with vocals. `quiet-…` is NO QUIET HOURS, an album: it is the one
 * playlist with a running order (`order`), which its window lists and which
 * plays front to back whenever shuffle is off. A `-v2`, `-v3` on the end is
 * another take of the same song (`songOf`).
 *
 * Pure apart from reading which files exist. What plays it is `musicDirector.ts`.
 */
import { uploadedAssetNames } from "@/features/chargen/art";

/** The file-name prefix that puts a track in the original, instrumental playlist. */
export const TRACK_PREFIX = "music-";

export type PlaylistId = "night-shift" | "radio-free" | "no-quiet-hours";

export type PlaylistDef = {
  id: PlaylistId;
  /** What NCAmp calls it. */
  name: string;
  /** The button's label, where there is room for little. */
  short: string;
  /** What is in it, in a line. */
  blurb: string;
  /** The file-name prefix that puts a track in it. */
  prefix: string;
  /**
   * An album's running order, by song (file name without extension or take). A
   * playlist without one is listed by title. A track missing from it plays after
   * the ones in it, by title.
   */
  order?: readonly string[];
};

/** Every playlist, the default first. */
export const PLAYLISTS: readonly PlaylistDef[] = [
  {
    id: "night-shift",
    name: "Night Shift",
    short: "NIGHT SHIFT",
    blurb: "The score. No vocals.",
    prefix: TRACK_PREFIX,
  },
  {
    id: "radio-free",
    name: "Radio Free Night City",
    short: "RADIO FREE",
    blurb: "Songs with vocals.",
    prefix: "radio-",
  },
  {
    id: "no-quiet-hours",
    name: "No Quiet Hours",
    short: "NO QUIET",
    blurb: "An album, in order.",
    prefix: "quiet-",
    order: [
      "quiet-the-night-wants-us",
      "quiet-looks-like-trouble",
      "quiet-touch-without-a-trace",
      "quiet-a-little-more",
      "quiet-make-it-feel-real",
      "quiet-in-the-blackout",
      "quiet-not-yours-to-keep",
      "quiet-call-me-back",
      "quiet-ours-until-morning",
      "quiet-the-city-can-wait",
    ],
  },
];

/** The one everybody starts on: the original, instrumental score. */
export const DEFAULT_PLAYLIST: PlaylistId = "night-shift";

export function isPlaylistId(value: unknown): value is PlaylistId {
  return PLAYLISTS.some((p) => p.id === value);
}

export function playlistDef(id: PlaylistId): PlaylistDef {
  return PLAYLISTS.find((p) => p.id === id)!;
}

/** Every track in one playlist, by name. Empty until something is uploaded. */
export function playlistTracks(id: PlaylistId): string[] {
  return uploadedAssetNames(playlistDef(id).prefix);
}

/** The original, instrumental rotation. Empty until something is uploaded. */
export function playlist(): string[] {
  return playlistTracks(DEFAULT_PLAYLIST);
}

/** Every track in either playlist. */
export function allTracks(): string[] {
  return PLAYLISTS.flatMap((p) => playlistTracks(p.id));
}

/** Which playlist a track belongs to, by its file name. */
export function playlistOf(track: string): PlaylistId | null {
  return PLAYLISTS.find((p) => track.startsWith(p.prefix))?.id ?? null;
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
