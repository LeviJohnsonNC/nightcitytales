/**
 * Many dice at once.
 *
 * When a batch of dice start together — "roll all ten", the Lifepath's "roll
 * everything left", a handful of damage d6s — they should go off as a ripple
 * rather than a single blink, and one click anywhere should finish them all.
 *
 * `staggerDelay` hands each die that asks within a short window a slightly
 * later start, so a batch fans out on its own without anyone counting. The
 * skip bus lets any rolling die, clicked, fast-forward every die in flight.
 *
 * Pure bookkeeping; the only clock is the one passed in.
 */

/** Dice asking within this long of each other are one batch. */
const BATCH_MS = 60;
/** How far apart the dice in a batch start. */
const STEP_MS = 70;
/** The longest a die waits for its turn in a batch. */
const MAX_DELAY_MS = 900;

let batchStart = -Infinity;
let batchCount = 0;

/** The delay before this die starts, given when it asked. */
export function staggerDelay(now: number): number {
  if (now - batchStart > BATCH_MS + batchCount * STEP_MS) {
    batchStart = now;
    batchCount = 0;
  }
  const delay = Math.min(MAX_DELAY_MS, batchCount * STEP_MS);
  batchCount += 1;
  return delay;
}

/** Forget any batch in progress (tests). */
export function resetStagger(): void {
  batchStart = -Infinity;
  batchCount = 0;
}

const skippers = new Set<() => void>();

/** A rolling die listens here; the returned function stops listening. */
export function onSkip(fn: () => void): () => void {
  skippers.add(fn);
  return () => skippers.delete(fn);
}

/** Finish every die that is still rolling. */
export function skipAll(): void {
  for (const fn of [...skippers]) fn();
}
