/**
 * Moving house, applied.
 *
 * `engine/home.ts` prices a move; this sends it through `move_house`, the one
 * transaction that takes the deposit, writes the new home onto the campaign,
 * moves the clock and the character, and leaves the `moved_house` receipt. The
 * plan is priced against the campaign as loaded, and the transaction refuses
 * it if any of that has changed since (`campaign changed`).
 */
import {
  getPlace,
  housingById,
  lifestyleById,
  planMove,
  readMovedHouseEventData,
  type Home,
  type MovedHouseEventData,
  type MoveVerdict,
} from "@/engine";
import { moveHouse, type Campaign, type CampaignVitals, type FullCharacter } from "@/lib/backend";
import { lifestyleRates, paidThroughDay } from "@/features/downtime/downtimeModel";
import { campaignHome } from "./home";

export type MoveContext = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
};

/** What moving to `target` would cost this character now, or why they cannot. */
export function moveVerdict(ctx: MoveContext, target: Home): MoveVerdict {
  return planMove({
    roleId: ctx.character.character.role ?? null,
    current: campaignHome(ctx.campaign, ctx.character),
    target,
    eurobucks: ctx.vitals.eurobucks,
    clock: { day: ctx.campaign.day, minute: ctx.campaign.minute },
    paidThroughDay: paidThroughDay(ctx.campaign, lifestyleRates(ctx.character, ctx.campaign)),
  });
}

/** The line the Life log shows for a move. */
export function moveSummary(
  target: Home,
  plan: { moving: boolean; deposit: number; perMonthAfter: number },
): string {
  const lifestyle = lifestyleById(target.lifestyleId)?.name ?? target.lifestyleId;
  const monthly = `${plan.perMonthAfter}eb a month from the next bill`;
  if (!plan.moving) return `Living on ${lifestyle} now: ${monthly}.`;
  const housing = housingById(target.housingId)?.name ?? target.housingId;
  const place = target.placeKey ? getPlace(target.placeKey)?.name : undefined;
  const deposit = plan.deposit > 0 ? ` Deposit ${plan.deposit}eb.` : "";
  const article = /^[AEIOU]/.test(housing) ? "an" : "a";
  return `Moved into ${article} ${housing}${place ? ` at ${place}` : ""}, living on ${lifestyle}.${deposit} ${monthly[0]!.toUpperCase()}${monthly.slice(1)}.`;
}

/** Commit a move. Throws the engine's reason when there is no plan. */
export async function commitMove(
  ctx: MoveContext,
  target: Home,
  requestId: string = crypto.randomUUID(),
): Promise<MovedHouseEventData> {
  const verdict = moveVerdict(ctx, target);
  if (!verdict.ok) throw new Error(verdict.reason);
  const { plan } = verdict;
  const current = campaignHome(ctx.campaign, ctx.character);
  const receipt = await moveHouse({
    campaign_id: ctx.campaign.id,
    request_id: requestId,
    summary: moveSummary(target, plan),
    expected: {
      day: ctx.campaign.day,
      minute: ctx.campaign.minute,
      eurobucks: ctx.vitals.eurobucks,
      bills_paid_through_day: ctx.campaign.bills_paid_through_day ?? 0,
    },
    move: {
      from_place: current.placeKey,
      from_housing: current.housingId,
      from_lifestyle: current.lifestyleId,
      to_place: target.placeKey,
      to_housing: target.housingId,
      to_lifestyle: target.lifestyleId,
      deposit: plan.deposit,
      rent: plan.rentAfter,
      lifestyle_cost: plan.lifestyleAfter,
      day_after: plan.clockAfter.day,
      minute_after: plan.clockAfter.minute,
    },
  });
  const read = readMovedHouseEventData(receipt);
  if (!read) throw new Error("The move returned a receipt nobody can read.");
  return read;
}
