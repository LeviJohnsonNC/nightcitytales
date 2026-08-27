/**
 * Persisting a fight. The engine (src/engine/encounter.ts) owns the state
 * transitions; this module loads the rows into engine state and writes the
 * changed combatants back. It never decides anything mechanical.
 */
import type { EncounterState } from "@/engine";
import {
  getActiveEncounter,
  getEncounter,
  startEncounter as startEncounterRpc,
  updateCombatant,
  updateEncounter,
  type FullEncounter,
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
};

function liveFrom(full: FullEncounter): LiveEncounter {
  const data: Record<string, CombatantData> = {};
  for (const row of full.combatants) data[row.id] = combatantDataOf(row);
  return {
    id: full.encounter.id,
    state: stateFromRows(full),
    data,
    arena: full.encounter.arena ?? null,
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
  return { id, state: input.state, data: input.data, arena: input.arena };
}

/** Write the encounter's round/turn/status and every combatant's live numbers. */
export async function saveLiveEncounter(live: LiveEncounter): Promise<void> {
  await updateEncounter(live.id, {
    round: live.state.round,
    active_index: live.state.activeIndex,
    order_ids: live.state.order,
    status: live.state.status,
  });
  for (const id of live.state.order) {
    const c = live.state.combatants[id];
    if (!c) continue;
    await updateCombatant(id, {
      hp_current: c.hp,
      wound_state: c.woundState,
      death_save_penalty: c.deathSavePenalty,
      sp_head: c.spHead,
      sp_body: c.spBody,
      defeated: c.defeated,
      initiative: c.initiative,
      data: live.data[id] as never,
    });
  }
}
