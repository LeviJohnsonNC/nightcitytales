/**
 * Backend adapter for encounters (the combat turn loop). Like every module in
 * /src/lib/backend, the only layer allowed to touch the Cloud client.
 */
import { backendClient } from "./client";
import type {
  Encounter,
  EncounterCombatant,
  EncounterCombatantUpdate,
  EncounterUpdate,
  FullEncounter,
  Json,
} from "./types";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/**
 * Payload for the start_encounter RPC. The engine (startEncounter) has already
 * rolled initiative and assigned each combatant a UUID id, so this is pure
 * persistence.
 */
export type StartEncounterPayload = {
  campaign_id: string;
  name?: string;
  beat_id?: string | null;
  active_index?: number;
  order_ids: string[];
  /** Key from the engine's closed ARENAS list; null reads as open ground. */
  arena?: string | null;
  combatants: Array<{
    id: string;
    character_id?: string | null;
    is_player: boolean;
    name: string;
    side: "friendly" | "hostile" | "neutral";
    ref: number;
    body: number;
    hp_max: number;
    hp_current: number;
    seriously_wounded_threshold: number;
    wound_state?: string;
    death_save_penalty?: number;
    sp_head?: number;
    sp_body?: number;
    initiative?: number | null;
    defeated?: boolean;
    data?: Json;
  }>;
};

/**
 * The complete mutable encounter projection. The database writes the fight and
 * the player's long-lived campaign state in one transaction, so a reload can
 * never restore HP from one version of the exchange and armor from another.
 */
export type SaveEncounterPayload = {
  encounter_id: string;
  round: number;
  active_index: number;
  order_ids: string[];
  status: string;
  /**
   * Damage taken by each piece of arena cover, keyed by its authored id.
   * Geometry is never sent: it lives in engine/battlefield.ts. The transaction
   * merges this by element-wise maximum rather than replacing it, so a save
   * built on a stale read can never un-damage a wall.
   */
  cover?: Record<string, number>;
  /**
   * The version the caller read. The transaction refuses the write if the row
   * has moved on since — see 20260901000000_encounter_version.sql. Omitting it
   * writes unchecked, which is what a client running an older bundle does.
   */
  version?: number;
  combatants: Array<{
    id: string;
    hp_current: number;
    wound_state: string;
    death_save_penalty: number;
    sp_head: number;
    sp_body: number;
    defeated: boolean;
    initiative: number | null;
    data: Json;
  }>;
  player: {
    hp_current: number;
    wound_state: string;
    mortal_save_failures: number;
    head_inventory_id?: string | null;
    head_sp?: number | null;
    body_inventory_id?: string | null;
    body_sp?: number | null;
  };
  ammo?: { inventory_id: string; loaded: number } | null;
};

/** Persist a fight in one transaction. Returns the new encounter id. */
export async function startEncounter(payload: StartEncounterPayload): Promise<string> {
  const { data, error } = await backendClient.rpc("start_encounter", {
    payload: payload as unknown as Json,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== "string") {
    throw new Error("start_encounter did not return an encounter id.");
  }
  return data;
}

/** Persist an exchange and its campaign consequences atomically. */
export async function saveEncounter(payload: SaveEncounterPayload): Promise<void> {
  const { error } = await backendClient.rpc("save_encounter_state", {
    payload: payload as unknown as Json,
  });
  if (error) throw new Error(error.message);
}

/**
 * Put a new combatant into a fight already in progress — a Lawman's Backup
 * turning up. start_encounter writes the opening roster in one transaction;
 * this is the only way anyone joins after that.
 */
export async function addCombatant(
  encounterId: string,
  combatant: {
    id: string;
    name: string;
    side: string;
    is_player: boolean;
    ref: number;
    body: number;
    hp_max: number;
    hp_current: number;
    seriously_wounded_threshold: number;
    wound_state: string;
    sp_head: number;
    sp_body: number;
    initiative: number | null;
    data: Json;
  },
): Promise<void> {
  const { error } = await backendClient
    .from("encounter_combatants")
    .insert({ encounter_id: encounterId, ...combatant });
  if (error) throw new Error(error.message);
}

/** The active encounter for a campaign, if a fight is in progress. */
export async function getActiveEncounter(campaignId: string): Promise<Encounter | null> {
  const res = await backendClient
    .from("encounters")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "active")
    .maybeSingle();
  return unwrap(res);
}

/** An encounter plus its combatants, ordered by initiative (highest first). */
export async function getEncounter(id: string): Promise<FullEncounter | null> {
  const encounterRes = await backendClient
    .from("encounters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const encounter = unwrap(encounterRes);
  if (!encounter) return null;

  const combatantsRes = await backendClient
    .from("encounter_combatants")
    .select("*")
    .eq("encounter_id", id)
    .order("initiative", { ascending: false });
  return { encounter, combatants: unwrap(combatantsRes) ?? [] };
}

export async function updateEncounter(id: string, patch: EncounterUpdate): Promise<Encounter> {
  return unwrap(
    await backendClient.from("encounters").update(patch).eq("id", id).select("*").single(),
  );
}

export async function updateCombatant(
  id: string,
  patch: EncounterCombatantUpdate,
): Promise<EncounterCombatant> {
  return unwrap(
    await backendClient
      .from("encounter_combatants")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single(),
  );
}
