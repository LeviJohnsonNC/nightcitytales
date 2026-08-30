/**
 * Pending attacks — the bridge between "the GM proposed a shot" and "the player
 * rolled it", mirroring checkPrompt.ts. Pure: it reads the ledger, the live
 * encounter and the sheet, and describes what is at stake. Every number comes
 * from the engine or the rules data; nothing here invents a DV or a damage die.
 */
import {
  getSkill,
  judgeAction,
  type CapabilitySnapshot,
  weaponAttackDv,
  weaponAttackGap,
  woundActionPenalty,
  type Combatant,
  type EncounterState,
  type WeaponProfile,
} from "@/engine";
import type {
  CampaignEvent,
  CampaignInventoryItem,
  CampaignVitals,
  FullCharacter,
} from "@/lib/backend";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { metresApart, weaponChoices } from "./encounterModel";
import { liveInventory } from "./liveInventory";
import { effectiveStatsRecord, statsRecord } from "./playModel";

export type PendingAttack = {
  eventId: string;
  beatId: string | null;
  intent: string;
  distance: number;
  attacker: Combatant;
  target: Combatant;
  /** Weapons the character is carrying, as combat profiles. */
  weapons: WeaponProfile[];
  /** −2 / −4 for the attacker's wound state (CP:R pg. 186). */
  woundPenalty: number;
  /** Current REF/DEX after Humanity and worn armor, when live vitals were supplied. */
  effectiveStats?: Record<string, number>;
};

/** What one weapon choice would mean for this attack. */
export type AttackOption = {
  weapon: WeaponProfile;
  statLabel: string;
  statValue: number;
  skillLabel: string;
  skillValue: number;
  dv: number | null;
  damageDice: number | null;
  /** Why this weapon cannot be rolled right now, if it cannot. */
  gap: string | null;
};

export function attackOption(
  pending: PendingAttack,
  weapon: WeaponProfile,
  character: FullCharacter,
  /** What the character can actually do; a refusal becomes the option's gap. */
  capability?: CapabilitySnapshot | null,
): AttackOption {
  const stats = pending.effectiveStats ?? statsRecord(character);
  const statKey = weapon.statKey ?? "ref";
  const skillLevel = weapon.skillId
    ? (character.skills.find((s) => s.skill_id === weapon.skillId)?.level ?? 0)
    : 0;
  return {
    weapon,
    statLabel: statKey.toUpperCase(),
    statValue: stats[statKey] ?? 0,
    skillLabel: weapon.skillId ? getSkill(weapon.skillId).name : weapon.skillName,
    skillValue: skillLevel,
    dv: weaponAttackDv(weapon, pending.distance),
    damageDice: weapon.damageDice,
    gap: weaponAttackGap(weapon, pending.distance) ?? legalityGap(capability, pending, weapon),
  };
}

/** Why the legality gate refuses this weapon right now, phrased for the player. */
function legalityGap(
  capability: CapabilitySnapshot | null | undefined,
  pending: PendingAttack,
  weapon: WeaponProfile,
): string | null {
  if (!capability) return null;
  const verdict = judgeAction(capability, {
    kind: "attack",
    targetKey: pending.target.id,
    distance: pending.distance,
    weapon: weapon.itemId,
  });
  return verdict.ok ? null : verdict.reason;
}

type PromptData = { targetId?: unknown; distance?: unknown; intent?: unknown };

/**
 * Metres from the player to a combatant, measured off their positions.
 *
 * The single place the Range DV comes from on the player's side. It used to be
 * whatever number the model put in its response.
 */
export function distanceToTarget(live: LiveEncounter, targetId: string): number {
  const player = Object.values(live.state.combatants).find((c) => c.isPlayer);
  const from = player ? live.data[player.id] : null;
  const to = live.data[targetId];
  if (!from || !to) return 0;
  return metresApart(from, to);
}

/** Resolve the GM's target key (or a combatant id, or a name) to a combatant. */
export function findTarget(live: LiveEncounter, targetKey: string): Combatant | null {
  const state: EncounterState = live.state;
  const direct = state.combatants[targetKey];
  if (direct) return direct;
  const needle = targetKey.trim().toLowerCase();
  for (const [id, data] of Object.entries(live.data)) {
    if (data.key.trim().toLowerCase() === needle) return state.combatants[id] ?? null;
  }
  return (
    Object.values(state.combatants).find((c) => c.name.trim().toLowerCase() === needle) ?? null
  );
}

/**
 * The attack awaiting the player's dice: the most recent attack_prompt with no
 * attack event resolving it afterwards.
 */
export function pendingAttackFrom(
  events: CampaignEvent[],
  character: FullCharacter,
  live: LiveEncounter | null,
  /** The campaign's kit, so a gun bought mid-campaign can be fired. */
  inventory: CampaignInventoryItem[] = [],
  vitals?: CampaignVitals,
): PendingAttack | null {
  if (!live || live.state.status !== "active") return null;
  const attacker = Object.values(live.state.combatants).find((c) => c.isPlayer);
  if (!attacker || attacker.defeated) return null;

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event) continue;
    if (event.type === "attack") return null; // the newest prompt is already rolled
    if (event.type !== "attack_prompt") continue;

    const data = (event.data ?? {}) as PromptData;
    const targetKey = typeof data.targetId === "string" ? data.targetId : null;
    if (!targetKey) return null;
    const target = findTarget(live, targetKey);
    if (!target || target.defeated) return null;

    return {
      eventId: event.id,
      beatId: event.beat_id ?? null,
      intent: typeof data.intent === "string" ? data.intent : "",
      // Measured now, not read back off the prompt event: the player may have
      // moved, or a hostile may have closed, since the GM proposed the shot.
      distance: distanceToTarget(live, target.id),
      attacker,
      target,
      weapons: weaponChoices(liveInventory(inventory, character)),
      woundPenalty: woundActionPenalty(attacker.woundState),
      ...(vitals ? { effectiveStats: effectiveStatsRecord(character, { vitals, inventory }) } : {}),
    };
  }
  return null;
}
