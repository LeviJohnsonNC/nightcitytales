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
  ammo?: { inventoryId: string; before: number; after: number };
  armorLocation?: "head" | "body";
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
  if (context.ammo) data["ammo"] = context.ammo;
  if (damage) data["damage"] = damage.total;
  if (applied) {
    data["through_armor"] = applied.damageThroughArmor;
    data["bonus_damage"] = applied.bonusDamage;
    data["hp_before"] = applied.hpAfter + applied.totalHpLoss;
    data["hp_after"] = applied.hpAfter;
    data["sp_before"] = applied.spBefore;
    data["sp_after"] = applied.spAfter;
    data["armor_location"] = context.armorLocation ?? "body";
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

/**
 * The ledger type cover damage is written under.
 *
 * Deliberately NOT "attack". engine/settlement.ts replays the job's own ledger
 * and reads every `attack` event where the player hit something with damage
 * through armor as a PERSON put in hospital, and counts every `attack` toward
 * how loud the job was. Filing a shot-up vending machine as an attack would
 * quietly cost faction standing for wounding a snack dispenser.
 */
export const COVER_DAMAGE_EVENT = "cover_damaged";

export type CoverLogContext = {
  attackerName: string;
  /** Who the shot was meant for, when it was meant for somebody. */
  targetName?: string;
  weapon?: string;
  beatId?: string | null;
};

export type CoverShot = {
  attack: AttackResult;
  /** Absent on a miss: nothing was done to it. */
  hit?: {
    pieceId: string;
    label: string;
    material: string;
    thickness: string;
    damage: number;
    applied: number;
    hpBefore: number;
    hpAfter: number;
    destroyed: boolean;
  } | null;
};

/**
 * Record a shot at cover.
 *
 * CP:R pg. 182 makes a section of cover something that "can be attacked just
 * like you can", so this carries the full To-Hit trace the way an attack on a
 * person does — a miss is a real outcome, not an absence.
 */
export async function logCoverDamage(
  campaignId: string,
  shot: CoverShot,
  context: CoverLogContext,
): Promise<CampaignEvent> {
  const hit = shot.hit ?? null;
  const label = hit?.label ?? "cover";
  const summary = !hit
    ? `${context.attackerName} shoots at ${label} and misses.`
    : hit.destroyed
      ? `${context.attackerName} shoots ${label} apart.`
      : `${context.attackerName} hits ${label} — ${hit.hpBefore} to ${hit.hpAfter}.`;
  return appendCampaignEvent({
    campaign_id: campaignId,
    type: COVER_DAMAGE_EVENT,
    summary,
    data: {
      attacker: context.attackerName,
      ...(context.targetName ? { intended_target: context.targetName } : {}),
      ...(context.weapon ? { weapon: context.weapon } : {}),
      hit: shot.attack.hit,
      formula: shot.attack.formula,
      margin: shot.attack.margin,
      ...(hit
        ? {
            cover: hit.pieceId,
            label: hit.label,
            material: hit.material,
            thickness: hit.thickness,
            damage: hit.damage,
            // Excess past the last point of HP is lost (pg. 182).
            applied: hit.applied,
            hp_before: hit.hpBefore,
            hp_after: hit.hpAfter,
            destroyed: hit.destroyed,
          }
        : {}),
    } as unknown as Json,
    ...(context.beatId ? { beat_id: context.beatId } : {}),
  });
}
