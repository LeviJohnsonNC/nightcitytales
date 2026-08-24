/**
 * What downtime looks like for one campaign, as plain data.
 *
 * Pure: it reads the campaign, the sheet and the kit, and says what resting
 * would do, what is owed, and what is worth repairing. Nothing here writes —
 * useDowntime applies it. Every number comes from the engine.
 */
import {
  DOWNTIME_MONTH_DAYS,
  armorRepairCost,
  billsDue,
  getArmor,
  planRest,
  startingLifestylePlan,
  type BillsDue,
  type RestPlan,
} from "@/engine";
import type { Campaign, CampaignInventoryItem, CampaignVitals, FullCharacter } from "@/lib/backend";

/** The monthly costs this character is on the hook for. */
export type LifestyleRates = {
  housingName: string;
  lifestyleName: string;
  rent: number;
  lifestyleCost: number;
  perMonth: number;
  firstMonthFree: boolean;
  /** True when the Role's own ability houses them and rent is nobody's problem. */
  granted: boolean;
};

export function lifestyleRates(character: FullCharacter): LifestyleRates {
  const plan = startingLifestylePlan(character.character.role ?? null);
  return {
    housingName: plan.housingName,
    lifestyleName: plan.lifestyleName,
    rent: plan.rent,
    lifestyleCost: plan.lifestyleCost,
    perMonth: plan.rent + plan.lifestyleCost,
    firstMonthFree: plan.firstMonthFree,
    granted: plan.grantedByRoleAbility,
  };
}

/**
 * The day through which bills are settled, with the free first month applied.
 *
 * Characters get their starting housing and Lifestyle free for the first month,
 * so a campaign that has never paid anything is still square until day 30. That
 * is applied on read rather than backfilled, so campaigns that predate the
 * column keep the month they were promised.
 */
export function paidThroughDay(campaign: Campaign, rates: LifestyleRates): number {
  const free = rates.firstMonthFree ? DOWNTIME_MONTH_DAYS : 0;
  return Math.max(campaign.bills_paid_through_day ?? 0, free);
}

/** A piece of worn armor that has taken hits, and what patching it costs. */
export type RepairableArmor = {
  inventoryId: string;
  itemId: string;
  name: string;
  currentSp: number;
  maxSp: number;
  missingSp: number;
  cost: number;
};

/** Every armor line whose SP has been chewed below its printed rating. */
export function repairableArmor(inventory: CampaignInventoryItem[]): RepairableArmor[] {
  const out: RepairableArmor[] = [];
  for (const row of inventory) {
    if (row.kind !== "armor") continue;
    let armor;
    try {
      armor = getArmor(row.item_id);
    } catch {
      continue; // an item the catalog no longer knows: not repairable here
    }
    // A piece with no printed SP (a shield with HP, say) is not repaired by
    // this rule — there is no rating to patch it back up to.
    const maxSp = armor.sp;
    if (typeof maxSp !== "number") continue;
    const currentSp = typeof row.current_sp === "number" ? row.current_sp : maxSp;
    if (currentSp >= maxSp) continue;
    const { missingSp, cost } = armorRepairCost({
      kind: "armor",
      itemId: row.item_id,
      currentSp,
      maxSp,
    });
    out.push({
      inventoryId: row.id,
      itemId: row.item_id,
      name: armor.name,
      currentSp,
      maxSp,
      missingSp,
      cost,
    });
  }
  return out.sort((a, b) => b.missingSp - a.missingSp);
}

export type DowntimeView = {
  day: number;
  /** The day bills are settled through right now, before any payment. */
  paidThrough: number;
  rates: LifestyleRates;
  bills: BillsDue;
  /** Days until the next month's costs come due. */
  daysToNextBill: number;
  eurobucks: number;
  hpCurrent: number;
  hpMax: number;
  body: number;
  /** Resting for the days the player has asked for. */
  rest: RestPlan;
  /** Resting all the way to full. */
  restToFull: RestPlan;
  repairs: RepairableArmor[];
  /** True when the character is whole and owes nothing — downtime is optional. */
  settled: boolean;
};

export function downtimeView(input: {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
  /** Days the player is considering resting. */
  restDays: number;
}): DowntimeView {
  const rates = lifestyleRates(input.character);
  const paidThrough = paidThroughDay(input.campaign, rates);
  const day = input.campaign.day ?? 0;
  const stats = input.character.stats as { body?: number } | null;
  const body = typeof stats?.body === "number" ? stats.body : 0;

  const restInput = {
    hpCurrent: input.vitals.hp_current,
    hpMax: input.vitals.hp_max,
    body,
  };
  const bills = billsDue({
    day,
    paidThroughDay: paidThrough,
    rent: rates.rent,
    lifestyleCost: rates.lifestyleCost,
  });
  const rest = planRest({ days: input.restDays, ...restInput });
  const restToFull = planRest({ days: Number.MAX_SAFE_INTEGER, ...restInput });
  const repairs = repairableArmor(input.inventory);

  return {
    day,
    paidThrough,
    rates,
    bills,
    daysToNextBill: Math.max(0, paidThrough + DOWNTIME_MONTH_DAYS - day),
    eurobucks: input.vitals.eurobucks,
    hpCurrent: input.vitals.hp_current,
    hpMax: input.vitals.hp_max,
    body,
    rest,
    restToFull,
    repairs,
    settled:
      input.vitals.hp_current >= input.vitals.hp_max && bills.total === 0 && repairs.length === 0,
  };
}

/**
 * What will be owed once those days of rest have passed.
 *
 * Rest is not free even when nobody charges for the bed: the month turns while
 * you are lying in it. Showing this next to the rest control is what makes
 * "rest to full" a decision rather than a button you always press.
 */
export function billsAfterResting(view: DowntimeView, days: number): BillsDue {
  return billsDue({
    day: view.day + Math.max(0, Math.trunc(days)),
    paidThroughDay: view.paidThrough,
    rent: view.rates.rent,
    lifestyleCost: view.rates.lifestyleCost,
  });
}
