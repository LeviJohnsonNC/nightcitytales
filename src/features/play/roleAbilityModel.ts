/**
 * A campaign's Role Ability, as the play loop sees it.
 *
 * Reads which ability the character has, what Rank they hold it at, and any
 * live state stored for it (a Solo's Combat Awareness division). Pure: it
 * decides nothing mechanical, it only assembles what the engine needs.
 */
import {
  combatAwarenessEffects,
  fieldExpertiseBonus,
  makerSpecialtyPool,
  operatorHaggleBonus,
  roleAbilityOf,
  type CombatAwarenessAllocation,
  type CombatAwarenessEffects,
  type RoleAbilityInfo,
} from "@/engine";
import type { Campaign, FullCharacter } from "@/lib/backend";
import type { PendingBackup } from "./backupFlow";

export type LiveRoleAbility = {
  info: RoleAbilityInfo;
  /** The Rank on the sheet, falling back to the Role's starting Rank. */
  rank: number;
};

/** The character's Role Ability and Rank, or null when the Role has none. */
export function liveRoleAbility(character: FullCharacter): LiveRoleAbility | null {
  const info = roleAbilityOf(character.character.role ?? null);
  if (!info) return null;
  const stored = character.roleAbility?.rank;
  const rank = typeof stored === "number" ? stored : info.startingRank;
  return { info, rank };
}

/** Live state for one ability, out of the campaign's role_state blob. */
function abilityState(campaign: Campaign, abilityId: string): Record<string, unknown> {
  const all = (campaign.role_state ?? {}) as Record<string, unknown>;
  const one = all[abilityId];
  return one && typeof one === "object" ? (one as Record<string, unknown>) : {};
}

/** A Solo's current division of their Combat Awareness pool. */
export function combatAwarenessAllocation(campaign: Campaign): CombatAwarenessAllocation {
  const raw = abilityState(campaign, "combat_awareness")["allocation"];
  if (!raw || typeof raw !== "object") return {};
  const out: CombatAwarenessAllocation = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[key] = Math.trunc(value);
    }
  }
  return out;
}

/** The role_state blob with one ability's state replaced. */
export function withAbilityState(
  campaign: Campaign,
  abilityId: string,
  state: Record<string, unknown>,
): Record<string, unknown> {
  const all = (campaign.role_state ?? {}) as Record<string, unknown>;
  return { ...all, [abilityId]: state };
}

/**
 * What a Solo's current division is doing right now. Null for every other Role,
 * so callers can ask unconditionally.
 */
export function combatAwarenessFor(
  campaign: Campaign,
  character: FullCharacter,
): (CombatAwarenessEffects & { rank: number }) | null {
  const ability = liveRoleAbility(character);
  if (!ability || ability.info.abilityId !== "combat_awareness") return null;
  const effects = combatAwarenessEffects(combatAwarenessAllocation(campaign), ability.rank);
  return { ...effects, rank: ability.rank };
}

/** Backup that has answered and is on its way, if any. */
export function pendingBackup(campaign: Campaign): PendingBackup | null {
  const raw = abilityState(campaign, "backup")["pending"];
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p["tierName"] !== "string" || typeof p["arrivesOnRound"] !== "number") return null;
  return {
    tierName: p["tierName"],
    arrivesOnRound: p["arrivesOnRound"],
    groups: typeof p["groups"] === "number" ? p["groups"] : 1,
  };
}

/** A Tech's division of their Maker Specialty ranks. */
export function makerSpecialties(campaign: Campaign): Record<string, number> {
  const raw = abilityState(campaign, "maker")["specialties"];
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0)
      out[key] = Math.trunc(value);
  }
  return out;
}

/** How many Specialty ranks a Tech has to spend, and how many are spent. */
export function makerSpecialtyBudget(
  campaign: Campaign,
  character: FullCharacter,
): { pool: number; spent: number } | null {
  const ability = liveRoleAbility(character);
  if (!ability || ability.info.abilityId !== "maker") return null;
  const allocation = makerSpecialties(campaign);
  const spent = Object.values(allocation).reduce((sum, value) => sum + value, 0);
  return { pool: makerSpecialtyPool(ability.rank), spent };
}

/**
 * Every Role-Ability modifier that applies to one skill check, as labelled roll
 * modifiers. Empty for a Role with nothing to say about this check — which is
 * most Roles on most checks, and is the point: the ones that speak up are the
 * ones the fiction says should.
 */
export function roleCheckModifiers(input: {
  campaign: Campaign;
  character: FullCharacter;
  skillId: string;
}): { label: string; value: number }[] {
  const ability = liveRoleAbility(input.character);
  if (!ability) return [];
  const out: { label: string; value: number }[] = [];

  // Solo: Threat Detection is points spent on seeing it coming.
  const awareness = combatAwarenessFor(input.campaign, input.character);
  if (awareness && input.skillId === "perception" && awareness.perception > 0) {
    out.push({ label: "Threat Detection", value: awareness.perception });
  }

  // Tech: Field Expertise rides on the printed list of Tech Skills.
  const field = fieldExpertiseBonus({
    abilityId: ability.info.abilityId,
    specialtyRank: makerSpecialties(input.campaign)["field_expertise"] ?? 0,
    skillId: input.skillId,
  });
  if (field > 0) out.push({ label: "Field Expertise", value: field });

  // Fixer: the Operator Rank is part of the printed Haggle roll.
  const haggle = operatorHaggleBonus({
    abilityId: ability.info.abilityId,
    rank: ability.rank,
    skillId: input.skillId,
  });
  if (haggle > 0) out.push({ label: "Operator", value: haggle });

  return out;
}
