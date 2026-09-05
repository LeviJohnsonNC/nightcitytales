import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPlaybackQueue,
  playbackView,
  publishCombatFrames,
  subscribeCombatFrames,
  type PlaybackFrame,
  type PlaybackState,
} from "../combatPlayback";
import type { LiveEncounter } from "@/features/campaign/encounterState";
const live = { id: "e", version: 3 } as LiveEncounter;
const frame = (sequence: number): PlaybackFrame => ({
  sequence,
  live,
  kind: "attack",
  text: `Shot ${sequence}`,
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("combat presentation queue", () => {
  it("plays saved frames in order even when another batch arrives during playback", () => {
    const states: PlaybackState[] = [];
    const queue = createPlaybackQueue((state) => states.push(state), false);
    queue.enqueue([frame(1), frame(2)]);
    queue.enqueue([frame(3)]);
    expect(states.at(-1)?.frame?.sequence).toBe(1);
    vi.runAllTimers();
    expect(states.filter((s) => s.playing).map((s) => s.frame?.sequence)).toEqual([1, 2, 3]);
    expect(states.at(-1)?.playing).toBe(false);
    queue.dispose();
  });
  it("skips to the last saved result without replaying pending frames", () => {
    const listener = vi.fn();
    const queue = createPlaybackQueue(listener, false);
    queue.enqueue([frame(1), frame(2), frame(3)]);
    queue.skip();
    expect(listener.mock.lastCall?.[0]).toMatchObject({
      playing: false,
      frame: { sequence: 3, animate: false },
    });
    const calls = listener.mock.calls.length;
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(calls);
    expect(live.version).toBe(3);
    queue.dispose();
  });
  it("cancels timers and ignores arrivals after unmount", () => {
    const listener = vi.fn();
    const queue = createPlaybackQueue(listener, false);
    queue.enqueue([frame(1), frame(2)]);
    queue.dispose();
    queue.enqueue([frame(3)]);
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("disables animation and finishes quickly for reduced motion", () => {
    const listener = vi.fn();
    const queue = createPlaybackQueue(listener, true);
    queue.enqueue([frame(1), frame(2)]);
    expect(listener.mock.lastCall?.[0].frame.animate).toBe(false);
    vi.advanceTimersByTime(160);
    expect(listener.mock.lastCall?.[0].playing).toBe(false);
    queue.dispose();
  });
  it("isolates campaigns and does not replay old events to a new subscriber", () => {
    const a = vi.fn(),
      b = vi.fn();
    const stop = subscribeCombatFrames("a", a),
      stopB = subscribeCombatFrames("b", b);
    publishCombatFrames("a", [frame(1)]);
    expect(a).toHaveBeenCalledOnce();
    expect(b).not.toHaveBeenCalled();
    stop();
    publishCombatFrames("a", [frame(2)]);
    expect(a).toHaveBeenCalledOnce();
    stopB();
    const later = vi.fn();
    const end = subscribeCombatFrames("a", later);
    expect(later).not.toHaveBeenCalled();
    end();
  });
});

describe("playback and query handoff", () => {
  it("holds the last saved frame and locks input while the query is stale", () => {
    const state = { frame: frame(1), playing: false };
    expect(playbackView(state, { ...live, version: 2 })).toMatchObject({
      locked: true,
      frame: { sequence: 1 },
    });
    expect(playbackView(state, live)).toEqual({ locked: false, frame: null });
  });
  it("shows a finishing encounter through its last frame, then lets it close", () => {
    expect(playbackView({ frame: frame(1), playing: true }, null).locked).toBe(true);
    expect(playbackView({ frame: frame(1), playing: false }, null).frame).toBeNull();
  });
  it("never substitutes a previous encounter's visuals for a new fight", () => {
    expect(playbackView({ frame: frame(1), playing: true }, { ...live, id: "new" })).toEqual({
      locked: false,
      frame: null,
    });
  });
});
