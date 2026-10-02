/**
 * Rolling a pending check: one function, for every way a check gets rolled.
 *
 * The Job screen and the Life screen each had their own copy of this, and they
 * had already drifted: the Job copy added what the character's Role brings to
 * the check (a Solo's Threat Detection on Perception, a Tech's Field Expertise)
 * and the Life copy did not, so the same Perception roll was worth more on a
 * job than on a Tuesday. A third caller — the engine rolling a small check by
 * itself — would have been a third copy. It is one now.
 *
 * Pure: the engine rolls, this only assembles what the engine is asked.
 */
import {
  DEFAULT_START,
  FACEDOWN_CHECK_ID,
  clampLuckSpend,
  facedown,
  luckModifier,
  luckRemaining,
  opposedCheckForCharacter,
  resolvePosition,
  skillCheckForCharacter,
  woundActionPenalty,
  type WoundStateCode,
} from "@/engine";
import type { Campaign, CampaignInventoryItem, CampaignVitals, FullCharacter } from "@/lib/backend";
import { oppositionFor, type CheckRoll, type PendingCheck } from "./checkPrompt";
import { actorFor, statsRecord } from "./playModel";
import { roleCheckModifiers } from "./roleAbilityModel";

export type RollCheckInput = {
  campaign: Campaign;
  character: FullCharacter;
  vitals: CampaignVitals;
  inventory: CampaignInventoryItem[];
  pending: PendingCheck;
  /** Luck the player dedicated. Clamped to what is actually left. */
  luckSpend?: number;
};

export function rollPendingCheck(input: RollCheckInput): CheckRoll {
  const { campaign, character, vitals, inventory, pending } = input;
  const actor = actorFor(character, {
    vitals,
    inventory,
    // A Local Expert check is about the neighbourhood the character is
    // standing in, and is worth nothing in one they are not a local in.
    districtKey: resolvePosition(campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
  });
  // Clamp against the live pool, not against what the card offered: the
  // stepper cannot talk the engine into spending points that are not there.
  const luckSpent = clampLuckSpend(
    input.luckSpend ?? 0,
    luckRemaining(vitals.luck_current, statsRecord(character)),
  );
  const spend = luckModifier(luckSpent);
  // Being hurt follows you out of the fight: the same −2/−4 the engine already
  // applies to attacks rides on every other Check too.
  const wounds = woundActionPenalty(vitals.wound_state as WoundStateCode);
  const situational = [
    ...(spend ? [spend] : []),
    ...(wounds !== 0 ? [{ label: "Wounds", value: wounds }] : []),
    // What the Role brings to this particular check.
    ...roleCheckModifiers({ campaign, character, skillId: pending.skillId }),
  ];
  const modifiers = situational.length > 0 ? { modifiers: situational } : {};

  // A Facedown is COOL + Reputation on both sides. Luck and wounds ride on it as
  // on any Action; what a Role brings to a Skill does not, because there is none.
  if (pending.skillId === FACEDOWN_CHECK_ID && pending.opposition) {
    const personal = [
      ...(spend ? [spend] : []),
      ...(wounds !== 0 ? [{ label: "Wounds", value: wounds }] : []),
    ];
    return {
      kind: "opposed",
      luckSpent,
      result: facedown({
        actorName: character.character.name,
        actorCool: pending.statValue,
        actorReputation: pending.skillLevel,
        ...(personal.length > 0 ? { actorModifiers: personal } : {}),
        opponentName: pending.opposition.npcName,
        opponentCool: pending.opposition.statValue,
        opponentReputation: pending.opposition.skillLevel,
      }),
    };
  }

  const opposition = oppositionFor(pending);
  if (opposition) {
    return {
      kind: "opposed",
      luckSpent,
      result: opposedCheckForCharacter(actor, pending.skillId, opposition, undefined, {
        actorName: character.character.name,
        ...modifiers,
      }),
    };
  }
  if (pending.dv === null) throw new Error("That check has neither a DV nor an opponent.");
  return {
    kind: "dv",
    luckSpent,
    result: skillCheckForCharacter(actor, pending.skillId, pending.dv, undefined, modifiers),
  };
}
