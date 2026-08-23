/**
 * Death Saves at the table. When the player's Turn starts while they are
 * Mortally Wounded, CP:R pg. 187 makes them roll before they can act. This
 * module only reads the ledger and the live encounter to say whether that roll
 * is owed — the engine (beginTurn / rollDeathSave) rolls it.
 */
import { currentCombatant, type Combatant } from "@/engine";
import type { CampaignEvent } from "@/lib/backend";
import type { LiveEncounter } from "@/features/campaign/encounterState";

export type PendingDeathSave = {
  eventId: string;
  beatId: string | null;
  combatant: Combatant;
  /** Roll UNDER this, after the penalty, to live. */
  body: number;
  penalty: number;
};

/** Is a Death Save owed right now, before the player can act? */
export function deathSaveOwed(live: LiveEncounter | null): Combatant | null {
  if (!live || live.state.status !== "active") return null;
  const current = currentCombatant(live.state);
  if (!current || !current.isPlayer || current.defeated) return null;
  return current.woundState === "mortal" ? current : null;
}

/**
 * The Death Save awaiting the player's dice: the most recent
 * death_save_prompt with no death_save resolving it afterwards.
 */
export function pendingDeathSaveFrom(
  events: CampaignEvent[],
  live: LiveEncounter | null,
): PendingDeathSave | null {
  const combatant = deathSaveOwed(live);
  if (!combatant) return null;

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event) continue;
    if (event.type === "death_save") return null; // the newest prompt is already rolled
    if (event.type !== "death_save_prompt") continue;
    return {
      eventId: event.id,
      beatId: event.beat_id ?? null,
      combatant,
      body: combatant.body,
      penalty: combatant.deathSavePenalty,
    };
  }
  return null;
}
