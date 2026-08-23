/**
 * Recording skill checks to the campaign event ledger. The full roll trace goes
 * into the immutable campaign_events row, so every die the engine rolled on the
 * player's behalf stays inspectable — the traceability the build depends on.
 */
import type { SkillCheckResult } from "@/engine";
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
