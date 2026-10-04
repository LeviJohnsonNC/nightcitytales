/**
 * A place's favour, called in.
 *
 * What a favour is, and when a place will do one, is `engine/favours.ts`; this
 * is the part that does it. `favourOffers` is the one question — what is on
 * offer where the character stands — asked by the sheet that shows it and by the
 * operation that honours it, so the two cannot disagree about what is available.
 * The operation asks it again on fresh rows rather than trusting what the screen
 * was holding.
 *
 * The writes are ordered so a failure partway leaves something fair: the benefit
 * first, then the goodwill it cost, then the time, then the receipt. A favour
 * that fails after its benefit costs a place a little less than it should have;
 * the other way round would cost the player goodwill and give them nothing.
 */
import {
  HEAT_CLOCK_KEY,
  advanceClock,
  districtOfPlace,
  favourCalledEventData,
  favourCalledOn,
  favoursAt,
  formatDuration,
  layLowReports,
  resolvePosition,
  DEFAULT_START,
  LEDGER_EVENTS,
  type FavourOffer,
  type PlaceState,
} from "@/engine";
import { downtimeView } from "@/features/downtime/downtimeModel";
import {
  appendCampaignEvent,
  getCampaign,
  listCampaignEvents,
  listClocks,
  setCampaignClock,
  updateCampaignVitals,
  type Campaign,
  type CampaignInventoryItem,
  type CampaignVitals,
  type FullCharacter,
  type Json,
} from "@/lib/backend";
import { pressureFrom, applyPressure } from "./pressure";
import { loadPlaceStates, spendFavourGoodwill } from "./placeState";

/** What `favourOffers` reads: the campaign as it stands, and the ledger's recent past. */
export type FavourInput = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
  places: Record<string, PlaceState>;
  /** Filled segments on the NCPD heat clock. */
  heat: number;
  events: readonly { type: string; data?: unknown }[];
};

/** The venue the character is standing in, or null when they are in the street. */
export function standingAt(campaign: Pick<Campaign, "location_key">): string | null {
  return resolvePosition(campaign.location_key ?? DEFAULT_START)?.placeKey ?? null;
}

/** Everything the place the character is standing in will do for them. */
export function favourOffers(input: FavourInput): FavourOffer[] {
  const placeKey = standingAt(input.campaign);
  if (!placeKey) return [];
  const view = downtimeView({ ...input, restDays: 1 });
  return favoursAt({
    placeKey,
    state: input.places[placeKey],
    context: {
      hpCurrent: input.vitals.hp_current,
      hpMax: input.vitals.hp_max,
      body: view.body,
      perDayBonus: view.care?.selfCare ?? 0,
      heat: input.heat,
      calledToday: favourCalledOn(input.events, placeKey, input.campaign.day ?? 0),
    },
  });
}

export type FavourOutcome =
  { ok: true; offer: FavourOffer; summary: string } | { ok: false; reason: string };

function summaryFor(offer: FavourOffer): string {
  const time = formatDuration(offer.minutes);
  return offer.effect === "patch"
    ? `${offer.placeName} looked after you — healed ${offer.hpHealed} HP, ${time}.`
    : `You went to ground at ${offer.placeName} — NCPD heat down ${offer.heatEased}, ${time}.`;
}

/** Call in one favour at the place the character is standing in. */
export async function callInFavour(input: {
  campaignId: string;
  favourKey: string;
  character: FullCharacter;
}): Promise<FavourOutcome> {
  const full = await getCampaign(input.campaignId);
  if (!full?.vitals) return { ok: false, reason: "Campaign not found." };
  const placeKey = standingAt(full.campaign);
  if (!placeKey) return { ok: false, reason: "There is nobody here to ask." };

  const [places, clockRows, events] = await Promise.all([
    loadPlaceStates(input.campaignId),
    listClocks(input.campaignId),
    listCampaignEvents(input.campaignId),
  ]);
  const heat =
    pressureFrom(clockRows).find((p) => p.clock.key === HEAT_CLOCK_KEY)?.clock.filled ?? 0;
  const offer = favourOffers({
    campaign: full.campaign,
    vitals: full.vitals,
    character: input.character,
    inventory: full.inventory,
    places,
    heat,
    events,
  }).find((o) => o.key === input.favourKey);

  if (!offer) return { ok: false, reason: "Nobody here would do that for you." };
  if (!offer.ready) return { ok: false, reason: offer.reason ?? "Not now." };

  // The benefit.
  if (offer.effect === "patch") {
    await updateCampaignVitals(input.campaignId, {
      hp_current: full.vitals.hp_current + offer.hpHealed,
    });
  } else {
    await applyPressure(input.campaignId, layLowReports(), {
      districtKey: districtOfPlace(placeKey)?.key ?? null,
    });
  }

  // What it cost them.
  await spendFavourGoodwill({ campaignId: input.campaignId, placeKey, offer, known: places });

  // The time it took, which is the other half of the cost.
  const day = full.campaign.day ?? 0;
  await setCampaignClock(
    input.campaignId,
    advanceClock({ day, minute: full.campaign.minute }, offer.minutes),
  );

  const summary = summaryFor(offer);
  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: LEDGER_EVENTS.favourCalled,
    summary,
    data: favourCalledEventData({
      placeKey,
      favour: offer.key,
      effect: offer.effect,
      spent: offer.cost,
      hpHealed: offer.hpHealed,
      heatEased: offer.heatEased,
      minutes: offer.minutes,
      day,
    }) as unknown as Json,
  });
  return { ok: true, offer, summary };
}
