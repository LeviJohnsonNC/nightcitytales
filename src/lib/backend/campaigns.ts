/**
 * Backend adapter for the play engine (campaigns). Like every module in
 * /src/lib/backend, this is the only layer allowed to touch the Cloud client;
 * features and components call these functions, never the client directly.
 */
import { backendClient } from "./client";
import type {
  Campaign,
  CampaignEvent,
  CampaignEventInsert,
  CampaignUpdate,
  CampaignVitals,
  CampaignVitalsUpdate,
  FullCampaign,
  Json,
} from "./types";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Every campaign the signed-in user owns, most recently updated first. */
export async function listCampaigns(): Promise<Campaign[]> {
  const res = await backendClient
    .from("campaigns")
    .select("*")
    .order("updated_at", { ascending: false });
  return unwrap(res) ?? [];
}

/** The single active campaign for a character, if one exists. */
export async function getActiveCampaignForCharacter(characterId: string): Promise<Campaign | null> {
  const res = await backendClient
    .from("campaigns")
    .select("*")
    .eq("character_id", characterId)
    .eq("status", "active")
    .maybeSingle();
  return unwrap(res);
}

/** A campaign plus every attached live-state record. */
export async function getCampaign(id: string): Promise<FullCampaign | null> {
  const campaignRes = await backendClient.from("campaigns").select("*").eq("id", id).maybeSingle();
  const campaign = unwrap(campaignRes);
  if (!campaign) return null;

  const [vitals, inventory, npcs, factions, flags, missions] = await Promise.all([
    backendClient.from("campaign_vitals").select("*").eq("campaign_id", id).maybeSingle(),
    backendClient.from("campaign_inventory").select("*").eq("campaign_id", id),
    backendClient.from("campaign_npcs").select("*").eq("campaign_id", id),
    backendClient.from("campaign_factions").select("*").eq("campaign_id", id),
    backendClient.from("campaign_flags").select("*").eq("campaign_id", id),
    backendClient.from("mission_progress").select("*").eq("campaign_id", id),
  ]);

  return {
    campaign,
    vitals: unwrap(vitals),
    inventory: unwrap(inventory) ?? [],
    npcs: unwrap(npcs) ?? [],
    factions: unwrap(factions) ?? [],
    flags: unwrap(flags) ?? [],
    missions: unwrap(missions) ?? [],
  };
}

export async function updateCampaign(id: string, patch: CampaignUpdate): Promise<Campaign> {
  return unwrap(
    await backendClient.from("campaigns").update(patch).eq("id", id).select("*").single(),
  );
}

/** Write the player's live HP / wound state back after combat. */
export async function updateCampaignVitals(
  campaignId: string,
  patch: CampaignVitalsUpdate,
): Promise<CampaignVitals> {
  return unwrap(
    await backendClient
      .from("campaign_vitals")
      .update(patch)
      .eq("campaign_id", campaignId)
      .select("*")
      .single(),
  );
}

/**
 * The payload the start_campaign database function accepts. It creates the
 * campaign, snapshots live vitals from the character, copies inventory, opens
 * the event ledger, and (optionally) starts a mission — all in one transaction.
 */
export type StartCampaignPayload = {
  character_id: string;
  name?: string;
  mission_id?: string | null;
};

/** Begin a playthrough from a saved character. Returns the new campaign id. */
export async function startCampaign(payload: StartCampaignPayload): Promise<string> {
  const { data, error } = await backendClient.rpc("start_campaign", {
    payload: payload as unknown as Json,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== "string") throw new Error("start_campaign did not return a campaign id.");
  return data;
}

/** Append one entry to a campaign's immutable event ledger. */
export async function appendCampaignEvent(event: CampaignEventInsert): Promise<CampaignEvent> {
  return unwrap(await backendClient.from("campaign_events").insert(event).select("*").single());
}

/** A campaign's event ledger in play order (oldest first). */
export async function listCampaignEvents(campaignId: string): Promise<CampaignEvent[]> {
  const res = await backendClient
    .from("campaign_events")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("seq", { ascending: true });
  return unwrap(res) ?? [];
}
