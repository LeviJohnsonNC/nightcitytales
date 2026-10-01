import { describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import { playlist, shuffleRound, songOf, TRACK_PREFIX } from "../soundtrack";
import {
  currentTrack,
  finishTrackThenStop,
  isMusicActive,
  isMusicEnabled,
  setMusicEnabled,
  startMusic,
  stopMusic,
} from "../musicDirector";

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

  it("never plays two takes of one song back to back, within a round or across two", () => {
    const takes = [...TRACKS, "music-a-v2", "music-c-v2", "music-c-v3"];
    for (let seed = 0; seed < 300; seed += 1) {
      const rng = seededRng(seed);
      const first = shuffleRound(takes, null, rng);
      const second = shuffleRound(takes, first[first.length - 1]!, rng);
      expect([...first].sort()).toEqual([...takes].sort());
      const run = [...first, ...second].map(songOf);
      for (let i = 1; i < run.length; i += 1)
        expect(run[i], `seed ${seed} at ${i}`).not.toBe(run[i - 1]);
    }
  });

  it("still plays every take when one song has too many to keep apart", () => {
    const round = shuffleRound(["music-a", "music-a-v2", "music-a-v3", "music-b"], null);
    expect(round).toHaveLength(4);
    expect(songOf("music-a-v12")).toBe("music-a");
    expect(songOf("music-v2-song")).toBe("music-v2-song");
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
