/**
 * Recording beat transitions to the campaign event ledger, so the story path a
 * campaign took is inspectable alongside the dice.
 */
import type { Beat, Mission } from "@/engine";
import {
  appendCampaignEvent,
  type CampaignEvent,
  type CampaignEventInsert,
  type Json,
} from "@/lib/backend";

export type BeatAdvance = {
  mission: Mission;
  fromBeatId: string;
  toBeat: Beat;
  /** The player-facing label of the exit taken, if any. */
  choiceLabel?: string;
};

/** Build the ledger row for advancing to a new beat. */
export function beatAdvancedEvent(campaignId: string, parts: BeatAdvance): CampaignEventInsert {
  const { mission, fromBeatId, toBeat, choiceLabel } = parts;
  return {
    campaign_id: campaignId,
    type: "beat_advanced",
    beat_id: toBeat.id,
    summary: `${mission.title}: ${toBeat.title}`,
    data: {
      mission_id: mission.id,
      from_beat: fromBeatId,
      to_beat: toBeat.id,
      beat_type: toBeat.type,
      ...(choiceLabel ? { choice: choiceLabel } : {}),
    } as unknown as Json,
  };
}

export async function logBeatAdvanced(
  campaignId: string,
  parts: BeatAdvance,
): Promise<CampaignEvent> {
  return appendCampaignEvent(beatAdvancedEvent(campaignId, parts));
}
