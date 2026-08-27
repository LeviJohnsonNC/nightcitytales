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
  DEFAULT_ARENA_KEY,
  arenaFor,
  getArmor,
  rangeMetres,
  threatFor,
  weaponProfile,
  woundMovePenalty,
  woundStateFor,
  type Arena,
  type Combatant,
  type EncounterState,
  type Point,
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
  /**
   * Where this combatant is standing, in metres.
   *
   * Every Range DV is MEASURED from this. It used to be a `distance` the model
   * wrote into its response, which made the narrator the author of every DV in
   * the fight — see engine/battlefield.ts.
   */
  position: Point;
  /** MOVE, in metres per Move Action. Bounds how far this combatant can go. */
  move: number;
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

/** A stored position, or nothing if this row predates positions existing. */
function positionOf(raw: Record<string, unknown>): Point | null {
  const value = raw["position"];
  if (!value || typeof value !== "object") return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * A place to stand for a fight that started before positions existed.
 *
 * Those rows carry the old model-authored `distance` instead. Rather than drop
 * a live encounter on the floor mid-round, put them that many metres up the
 * arena from the player's start — the same distance they had, now as a place.
 */
function legacyPosition(raw: Record<string, unknown>, isPlayer: boolean): Point {
  const arena = arenaFor(DEFAULT_ARENA_KEY);
  if (isPlayer) return { ...arena.playerStart };
  const distance = typeof raw["distance"] === "number" ? Math.max(0, raw["distance"]) : 12;
  return { x: arena.playerStart.x, y: arena.playerStart.y + distance };
}

export function combatantDataOf(row: EncounterCombatant): CombatantData {
  const raw = (row.data ?? {}) as Record<string, unknown> & Partial<CombatantData>;
  const turn = turnStateOf(raw.turn);
  return {
    key: typeof raw.key === "string" ? raw.key : row.id,
    weaponName: typeof raw.weaponName === "string" ? raw.weaponName : "sidearm",
    damageDice: typeof raw.damageDice === "number" ? raw.damageDice : 2,
    rangeType: typeof raw.rangeType === "string" ? raw.rangeType : null,
    position: positionOf(raw) ?? legacyPosition(raw, row.is_player),
    move: typeof raw.move === "number" ? raw.move : DEFAULT_HOSTILE_MOVE,
    attackSkill: typeof raw.attackSkill === "number" ? raw.attackSkill : 0,
    ...(turn ? { turn } : {}),
  };
}

/**
 * MOVE for a combatant row that predates anybody having one.
 *
 * Every hostile built today carries its own MOVE off its threat profile, and
 * Backup carries the printed one off its tier. This is only the floor for rows
 * written before either existed.
 */
export const DEFAULT_HOSTILE_MOVE = 6;

/** Metres between two combatants, which is the only place a Range DV comes from. */
export function metresApart(a: CombatantData, b: CombatantData): number {
  return rangeMetres(a.position, b.position);
}

/**
 * How far this combatant can actually go this Round.
 *
 * Mortally Wounded is −6 MOVE with a floor of 1 (CP:R pg. 186); the rules put
 * the floor on the caller, and this is the caller.
 */
export function moveAllowance(move: number, wound: WoundStateCode): number {
  const base = Math.max(0, move);
  if (base <= 0) return 0;
  return Math.max(1, base + woundMovePenalty(wound));
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
  arena: Arena = arenaFor(DEFAULT_ARENA_KEY),
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
    position: { ...arena.playerStart },
    // MOVE is a stat on the sheet. A wounded character's MOVE penalty is
    // applied where the movement is spent, not baked in here.
    move: Math.max(0, stats["move"] ?? 0),
    attackSkill: 0,
  };
  return { combatant, data };
}

/**
 * A hostile as an engine combatant, standing where the arena put them.
 *
 * The GM names them and picks a profile; every number comes off that profile.
 * This used to read REF, BODY, HP, SP, skill, weapon and damage dice straight
 * out of the model's response.
 */
export function hostileCombatant(
  enemy: GmEnemy,
  id: string,
  position: Point,
): { combatant: Combatant; data: CombatantData } {
  const profile = threatFor(enemy.profile);
  const threshold = Math.ceil(profile.hp / 2);
  const combatant: Combatant = {
    id,
    name: enemy.name,
    side: "hostile",
    isPlayer: false,
    ref: profile.ref,
    body: profile.body,
    hpMax: profile.hp,
    hp: profile.hp,
    seriouslyWoundedThreshold: threshold,
    woundState: "none",
    deathSavePenalty: 0,
    spHead: profile.sp,
    spBody: profile.sp,
    defeated: false,
    initiative: null,
  };
  const data: CombatantData = {
    key: enemy.key,
    weaponName: profile.weaponName,
    damageDice: profile.damageDice,
    rangeType: profile.rangeType,
    position: { ...position },
    // Their own MOVE now, not one constant for everybody: a chromed booster
    // covers 8 m and a renta-cop covers 4, which is the difference between a
    // fight that closes and one that does not.
    move: profile.move,
    attackSkill: profile.attackSkill,
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
  arena: string | null;
}): StartEncounterPayload {
  return {
    campaign_id: input.campaignId,
    name: input.name,
    beat_id: input.beatId,
    active_index: input.state.activeIndex,
    order_ids: input.state.order,
    arena: input.arena,
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
