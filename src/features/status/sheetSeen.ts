/**
 * Which row of the Screamsheet this browser has read up to.
 *
 * A per-viewer convenience, like the "Previously" card's dismissal: it is held
 * in storage that may be absent, blocked or cleared, and when it is, the only
 * cost is that headlines read as new again. It is never state, and nothing in
 * the game reads it.
 */
const KEY = "nct.sheet.seen";

export function readSheetSeen(campaignId: string): number | null {
  try {
    const raw = window.localStorage.getItem(`${KEY}.${campaignId}`);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeSheetSeen(campaignId: string, seq: number): void {
  try {
    window.localStorage.setItem(`${KEY}.${campaignId}`, String(seq));
  } catch {
    // Not kept: the headlines simply read as new again.
  }
}
