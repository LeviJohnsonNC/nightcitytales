/**
 * NCAmp's numbers and names: the equalizer settings it stores and applies,
 * what it calls each track, and that its controls are safe to call outside a
 * browser (the server render, the tests).
 */
import { describe, expect, it } from "vitest";
import {
  EQ_BANDS,
  EQ_PRESETS,
  EQ_RANGE_DB,
  bandLabel,
  clampDb,
  dbToGain,
  normalizeEq,
} from "../equalizer";
import {
  getPlayerState,
  next,
  pause,
  play,
  previous,
  seek,
  setBalance,
  setEq,
  setPlaylist,
  setShuffle,
  setVolume,
  stop,
} from "../musicDirector";
import {
  DEFAULT_PLAYLIST,
  PLAYLISTS,
  allTracks,
  playlistDef,
  playlistOf,
  playlistTracks,
  songOf,
} from "../soundtrack";
import {
  SONG_TITLES,
  formatTime,
  inPlaylistOrder,
  inTitleOrder,
  takeOf,
  trackTitle,
} from "../trackTitles";

describe("the equalizer", () => {
  it("has the ten classic bands, and every preset sets all ten within range", () => {
    expect(EQ_BANDS).toHaveLength(10);
    expect(EQ_BANDS.map(bandLabel)).toEqual([
      "60",
      "170",
      "310",
      "600",
      "1K",
      "3K",
      "6K",
      "12K",
      "14K",
      "16K",
    ]);
    for (const [name, bands] of Object.entries(EQ_PRESETS)) {
      expect(bands, name).toHaveLength(10);
      for (const db of bands) expect(Math.abs(db), name).toBeLessThanOrEqual(EQ_RANGE_DB);
    }
    expect(EQ_PRESETS["Flat"]!.every((db) => db === 0)).toBe(true);
  });

  it("repairs whatever was stored", () => {
    expect(normalizeEq(null)).toEqual({ on: true, preamp: 0, bands: EQ_BANDS.map(() => 0) });
    const fixed = normalizeEq({ on: false, preamp: 99, bands: [3, "x", -40] });
    expect(fixed.on).toBe(false);
    expect(fixed.preamp).toBe(EQ_RANGE_DB);
    expect(fixed.bands.slice(0, 3)).toEqual([3, 0, -EQ_RANGE_DB]);
    expect(fixed.bands).toHaveLength(10);
    expect(clampDb(Number.NaN)).toBe(0);
  });

  it("turns decibels into gain", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(20)).toBeCloseTo(10);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 2);
  });
});

describe("what the playlist calls a track", () => {
  it("has a title for every song in the rotation", () => {
    for (const track of allTracks()) expect(SONG_TITLES[songOf(track)], track).toBeTruthy();
  });

  it("tidies a radio file's name as it does a score's", () => {
    expect(trackTitle("radio-glass-and-rain")).toBe("Glass And Rain");
    expect(trackTitle("radio-nice-try-v2")).toBe("Nice Try (take 2)");
    expect(trackTitle("radio-tell-me-im-good")).toBe("Tell Me I'm Good");
  });

  it("names takes, and tidies a file it has never heard of", () => {
    expect(trackTitle("music-badlands-highway")).toBe("Badlands Highway");
    expect(trackTitle("music-badlands-highway-v2")).toBe("Badlands Highway (take 2)");
    expect(takeOf("music-meet")).toBeNull();
    expect(trackTitle("music-glass-and-rain-v3")).toBe("Glass And Rain (take 3)");
  });

  it("lists tracks by title, each song's takes after it", () => {
    expect(
      inTitleOrder([
        "music-meet",
        "music-badlands-highway-v2",
        "music-build",
        "music-badlands-highway",
      ]),
    ).toEqual(["music-badlands-highway", "music-badlands-highway-v2", "music-build", "music-meet"]);
  });

  it("formats time the way the display does", () => {
    expect(formatTime(225)).toBe("3:45");
    expect(formatTime(59.9)).toBe("0:59");
    expect(formatTime(Number.NaN)).toBe("--:--");
    expect(formatTime(null)).toBe("--:--");
  });
});

describe("the playlists", () => {
  it("open on the original, instrumental one", () => {
    expect(DEFAULT_PLAYLIST).toBe("night-shift");
    expect(PLAYLISTS[0]!.id).toBe(DEFAULT_PLAYLIST);
    expect(getPlayerState().list).toBe("night-shift");
  });

  it("are named, and split by file name with no track in both", () => {
    expect(PLAYLISTS.map((p) => p.name)).toEqual([
      "Night Shift",
      "Radio Free Night City",
      "No Quiet Hours",
    ]);
    const night = playlistTracks("night-shift");
    const radio = playlistTracks("radio-free");
    const quiet = playlistTracks("no-quiet-hours");
    expect(night.length).toBeGreaterThan(0);
    expect(radio.length).toBeGreaterThanOrEqual(9);
    expect(night.filter((t) => radio.includes(t))).toEqual([]);
    for (const t of night) expect(playlistOf(t)).toBe("night-shift");
    for (const t of radio) expect(playlistOf(t)).toBe("radio-free");
    for (const t of quiet) expect(playlistOf(t)).toBe("no-quiet-hours");
    expect(allTracks()).toHaveLength(night.length + radio.length + quiet.length);
  });

  it("list No Quiet Hours in its running order, and the others by title", () => {
    const order = playlistDef("no-quiet-hours").order!;
    expect(order.map((song) => SONG_TITLES[song])).toEqual([
      "The Night Wants Us",
      "Looks Like Trouble",
      "Touch Without a Trace",
      "A Little More",
      "Make It Feel Real",
      "In the Blackout",
      "Not Yours to Keep",
      "Call Me Back",
      "Ours Until Morning",
      "The City Can Wait",
    ]);
    // uploaded in any order, a second take and a stray among them
    const uploaded = [
      "quiet-the-city-can-wait",
      "quiet-zz-bonus",
      "quiet-the-night-wants-us-v2",
      ...order.slice(1, -1).reverse(),
      "quiet-the-night-wants-us",
    ];
    expect(inPlaylistOrder("no-quiet-hours", uploaded)).toEqual([
      "quiet-the-night-wants-us",
      "quiet-the-night-wants-us-v2",
      ...order.slice(1),
      "quiet-zz-bonus",
    ]);
    const radio = playlistTracks("radio-free");
    expect(inPlaylistOrder("radio-free", radio)).toEqual(inTitleOrder(radio));
  });

  it("switch, clearing whatever the old list had loaded", () => {
    setPlaylist("radio-free");
    expect(getPlayerState().list).toBe("radio-free");
    expect(getPlayerState().track).toBeNull();
    setPlaylist("no-quiet-hours");
    expect(getPlayerState().list).toBe("no-quiet-hours");
    setPlaylist("night-shift");
    expect(getPlayerState().list).toBe("night-shift");
  });
});

describe("the controls, outside a browser", () => {
  it("throw nothing and keep the settings the player chose", () => {
    for (const control of [play, pause, stop, next, previous])
      expect(() => control()).not.toThrow();
    expect(() => seek(0.5)).not.toThrow();
    setVolume(0.8);
    setBalance(-0.5);
    setShuffle(false);
    setEq({ on: true, preamp: 2, bands: EQ_PRESETS["Rock"]! });
    const state = getPlayerState();
    expect(state.volume).toBe(0.8);
    expect(state.balance).toBe(-0.5);
    expect(state.shuffle).toBe(false);
    expect(state.eq.bands).toEqual(EQ_PRESETS["Rock"]);
    expect(state.status).toBe("stopped");
    setBalance(0.03);
    expect(getPlayerState().balance).toBe(0);
    setShuffle(true);
  });
});
