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
  placeKeyOf,
  positionKey,
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

/**
 * "west " and "the west of Little Europe" in the same line is one direction too
 * many. When the place already says which way it lies, the heading is dropped.
 */
function ledgerPhrase(
  heading: ReturnType<typeof directionBetween>,
  what: string,
): { heading: string; what: string } {
  if (!heading) return { heading: "", what };
  const named = `the ${directionName(heading)} of `;
  if (what.toLowerCase().startsWith(named)) return { heading: "", what };
  return { heading: `${directionName(heading)} `, what };
}

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
  // What gets stored: the exact spot when the trip landed on one, so the pin and
  // the next trip's distance both know where the character actually is.
  const key = destination?.point
    ? positionKey(destination.districtKey, destination.point)
    : (destination?.placeKey ??
      destination?.landmarkKey ??
      destination?.streetKey ??
      destination?.districtKey ??
      to);

  const known = new Set<string>(
    Array.isArray(campaign.known_places)
      ? (campaign.known_places as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
  );
  // The visited list is a list of PLACES. A point is where you happened to be
  // standing, not somewhere to remember and go back to, so only the place half
  // is kept — otherwise every waterfront stroll leaves a new entry behind.
  known.add(placeKeyOf(key) ?? key);

  const nextClock = minutes > 0 ? advanceClock(clock, minutes) : clock;
  if (minutes > 0) await setCampaignClock(campaign.id, nextClock);

  const updated = await updateCampaign(campaign.id, {
    location_key: key,
    known_places: [...known],
  });

  // The heading is recorded as fact, so the next narration cannot describe a
  // trip east as heading west.
  const heading = directionBetween(from, key);
  const where = ledgerPhrase(heading, describePosition(key));
  await appendCampaignEvent({
    campaign_id: campaign.id,
    type: "travelled",
    summary:
      `Travelled ${where.heading}to ${where.what}` +
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
