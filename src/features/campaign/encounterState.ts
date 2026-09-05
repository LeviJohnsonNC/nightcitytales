/**
 * Persisting a fight. The engine (src/engine/encounter.ts) owns the state
 * transitions; this module loads the rows into engine state and writes the
 * changed combatants back. It never decides anything mechanical.
 */
import {
  arenaFor,
  coverDamageFrom,
  snapToOpenTile,
  type CoverDamage,
  type EncounterState,
} from "@/engine";
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
  /**
   * The row version this state was read at.
   *
   * Sent back with every save; the transaction refuses the write if the row has
   * moved on since (20260901000000_encounter_version.sql). Positions live in
   * `data`, and a lost update there does not stale a number — it puts a
   * character back on ground they have already left, and every Range DV
   * afterwards is measured from where they are standing.
   */
  version: number;
};

function liveFrom(full: FullEncounter): LiveEncounter {
  const arena = full.encounter.arena ?? null;
  // Everybody stands on a square. Rows written before the grid existed hold
  // loose metres, so they are snapped on the way in rather than migrated: the
  // worst case is a body shifting under a metre, and no fight in progress is
  // left standing between two squares the board cannot draw them on.
  const ground = arenaFor(arena);
  // Read against the authored arena: an id no arena knows is dropped rather
  // than trusted into a live fight. The database validated shape and sign;
  // identity is this layer's to check.
  const cover = coverDamageFrom(ground, full.encounter.cover);
  const data: Record<string, CombatantData> = {};
  for (const row of full.combatants) {
    const combatant = combatantDataOf(row);
    data[row.id] = { ...combatant, position: snapToOpenTile(ground, cover, combatant.position) };
  }
  return {
    id: full.encounter.id,
    state: stateFromRows(full),
    data,
    arena,
    cover,
    version: full.encounter.version ?? 0,
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
  // A row nobody has saved yet is at the column's default.
  return { id, state: input.state, data: input.data, arena: input.arena, cover: {}, version: 0 };
}

/**
 * The write refused because somebody else moved the fight on first.
 *
 * Its own type because the caller's answer is specific: re-read and try again,
 * never retry the same payload — the state it was computed from is gone.
 */
export class EncounterChangedError extends Error {
  constructor() {
    super("The fight moved on while that was being sent. Reloading it.");
    this.name = "EncounterChangedError";
  }
}

/** The Postgres message the transaction refuses a stale write with. */
const CHANGED = "encounter changed";

/**
 * Write the fight and the player's durable campaign state in one transaction.
 *
 * Returns the encounter at its NEW version. Every caller must carry that
 * forward: a sequence that saves more than once — an attack, then the hostile
 * Turns it triggers, then Backup arriving — would otherwise send the same stale
 * token on its second write and refuse itself.
 */
export async function saveLiveEncounter(
  live: LiveEncounter,
  ammo: { inventoryId: string; loaded: number } | null = null,
): Promise<LiveEncounter> {
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
    version: live.version,
    ...(ammo ? { ammo: { inventory_id: ammo.inventoryId, loaded: ammo.loaded } } : {}),
  };
  try {
    await saveEncounter(payload);
  } catch (error) {
    if (error instanceof Error && error.message.includes(CHANGED)) {
      throw new EncounterChangedError();
    }
    throw error;
  }
  // The transaction sets version to exactly the one it checked plus one, so the
  // caller can advance its own token without a round trip for it.
  return { ...live, version: live.version + 1 };
}
