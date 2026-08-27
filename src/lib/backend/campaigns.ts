/**
 * Backend adapter for the play engine (campaigns). Like every module in
 * /src/lib/backend, this is the only layer allowed to touch the Cloud client;
 * features and components call these functions, never the client directly.
 */
import { slotFor, type ItemKind } from "@/engine";
import { backendClient } from "./client";
import type {
  Campaign,
  CampaignEvent,
  CampaignEventInsert,
  CampaignFlag,
  CampaignInventoryItem,
  CampaignNpc,
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

/**
 * Wipe every playthrough a character has: campaigns, and through them vitals,
 * inventory, NPCs, factions, flags, mission progress, encounters and the event
 * ledger, all of which cascade off the campaign row. The character sheet itself
 * is untouched — starting again snapshots it fresh.
 */
export async function resetAdventureForCharacter(characterId: string): Promise<void> {
  const { error } = await backendClient.from("campaigns").delete().eq("character_id", characterId);
  if (error) throw new Error(error.message);
}

/** One of a campaign's NPCs by the stable key the GM refers to them by. */
/** Every person this campaign remembers, in the order they were written. */
export async function listCampaignNpcs(campaignId: string): Promise<CampaignNpc[]> {
  const res = await backendClient
    .from("campaign_npcs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  return unwrap(res) ?? [];
}

export async function findCampaignNpc(
  campaignId: string,
  npcKey: string,
): Promise<CampaignNpc | null> {
  const res = await backendClient
    .from("campaign_npcs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("npc_id", npcKey)
    .maybeSingle();
  return unwrap(res);
}

/**
 * Create or update an NPC by key. The table has no unique constraint on
 * (campaign_id, npc_id), so this reads before it writes rather than upserting.
 */
export async function saveCampaignNpc(
  campaignId: string,
  npcKey: string,
  patch: { name?: string; data?: Json },
): Promise<CampaignNpc> {
  const existing = await findCampaignNpc(campaignId, npcKey);
  if (existing) {
    return unwrap(
      await backendClient
        .from("campaign_npcs")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single(),
    );
  }
  return unwrap(
    await backendClient
      .from("campaign_npcs")
      .insert({
        campaign_id: campaignId,
        npc_id: npcKey,
        name: patch.name ?? npcKey,
        ...(patch.data ? { data: patch.data } : {}),
      })
      .select("*")
      .single(),
  );
}

/**
 * Add a bought item to the campaign's kit, stacking onto an identical unequipped
 * line rather than filing a second row for the same thing. Armor and weapons are
 * tracked individually (their SP and mods diverge), so only stackable kinds
 * stack; the caller says which by passing `stack`.
 */
export async function addInventoryItem(
  campaignId: string,
  item: { kind: ItemKind; itemId: string; quantity: number; stack: boolean },
): Promise<CampaignInventoryItem> {
  // Where it sits on the character, derived once from the catalog. Everything
  // downstream keys off slot — weaponCapabilities skips any row whose slot is
  // not "weapon", ammunition is counted by slot, armor is worn by location — so
  // a row written without one is a row the game cannot see. Buying a gun used
  // to produce exactly that: 500eb for an invisible database row.
  const slot = slotFor(item.kind, item.itemId);
  if (item.stack) {
    const existing = await backendClient
      .from("campaign_inventory")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("kind", item.kind)
      .eq("item_id", item.itemId)
      .limit(1)
      .maybeSingle();
    const row = unwrap(existing);
    if (row) {
      return unwrap(
        await backendClient
          .from("campaign_inventory")
          .update({ quantity: row.quantity + item.quantity })
          .eq("id", row.id)
          .select("*")
          .single(),
      );
    }
  }
  return unwrap(
    await backendClient
      .from("campaign_inventory")
      .insert({
        campaign_id: campaignId,
        kind: item.kind,
        item_id: item.itemId,
        quantity: item.quantity,
        slot,
      })
      .select("*")
      .single(),
  );
}

/** Restore a repaired piece of armor to a given SP. */
export async function setInventorySp(
  inventoryId: string,
  currentSp: number,
): Promise<CampaignInventoryItem> {
  return unwrap(
    await backendClient
      .from("campaign_inventory")
      .update({ current_sp: currentSp })
      .eq("id", inventoryId)
      .select("*")
      .single(),
  );
}

/**
 * Set how many rounds a carried weapon has loaded. Null means the weapon takes
 * no ammunition; the play layer never writes a negative count.
 */
export async function setInventoryAmmo(
  inventoryId: string,
  ammoLoaded: number | null,
): Promise<CampaignInventoryItem> {
  return unwrap(
    await backendClient
      .from("campaign_inventory")
      .update({ ammo_loaded: ammoLoaded === null ? null : Math.max(0, ammoLoaded) })
      .eq("id", inventoryId)
      .select("*")
      .single(),
  );
}

/** Mark a piece of kit broken (or repaired back to working order). */
export async function setInventoryCondition(
  inventoryId: string,
  condition: "ok" | "broken",
): Promise<CampaignInventoryItem> {
  return unwrap(
    await backendClient
      .from("campaign_inventory")
      .update({ condition })
      .eq("id", inventoryId)
      .select("*")
      .single(),
  );
}

/** Spend a quantity from a stacked line, floored at zero. */
/**
 * Put a piece of armor on, or take it off.
 *
 * Only worn armor gives SP (encounterModel.armorSp), so this is what makes a
 * vest you bought actually stop a bullet.
 */
export async function setInventoryEquipped(
  inventoryId: string,
  equipped: boolean,
): Promise<CampaignInventoryItem> {
  return unwrap(
    await backendClient
      .from("campaign_inventory")
      .update({ equipped })
      .eq("id", inventoryId)
      .select("*")
      .single(),
  );
}

export async function setInventoryQuantity(
  inventoryId: string,
  quantity: number,
): Promise<CampaignInventoryItem> {
  return unwrap(
    await backendClient
      .from("campaign_inventory")
      .update({ quantity: Math.max(0, quantity) })
      .eq("id", inventoryId)
      .select("*")
      .single(),
  );
}

/**
 * Every flag on a campaign, read fresh.
 *
 * Callers that are about to WRITE a flag read it through this rather than
 * through a bundle they were handed: a snapshot taken before an awaited call is
 * a snapshot that may already be wrong, and a die rolled against a stale flag is
 * a die rolled twice.
 */
export async function listCampaignFlags(campaignId: string): Promise<CampaignFlag[]> {
  return (
    unwrap(await backendClient.from("campaign_flags").select("*").eq("campaign_id", campaignId)) ??
    []
  );
}

/**
 * Record a world fact the GM established. The table is unique on
 * (campaign_id, flag), so setting the same flag twice is idempotent rather
 * than a second row.
 */
export async function setCampaignFlag(
  campaignId: string,
  flag: string,
  value: Json = true as unknown as Json,
): Promise<CampaignFlag> {
  return unwrap(
    await backendClient
      .from("campaign_flags")
      .upsert({ campaign_id: campaignId, flag, value }, { onConflict: "campaign_id,flag" })
      .select("*")
      .single(),
  );
}

/** Move an NPC's disposition, clamped by the caller to the scale the column allows. */
export async function setNpcDisposition(
  npcRowId: string,
  disposition: number,
): Promise<CampaignNpc> {
  return unwrap(
    await backendClient
      .from("campaign_npcs")
      .update({ disposition })
      .eq("id", npcRowId)
      .select("*")
      .single(),
  );
}

/** Append one entry to a campaign's immutable event ledger. */
export async function appendCampaignEvent(event: CampaignEventInsert): Promise<CampaignEvent> {
  return unwrap(await backendClient.from("campaign_events").insert(event).select("*").single());
}

/** A campaign's event ledger in play order (oldest first). */
/**
 * How many ledger rows a turn reads.
 *
 * Every consumer of a turn's events is already bounded — the last six narration
 * lines, the last eight, everything since the last `mission_started`, the last
 * forty rendered in the log. Nothing needed the whole campaign, but the whole
 * campaign is what was fetched, fifteen call sites' worth, several times a turn.
 * At hour one that is forty rows; at hour forty it is thousands, and the cost of
 * a turn grew with the length of the campaign forever.
 *
 * 200 comfortably holds a busy job — its beats, checks, a firefight and the
 * narration around them — so "only this job" still resolves inside the window.
 * Anything older than that is the chronicle's business, not a turn's.
 */
export const EVENT_WINDOW = 200;

/**
 * A campaign's recent ledger, newest-bounded and returned oldest-first.
 *
 * Reads descending against the (campaign_id, seq) index and reverses, so the
 * database returns the newest N rather than scanning the campaign to find them.
 * Callers that genuinely need more — settlement reads a whole job, and it runs
 * once per job rather than once per turn — pass a wider limit.
 */
export async function listCampaignEvents(
  campaignId: string,
  limit: number = EVENT_WINDOW,
): Promise<CampaignEvent[]> {
  const res = await backendClient
    .from("campaign_events")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("seq", { ascending: false })
    .limit(Math.max(1, Math.trunc(limit)));
  const rows = unwrap(res) ?? [];
  return rows.reverse();
}
