import { backendClient } from "./client";
import type { Json } from "./types";

/** Additive RPC contract until Cloud types are regenerated after deployment. */
async function sceneRpc(name: string, payload: Json): Promise<unknown> {
  const rpc = backendClient.rpc.bind(backendClient) as (
    name: string,
    args: { payload: Json },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc(name, { payload });
  if (error) throw new Error(error.message);
  return data;
}
export function stageAuthoredScene(campaignId: string, manifest: Json): Promise<unknown> {
  return sceneRpc("stage_authored_scene", { campaign_id: campaignId, manifest });
}
export function readCampaignScene(campaignId: string, sceneId?: string): Promise<unknown> {
  return sceneRpc("read_campaign_scene", {
    campaign_id: campaignId,
    ...(sceneId ? { scene_id: sceneId } : {}),
  });
}

/** Automatic composition must never move a campaign back to a stale narrator location. */
export function stageAdventureScene(
  campaignId: string,
  scene: import("@/engine").AuthoredScene,
  expected: { missionId: string; beatId: string | null; location: string },
): Promise<unknown> {
  return sceneRpc("stage_adventure_scene", {
    campaign_id: campaignId,
    manifest: { version: 1, scene },
    expected,
  } as unknown as Json);
}
