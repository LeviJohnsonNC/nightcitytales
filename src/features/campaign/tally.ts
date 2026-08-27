/**
 * The handful of numbers that must survive the window.
 *
 * Almost everything a turn needs is recent, which is why a turn reads the last
 * 200 ledger rows rather than the campaign. But the record's job is to remember
 * fifty sessions, and counting "jobs taken" out of a 200-row window would mean
 * counting the last two — a long-memory feature with a short memory, which is
 * worse than not having one.
 *
 * So these four are tallied when they happen and stored. Four integers, written
 * once per job or once per decline, and exact forever.
 */
import { listCampaignFlags, setCampaignFlag, type CampaignFlag, type Json } from "@/lib/backend";

export const TALLY_FLAG = "campaign_tally";

export type CampaignTally = {
  jobsTaken: number;
  jobsFinished: number;
  jobsDeclined: number;
  bodies: number;
};

const EMPTY: CampaignTally = { jobsTaken: 0, jobsFinished: 0, jobsDeclined: 0, bodies: 0 };

function int(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

/** What the campaign has counted so far. Zeroes for a campaign that has none. */
export function tallyFrom(flags: CampaignFlag[]): CampaignTally {
  const value = flags.find((f) => f.flag === TALLY_FLAG)?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY };
  const row = value as Record<string, unknown>;
  return {
    jobsTaken: int(row["jobsTaken"]),
    jobsFinished: int(row["jobsFinished"]),
    jobsDeclined: int(row["jobsDeclined"]),
    bodies: int(row["bodies"]),
  };
}

/**
 * Add to the campaign's running totals.
 *
 * Reads its own flags before writing, so two things counted close together
 * cannot each write a total missing the other.
 */
export async function addToTally(
  campaignId: string,
  delta: Partial<CampaignTally>,
): Promise<CampaignTally> {
  const current = tallyFrom(await listCampaignFlags(campaignId));
  const next: CampaignTally = {
    jobsTaken: current.jobsTaken + int(delta.jobsTaken),
    jobsFinished: current.jobsFinished + int(delta.jobsFinished),
    jobsDeclined: current.jobsDeclined + int(delta.jobsDeclined),
    bodies: current.bodies + int(delta.bodies),
  };
  await setCampaignFlag(campaignId, TALLY_FLAG, next as unknown as Json);
  return next;
}
