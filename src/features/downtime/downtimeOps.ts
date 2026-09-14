/**
 * Downtime, applied — the single implementation of resting, paying rent,
 * buying and patching armor.
 *
 * These used to live inside useDowntime, which made the Downtime panel the only
 * way to perform them. Life needs the very same operations (a night's sleep IS
 * a rest; settling the landlord IS paying bills), so they live here and both
 * callers share them. Every mechanical number still comes from the engine
 * through downtimeModel; nothing here decides a cost or a healing rate.
 */
import {
  MINUTES_PER_DAY,
  advanceClock,
  canAfford,
  itemName,
  purchaseCost,
  stacksInInventory,
} from "@/engine";
import type { ItemKind } from "@/engine";
import {
  addInventoryItem,
  appendCampaignEvent,
  getCampaign,
  getCharacter,
  listCampaignPlaces,
  setCampaignClock,
  setInventorySp,
  updateCampaign,
  updateCampaignVitals,
  type Campaign,
  type CampaignInventoryItem,
  type CampaignPlace,
  type CampaignVitals,
  type FullCharacter,
  type Json,
} from "@/lib/backend";
import { medicineDoses, withAbilityState } from "@/features/play/roleAbilityModel";
import { downtimeView, type RepairableArmor } from "./downtimeModel";

export type DowntimeBundle = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
  /**
   * Everywhere this campaign has been, and how often.
   *
   * Loaded for one question: which neighbourhoods the character has spent
   * enough time in to be able to buy Local Expert for them. A row exists only
   * once something has happened at a place, so this is the campaign's own
   * record of where the character has actually walked.
   */
  places: CampaignPlace[];
};

export async function loadDowntime(campaignId: string): Promise<DowntimeBundle> {
  const full = await getCampaign(campaignId);
  if (!full) throw new Error("Campaign not found.");
  if (!full.vitals) throw new Error("Campaign has no vitals.");
  const character = await getCharacter(full.campaign.character_id);
  if (!character) throw new Error("This campaign's character no longer exists.");
  return {
    campaign: full.campaign,
    vitals: full.vitals,
    character,
    inventory: full.inventory,
    places: await listCampaignPlaces(campaignId),
  };
}

/** Kinds that stack as a quantity rather than as separate tracked pieces. */
export function stacks(kind: ItemKind): boolean {
  return stacksInInventory(kind);
}

/**
 * Lie low. Days pass, HP comes back at BODY a day, and the calendar moves —
 * which is what brings the next month's rent closer.
 *
 * `advanceCalendar` is false when the caller already owns the clock: a Life turn
 * spends its own minutes, and the days it crossed are what it passes in here, so
 * moving the calendar again would count the same night twice.
 */
export async function rest(
  bundle: DowntimeBundle,
  days: number,
  options: { advanceCalendar?: boolean; antibiotic?: boolean } = {},
): Promise<{ days: number; hpHealed: number }> {
  const view = downtimeView({ ...bundle, restDays: days });
  // A Medtech may start a course of their own Antibiotic on the way into bed:
  // the printed drug, +2 HP a day for a week, one at a time. The dose is spent
  // whether or not the rest runs the full week, which is what makes taking it
  // for a two-day lie-down a waste rather than a free upgrade.
  const onCourse = options.antibiotic === true && view.restOnAntibiotic !== null;
  const plan = onCourse && view.restOnAntibiotic ? view.restOnAntibiotic : view.rest;
  if (plan.days <= 0) return { days: 0, hpHealed: 0 };
  if (onCourse) await spendDose(bundle, "antibiotic");

  if (options.advanceCalendar !== false) {
    await setCampaignClock(
      bundle.campaign.id,
      advanceClock(
        { day: bundle.campaign.day, minute: bundle.campaign.minute },
        plan.days * MINUTES_PER_DAY,
      ),
    );
  }
  if (plan.hpHealed > 0) {
    await updateCampaignVitals(bundle.campaign.id, { hp_current: plan.hpAfter });
  }
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: "downtime_rest",
    summary:
      `Lay low for ${plan.days} day${plan.days === 1 ? "" : "s"}` +
      (plan.hpHealed > 0
        ? ` — healed ${plan.hpHealed} HP (${describeRate(view.body, plan)}), ` +
          `now ${plan.hpAfter}/${view.hpMax}.`
        : "."),
    data: {
      days: plan.days,
      hpHealed: plan.hpHealed,
      body: view.body,
      perDay: plan.perDay,
      ...(onCourse ? { antibioticDays: plan.courseDays } : {}),
    } as unknown as Json,
  });
  return { days: plan.days, hpHealed: plan.hpHealed };
}

/** Settle what the landlord and the food are owed. */
export async function payBills(bundle: DowntimeBundle): Promise<{ total: number }> {
  const view = downtimeView({ ...bundle, restDays: 0 });
  const bills = view.bills;
  if (bills.total <= 0) return { total: 0 };
  if (!canAfford(view.eurobucks, bills.total)) {
    throw new Error(
      `That is ${bills.total}eb and you have ${view.eurobucks}eb. ` +
        "Unpaid Lifestyle is its own kind of trouble in Night City.",
    );
  }

  await updateCampaignVitals(bundle.campaign.id, {
    eurobucks: view.eurobucks - bills.total,
  });
  await updateCampaign(bundle.campaign.id, { bills_paid_through_day: bills.paidThroughDay });
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: "downtime_bills",
    summary:
      `Paid ${bills.total}eb — ${bills.months} month${bills.months === 1 ? "" : "s"} of ` +
      `${view.rates.housingName} (${bills.rent}eb) and ${view.rates.lifestyleName} (${bills.lifestyle}eb).`,
    data: {
      months: bills.months,
      rent: bills.rent,
      lifestyle: bills.lifestyle,
      total: bills.total,
    } as unknown as Json,
  });
  return { total: bills.total };
}

/** Buy something at Night Market prices. */
export async function buy(
  bundle: DowntimeBundle,
  purchase: { kind: ItemKind; itemId: string; quantity: number },
): Promise<void> {
  const cost = purchaseCost(purchase.kind, purchase.itemId, purchase.quantity);
  const held = bundle.vitals.eurobucks;
  if (purchase.quantity <= 0) return;
  if (!canAfford(held, cost)) {
    throw new Error(`That is ${cost}eb and you have ${held}eb.`);
  }

  await addInventoryItem(bundle.campaign.id, {
    kind: purchase.kind,
    itemId: purchase.itemId,
    quantity: purchase.quantity,
    stack: stacks(purchase.kind),
  });
  await updateCampaignVitals(bundle.campaign.id, { eurobucks: held - cost });
  const name = itemName(purchase.kind, purchase.itemId);
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: "downtime_purchase",
    summary: `Bought ${purchase.quantity > 1 ? `${purchase.quantity}× ` : ""}${name} for ${cost}eb.`,
    data: { ...purchase, cost } as unknown as Json,
  });
}

/** Have a chewed-up piece of armor patched back to its printed SP. */
export async function repair(
  bundle: DowntimeBundle,
  piece: RepairableArmor,
): Promise<{ cost: number }> {
  const held = bundle.vitals.eurobucks;
  if (piece.missingSp <= 0) return { cost: 0 };
  if (!canAfford(held, piece.cost)) {
    throw new Error(`Patching the ${piece.name} is ${piece.cost}eb and you have ${held}eb.`);
  }

  await setInventorySp(piece.inventoryId, piece.maxSp);
  await updateCampaignVitals(bundle.campaign.id, { eurobucks: held - piece.cost });
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: "downtime_repair",
    summary: `Patched ${piece.name} back to SP${piece.maxSp} for ${piece.cost}eb.`,
    data: {
      itemId: piece.itemId,
      restoredSp: piece.missingSp,
      cost: piece.cost,
    } as unknown as Json,
  });
  return { cost: piece.cost };
}

/** The armor most worth patching right now, for a Life turn that asks for it. */
export function worstArmor(bundle: DowntimeBundle): RepairableArmor | null {
  const view = downtimeView({ ...bundle, restDays: 0 });
  return (
    [...view.repairs].sort((a, b) => b.missingSp - a.missingSp).find((p) => p.missingSp > 0) ?? null
  );
}

/** How the rate reads on the receipt, so a better day is visible as a reason. */
function describeRate(
  body: number,
  plan: { perDay: number; courseDays: number; perDayOnCourse: number },
): string {
  const base =
    plan.perDay > body ? `BODY ${body} +${plan.perDay - body} a day` : `BODY ${body} a day`;
  if (plan.courseDays <= 0) return base;
  return `${base}, +${plan.perDayOnCourse - plan.perDay} for ${plan.courseDays} of them on Antibiotic`;
}

/**
 * Spend one dose of a synthesized drug.
 *
 * Doses live in the campaign's role_state beside the Specialty division that
 * unlocked them, which is where the Role panel writes and reads them. Refuses
 * rather than going negative: a dose that is not there was already used.
 */
async function spendDose(bundle: DowntimeBundle, drugId: string): Promise<void> {
  const doses = medicineDoses(bundle.campaign);
  const held = doses[drugId] ?? 0;
  if (held <= 0) throw new Error(`No ${drugId} on hand.`);
  const next = { ...doses };
  if (held > 1) next[drugId] = held - 1;
  else delete next[drugId];
  await updateCampaign(bundle.campaign.id, {
    role_state: withAbilityState(bundle.campaign, "medicine", {
      specialties: (
        bundle.campaign.role_state as Record<string, { specialties?: unknown }> | null
      )?.["medicine"]?.specialties,
      doses: next,
    }) as unknown as Json,
  });
}

/**
 * Take a Speedheal: BODY + WILL HP, at once, and never to somebody Mortally
 * Wounded — which is the printed restriction and the reason it is not simply a
 * better rest. Once a day, so a stack of doses is not a stack of health bars.
 */
export async function takeSpeedheal(bundle: DowntimeBundle): Promise<{ hpHealed: number }> {
  const view = downtimeView({ ...bundle, restDays: 0 });
  const speedheal = view.care?.speedheal;
  if (!speedheal) throw new Error("No Speedheal synthesized.");
  if (bundle.vitals.hp_current <= 0) {
    throw new Error("Speedheal does nothing for someone Mortally Wounded. They need stabilizing.");
  }
  const hpAfter = Math.min(view.hpMax, bundle.vitals.hp_current + speedheal.hp);
  const hpHealed = hpAfter - bundle.vitals.hp_current;
  if (hpHealed <= 0) throw new Error("Already whole — that dose would be wasted.");

  await spendDose(bundle, "speedheal");
  await updateCampaignVitals(bundle.campaign.id, { hp_current: hpAfter });
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: "downtime_speedheal",
    summary: `Took a Speedheal — ${hpHealed} HP back, now ${hpAfter}/${view.hpMax}.`,
    data: { hpHealed, hpAfter } as unknown as Json,
  });
  return { hpHealed };
}
