/**
 * Backend adapter for mission_progress (the beat-graph position). Reads and
 * writes the single mission_progress row per (campaign, mission).
 */
import { backendClient } from "./client";
import type { MissionProgress, MissionProgressInsert, MissionProgressUpdate } from "./types";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** The progress row for a mission in a campaign, if it has been started. */
export async function getMissionProgress(
  campaignId: string,
  missionId: string,
): Promise<MissionProgress | null> {
  const res = await backendClient
    .from("mission_progress")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("mission_id", missionId)
    .maybeSingle();
  return unwrap(res);
}

/** Create or replace the progress row (unique on campaign_id + mission_id). */
export async function upsertMissionProgress(row: MissionProgressInsert): Promise<MissionProgress> {
  return unwrap(
    await backendClient
      .from("mission_progress")
      .upsert(row, { onConflict: "campaign_id,mission_id" })
      .select("*")
      .single(),
  );
}

export async function updateMissionProgress(
  id: string,
  patch: MissionProgressUpdate,
): Promise<MissionProgress> {
  return unwrap(
    await backendClient.from("mission_progress").update(patch).eq("id", id).select("*").single(),
  );
}
