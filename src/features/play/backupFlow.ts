/**
 * A Lawman calling it in.
 *
 * Backup is armed, armored, and played by the GM — here, by the engine. A call
 * that lands names a tier and a number of Rounds; when that Round comes around
 * the group joins the fight as friendly combatants and starts shooting the
 * people who are shooting you.
 *
 * The tier's printed Combat Number is a combined STAT+Skill base that a d10 is
 * added to, which is not how a player's attack is built (STAT and Skill
 * separately). It is carried as the whole of their attack, with the Skill half
 * zero, so the arithmetic matches the book exactly.
 */
import {
  arenaFor,
  clampToArena,
  joinEncounter,
  type BackupCall,
  type BackupTier,
  type Combatant,
  type Point,
} from "@/engine";
import { addCombatant, appendCampaignEvent, type Json } from "@/lib/backend";
import { saveLiveEncounter, type LiveEncounter } from "@/features/campaign/encounterState";
import type { CombatantData } from "./encounterModel";

/** What a landed call is waiting on, stored until the Round comes round. */
export type PendingBackup = {
  tierName: string;
  arrivesOnRound: number;
  groups: number;
};

/** The state a call leaves behind for the encounter to honour. */
export function pendingBackupFrom(call: BackupCall, currentRound: number): PendingBackup | null {
  if (!call.responded || !call.tier || call.roundsUntilArrival === null) return null;
  return {
    tierName: call.tier.name,
    arrivesOnRound: currentRound + call.roundsUntilArrival,
    groups: call.groups,
  };
}

/** One member of a Backup group, as a combatant. */
function backupCombatant(
  tier: BackupTier,
  index: number,
  id: string,
  position: Point,
): {
  combatant: Combatant;
  data: CombatantData;
} {
  const combatant: Combatant = {
    id,
    name: tier.count > 1 ? `${tier.name} ${index + 1}` : tier.name,
    side: "friendly",
    isPlayer: false,
    // The Combat Number is the whole of their attack base; Initiative is rolled
    // off it too, since the tier prints no separate REF.
    ref: tier.combat,
    body: tier.body,
    hpMax: tier.hp,
    hp: tier.hp,
    seriouslyWoundedThreshold: Math.ceil(tier.hp / 2),
    woundState: "none",
    deathSavePenalty: 0,
    spHead: tier.sp,
    spBody: tier.sp,
    defeated: false,
    initiative: null,
  };
  const data: CombatantData = {
    key: `backup-${tier.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index + 1}`,
    weaponName: "Backup sidearm",
    damageDice: 3,
    rangeType: "pistol",
    position,
    // The tier's own printed MOVE. Backup has carried this number since the
    // Lawman ability shipped and nothing had ever read it, because until
    // positions existed nobody could walk anywhere.
    move: tier.move,
    // The Combat Number already carries their Skill; adding it again would
    // count the same training twice.
    attackSkill: 0,
  };
  return { combatant, data };
}

/**
 * Bring a group in. Everyone rolls Initiative and takes their place in the
 * order, the rows are written so the fight survives a reload, and the ledger
 * records who turned up.
 */
export async function arriveBackup(input: {
  campaignId: string;
  beatId: string | null;
  live: LiveEncounter;
  tier: BackupTier;
  groups: number;
}): Promise<{ live: LiveEncounter; line: string }> {
  let state = input.live.state;
  const data = { ...input.live.data };
  const members = input.tier.count * Math.max(1, input.groups);

  // Backup turns up where the character is, spread along the line they came in
  // on. Nobody picks a distance: they arrive beside you and close from there
  // like anyone else.
  const arena = arenaFor(input.live.arena);
  const player = Object.values(input.live.state.combatants).find((c) => c.isPlayer);
  const rally = (player ? data[player.id]?.position : null) ?? arena.playerStart;

  for (let index = 0; index < members; index += 1) {
    const id = crypto.randomUUID();
    const spot = clampToArena(arena, {
      x: rally.x + (index % 2 === 0 ? 1 : -1) * (Math.floor(index / 2) + 1) * 2,
      y: rally.y,
    });
    const built = backupCombatant(input.tier, index, id, spot);
    state = joinEncounter(state, built.combatant);
    data[id] = built.data;
    await addCombatant(input.live.id, {
      id,
      name: built.combatant.name,
      side: built.combatant.side,
      is_player: false,
      ref: built.combatant.ref,
      body: built.combatant.body,
      hp_max: built.combatant.hpMax,
      hp_current: built.combatant.hp,
      seriously_wounded_threshold: built.combatant.seriouslyWoundedThreshold,
      wound_state: built.combatant.woundState,
      sp_head: built.combatant.spHead,
      sp_body: built.combatant.spBody,
      initiative: state.combatants[id]?.initiative ?? null,
      data: built.data as unknown as Json,
    });
  }

  const live = await saveLiveEncounter({ ...input.live, state, data });

  const line =
    `${input.tier.name} arrives — ${members} of them, ` +
    `Combat ${input.tier.combat}, SP ${input.tier.sp}, HP ${input.tier.hp}. ${input.tier.note}`;
  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: "backup_arrived",
    summary: line,
    data: { tier: input.tier.name, members } as unknown as Json,
    ...(input.beatId ? { beat_id: input.beatId } : {}),
  });

  return { live, line };
}
