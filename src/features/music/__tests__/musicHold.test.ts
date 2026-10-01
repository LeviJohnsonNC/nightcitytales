/**
 * The playlist yielding to a fight, and the game taking the music up from the
 * creator. The director runs against stand-ins for the browser's audio, with a
 * clock the test moves, because what matters here is what is playing and when.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudio {
  static made: FakeAudio[] = [];
  src = "";
  preload = "";
  loop = false;
  currentTime = 0;
  duration = 200;
  paused = true;
  ended = false;
  volume = 1;
  listeners = new Map<string, (() => void)[]>();
  constructor() {
    FakeAudio.made.push(this);
  }
  addEventListener(name: string, fn: () => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

type Director = typeof import("../musicDirector");
let d: Director;

/** Let the clock run, with the promises the director waits on settling as it goes. */
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const sounding = () => FakeAudio.made.filter((el) => !el.paused && el.volume > 0.01);

beforeEach(async () => {
  vi.useFakeTimers();
  FakeAudio.made = [];
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    addEventListener: () => undefined,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    location: { href: "http://localhost/", origin: "http://localhost" },
  });
  vi.stubGlobal("document", { hidden: false, addEventListener: () => undefined });
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.resetModules();
  d = await import("../musicDirector");
});

afterEach(() => {
  d.stopMusic();
  vi.runAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the game taking the music up", () => {
  it("plays the playlist, and carries on with the same track when taken up again", async () => {
    d.startMusic();
    await run(2000);
    const track = d.currentTrack();
    expect(track).not.toBeNull();
    expect(d.getPlayerState().status).toBe("playing");
    // The creator's cleanup, then the game's start: no break and no new track.
    d.startMusic();
    await run(2000);
    expect(d.currentTrack()).toBe(track);
    expect(sounding()).toHaveLength(1);
  });

  it("does not start for a player who pressed Stop, which is remembered", async () => {
    d.startMusic();
    await run(1000);
    d.stop();
    await run(1000);
    expect(d.isMusicEnabled()).toBe(false);
    d.startMusic();
    await run(2000);
    expect(sounding()).toHaveLength(0);
  });
});

describe("a fight scoring the moment", () => {
  it("fades the playlist out, says what is holding it, and brings the same track back", async () => {
    d.startMusic();
    await run(2000);
    const track = d.currentTrack();
    d.holdMusic("Neon Storm Front");
    expect(d.getPlayerState().held).toBe("Neon Storm Front");
    await run(1200);
    expect(sounding()).toHaveLength(0);
    // Held is not Paused: the player did not do this.
    expect(d.getPlayerState().status).not.toBe("paused");

    d.releaseMusic();
    await run(1500);
    expect(d.getPlayerState().held).toBeNull();
    expect(d.currentTrack()).toBe(track);
    expect(sounding()).toHaveLength(1);
  });

  it("leaves a track the player had paused paused", async () => {
    d.startMusic();
    await run(2000);
    d.pause();
    d.holdMusic("Neon Storm Front");
    await run(1200);
    d.releaseMusic();
    await run(1500);
    expect(sounding()).toHaveLength(0);
    expect(d.getPlayerState().status).toBe("paused");
  });

  it("gives way to the player asking for music by name", async () => {
    d.startMusic();
    await run(2000);
    d.holdMusic("Neon Storm Front");
    await run(1200);
    d.next();
    await run(1500);
    expect(d.getPlayerState().held).toBeNull();
    expect(sounding()).toHaveLength(1);
  });

  it("is ended by leaving, and releasing with nothing held is nothing", async () => {
    d.releaseMusic();
    d.startMusic();
    await run(2000);
    d.holdMusic("Neon Storm Front");
    d.stopMusic();
    expect(d.getPlayerState().held).toBeNull();
    await run(1500);
    expect(sounding()).toHaveLength(0);
  });

  it("names whatever holds it last", async () => {
    d.startMusic();
    await run(1000);
    d.holdMusic("Neon Storm Front");
    d.holdMusic("Something Else");
    expect(d.getPlayerState().held).toBe("Something Else");
    d.releaseMusic();
    expect(d.getPlayerState().held).toBeNull();
  });
});
