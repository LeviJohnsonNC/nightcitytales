/**
 * What the descent sounds like, as a score in time.
 *
 * Pure: levels as functions of the time into the descent, and the moments that
 * make a sound as a list, so the sound can be tested without an AudioContext
 * and a skip or a stall cannot leave it out of step with the picture. The
 * synthesis is `descentAudio.ts`; this says what and when.
 *
 * Nothing here is a recording. Rain is filtered noise, the drone is two
 * oscillators a hair apart, the heartbeat is two sine thumps, and the ticks are
 * the counter falling.
 */
import { BLACK_END_MS, CITY_END_MS, DIVE_END_MS, SEARCH_END_MS, ease } from "./descentTimeline";

export type OneShot = "city" | "lock" | "whoosh" | "thunder" | "window";

/** The moments that happen once, each at the instant its picture does. */
export const ONE_SHOTS: { at: number; kind: OneShot }[] = [
  { at: BLACK_END_MS, kind: "city" },
  { at: SEARCH_END_MS, kind: "lock" },
  { at: SEARCH_END_MS + 120, kind: "whoosh" },
  { at: SEARCH_END_MS + 1250, kind: "thunder" },
  { at: DIVE_END_MS, kind: "window" },
];

/** The heart: first felt as the search begins to close, quickening to the lock. */
const HEART_FROM_MS = CITY_END_MS + 1200;
const HEART_SLOW_MS = 1100;
const HEART_FAST_MS = 480;

export const HEARTBEATS: number[] = (() => {
  const beats: number[] = [];
  let t = HEART_FROM_MS;
  while (t < DIVE_END_MS) {
    beats.push(Math.round(t));
    const along = (t - HEART_FROM_MS) / (DIVE_END_MS - HEART_FROM_MS);
    t += HEART_SLOW_MS + (HEART_FAST_MS - HEART_SLOW_MS) * Math.min(1, along);
  }
  return beats;
})();

/** One click of the counter every this often while the search falls. */
export const TICK_EVERY_MS = 70;

/** The ticks in a span, each with how far through the search it is (0 to 1), for pitch. */
export function ticksBetween(from: number, to: number): { at: number; along: number }[] {
  const out: { at: number; along: number }[] = [];
  const first = Math.max(CITY_END_MS, from);
  const last = Math.min(SEARCH_END_MS, to);
  if (last <= first) return out;
  for (let k = Math.floor(first / TICK_EVERY_MS) + 1; k * TICK_EVERY_MS <= last; k++) {
    const at = k * TICK_EVERY_MS;
    if (at > from) out.push({ at, along: (at - CITY_END_MS) / (SEARCH_END_MS - CITY_END_MS) });
  }
  return out;
}

/**
 * How stale a moment can be and still be heard. After a skip or a stall the
 * clock jumps; a cue that was due seconds ago is the past, not something to
 * fire all at once.
 */
export const CUE_WINDOW_MS = 450;

export type Due = {
  oneShots: OneShot[];
  heartbeats: number[];
  ticks: { at: number; along: number }[];
};

/** What is due in the span (from, to], leaving out anything older than `CUE_WINDOW_MS`. */
export function cuesBetween(from: number, to: number): Due {
  const since = Math.max(from, to - CUE_WINDOW_MS);
  return {
    oneShots: ONE_SHOTS.filter((c) => c.at > since && c.at <= to).map((c) => c.kind),
    heartbeats: HEARTBEATS.filter((t) => t > since && t <= to),
    ticks: ticksBetween(since, to),
  };
}

/** The rain bed: faint at the start, heavier against the glass. 0 to 1. */
export function rainLevel(ms: number): number {
  return 0.35 * ease(ms / 900) + 0.65 * ease((ms - (DIVE_END_MS - 1500)) / 1500);
}

/** How much of the sound is heard through glass, 0 open to 1 shut in. */
export function glassAmount(ms: number): number {
  return ease((ms - (SEARCH_END_MS + 1000)) / 2200);
}

/** The drone under the search: in with the city, swelling to the lock, then easing to a hum in the room. */
export function droneLevel(ms: number): number {
  if (ms < BLACK_END_MS) return 0.15 * ease(ms / BLACK_END_MS);
  if (ms < SEARCH_END_MS)
    return 0.15 + 0.85 * ease((ms - BLACK_END_MS) / (SEARCH_END_MS - BLACK_END_MS));
  return 1 - 0.85 * ease((ms - (SEARCH_END_MS + 1500)) / 1800);
}

/** The drone's pitch in Hz: it climbs through the search and the fall. */
export function dronePitch(ms: number): number {
  return 55 + 30 * ease((ms - CITY_END_MS) / (DIVE_END_MS - CITY_END_MS));
}
