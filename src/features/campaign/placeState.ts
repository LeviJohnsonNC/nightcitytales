/**
 * Persisting what has happened to a place.
 *
 * The engine decides what an observation does to somewhere (engine/placeState.ts);
 * this is the only module that turns that into a row. A place with no row is at
 * its authored starting condition, so nothing has to be written until something
 * actually happens.
 */
import {
  applyToPlace,
  recordVisit,
  startingState,
  type Observation,
  type PlaceState,
} from "@/engine";
import {
  appendCampaignEvent,
  listCampaignPlaces,
  upsertCampaignPlace,
  type CampaignPlace,
  type Json,
} from "@/lib/backend";

/** Read a row back into the engine's shape. */
export function placeStateFromRow(row: CampaignPlace): PlaceState {
  const dials = (row.dials ?? {}) as Record<string, unknown>;
  const numbers: Record<string, number> = {};
  for (const [key, value] of Object.entries(dials)) {
    if (typeof value === "number" && Number.isFinite(value)) numbers[key] = value;
  }
  return {
    placeKey: row.place_key,
    dials: numbers,
    flags: Array.isArray(row.flags)
      ? row.flags.filter((f): f is string => typeof f === "string")
      : [],
    visits: row.visits,
    firstVisitDay: row.first_visit_day,
    lastVisitDay: row.last_visit_day,
  };
}

/** Everywhere this campaign has changed, by place key. */
export async function loadPlaceStates(campaignId: string): Promise<Record<string, PlaceState>> {
  const rows = await listCampaignPlaces(campaignId);
  const out: Record<string, PlaceState> = {};
  for (const row of rows) out[row.place_key] = placeStateFromRow(row);
  return out;
}

async function save(campaignId: string, state: PlaceState): Promise<void> {
  await upsertCampaignPlace(campaignId, {
    placeKey: state.placeKey,
    dials: state.dials,
    flags: state.flags,
    visits: state.visits,
    firstVisitDay: state.firstVisitDay,
    lastVisitDay: state.lastVisitDay,
  });
}

/**
 * Fold a turn's observations into the place they happened in.
 *
 * A dial crossing writes a ledger line, because that is the moment a place
 * stops being what the atlas said about it and the player deserves to be able
 * to look back and find out when.
 */
export async function applyPlaceObservations(args: {
  campaignId: string;
  placeKey: string;
  observations: Observation[];
  known?: Record<string, PlaceState> | undefined;
}): Promise<PlaceState | null> {
  if (!args.observations.length) return null;
  const before = args.known?.[args.placeKey] ?? startingState(args.placeKey);
  const change = applyToPlace(before, args.observations);
  if (!change.moved.length && !change.flagged.length) return before;

  await save(args.campaignId, change.state);

  for (const flag of change.flagged) {
    await appendCampaignEvent({
      campaign_id: args.campaignId,
      type: "place_changed",
      summary: flag.note,
      data: { placeKey: args.placeKey, flag: flag.flag, set: flag.set } as unknown as Json,
    });
  }
  return change.state;
}

/** Note that the character was here, once per day at most. */
export async function notePlaceVisit(args: {
  campaignId: string;
  placeKey: string;
  day: number;
  known?: Record<string, PlaceState> | undefined;
}): Promise<PlaceState> {
  const before = args.known?.[args.placeKey] ?? startingState(args.placeKey);
  if (before.lastVisitDay === args.day) return before;
  const after = recordVisit(before, args.day);
  await save(args.campaignId, after);
  return after;
}
