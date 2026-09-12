/**
 * Backend adapter for what a campaign has discovered.
 *
 * `src/engine/truth.ts` derives what is TRUE about a place; this records who
 * has found it out. A row exists only once something has been found, so a
 * campaign that has searched nothing has no rows — which is also its honest
 * starting state.
 *
 * TOLERATES THE TABLE NOT EXISTING. `campaign_truths` ships as a pending
 * migration (see supabase/migrations/APPLIED.md), so between this code merging
 * and somebody running the SQL there is a window where the table is absent.
 * This repository has already been burned by exactly that gap the other way
 * round: `home_place_key` was committed and never applied, the read failed, the
 * failure was SWALLOWED, and every character silently woke up at the atlas
 * default. So the absence is handled deliberately rather than accidentally —
 * `truthsAvailable` says whether the feature is switched on at all, and the
 * caller uses it to fall back to the old behaviour instead of quietly finding
 * nothing forever.
 */
import { backendClient } from "./client";
import type { CampaignTruth } from "./types";

/** Postgres: relation does not exist. The one error that means "not migrated yet". */
const UNDEFINED_TABLE = "42P01";

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === UNDEFINED_TABLE) return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("campaign_truths") && message.includes("does not exist");
}

export type CampaignTruths = {
  /**
   * False when the table is not there yet. NOT the same as "nothing has been
   * discovered": one means the feature is off, the other means the campaign has
   * not looked, and a caller that conflates them silently disables Perception.
   */
  available: boolean;
  rows: CampaignTruth[];
};

/** Every truth this campaign has discovered. */
export async function listCampaignTruths(campaignId: string): Promise<CampaignTruths> {
  const res = await backendClient.from("campaign_truths").select("*").eq("campaign_id", campaignId);
  if (res.error) {
    if (isMissingTable(res.error)) return { available: false, rows: [] };
    throw new Error(res.error.message);
  }
  return { available: true, rows: (res.data as CampaignTruth[]) ?? [] };
}

export type TruthDiscovery = {
  truthKey: string;
  discoveredDay: number | null;
  viaSkill: string | null;
};

/**
 * Record a discovery. Idempotent on (campaign, truth): finding the same thing
 * twice is one discovery, and the first time it was found is the one that
 * counts.
 */
export async function recordTruthDiscovery(
  campaignId: string,
  input: TruthDiscovery,
): Promise<boolean> {
  const res = await backendClient.from("campaign_truths").upsert(
    {
      campaign_id: campaignId,
      truth_key: input.truthKey,
      discovered_day: input.discoveredDay,
      via_skill: input.viaSkill,
    },
    { onConflict: "campaign_id,truth_key", ignoreDuplicates: true },
  );
  if (res.error) {
    if (isMissingTable(res.error)) return false;
    throw new Error(res.error.message);
  }
  return true;
}
