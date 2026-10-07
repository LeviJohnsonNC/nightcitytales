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
import { PLAYLISTS, playlistDef, songOf, type PlaylistId } from "./soundtrack";

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
  "music-coyote-run": "Coyote Run",
  "music-ninety-floors-up": "Ninety Floors Up",
  "music-drowned-arcade": "Drowned Arcade",
  "music-black-ice": "Black ICE",
  "music-first-light": "First Light",
  // Radio Free Night City: the songs with vocals.
  "radio-bad-for-business": "Bad for Business",
  "radio-dead-man-dancing": "Dead Man Dancing",
  "radio-heavens-got-a-back-door": "Heaven's Got a Back Door",
  "radio-hotwire-me": "Hotwire Me",
  "radio-like-you-stole-me": "Like You Stole Me",
  "radio-nice-try": "Nice Try",
  "radio-one-more-first-time": "One More First Time",
  "radio-take-me-nowhere": "Take Me Nowhere",
  "radio-tell-me-im-good": "Tell Me I'm Good",
  // No Quiet Hours: an album, listed in its running order (`soundtrack.ts`).
  "quiet-the-night-wants-us": "The Night Wants Us",
  "quiet-looks-like-trouble": "Looks Like Trouble",
  "quiet-touch-without-a-trace": "Touch Without a Trace",
  "quiet-a-little-more": "A Little More",
  "quiet-make-it-feel-real": "Make It Feel Real",
  "quiet-in-the-blackout": "In the Blackout",
  "quiet-not-yours-to-keep": "Not Yours to Keep",
  "quiet-call-me-back": "Call Me Back",
  "quiet-ours-until-morning": "Ours Until Morning",
  "quiet-the-city-can-wait": "The City Can Wait",
};

/** A file name without the prefix that says which playlist it is in. */
function withoutPrefix(song: string): string {
  const prefix = PLAYLISTS.map((p) => p.prefix).find((p) => song.startsWith(p));
  return prefix ? song.slice(prefix.length) : song;
}

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
    withoutPrefix(song)
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

/**
 * A playlist's tracks as its window lists them and as they play with shuffle off:
 * an album in its running order (each song's takes after it, anything not in the
 * order after the rest, by title), any other playlist by title.
 */
export function inPlaylistOrder(id: PlaylistId, tracks: readonly string[]): string[] {
  const order = playlistDef(id).order;
  const byTitle = inTitleOrder(tracks);
  if (!order) return byTitle;
  const rank = (t: string) => {
    const i = order.indexOf(songOf(t));
    return i < 0 ? order.length : i;
  };
  // a stable sort over the title order keeps takes, and strays, in title order
  return [...byTitle].sort((a, b) => rank(a) - rank(b));
}
