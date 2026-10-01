/**
 * A phone in the hand at the two moments that matter: the lock, and the cut to
 * the prose. A browser without vibration, and anybody who has asked for less
 * motion, gets nothing.
 */
export function haptic(pattern: number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // A page that has not been touched is not allowed to buzz. That is fine.
  }
}

export const LOCK_BUZZ = [30, 40, 30];
export const HINGE_BUZZ = [70];
