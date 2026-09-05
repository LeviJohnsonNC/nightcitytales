import { afterEach, describe, expect, it, vi } from "vitest";
import {
  feedbackCues,
  feedbackOffset,
  playbackHeading,
  scheduleCombatCues,
} from "../combatFeedback";
import { soundSamples, createCombatAudio } from "../combatSound";
import type { PlaybackFrame } from "../combatPlayback";

const frame = {
  sequence: 1,
  kind: "attack",
  actorId: "h",
  targetId: "p",
  hit: true,
  weaponRange: "pistol",
  targetHpBefore: 30,
  text: "MISS (untrusted wording)",
  live: {
    arena: "night_shift_yard",
    cover: {},
    state: { combatants: { h: { name: "Scav" }, p: { name: "Vela", hp: 24 } } },
  },
} as unknown as PlaybackFrame;
afterEach(() => vi.useRealTimers());
describe("saved combat feedback", () => {
  it("distinguishes real wounds, armor, misses, melee, and material impacts without parsing prose", () => {
    expect(feedbackCues(frame).map((c) => c.sound)).toEqual(["pistol", "body"]);
    expect(feedbackCues({ ...frame, targetHpBefore: 24 }).map((c) => c.sound)).toEqual([
      "pistol",
      "metal",
    ]);
    expect(feedbackCues({ ...frame, hit: false }).map((c) => c.sound)).toEqual(["pistol", "miss"]);
    expect(feedbackCues({ ...frame, attackStyle: "melee" }).map((c) => c.sound)).toEqual([
      "melee",
      "body",
    ]);
    expect(
      feedbackCues({ ...frame, kind: "cover", coverPieceId: "pallets" }).map((c) => c.sound),
    ).toEqual(["pistol", "wood"]);
    expect(
      feedbackCues({ ...frame, kind: "cover", coverPieceId: "concrete" }).map((c) => c.sound),
    ).toEqual(["pistol", "concrete"]);
    expect(feedbackCues({ ...frame, animate: false })).toEqual([]);
  });
  it("cancels pending effects and never repeats a cue on rerender or late arrival", () => {
    vi.useFakeTimers();
    const play = vi.fn(),
      played = new Set<number>();
    const f = { ...frame, startedAt: Date.now() };
    const cancel = scheduleCombatCues(f, played, play);
    vi.advanceTimersByTime(170);
    expect(play).toHaveBeenCalledExactlyOnceWith("pistol");
    cancel();
    const again = scheduleCombatCues(f, played, play);
    vi.advanceTimersByTime(10);
    again();
    vi.runAllTimers();
    expect(play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    scheduleCombatCues(f, new Set(), play);
    vi.runAllTimers();
    expect(play).toHaveBeenCalledTimes(1);
  });
  it("keeps camera impulse bounded and returns precisely to the user's framing", () => {
    for (let t = 0; t < 1000; t++) {
      const offset = feedbackOffset(frame, t, false);
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(2.5);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(1.1);
    }
    expect(feedbackOffset(frame, 800, false)).toEqual({ x: 0, y: 0 });
    expect(feedbackOffset(frame, 200, true)).toEqual({ x: 0, y: 0 });
    expect(feedbackOffset({ ...frame, animate: false }, 200, false)).toEqual({ x: 0, y: 0 });
    expect(playbackHeading(frame)).toBe("Scav · Attacking → Vela");
  });
  it("generates distinct, finite, bounded original sounds with quiet tails", () => {
    const fingerprints = new Set();
    for (const cue of [
      "pistol",
      "rifle",
      "shotgun",
      "smg",
      "bow",
      "launcher",
      "metal",
      "body",
      "wood",
      "concrete",
      "miss",
      "reload",
      "step",
      "turn",
    ] as const) {
      const samples = soundSamples(cue, 24000);
      fingerprints.add(samples.slice(0, 1000).join(","));
      expect(samples.every((n) => Number.isFinite(n) && Math.abs(n) < 1)).toBe(true);
      expect(samples.some((n) => Math.abs(n) > 0.01)).toBe(true);
      expect(Math.abs(samples.at(-1)!)).toBeLessThan(0.01);
    }
    expect(fingerprints.size).toBe(14);
  });
  it("remains optional when Web Audio is unavailable and cannot play before unlock", () => {
    const audio = createCombatAudio();
    expect(() => {
      audio.play("pistol", 0.5);
      audio.unlock();
      audio.stop();
      audio.dispose();
      audio.unlock();
    }).not.toThrow();
  });
});
