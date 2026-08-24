/**
 * Downtime, applied. The model says what resting, paying, buying and repairing
 * would do; this sequences the writes and records each one in the campaign
 * ledger, so the after-action shows up in the log alongside the job itself.
 *
 * Every mechanical number comes from the engine through downtimeModel. Nothing
 * here decides a cost or a healing rate.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { canAfford, itemName, purchaseCost, type ItemKind } from "@/engine";
import {
  addInventoryItem,
  appendCampaignEvent,
  getCampaign,
  getCharacter,
  setInventorySp,
  updateCampaign,
  updateCampaignVitals,
  type Campaign,
  type CampaignInventoryItem,
  type CampaignVitals,
  type FullCharacter,
  type Json,
} from "@/lib/backend";
import { billsAfterResting, downtimeView, type RepairableArmor } from "./downtimeModel";

export type DowntimeBundle = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
};

async function loadDowntime(campaignId: string): Promise<DowntimeBundle> {
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
  };
}

/** Kinds that stack as a quantity rather than as separate tracked pieces. */
function stacks(kind: ItemKind): boolean {
  return kind === "ammunition" || kind === "gear";
}

/**
 * Lie low. Days pass, HP comes back at BODY a day, and the calendar moves —
 * which is what brings the next month's rent closer.
 */
async function rest(bundle: DowntimeBundle, days: number): Promise<void> {
  const view = downtimeView({ ...bundle, restDays: days });
  const plan = view.rest;
  if (plan.days <= 0) return;

  await updateCampaign(bundle.campaign.id, { day: view.day + plan.days });
  if (plan.hpHealed > 0) {
    await updateCampaignVitals(bundle.campaign.id, { hp_current: plan.hpAfter });
  }
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: "downtime_rest",
    summary:
      `Lay low for ${plan.days} day${plan.days === 1 ? "" : "s"}` +
      (plan.hpHealed > 0
        ? ` — healed ${plan.hpHealed} HP (BODY ${view.body} a day), now ${plan.hpAfter}/${view.hpMax}.`
        : "."),
    data: { days: plan.days, hpHealed: plan.hpHealed, body: view.body } as unknown as Json,
  });
}

/** Settle what the landlord and the food are owed. */
async function payBills(bundle: DowntimeBundle): Promise<void> {
  const view = downtimeView({ ...bundle, restDays: 0 });
  const bills = view.bills;
  if (bills.total <= 0) return;
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
}

/** Buy something at Night Market prices. */
async function buy(
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
async function repair(bundle: DowntimeBundle, piece: RepairableArmor): Promise<void> {
  const held = bundle.vitals.eurobucks;
  if (piece.missingSp <= 0) return;
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
}

export function useDowntime(campaignId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["downtime", campaignId],
    queryFn: () => loadDowntime(campaignId),
  });
  const [restDays, setRestDays] = useState(1);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["downtime", campaignId] });
    // The play screen shows the same HP, eurobucks and kit.
    void queryClient.invalidateQueries({ queryKey: ["play", campaignId] });
  };

  const bundle = query.data ?? null;

  const restMutation = useMutation({
    mutationFn: (days: number) => {
      if (!bundle) throw new Error("Still loading.");
      return rest(bundle, days);
    },
    onSuccess: invalidate,
  });
  const billsMutation = useMutation({
    mutationFn: () => {
      if (!bundle) throw new Error("Still loading.");
      return payBills(bundle);
    },
    onSuccess: invalidate,
  });
  const buyMutation = useMutation({
    mutationFn: (purchase: { kind: ItemKind; itemId: string; quantity: number }) => {
      if (!bundle) throw new Error("Still loading.");
      return buy(bundle, purchase);
    },
    onSuccess: invalidate,
  });
  const repairMutation = useMutation({
    mutationFn: (piece: RepairableArmor) => {
      if (!bundle) throw new Error("Still loading.");
      return repair(bundle, piece);
    },
    onSuccess: invalidate,
  });

  const view = bundle ? downtimeView({ ...bundle, restDays }) : null;

  return {
    isPending: query.isPending,
    error: query.error as Error | null,
    bundle,
    view,
    /** What will be owed once the days currently dialled in have passed. */
    billsAfterRest: view ? billsAfterResting(view, view.rest.days) : null,
    restDays,
    setRestDays,
    rest: (days: number) => restMutation.mutate(days),
    payBills: () => billsMutation.mutate(),
    buy: (purchase: { kind: ItemKind; itemId: string; quantity: number }) =>
      buyMutation.mutate(purchase),
    repair: (piece: RepairableArmor) => repairMutation.mutate(piece),
    busy:
      restMutation.isPending ||
      billsMutation.isPending ||
      buyMutation.isPending ||
      repairMutation.isPending,
    actionError:
      (restMutation.error as Error | null) ??
      (billsMutation.error as Error | null) ??
      (buyMutation.error as Error | null) ??
      (repairMutation.error as Error | null),
  };
}
