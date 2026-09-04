/**
 * Backend adapter for what has happened to a place.
 *
 * A row exists only once something has. A campaign that has never touched a
 * location has no row for it and the engine reads its authored starting
 * condition, so 156 locations never become 156 rows per campaign saying nothing.
 */
import { backendClient } from "./client";
import type { CampaignPlace, Json } from "./types";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Every place this campaign has changed or visited. */
export async function listCampaignPlaces(campaignId: string): Promise<CampaignPlace[]> {
  const res = await backendClient
    .from("campaign_places")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("place_key", { ascending: true });
  return unwrap(res) ?? [];
}

export type PlaceUpsert = {
  placeKey: string;
  dials: Record<string, number>;
  flags: string[];
  visits: number;
  firstVisitDay: number | null;
  lastVisitDay: number | null;
};

/** Write one place's state back, keyed on the place (unique per campaign). */
export async function upsertCampaignPlace(
  campaignId: string,
  input: PlaceUpsert,
): Promise<CampaignPlace> {
  return unwrap(
    await backendClient
      .from("campaign_places")
      .upsert(
        {
          campaign_id: campaignId,
          place_key: input.placeKey,
          dials: input.dials as unknown as Json,
          flags: input.flags,
          visits: input.visits,
          first_visit_day: input.firstVisitDay,
          last_visit_day: input.lastVisitDay,
        },
        { onConflict: "campaign_id,place_key" },
      )
      .select()
      .single(),
  );
}
