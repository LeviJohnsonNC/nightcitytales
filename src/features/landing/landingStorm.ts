/**
 * The storm over the landing page's key art: when the lightning strikes.
 *
 * Pure and seeded, so the page has the same night every visit and the timing
 * can be tested without a canvas. The rain itself is the opening's
 * (`opening/descent/rain.ts`); this only decides when the sky lights up, and
 * how much of that light reaches the runner's face.
 */
import { seededRng } from "@/engine";

export const STORM_SEED = 0x4e43;

/** A strike and, nearly always, a weaker one right behind it: lightning flickers. */
export type Strike = { at: number; power: number };

/** How long a flash takes to fade, in ms. */
export const FLASH_FADE_MS = 340;

/** Every strike in the first `horizonMs`: the first after a few seconds, then one every 7 to 15. */
export function strikeTimes(seed: number, horizonMs: number): Strike[] {
  const rand = seededRng(seed);
  const out: Strike[] = [];
  let at = 3200 + rand() * 1800;
  while (at < horizonMs) {
    out.push({ at, power: 0.7 + rand() * 0.3 });
    if (rand() < 0.75) out.push({ at: at + 90 + rand() * 90, power: 0.4 + rand() * 0.25 });
    at += 7000 + rand() * 8000;
  }
  return out;
}

/** How lit the sky is at a moment, 0 to 1. */
export function flashAt(ms: number, strikes: readonly Strike[]): number {
  let lit = 0;
  for (const s of strikes) {
    const into = ms - s.at;
    if (into >= 0 && into < FLASH_FADE_MS)
      lit = Math.max(lit, s.power * (1 - into / FLASH_FADE_MS) ** 2);
  }
  return lit;
}

/** The longest the page is storm-timed for; past it the sky stays dark rather than loop. */
export const STORM_HORIZON_MS = 30 * 60 * 1000;

/** How hard it rains over the page, 0 to 1: a steady downpour that swells just before a strike. */
export function stormIntensity(ms: number): number {
  return 0.55 + 0.1 * Math.sin(ms / 4200);
}
