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
  checkPercent,
  clampLuckSpend,
  facedown,
  kitBonuses,
  luckModifier,
  luckRemaining,
  opposedCheckForCharacter,
  opposedPercent,
  areaForCheck,
  getSkill,
  skillLevelFor,
  type StatKey,
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

/** What is riding on a check besides STAT + Skill, assembled once. */
type CheckSetup = {
  luckSpent: number;
  /** Luck and wounds: what any Action carries, a Facedown included. */
  personal: { label: string; value: number }[];
  /** What the Role brings to this particular Skill; a Facedown has none. */
  role: { label: string; value: number }[];
  /** What the carried kit prints for this Skill (a Medscanner on First Aid); a Facedown has none. */
  kit: { label: string; value: number }[];
};

/**
 * Everything beyond STAT + Skill that rides on one check: the Luck dedicated,
 * the wound tax, what the Role brings to the Skill, and what the kit prints for it.
 *
 * Rolling and previewing both read it, so the chance the card shows is made of
 * the very modifiers the die is rolled with. They used to be assembled apart:
 * the card's outlook subtracted a wound penalty that is already negative — so a
 * wounded character was told they were better off than they were — and never
 * saw a Role bonus at all. A preview that is built beside the roll can only
 * agree with it by luck.
 */
function checkSetup(input: RollCheckInput): CheckSetup {
  const { campaign, character, vitals, pending } = input;
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
  return {
    luckSpent,
    personal: [
      ...(spend ? [spend] : []),
      ...(wounds !== 0 ? [{ label: "Wounds", value: wounds }] : []),
    ],
    role: roleCheckModifiers({ campaign, character, skillId: pending.skillId }),
    kit: kitBonuses(
      input.inventory.filter((row) => row.quantity > 0).map((row) => row.item_id),
      pending.skillId,
    ),
  };
}

/** What a check looks like before the die: the real total it rolls from, and the chance. */
export type CheckPreview = {
  /** STAT + Skill + every modifier — what `result.modifier` will be once rolled. */
  base: number;
  /** The target the total is held against: a DV, or their base (before their die). */
  against: number;
  /** Chance of success, a whole percentage. */
  percent: number;
  /** Luck, wounds and Role bonuses, labelled, so the chip can say what moved it. */
  modifiers: { label: string; value: number }[];
};

/**
 * The chance a pending check succeeds with `luckSpend` dedicated. A Facedown,
 * an Opposed Check and a DV check each read the numbers their roll reads.
 * Null when the card carries no target to hold the total against.
 */
export function previewPendingCheck(input: RollCheckInput): CheckPreview | null {
  const { pending } = input;
  const setup = checkSetup(input);
  const isFacedown = pending.skillId === FACEDOWN_CHECK_ID && pending.opposition;
  const modifiers = isFacedown ? setup.personal : [...setup.personal, ...setup.role, ...setup.kit];
  // STAT + Skill is read from the actor the roll will use, by the lookups the
  // roll uses, rather than from the number the card was drawn with: a card can
  // be a few turns old, and the roll is made from what is true now.
  const actor = rollingActor(input);
  const stat = isFacedown ? undefined : actor.stats[getSkill(pending.skillId).stat as StatKey];
  const carried =
    isFacedown || typeof stat !== "number"
      ? pending.base
      : stat + skillLevelFor(actor, pending.skillId, areaForCheck(actor, pending.skillId));
  const base = carried + modifiers.reduce((sum, m) => sum + m.value, 0);

  if (pending.opposition) {
    const theirs = pending.opposition.statValue + pending.opposition.skillLevel;
    return { base, against: theirs, percent: opposedPercent(base, theirs), modifiers };
  }
  if (pending.dv === null) return null;
  return { base, against: pending.dv, percent: checkPercent(base, pending.dv), modifiers };
}

/** The character as the roll reads them: live stats, and the ground they stand on. */
function rollingActor(input: RollCheckInput) {
  const { campaign, character, vitals, inventory } = input;
  return actorFor(character, {
    vitals,
    inventory,
    // A Local Expert check is about the neighbourhood the character is
    // standing in, and is worth nothing in one they are not a local in.
    districtKey: resolvePosition(campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
  });
}

export function rollPendingCheck(input: RollCheckInput): CheckRoll {
  const { character, pending } = input;
  const actor = rollingActor(input);
  const { luckSpent, personal, role, kit } = checkSetup(input);
  // What the Role and the kit bring to this particular check ride after Luck and wounds.
  const situational = [...personal, ...role, ...kit];
  const modifiers = situational.length > 0 ? { modifiers: situational } : {};

  // A Facedown is COOL + Reputation on both sides. Luck and wounds ride on it as
  // on any Action; what a Role brings to a Skill does not, because there is none.
  if (pending.skillId === FACEDOWN_CHECK_ID && pending.opposition) {
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
