/**
 * The shape of the descent, in time.
 *
 * Ten seconds, because that is how long the opening takes to write, and it is
 * elastic at the one place it has to be: the descent always plays through to
 * the window, and then HOLDS there for as long as the model needs. Nothing in
 * it is a game number.
 *
 *   black   0.0 – 1.0 s   rain, the city not yet lit
 *   city    1.0 – 3.5     seven million lights, one tagline
 *   search  3.5 – 6.5     the player's own facts narrow the city
 *   dive    6.5 – 9.0     down through one light into a window
 *   hold    9.0 –         the window, until the prose is ready
 *
 * Pure, so the timing can be tested without a clock or a canvas.
 */

export type Beat = "black" | "city" | "search" | "dive" | "hold";

export const BLACK_END_MS = 1000;
export const CITY_END_MS = 3500;
export const SEARCH_END_MS = 6500;
export const DIVE_END_MS = 9000;

/** How long the hand-off from the window to the prose takes. */
export const HINGE_MS = 900;

/** How long the descent must have been running before it can be skipped. */
export const SKIP_AFTER_MS = 2000;

/** Where a skip lands: the last half second of the dive, so the window still arrives. */
export const SKIP_TO_MS = DIVE_END_MS - 500;

/** The same descent for somebody who has asked for less motion: a short fade into the window. */
export const REDUCED_START_MS = DIVE_END_MS - 500;

export function beatAt(ms: number): Beat {
  if (ms < BLACK_END_MS) return "black";
  if (ms < CITY_END_MS) return "city";
  if (ms < SEARCH_END_MS) return "search";
  if (ms < DIVE_END_MS) return "dive";
  return "hold";
}

/** How far through a beat, 0 to 1. The hold has no end, so it is always 1. */
export function beatProgress(ms: number): number {
  const spans: [number, number][] = [
    [0, BLACK_END_MS],
    [BLACK_END_MS, CITY_END_MS],
    [CITY_END_MS, SEARCH_END_MS],
    [SEARCH_END_MS, DIVE_END_MS],
  ];
  for (const [from, to] of spans) if (ms < to) return Math.max(0, (ms - from) / (to - from));
  return 1;
}

/**
 * The time the descent has reached, given how much of the real time has gone
 * by and whether the facts it narrows by have arrived. Without them it waits at
 * the end of the city, because the search is the part that is about the player.
 */
export function virtualTime(realMs: number, hasFacts: boolean): number {
  return hasFacts ? realMs : Math.min(realMs, CITY_END_MS);
}

/** Smooth in and out, 0 to 1. */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** The zoom at the end of the city and of the search, and at the bottom of the dive. */
export const ZOOM_CITY = 1.12;
export const ZOOM_SEARCH = 1.7;
export const ZOOM_DEEP = 28;

/** The camera's zoom at a time: a slow drift, a push, then a fall. */
export function zoomAt(ms: number): number {
  if (ms < CITY_END_MS) return 1 + (ZOOM_CITY - 1) * ease(ms / CITY_END_MS);
  if (ms < SEARCH_END_MS) {
    return (
      ZOOM_CITY +
      (ZOOM_SEARCH - ZOOM_CITY) * ease((ms - CITY_END_MS) / (SEARCH_END_MS - CITY_END_MS))
    );
  }
  if (ms < DIVE_END_MS) {
    const t = ease((ms - SEARCH_END_MS) / (DIVE_END_MS - SEARCH_END_MS));
    // Exponential, because a fall feels even when each moment doubles the last.
    return ZOOM_SEARCH * Math.pow(ZOOM_DEEP / ZOOM_SEARCH, t);
  }
  return ZOOM_DEEP;
}

/** The population shown at a moment, falling through `counts` (each a step of the search). */
export function populationAt(ms: number, total: number, counts: number[]): number {
  if (ms < CITY_END_MS || counts.length === 0) return total;
  const span = (SEARCH_END_MS - CITY_END_MS) / counts.length;
  const into = ms - CITY_END_MS;
  const stepIndex = Math.min(counts.length - 1, Math.floor(into / span));
  const t = ease(Math.min(1, (into - stepIndex * span) / (span * 0.7)));
  const from = stepIndex === 0 ? total : counts[stepIndex - 1]!;
  const to = counts[stepIndex]!;
  // Geometric, so it falls fast and then lingers on the small numbers.
  const value = from * Math.pow(Math.max(to, 1) / Math.max(from, 1), t);
  return ms >= SEARCH_END_MS ? counts[counts.length - 1]! : Math.max(1, Math.round(value));
}
