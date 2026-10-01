/**
 * When the descent began.
 *
 * The sequence is a pure function of how long it has been since the player
 * pressed "Enter Night City" — not since some component mounted — because three
 * different screens render it in turn (the button's own fade, the route while
 * the campaign loads, the opening itself) and a clock that restarted at each
 * would play the first second three times. Module state, deliberately: it only
 * has to survive a client-side navigation, and a reload that lands on the
 * opening simply starts the descent again from the top.
 *
 * Presentation only. Nothing here touches the campaign.
 */

/** A descent armed longer ago than this is somebody else's: start again. */
const FRESH_MS = 120_000;

let armedAt: number | null = null;

/** The player has pressed the button. Everything is measured from now. */
export function armDescent(now: number = performance.now()): void {
  armedAt = now;
}

/** The campaign turned out to be an old one with no opening: nothing to play. */
export function disarmDescent(): void {
  armedAt = null;
}

/** Whether a descent is under way that a screen should carry on drawing. */
export function descentArmed(now: number = performance.now()): boolean {
  return armedAt !== null && now - armedAt <= FRESH_MS;
}

/**
 * Milliseconds since the descent began, arming it now if nothing has. A screen
 * that mounts with no descent under way (a reload, a deep link) starts one.
 */
export function descentElapsed(now: number = performance.now()): number {
  if (armedAt === null || now - armedAt > FRESH_MS) armedAt = now;
  return now - armedAt;
}
