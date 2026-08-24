/**
 * Downtime — the half of a session that happens after the shooting.
 *
 * At a table the job does not end when the last hostile drops: you patch up,
 * count the take, pay the landlord, and buy the thing that would have saved you
 * this time. All of that costs days, and days are why healing is a decision:
 * a character who rests until they are whole pays a month's rent doing it.
 *
 * Pure arithmetic over the rules data, like the rest of the engine. Nothing here
 * reads or writes the campaign; the feature layer applies what these functions
 * return. The rules values come from recovery.json and creation-rules.json —
 * including which of them are transcribed and which are this app's own, which
 * that file states plainly.
 */
import { RECOVERY_RULES } from "./rulesData";
import { itemCost, type ItemKind } from "./catalog";

/** HP recovered per full day of rest: the character's BODY. */
export function healingPerDay(body: number): number {
  return Math.max(0, Math.trunc(body));
}

/** Days in a month, for charging monthly costs against a day counter. */
export const DOWNTIME_MONTH_DAYS: number = RECOVERY_RULES.month.days;

export type RestInput = {
  days: number;
  hpCurrent: number;
  hpMax: number;
  body: number;
};

export type RestPlan = {
  /** Days actually spent — never more than the wound needs. */
  days: number;
  hpHealed: number;
  hpAfter: number;
  /** Days it would take to reach full HP from here. */
  daysToFull: number;
};

/**
 * What resting for a stretch of days does.
 *
 * Rest is capped at what the injury needs: a character who is two days from
 * whole cannot burn a week of rent lying in bed for no gain. Someone already at
 * full HP rests zero days no matter what they asked for.
 */
export function planRest(input: RestInput): RestPlan {
  const perDay = healingPerDay(input.body);
  const missing = Math.max(0, input.hpMax - input.hpCurrent);
  const daysToFull = perDay > 0 ? Math.ceil(missing / perDay) : 0;
  const days = Math.max(0, Math.min(Math.trunc(input.days), daysToFull));
  const hpHealed = Math.min(missing, days * perDay);
  return { days, hpHealed, hpAfter: input.hpCurrent + hpHealed, daysToFull };
}

export type BillsInput = {
  /** The campaign's current day counter. */
  day: number;
  /** The day through which rent and Lifestyle are already settled. */
  paidThroughDay: number;
  /** Monthly rent for the character's housing. */
  rent: number;
  /** Monthly cost of the character's Lifestyle. */
  lifestyleCost: number;
};

export type BillsDue = {
  /** Whole months that have come due since the last payment. */
  months: number;
  rent: number;
  lifestyle: number;
  total: number;
  /** The day through which paying would settle things. */
  paidThroughDay: number;
};

/**
 * What the landlord and the food are owed right now.
 *
 * Costs are printed per month, so a day counter is charged a month at a time:
 * nothing is owed until a full month has passed, and then the whole month is.
 */
export function billsDue(input: BillsInput): BillsDue {
  const elapsed = Math.max(0, input.day - input.paidThroughDay);
  const months = Math.floor(elapsed / DOWNTIME_MONTH_DAYS);
  const rent = months * Math.max(0, input.rent);
  const lifestyle = months * Math.max(0, input.lifestyleCost);
  return {
    months,
    rent,
    lifestyle,
    total: rent + lifestyle,
    paidThroughDay: input.paidThroughDay + months * DOWNTIME_MONTH_DAYS,
  };
}

/** Whether the take covers what is owed. */
export function canAfford(eurobucks: number, cost: number): boolean {
  return cost <= eurobucks;
}

export type ArmorRepair = {
  /** SP the piece is missing. */
  missingSp: number;
  cost: number;
};

/**
 * What patching a chewed-up piece of armor costs.
 *
 * The fraction is this app's own — see armorRepair._provenance in recovery.json.
 * Repairing to a higher SP than the piece was printed with is not a thing, so
 * the missing points are measured against its own rating.
 */
export function armorRepairCost(input: {
  kind: ItemKind;
  itemId: string;
  currentSp: number;
  maxSp: number;
}): ArmorRepair {
  const missingSp = Math.max(0, Math.trunc(input.maxSp) - Math.trunc(input.currentSp));
  if (missingSp === 0) return { missingSp: 0, cost: 0 };
  const price = itemCost(input.kind, input.itemId);
  const perPoint = price * RECOVERY_RULES.armorRepair.costPerMissingSpFraction;
  return { missingSp, cost: Math.ceil(missingSp * perPoint) };
}

/** The eurobuck cost of a purchase, at catalog price. */
export function purchaseCost(kind: ItemKind, itemId: string, quantity: number): number {
  return itemCost(kind, itemId) * Math.max(0, Math.trunc(quantity));
}
