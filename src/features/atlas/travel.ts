/**
 * Moving through Night City. The engine prices the trip and decides whether the
 * destination exists; this module only persists the result and writes the
 * ledger entry.
 */
import {
  canTravel,
  DEFAULT_START,
  describePosition,
  directionBetween,
  directionName,
  modeLabel,
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
  /** What the engine already priced the trip at, when it has. */
  minutes?: number;
  /** How they got there, for the ledger line. */
  mode?: string;
}): Promise<TravelResult> {
  const { campaign, clock, to } = args;
  if (!canTravel(to)) throw new Error(`"${to}" is not a place on the Night City map.`);

  // Where a campaign with no recorded address stands, the same way every other
  // reader of location_key resolves it. Reading this as null instead priced the
  // first trip of every campaign off a missing origin and left its heading out
  // of the ledger.
  const from = campaign.location_key ?? DEFAULT_START;
  // The caller has usually already routed and priced the trip; re-pricing it
  // here would quietly disagree with what the player was told.
  const minutes = args.minutes ?? travelMinutes(from, to, args.mode);
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

  // The heading is recorded as fact, so the next narration cannot describe a
  // trip east as heading west.
  const heading = directionBetween(from, key);
  await appendCampaignEvent({
    campaign_id: campaign.id,
    type: "travelled",
    summary:
      `Travelled ${heading ? `${directionName(heading)} ` : ""}to ${describePosition(key)}` +
      `${args.mode ? ` ${modeLabel(args.mode)}` : ""}${minutes ? ` (${minutes} min)` : ""}.`,
    data: {
      from,
      to: key,
      minutes,
      ...(args.mode ? { mode: args.mode } : {}),
      ...(heading ? { direction: heading } : {}),
    },
  });

  return { campaign: updated, clock: nextClock, minutes };
}
