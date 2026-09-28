/**
 * What NCAmp calls each track: the title it was written under in
 * `docs/soundtrack.md`, the way a playlist line reads it.
 *
 * A track with no entry here still plays and still gets a name — its file name,
 * tidied — so a new upload never shows up blank. Add a line when you add a
 * song, and a test will remind you if you forget.
 *
 * Pure.
 */
import { songOf } from "./soundtrack";

/** Who the playlist says made it. */
export const TRACK_ARTIST = "Night City Tales";

export const SONG_TITLES: Record<string, string> = {
  "music-meet": "Rain on Glass",
  "music-interview": "The Back Booth",
  "music-people": "Names You Know",
  "music-build": "Chrome and Muscle",
  "music-reveal": "Night City Wants You",
  "music-neon-arteries": "Neon Arteries",
  "music-kabuki-market": "Kabuki Market",
  "music-badlands-highway": "Badlands Highway",
  "music-chrome-heart": "Chrome Heart",
  "music-after-hours": "After Hours",
};

/** The take number of a `-v2`/`-v3` track, or null for the first take. */
export function takeOf(track: string): number | null {
  const match = /-v(\d+)$/.exec(track);
  return match ? Number(match[1]) : null;
}

/** "Badlands Highway (take 2)". */
export function trackTitle(track: string): string {
  const song = songOf(track);
  const title =
    SONG_TITLES[song] ??
    song
      .replace(/^music-/, "")
      .split("-")
      .filter(Boolean)
      .map((word) => word[0]!.toUpperCase() + word.slice(1))
      .join(" ");
  const take = takeOf(track);
  return take ? `${title} (take ${take})` : title;
}

/** "3:45"; "--:--" when the length is not known yet. */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The playlist as NCAmp lists it: by title, a song's takes after it. */
export function inTitleOrder(tracks: readonly string[]): string[] {
  return [...tracks].sort(
    (a, b) => trackTitle(a).localeCompare(trackTitle(b)) || a.localeCompare(b),
  );
}
