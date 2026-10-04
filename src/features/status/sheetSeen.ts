/**
 * Which row of the Screamsheet this browser has read up to.
 *
 * A per-viewer convenience, like the "Previously" card's dismissal: it is held
 * in storage that may be absent, blocked or cleared, and when it is, the only
 * cost is that headlines read as new again. It is never state, and nothing in
 * the game reads it.
 */
const KEY = "nct.sheet.seen";

/**
 * What to start from the first time this browser loads a campaign that already
 * has headlines: everything up to the newest, so a campaign that began before the
 * Sheet existed (or a new browser) is not greeted with a wall of "new". Null
 * when there is nothing to adopt, or the reader has already got somewhere.
 */
export function firstVisitBaseline(
  items: readonly { seq: number }[],
  seen: number | null,
): number | null {
  if (seen !== null || items.length === 0) return null;
  return items.reduce((newest, item) => Math.max(newest, item.seq), items[0]!.seq);
}

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
