/**
 * Recording combat resolutions to the campaign event ledger. Attacks and Death
 * Saves carry their full roll trace, so every combat die stays inspectable.
 */
import type { ApplyDamageResult, AttackResult, DamageRoll, DeathSaveResult } from "@/engine";
import {
  appendCampaignEvent,
  type CampaignEvent,
  type CampaignEventInsert,
  type Json,
} from "@/lib/backend";

export type AttackParts = {
  attack: AttackResult;
  damage?: DamageRoll | null;
  applied?: ApplyDamageResult | null;
};

export type AttackLogContext = {
  attackerName: string;
  targetName: string;
  targetWoundState?: string;
  beatId?: string | null;
  weapon?: string;
};

/** Build the ledger row for a resolved attack. */
export function attackEvent(
  campaignId: string,
  parts: AttackParts,
  context: AttackLogContext,
): CampaignEventInsert {
  const { attack, damage, applied } = parts;
  const data: Record<string, unknown> = {
    attacker: context.attackerName,
    target: context.targetName,
    hit: attack.hit,
    margin: attack.margin,
  };
  if (context.weapon) data["weapon"] = context.weapon;
  if (damage) data["damage"] = damage.total;
  if (applied) {
    data["through_armor"] = applied.damageThroughArmor;
    data["bonus_damage"] = applied.bonusDamage;
    data["hp_after"] = applied.hpAfter;
    data["ablated"] = applied.ablated;
    data["critical_injury"] = applied.criticalInjury;
  }
  if (context.targetWoundState) data["target_wound_state"] = context.targetWoundState;

  return {
    campaign_id: campaignId,
    type: "attack",
    summary: attack.formula,
    roll: attack as unknown as Json,
    data: data as unknown as Json,
    ...(context.beatId ? { beat_id: context.beatId } : {}),
  };
}

export type DeathSaveLogContext = {
  combatantName: string;
  died: boolean;
  beatId?: string | null;
};

/** Build the ledger row for a Death Save. */
export function deathSaveEvent(
  campaignId: string,
  result: DeathSaveResult,
  context: DeathSaveLogContext,
): CampaignEventInsert {
  const verdict = context.died ? "DEAD" : "survives";
  return {
    campaign_id: campaignId,
    type: "death_save",
    summary: `${context.combatantName} Death Save: d10(${result.roll}) + penalty(${result.penalty}) = ${result.effective} vs BODY — ${verdict}`,
    roll: result as unknown as Json,
    data: {
      combatant: context.combatantName,
      survived: !context.died,
      died: context.died,
    } as unknown as Json,
    ...(context.beatId ? { beat_id: context.beatId } : {}),
  };
}

export async function logAttack(
  campaignId: string,
  parts: AttackParts,
  context: AttackLogContext,
): Promise<CampaignEvent> {
  return appendCampaignEvent(attackEvent(campaignId, parts, context));
}

export async function logDeathSave(
  campaignId: string,
  result: DeathSaveResult,
  context: DeathSaveLogContext,
): Promise<CampaignEvent> {
  return appendCampaignEvent(deathSaveEvent(campaignId, result, context));
}
