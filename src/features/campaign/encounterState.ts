/**
 * Persisting a fight. The engine (src/engine/encounter.ts) owns the state
 * transitions; this module loads the rows into engine state and writes the
 * changed combatants back. It never decides anything mechanical.
 */
import { arenaFor, coverDamageFrom, type CoverDamage, type EncounterState } from "@/engine";
import {
  getActiveEncounter,
  getEncounter,
  saveEncounter,
  startEncounter as startEncounterRpc,
  type FullEncounter,
  type SaveEncounterPayload,
} from "@/lib/backend";
import {
  combatantDataOf,
  startEncounterPayload,
  stateFromRows,
  type CombatantData,
} from "@/features/play/encounterModel";

export type LiveEncounter = {
  id: string;
  state: EncounterState;
  /** Per-combatant extras (weapon, position, GM key) keyed by combatant id. */
  data: Record<string, CombatantData>;
  /** Which of the engine's arenas this fight is happening on. */
  arena: string | null;
  /**
   * Damage taken by each piece of that arena's cover, keyed by its authored id.
   *
   * Only the damage: where cover stands and what it is made of is authored in
   * engine/battlefield.ts, so a fight in progress cannot disagree with the
   * arena it is being fought on.
   */
  cover: CoverDamage;
};

function liveFrom(full: FullEncounter): LiveEncounter {
  const data: Record<string, CombatantData> = {};
  for (const row of full.combatants) data[row.id] = combatantDataOf(row);
  const arena = full.encounter.arena ?? null;
  return {
    id: full.encounter.id,
    state: stateFromRows(full),
    data,
    arena,
    // Read against the authored arena: an id no arena knows is dropped rather
    // than trusted into a live fight. The database validated shape and sign;
    // identity is this layer's to check.
    cover: coverDamageFrom(arenaFor(arena), full.encounter.cover),
  };
}

/** The campaign's fight in progress, if there is one. */
export async function loadLiveEncounter(campaignId: string): Promise<LiveEncounter | null> {
  const encounter = await getActiveEncounter(campaignId);
  if (!encounter) return null;
  const full = await getEncounter(encounter.id);
  return full ? liveFrom(full) : null;
}

/** Persist a freshly rolled encounter and return it as live state. */
export async function createLiveEncounter(input: {
  campaignId: string;
  name: string;
  beatId: string | null;
  characterId: string;
  state: EncounterState;
  data: Record<string, CombatantData>;
  arena: string | null;
}): Promise<LiveEncounter> {
  const id = await startEncounterRpc(startEncounterPayload(input));
  return { id, state: input.state, data: input.data, arena: input.arena, cover: {} };
}

/** Write the fight and the player's durable campaign state in one transaction. */
export async function saveLiveEncounter(
  live: LiveEncounter,
  ammo: { inventoryId: string; loaded: number } | null = null,
): Promise<void> {
  const player = Object.values(live.state.combatants).find((c) => c.isPlayer);
  if (!player) throw new Error("The encounter has no player combatant.");
  const armor = live.data[player.id]?.armor;
  const payload: SaveEncounterPayload = {
    encounter_id: live.id,
    round: live.state.round,
    cover: live.cover,
    active_index: live.state.activeIndex,
    order_ids: live.state.order,
    status: live.state.status,
    combatants: live.state.order.flatMap((id) => {
      const c = live.state.combatants[id];
      if (!c) return [];
      return [
        {
          id,
          hp_current: c.hp,
          wound_state: c.woundState,
          death_save_penalty: c.deathSavePenalty,
          sp_head: c.spHead,
          sp_body: c.spBody,
          defeated: c.defeated,
          initiative: c.initiative,
          data: live.data[id] as never,
        },
      ];
    }),
    player: {
      hp_current: player.hp,
      wound_state: player.woundState,
      mortal_save_failures: player.deathSavePenalty,
      ...(armor?.headInventoryId
        ? { head_inventory_id: armor.headInventoryId, head_sp: player.spHead }
        : {}),
      ...(armor?.bodyInventoryId
        ? { body_inventory_id: armor.bodyInventoryId, body_sp: player.spBody }
        : {}),
    },
    ...(ammo ? { ammo: { inventory_id: ammo.inventoryId, loaded: ammo.loaded } } : {}),
  };
  await saveEncounter(payload);
}
