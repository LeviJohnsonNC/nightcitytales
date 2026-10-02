/**
 * Death Saves at the table. When the player's Turn starts while they are
 * Mortally Wounded, CP:R pg. 187 makes them roll before they can act. This
 * module reads the live encounter to say whether that roll
 * is owed — the engine (beginTurn / rollDeathSave) rolls it.
 */
import { turnDeathSaveOwed, type Combatant } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";

export type PendingDeathSave = {
  eventId: string;
  encounterVersion: number;
  beatId: string | null;
  combatant: Combatant;
  /** Roll UNDER this, after the penalty, to live. */
  body: number;
  penalty: number;
};

/** Is a Death Save owed right now, before the player can act? */
export function deathSaveOwed(live: LiveEncounter | null): Combatant | null {
  if (!live || live.state.status !== "active") return null;
  const current = turnDeathSaveOwed(live.state);
  return current?.isPlayer ? current : null;
}

/**
 * The Death Save awaiting the player's dice, derived from durable turn state.
 */
export function pendingDeathSaveFrom(
  live: LiveEncounter | null,
  beatId: string | null = null,
): PendingDeathSave | null {
  const combatant = deathSaveOwed(live);
  if (!combatant || !live) return null;

  // State owns the obligation. A missing ledger write or a save from an older
  // round must never leave an owed roll without a usable card.
  return {
    eventId: `${live.id}:${live.state.round}:${combatant.id}:death-save`,
    encounterVersion: live.version,
    beatId,
    combatant,
    body: combatant.body,
    penalty: combatant.deathSavePenalty,
  };
}
