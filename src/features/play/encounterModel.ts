/**
 * Mapping between saved rows and the pure encounter engine. Everything
 * mechanical (initiative, To-Hit, damage, Death Saves) lives in
 * src/engine/encounter.ts; this file only translates shapes.
 *
 * Armor SP comes from the character's equipped armor lines and their ablated
 * current_sp, never from a guess. Hostile stat blocks come from the GM (they are
 * improvised NPCs, not rules data) and are stored on the combatant row so the
 * fight survives a reload.
 */
import {
  getArmor,
  weaponProfile,
  woundStateFor,
  type Combatant,
  type EncounterState,
  type WeaponProfile,
  type WoundStateCode,
} from "@/engine";
import type { GmEnemy } from "@/features/gm/gmResponse";
import type {
  CampaignInventoryItem,
  CampaignVitals,
  EncounterCombatant,
  FullCharacter,
  FullEncounter,
  Json,
} from "@/lib/backend";
import type { StartEncounterPayload } from "@/lib/backend";
import { liveInventory } from "./liveInventory";
import { statsRecord } from "./playModel";

/** Per-combatant turn bookkeeping: one Action and one Move a Round (CP:R pg. 165). */
export type CombatantTurnState = {
  /** The Round these counters belong to; a new Round resets them. */
  round: number;
  actionUsed: boolean;
  shotsThisRound: number;
  shotWeaponId: string | null;
  metresMoved: number;
};

/** The per-combatant extras the schema keeps in `data`. */
export type CombatantData = {
  /** The GM's stable key for this hostile ("scav_1"); the player uses "player". */
  key: string;
  weaponName: string;
  damageDice: number;
  rangeType: string | null;
  /** Distance in metres between this combatant and the player character. */
  distance: number;
  /** Skill level used for this combatant's attacks (hostiles only). */
  attackSkill: number;
  /** What this combatant has spent of the current Round, when tracked. */
  turn?: CombatantTurnState;
};

function turnStateOf(raw: unknown): CombatantTurnState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Partial<CombatantTurnState>;
  if (typeof t.round !== "number") return undefined;
  return {
    round: t.round,
    actionUsed: t.actionUsed === true,
    shotsThisRound: typeof t.shotsThisRound === "number" ? t.shotsThisRound : 0,
    shotWeaponId: typeof t.shotWeaponId === "string" ? t.shotWeaponId : null,
    metresMoved: typeof t.metresMoved === "number" ? t.metresMoved : 0,
  };
}

export function combatantDataOf(row: EncounterCombatant): CombatantData {
  const raw = (row.data ?? {}) as Partial<CombatantData>;
  const turn = turnStateOf(raw.turn);
  return {
    key: typeof raw.key === "string" ? raw.key : row.id,
    weaponName: typeof raw.weaponName === "string" ? raw.weaponName : "sidearm",
    damageDice: typeof raw.damageDice === "number" ? raw.damageDice : 2,
    rangeType: typeof raw.rangeType === "string" ? raw.rangeType : null,
    distance: typeof raw.distance === "number" ? raw.distance : 12,
    attackSkill: typeof raw.attackSkill === "number" ? raw.attackSkill : 0,
    ...(turn ? { turn } : {}),
  };
}

/**
 * Worn armor SP by location, using ablated current_sp when present.
 *
 * Reads the CAMPAIGN's rows, not the character sheet. Reading the sheet meant
 * armor bought during the campaign gave no protection at all, and that the
 * `current_sp` armor repair writes was a number nothing computing protection
 * ever looked at.
 */
export function armorSp(rows: CampaignInventoryItem[]): { head: number; body: number } {
  const out = { head: 0, body: 0 };
  for (const row of rows) {
    // Only what is actually WORN. Counting everything owned would make the
    // best armor in the kit protect you for free, and armor's REF penalty is
    // not modelled in play yet — so owning heavy plate would be pure upside.
    // Buying armor marks it worn (features/campaign/shopping.ts) instead.
    if (!row.equipped || row.quantity <= 0) continue;
    const location: "head" | "body" | null =
      row.slot === "head" ? "head" : row.slot === "body" ? "body" : null;
    if (!location) continue;
    let sp: number | null = row.current_sp;
    if (sp === null) {
      try {
        sp = getArmor(row.item_id).sp;
      } catch {
        sp = null;
      }
    }
    if (typeof sp === "number") out[location] = Math.max(out[location], sp);
  }
  return out;
}

/**
 * Every catalog weapon the character is carrying, as combat profiles.
 *
 * The campaign's rows again: a gun bought mid-campaign was previously never
 * offered as something to attack with.
 */
export function weaponChoices(rows: CampaignInventoryItem[]): WeaponProfile[] {
  const profiles: WeaponProfile[] = [];
  for (const row of rows) {
    if (row.slot !== "weapon" || row.quantity <= 0) continue;
    try {
      profiles.push(weaponProfile(row.item_id));
    } catch {
      // Not a catalog weapon; nothing to resolve with.
    }
  }
  return profiles;
}

/** The player's combatant, straight off the sheet and the live vitals. */
export function playerCombatant(
  character: FullCharacter,
  vitals: CampaignVitals,
  id: string,
  inventory: CampaignInventoryItem[] = [],
): { combatant: Combatant; data: CombatantData } {
  const stats = statsRecord(character);
  const sp = armorSp(liveInventory(inventory, character));
  const combatant: Combatant = {
    id,
    name: character.character.name,
    side: "friendly",
    isPlayer: true,
    ref: stats["ref"] ?? 0,
    body: stats["body"] ?? 0,
    hpMax: vitals.hp_max,
    hp: vitals.hp_current,
    seriouslyWoundedThreshold: vitals.seriously_wounded_threshold,
    woundState: woundStateFor(
      vitals.hp_current,
      vitals.hp_max,
      vitals.seriously_wounded_threshold,
    ) as WoundStateCode,
    deathSavePenalty: vitals.mortal_save_failures,
    spHead: sp.head,
    spBody: sp.body,
    defeated: false,
    initiative: null,
  };
  const data: CombatantData = {
    key: "player",
    weaponName: "",
    damageDice: 0,
    rangeType: null,
    distance: 0,
    attackSkill: 0,
  };
  return { combatant, data };
}

/** A GM-authored hostile as an engine combatant. */
export function hostileCombatant(
  enemy: GmEnemy,
  id: string,
): { combatant: Combatant; data: CombatantData } {
  const threshold = Math.ceil(enemy.hp / 2);
  const combatant: Combatant = {
    id,
    name: enemy.name,
    side: "hostile",
    isPlayer: false,
    ref: enemy.ref,
    body: enemy.body,
    hpMax: enemy.hp,
    hp: enemy.hp,
    seriouslyWoundedThreshold: threshold,
    woundState: "none",
    deathSavePenalty: 0,
    spHead: enemy.sp,
    spBody: enemy.sp,
    defeated: false,
    initiative: null,
  };
  const data: CombatantData = {
    key: enemy.key,
    weaponName: enemy.weaponName,
    damageDice: enemy.damageDice,
    rangeType: enemy.rangeType,
    distance: enemy.distance,
    attackSkill: enemy.attackSkill,
  };
  return { combatant, data };
}

/** Rebuild the live engine state from the persisted rows. */
export function stateFromRows(full: FullEncounter): EncounterState {
  const combatants: Record<string, Combatant> = {};
  for (const row of full.combatants) {
    combatants[row.id] = {
      id: row.id,
      name: row.name,
      side: row.side as Combatant["side"],
      isPlayer: row.is_player,
      ref: row.ref,
      body: row.body,
      hpMax: row.hp_max,
      hp: row.hp_current,
      seriouslyWoundedThreshold: row.seriously_wounded_threshold,
      woundState: row.wound_state as WoundStateCode,
      deathSavePenalty: row.death_save_penalty,
      spHead: row.sp_head,
      spBody: row.sp_body,
      defeated: row.defeated,
      initiative: row.initiative,
    };
  }
  const order = Array.isArray(full.encounter.order_ids)
    ? (full.encounter.order_ids as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  return {
    round: full.encounter.round,
    order,
    activeIndex: full.encounter.active_index,
    status: full.encounter.status === "active" ? "active" : (full.encounter.status as never),
    combatants,
  };
}

/** The payload the start_encounter RPC expects for a freshly rolled fight. */
export function startEncounterPayload(input: {
  campaignId: string;
  name: string;
  beatId: string | null;
  characterId: string;
  state: EncounterState;
  data: Record<string, CombatantData>;
}): StartEncounterPayload {
  return {
    campaign_id: input.campaignId,
    name: input.name,
    beat_id: input.beatId,
    active_index: input.state.activeIndex,
    order_ids: input.state.order,
    combatants: input.state.order.map((id) => {
      const c = input.state.combatants[id]!;
      return {
        id: c.id,
        character_id: c.isPlayer ? input.characterId : null,
        is_player: c.isPlayer,
        name: c.name,
        side: c.side,
        ref: c.ref,
        body: c.body,
        hp_max: c.hpMax,
        hp_current: c.hp,
        seriously_wounded_threshold: c.seriouslyWoundedThreshold,
        wound_state: c.woundState,
        death_save_penalty: c.deathSavePenalty,
        sp_head: c.spHead,
        sp_body: c.spBody,
        initiative: c.initiative,
        defeated: c.defeated,
        data: (input.data[c.id] ?? {}) as unknown as Json,
      };
    }),
  };
}
