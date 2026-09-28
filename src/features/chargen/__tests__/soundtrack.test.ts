import { describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import { playlist, shuffleRound, TRACK_PREFIX } from "../music/soundtrack";
import {
  currentTrack,
  finishTrackThenStop,
  isMusicActive,
  isMusicEnabled,
  setMusicEnabled,
  startMusic,
  stopMusic,
} from "../music/musicDirector";

describe("the creator's playlist", () => {
  it("is every uploaded music- track, each once", () => {
    const tracks = playlist();
    // The five the creator shipped with; more join by being uploaded.
    for (const name of ["music-meet", "music-interview", "music-people", "music-build"]) {
      expect(tracks).toContain(name);
    }
    expect(new Set(tracks).size).toBe(tracks.length);
    for (const name of tracks) expect(name.startsWith(TRACK_PREFIX)).toBe(true);
  });
});

describe("a round of the shuffle", () => {
  const TRACKS = ["music-a", "music-b", "music-c", "music-d", "music-e"];

  it("plays every track once, in an order the seed decides", () => {
    const round = shuffleRound(TRACKS, null, seededRng(7));
    expect([...round].sort()).toEqual(TRACKS);
    expect(shuffleRound(TRACKS, null, seededRng(7))).toEqual(round);
    const orders = new Set(
      Array.from({ length: 20 }, (_, i) => shuffleRound(TRACKS, null, seededRng(i)).join()),
    );
    expect(orders.size).toBeGreaterThan(5);
  });

  it("never opens on the track the last round ended with", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const round = shuffleRound(TRACKS, "music-c", seededRng(seed));
      expect(round[0]).not.toBe("music-c");
      expect([...round].sort()).toEqual(TRACKS);
    }
  });

  it("copes with one track or none", () => {
    expect(shuffleRound(["music-a"], "music-a")).toEqual(["music-a"]);
    expect(shuffleRound([], null)).toEqual([]);
  });
});

describe("the director, outside a browser", () => {
  it("does nothing and throws nothing", () => {
    expect(() => startMusic()).not.toThrow();
    expect(isMusicActive()).toBe(true);
    expect(currentTrack()).toBeNull();
    expect(() => finishTrackThenStop()).not.toThrow();
    expect(isMusicActive()).toBe(false);
    startMusic();
    stopMusic();
    expect(isMusicActive()).toBe(false);
    setMusicEnabled(false);
    expect(isMusicEnabled()).toBe(false);
    setMusicEnabled(true);
  });
});
