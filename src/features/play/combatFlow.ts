/**
 * Sequencing a fight: the engine resolves, this module persists and logs.
 * No dice are rolled here and no hit/miss is decided here — every mechanical
 * answer comes from src/engine/encounter.ts.
 */
import {
  advanceTurn,
  beginTurn,
  currentCombatant,
  performAttack,
  singleShotDV,
  startEncounter as rollInitiativeOrder,
  type Combatant,
  type EncounterState,
  type PerformAttackResult,
  type WeaponRangeType,
} from "@/engine";
import { logAttack, logDeathSave } from "@/features/campaign/combatLog";
import {
  createLiveEncounter,
  saveLiveEncounter,
  type LiveEncounter,
} from "@/features/campaign/encounterState";
import type { GmEnemy } from "@/features/gm/gmResponse";
import {
  appendCampaignEvent,
  type CampaignVitals,
  type FullCharacter,
  type Json,
} from "@/lib/backend";
import {
  hostileCombatant,
  playerCombatant as buildPlayerCombatant,
  type CombatantData,
} from "./encounterModel";

const MAX_NPC_TURNS = 24;

/** Roll initiative for a GM-proposed fight and persist it. */
export async function beginEncounter(input: {
  campaignId: string;
  characterId: string;
  beatId: string | null;
  name: string;
  character: FullCharacter;
  vitals: CampaignVitals;
  enemies: GmEnemy[];
}): Promise<LiveEncounter> {
  const data: Record<string, CombatantData> = {};
  const combatants: Combatant[] = [];

  const player = buildPlayerCombatant(input.character, input.vitals, crypto.randomUUID());
  combatants.push(player.combatant);
  data[player.combatant.id] = player.data;

  for (const enemy of input.enemies) {
    const hostile = hostileCombatant(enemy, crypto.randomUUID());
    combatants.push(hostile.combatant);
    data[hostile.combatant.id] = hostile.data;
  }

  const state = rollInitiativeOrder(combatants);
  const live = await createLiveEncounter({
    campaignId: input.campaignId,
    characterId: input.characterId,
    beatId: input.beatId,
    name: input.name,
    state,
    data,
  });

  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: "encounter_started",
    summary: `${input.name} — initiative: ${state.order
      .map((id) => `${state.combatants[id]!.name} (${state.combatants[id]!.initiative ?? 0})`)
      .join(", ")}`,
    data: { encounterId: live.id } as unknown as Json,
    ...(input.beatId ? { beat_id: input.beatId } : {}),
  });

  return live;
}

function playerOf(state: EncounterState): Combatant | null {
  return Object.values(state.combatants).find((c) => c.isPlayer) ?? null;
}

/**
 * Run every hostile turn until it is the player's turn again (or the fight is
 * over). Returns the updated encounter and plain lines describing what the
 * engine decided, for the GM to narrate.
 */
export async function runNpcTurns(
  campaignId: string,
  beatId: string | null,
  live: LiveEncounter,
): Promise<{ live: LiveEncounter; lines: string[] }> {
  let state = live.state;
  const lines: string[] = [];

  for (let i = 0; i < MAX_NPC_TURNS; i += 1) {
    if (state.status !== "active") break;
    state = advanceTurn(state);
    const actor = currentCombatant(state);
    if (!actor) break;
    if (actor.isPlayer) break;

    const begun = beginTurn(state);
    state = begun.state;
    if (begun.deathSave) {
      await logDeathSave(campaignId, begun.deathSave, {
        combatantName: actor.name,
        died: begun.died,
        beatId,
      });
      lines.push(`${actor.name} Death Save: ${begun.died ? "failed and is dead" : "survived"}.`);
    }
    const live_actor = state.combatants[actor.id];
    if (!live_actor || live_actor.defeated) continue;

    const target = playerOf(state);
    if (!target || target.defeated) break;

    const stats = live.data[actor.id];
    if (!stats) continue;
    const dv = stats.rangeType
      ? singleShotDV(stats.rangeType as WeaponRangeType, stats.distance)
      : null;
    if (dv === null) continue; // No printed DV: the engine will not invent one.

    const result = performAttack(state, {
      attackerId: actor.id,
      targetId: target.id,
      statLabel: "REF",
      statValue: live_actor.ref,
      skillLabel: stats.weaponName,
      skillValue: stats.attackSkill,
      dv,
      damageDice: stats.damageDice,
    });
    state = result.state;

    await logAttack(
      campaignId,
      { attack: result.attack, damage: result.damage, applied: result.applied },
      {
        attackerName: actor.name,
        targetName: target.name,
        weapon: stats.weaponName,
        ...(result.targetWoundState ? { targetWoundState: result.targetWoundState } : {}),
        beatId,
      },
    );
    lines.push(describeAttack(actor.name, target.name, stats.weaponName, result));
  }

  const next: LiveEncounter = { ...live, state };
  await saveLiveEncounter(next);
  return { live: next, lines };
}

/** A flat, factual line the GM must narrate rather than re-decide. */
export function describeAttack(
  attackerName: string,
  targetName: string,
  weapon: string,
  result: PerformAttackResult,
): string {
  if (!result.attack.hit) {
    return `${attackerName} attacks ${targetName} with ${weapon}: MISS (${result.attack.formula}).`;
  }
  const applied = result.applied;
  const parts = [
    `${attackerName} attacks ${targetName} with ${weapon}: HIT (${result.attack.formula})`,
  ];
  if (result.damage && applied) {
    parts.push(
      `${result.damage.total} damage rolled, ${applied.damageThroughArmor} through armor` +
        (applied.criticalInjury ? " plus a Critical Injury (+5 to HP)" : "") +
        `, ${targetName} is at ${applied.hpAfter} HP`,
    );
  }
  if (result.targetWoundState && result.targetWoundState !== "none") {
    parts.push(`${targetName} is ${result.targetWoundState.replace("_", " ")}`);
  }
  if (result.targetDefeated) parts.push(`${targetName} is out of the fight`);
  return `${parts.join("; ")}.`;
}
