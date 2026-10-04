/**
 * "Previously": the last job, retold when you come back to Life.
 *
 * Finishing a job and starting the next stretch of Life are two screens, and
 * between them a player may close the tab for a night. The Life screen then
 * opens on the situation — a bar, a bill — with nothing to say about the thing
 * that was happening when they left. `welcomeBack` covers what is OWED after a
 * long gap; this covers what HAPPENED, which is the other half of picking a
 * story back up.
 *
 * It reads the closing frame the settlement stored with the receipt
 * (`readClosingFrameEventData`), so it is the same moment Aftermath showed, not a
 * second telling. It shows for exactly as long as it is news: the newest settled
 * job only, until the player does anything in Life, or says they have seen it.
 * It never shows a frame for an older job, never invents one for a quiet job, and
 * has no clock, no streak and no "come back" in it.
 *
 * Pure: rows in, a frame (or nothing) out.
 */
import { LEDGER_EVENTS, readClosingFrameEventData, type ClosingFrame } from "@/engine";
import type { CampaignEvent } from "@/lib/backend";

export type LatestFrame = {
  frame: ClosingFrame;
  /** The `job_settled` receipt it came from, so it is dismissed once per job. */
  settledId: string;
  settledSeq: number;
};

/**
 * The frame of the NEWEST settled job. If that job closed quietly, there is
 * none: an older job's frame is history, not what just happened.
 */
export function latestClosingFrame(settled: CampaignEvent[]): LatestFrame | null {
  let newest: CampaignEvent | null = null;
  for (const event of settled) {
    if (event.type !== LEDGER_EVENTS.jobSettled) continue;
    if (newest === null || event.seq > newest.seq) newest = event;
  }
  if (!newest) return null;
  const frame = readClosingFrameEventData(newest.data);
  return frame ? { frame, settledId: newest.id, settledSeq: newest.seq } : null;
}

/**
 * How the job in progress ended, once it has settled. Aftermath reads this while
 * the settlement may still be in flight, so it must not hand back the frame of
 * the PREVIOUS job in the meantime: the settled receipt has to come after this
 * job began, and when the window no longer reaches back to the start it has to
 * be inside the window itself.
 */
export function frameOfCurrentJob(input: {
  /** The recent ledger, newest last. */
  events: CampaignEvent[];
  /** Every settled-job receipt, whole. */
  settled: CampaignEvent[];
}): ClosingFrame | null {
  let startedSeq = -1;
  for (const event of input.events) {
    if (event.type === "mission_started" && event.seq > startedSeq) startedSeq = event.seq;
  }
  const latest = latestClosingFrame(input.settled);
  if (!latest || latest.settledSeq < startedSeq) return null;
  if (startedSeq === -1 && !input.events.some((e) => e.id === latest.settledId)) return null;
  return latest.frame;
}

/**
 * The frame to open Life on, or null when it is no longer news: the player has
 * already acted since the job closed, or has seen it and put it away.
 */
export function previouslyFor(input: {
  latest: LatestFrame | null;
  /** The recent ledger, newest last. */
  events: CampaignEvent[];
  dismissedId: string | null;
}): ClosingFrame | null {
  const { latest } = input;
  if (!latest) return null;
  if (input.dismissedId === latest.settledId) return null;
  const acted = input.events.some((e) => e.type === "player_input" && e.seq > latest.settledSeq);
  return acted ? null : latest.frame;
}

const KEY = "nct.previously";

/** What this browser has put away for a campaign. Storage can be absent or blocked. */
export function readDismissed(campaignId: string): string | null {
  try {
    return window.localStorage.getItem(`${KEY}.${campaignId}`);
  } catch {
    return null;
  }
}

export function writeDismissed(campaignId: string, settledId: string): void {
  try {
    window.localStorage.setItem(`${KEY}.${campaignId}`, settledId);
  } catch {
    // A convenience, not state: if it cannot be kept it simply shows again.
  }
}
