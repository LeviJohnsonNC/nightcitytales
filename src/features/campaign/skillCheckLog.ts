/**
 * Recording skill checks to the campaign event ledger. The full roll trace goes
 * into the immutable campaign_events row, so every die the engine rolled on the
 * player's behalf stays inspectable — the traceability the build depends on.
 */
import type { OpposedCheckResult, SkillCheckResult } from "@/engine";
import {
  appendCampaignEvent,
  type CampaignEvent,
  type CampaignEventInsert,
  type Json,
} from "@/lib/backend";

export type SkillCheckContext = {
  /** The skill id checked, e.g. "handgun". */
  skillId?: string;
  /** Display name of the skill, e.g. "Handgun". */
  skillName?: string;
  /** Beat this check happened on, if any. */
  beatId?: string | null;
  /** The player's stated intent, e.g. "shoot the guard". */
  intent?: string;
  /**
   * The check_prompt row this roll answers. Recorded so more than one prompt can
   * be outstanding at once and each still be matched to the die that settled it.
   */
  promptEventId?: string;
  /** Luck Points dedicated to this roll, so the trace shows what it cost. */
  luckSpent?: number;
  /**
   * The engine rolled this by itself because it was small (engine/autoRoll.ts).
   * Recorded so the log can say so: a roll the player never pressed must still
   * be visible as a roll, and as one they did not press.
   */
  auto?: boolean;
};

/** Build the immutable ledger row for a resolved skill check. */
export function skillCheckEvent(
  campaignId: string,
  result: SkillCheckResult,
  context: SkillCheckContext = {},
): CampaignEventInsert {
  const data: Record<string, unknown> = {
    success: result.success,
    margin: result.margin,
    critical: result.critical,
  };
  if (context.skillId) data["skill_id"] = context.skillId;
  if (context.skillName) data["skill_name"] = context.skillName;
  if (context.intent) data["intent"] = context.intent;
  if (context.promptEventId) data["prompt_event_id"] = context.promptEventId;
  if (context.luckSpent) data["luck_spent"] = context.luckSpent;
  if (context.auto) data["auto"] = true;

  return {
    campaign_id: campaignId,
    type: "skill_check",
    summary: result.formula,
    roll: result as unknown as Json,
    data: data as unknown as Json,
    ...(context.beatId ? { beat_id: context.beatId } : {}),
  };
}

/** Resolve-and-record helper: append the check to the ledger, returning the row. */
export async function logSkillCheck(
  campaignId: string,
  result: SkillCheckResult,
  context: SkillCheckContext = {},
): Promise<CampaignEvent> {
  return appendCampaignEvent(skillCheckEvent(campaignId, result, context));
}

/**
 * How an opposed roll reads in the log: both totals, and the margin between
 * them. A tie is called out by name, because losing one is not the same as
 * being outrolled and the narration must not blur the two.
 */
export function opposedCheckSummary(result: OpposedCheckResult): string {
  const verdict = result.success ? "SUCCESS" : result.tie ? "TIE — defender holds" : "FAILURE";
  const margin = Math.abs(result.margin);
  const by = result.tie ? "" : ` by ${margin}`;
  return (
    `${result.actorSide.name}: ${result.actor.formula} | ` +
    `${result.opponentSide.name}: ${result.opponent.formula} → ${verdict}${by}`
  );
}

/** Build the immutable ledger row for a resolved opposed check. */
export function opposedCheckEvent(
  campaignId: string,
  result: OpposedCheckResult,
  context: SkillCheckContext & { npcKey?: string } = {},
): CampaignEventInsert {
  const data: Record<string, unknown> = {
    success: result.success,
    margin: result.margin,
    tie: result.tie,
    critical: result.actor.critical,
    opposed: {
      npc_key: context.npcKey ?? null,
      npc_name: result.opponentSide.name,
      opposing_skill: result.opponentSide.skillLabel,
      opposing_total: result.opponent.total,
      opposing_critical: result.opponent.critical,
    },
  };
  if (context.skillId) data["skill_id"] = context.skillId;
  if (context.skillName) data["skill_name"] = context.skillName;
  if (context.intent) data["intent"] = context.intent;
  if (context.promptEventId) data["prompt_event_id"] = context.promptEventId;
  if (context.luckSpent) data["luck_spent"] = context.luckSpent;

  return {
    campaign_id: campaignId,
    type: "skill_check",
    summary: opposedCheckSummary(result),
    roll: result as unknown as Json,
    data: data as unknown as Json,
    ...(context.beatId ? { beat_id: context.beatId } : {}),
  };
}

/** Resolve-and-record helper for an opposed check. */
export async function logOpposedCheck(
  campaignId: string,
  result: OpposedCheckResult,
  context: SkillCheckContext & { npcKey?: string } = {},
): Promise<CampaignEvent> {
  return appendCampaignEvent(opposedCheckEvent(campaignId, result, context));
}

/** An automatic roll, as the log shows it by default: one short line. */
export type AutoRollView = {
  /** "Streetwise 19 vs 13 · SUCCESS · auto" */
  headline: string;
  /** The full trace, shown on request: the formula the engine wrote. */
  detail: string;
};

/**
 * How an automatic roll reads in the log, or null for one the player pressed.
 *
 * Fast by default, fully auditable on request (PRODUCT.md, Interface): the
 * headline says what was rolled, against what, how it came out, and that
 * nobody pressed anything; the detail is the complete trace.
 */
export function readAutoRoll(event: CampaignEvent): AutoRollView | null {
  if (event.type !== "skill_check") return null;
  const data = (event.data ?? {}) as { auto?: unknown; skill_name?: unknown };
  if (data.auto !== true) return null;
  const roll = (event.roll ?? {}) as { total?: unknown; dv?: unknown; success?: unknown };
  const skill = typeof data.skill_name === "string" ? data.skill_name : "Check";
  const total = typeof roll.total === "number" ? roll.total : null;
  const dv = typeof roll.dv === "number" ? roll.dv : null;
  const verdict = roll.success === true ? "SUCCESS" : roll.success === false ? "FAILURE" : null;
  const parts = [
    total !== null && dv !== null ? `${skill} ${total} vs ${dv}` : skill,
    ...(verdict ? [verdict] : []),
    "auto",
  ];
  return { headline: parts.join(" · "), detail: event.summary ?? "" };
}
