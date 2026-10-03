/**
 * The descent's sound, against a stand-in for the browser's audio. It cannot
 * say how it sounds; it can say that it makes a sound only for a player who has
 * the music on, never throws, makes one thing across screens, and lets go.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const music = vi.hoisted(() => ({ enabled: true, ducks: [] as number[], releases: 0 }));
vi.mock("@/features/music/musicDirector", () => ({
  isMusicEnabled: () => music.enabled,
  duckMusic: (_ms: number, depth?: number) => music.ducks.push(depth ?? 0.65),
  releaseDuck: () => {
    music.releases += 1;
  },
}));

type Param = {
  value: number;
  setValueAtTime: () => void;
  linearRampToValueAtTime: () => void;
  exponentialRampToValueAtTime: () => void;
  setTargetAtTime: () => void;
  cancelScheduledValues: () => void;
};
const param = (): Param => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
});
const node = (extra: Record<string, unknown> = {}) => {
  const n: Record<string, unknown> = {
    connect: (to: unknown) => to,
    start: vi.fn(),
    stop: vi.fn(),
    gain: param(),
    frequency: param(),
    Q: param(),
    ...extra,
  };
  return n;
};
const made = { contexts: 0, closed: 0 };
class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state = "running";
  destination = {};
  constructor() {
    made.contexts += 1;
  }
  resume = () => Promise.resolve();
  close = () => {
    made.closed += 1;
    return Promise.resolve();
  };
  createGain = () => node();
  createOscillator = () => node();
  createBiquadFilter = () => node();
  createBuffer = (_c: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  });
  createBufferSource = () => node();
}

beforeEach(() => {
  vi.useFakeTimers();
  made.contexts = 0;
  made.closed = 0;
  music.enabled = true;
  music.ducks = [];
  music.releases = 0;
  vi.stubGlobal("window", {
    AudioContext: FakeContext,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
});
afterEach(async () => {
  const { releaseDescentAudio } = await import("../descentAudio");
  releaseDescentAudio();
  vi.runAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("the sound of the descent", () => {
  it("is silent, and makes no context, for a player with the music off", async () => {
    music.enabled = false;
    const { acquireDescentAudio } = await import("../descentAudio");
    expect(acquireDescentAudio()).toBeNull();
    expect(made.contexts).toBe(0);
    expect(music.ducks).toEqual([]);
  });

  it("is silent in a browser with no audio, and does not throw", async () => {
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    const { acquireDescentAudio } = await import("../descentAudio");
    expect(acquireDescentAudio()).toBeNull();
  });

  it("ducks the music under it, deeper than a dice roll does", async () => {
    const { acquireDescentAudio } = await import("../descentAudio");
    expect(acquireDescentAudio()).not.toBeNull();
    expect(music.ducks).toEqual([0.3]);
  });

  it("plays through the whole descent without throwing", async () => {
    const { acquireDescentAudio } = await import("../descentAudio");
    const audio = acquireDescentAudio()!;
    let prev = 0;
    for (let ms = 0; ms <= 10_000; ms += 16) {
      audio.update(ms, prev);
      prev = ms;
    }
    audio.hinge();
    audio.landed();
    expect(made.contexts).toBe(1);
  });

  it("keeps being played with after it lands: keys, signs and a door, none of which throw", async () => {
    const { acquireDescentAudio, landDescentAudio, liveDescentAudio } =
      await import("../descentAudio");
    acquireDescentAudio();
    landDescentAudio();
    const audio = liveDescentAudio()!;
    for (let i = 0; i < 20; i++) audio.type();
    audio.sign();
    audio.door();
    audio.dispose();
    audio.type();
    expect(made.contexts).toBe(1);
  });

  it("is one sound across the handover from one screen to the next", async () => {
    const { acquireDescentAudio, releaseDescentAudio } = await import("../descentAudio");
    const first = acquireDescentAudio();
    releaseDescentAudio();
    vi.advanceTimersByTime(300);
    const second = acquireDescentAudio();
    expect(second).toBe(first);
    vi.advanceTimersByTime(5000);
    expect(made.contexts).toBe(1);
    expect(made.closed).toBe(0);
  });

  it("lets go, and lets the music back, when nobody takes it up", async () => {
    const { acquireDescentAudio, releaseDescentAudio } = await import("../descentAudio");
    acquireDescentAudio();
    releaseDescentAudio();
    vi.advanceTimersByTime(3000);
    expect(made.closed).toBe(1);
    expect(music.releases).toBe(1);
  });

  it("keeps a little rain under the prose once it has landed, and lets it go after a while", async () => {
    const { acquireDescentAudio, landDescentAudio, releaseDescentAudio, liveDescentAudio } =
      await import("../descentAudio");
    acquireDescentAudio();
    landDescentAudio();
    releaseDescentAudio();
    vi.advanceTimersByTime(5000);
    expect(made.closed).toBe(0);
    expect(liveDescentAudio()).not.toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(made.closed).toBe(1);
    expect(liveDescentAudio()).toBeNull();
  });

  it("goes within a second or so of a door being taken, and lets the music back", async () => {
    const { acquireDescentAudio, landDescentAudio, liveDescentAudio } =
      await import("../descentAudio");
    acquireDescentAudio();
    landDescentAudio();
    liveDescentAudio()!.door();
    vi.advanceTimersByTime(1600);
    expect(made.closed).toBe(1);
    expect(liveDescentAudio()).toBeNull();
    expect(music.releases).toBe(1);
  });

  it("lets go of what rain is left when the screen under the prose goes", async () => {
    const { acquireDescentAudio, landDescentAudio, leaveDescentAudio, liveDescentAudio } =
      await import("../descentAudio");
    acquireDescentAudio();
    landDescentAudio();
    leaveDescentAudio();
    expect(liveDescentAudio()).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(made.closed).toBe(1);
  });
});
