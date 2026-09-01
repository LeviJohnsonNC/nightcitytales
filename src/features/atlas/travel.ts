/**
 * Moving through Night City. The engine prices the trip and decides whether the
 * destination exists; this module only persists the result and writes the
 * ledger entry.
 */
import {
  canTravel,
  describePosition,
  resolvePosition,
  travelMinutes,
  type GameClock,
} from "@/engine";
import { advanceClock } from "@/engine";
import { appendCampaignEvent, updateCampaign } from "@/lib/backend/campaigns";
import { setCampaignClock } from "@/lib/backend/life";
import type { Campaign } from "@/lib/backend/types";

export type TravelResult = {
  campaign: Campaign;
  clock: GameClock;
  minutes: number;
};

/** Move the campaign to a destination, spending the house-rule travel time. */
export async function travelTo(args: {
  campaign: Campaign;
  clock: GameClock;
  to: string;
}): Promise<TravelResult> {
  const { campaign, clock, to } = args;
  if (!canTravel(to)) throw new Error(`"${to}" is not a place on the Night City map.`);

  const from = campaign.location_key ?? null;
  const minutes = travelMinutes(from, to);
  const destination = resolvePosition(to);
  const key = destination?.placeKey ?? destination?.districtKey ?? to;

  const known = new Set<string>(
    Array.isArray(campaign.known_places)
      ? (campaign.known_places as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
  );
  known.add(key);

  const nextClock = minutes > 0 ? advanceClock(clock, minutes) : clock;
  if (minutes > 0) await setCampaignClock(campaign.id, nextClock);

  const updated = await updateCampaign(campaign.id, {
    location_key: key,
    known_places: [...known],
  });

  await appendCampaignEvent({
    campaign_id: campaign.id,
    type: "travelled",
    summary: `Travelled to ${describePosition(key)}${minutes ? ` (${minutes} min)` : ""}.`,
    data: { from, to: key, minutes },
  });

  return { campaign: updated, clock: nextClock, minutes };
}
