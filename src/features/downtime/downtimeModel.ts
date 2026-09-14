/**
 * What downtime looks like for one campaign, as plain data.
 *
 * Pure: it reads the campaign, the sheet and the kit, and says what resting
 * would do, what is owed, and what is worth repairing. Nothing here writes —
 * useDowntime applies it. Every number comes from the engine.
 */
import {
  DOWNTIME_MONTH_DAYS,
  MEDICAL_DRUGS,
  SELF_CARE_SKILLS,
  armorRepairCost,
  billsDue,
  getArmor,
  planRest,
  selfCareBonus,
  speedhealAmount,
  startingLifestylePlan,
  type BillsDue,
  type HealingCourse,
  type MedicalDrug,
  type RestPlan,
} from "@/engine";
import { liveRoleAbility, medicineDoses, medicineSkills } from "@/features/play/roleAbilityModel";
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

/** The printed drug with this id, or null when the rules data has no such drug. */
export function medicalDrug(id: string): MedicalDrug | null {
  return MEDICAL_DRUGS.find((drug) => drug.id === id) ?? null;
}

/**
 * What the character's own medicine does for their recovery.
 *
 * Null for everybody who is not a Medtech, which is what keeps this off every
 * other Role's downtime entirely. For a Medtech it is three things: the small
 * standing self-care bonus (a house rule, flagged in recovery.json), and the
 * two printed drugs they can have synthesized — Antibiotic, which is a course
 * run through a rest, and Speedheal, which is taken now.
 */
export type MedicalCare = {
  /** The better of Surgery and Medical Tech, as their Specialty points set it. */
  skillLevel: number;
  /** Standing HP a day beyond BODY. */
  selfCare: number;
  /** Doses of each drug on hand, by drug id. */
  doses: Record<string, number>;
  /** The Antibiotic course a dose would start, when one is on hand. */
  antibiotic: (HealingCourse & { drug: MedicalDrug }) | null;
  /** What a Speedheal dose would restore right now, when one is on hand. */
  speedheal: { hp: number; drug: MedicalDrug } | null;
};

export function medicalCare(input: {
  campaign: Campaign;
  character: FullCharacter;
}): MedicalCare | null {
  const ability = liveRoleAbility(input.character);
  if (!ability || ability.info.abilityId !== "medicine") return null;

  const skills = medicineSkills(input.campaign);
  const skillLevel = Math.max(...SELF_CARE_SKILLS.map((id) => skills[id] ?? 0), 0);
  const doses = medicineDoses(input.campaign);
  const stats = input.character.stats as { body?: number; will?: number } | null;

  const antibioticDrug = medicalDrug("antibiotic");
  const speedhealDrug = medicalDrug("speedheal");
  return {
    skillLevel,
    selfCare: selfCareBonus(skillLevel),
    doses,
    antibiotic:
      antibioticDrug && (doses["antibiotic"] ?? 0) > 0
        ? {
            drug: antibioticDrug,
            hpPerDay: antibioticDrug.hpPerDayBonus ?? 0,
            days: antibioticDrug.days ?? 0,
          }
        : null,
    speedheal:
      speedhealDrug && (doses["speedheal"] ?? 0) > 0
        ? { drug: speedhealDrug, hp: speedhealAmount(stats ?? {}) }
        : null,
  };
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
  /** What this character's own medicine buys them, or null for every other Role. */
  care: MedicalCare | null;
  /** Resting for the days the player has asked for. */
  rest: RestPlan;
  /** Resting all the way to full. */
  restToFull: RestPlan;
  /** The same rest with an Antibiotic course started, when a dose is on hand. */
  restOnAntibiotic: RestPlan | null;
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

  // A Medtech's own training and their own drugs. Null for every other Role,
  // and a zero bonus is what every other Role's rest has always been.
  const care = medicalCare({ campaign: input.campaign, character: input.character });
  const restInput = {
    hpCurrent: input.vitals.hp_current,
    hpMax: input.vitals.hp_max,
    body,
    perDayBonus: care?.selfCare ?? 0,
  };
  const bills = billsDue({
    day,
    paidThroughDay: paidThrough,
    rent: rates.rent,
    lifestyleCost: rates.lifestyleCost,
  });
  const rest = planRest({ days: input.restDays, ...restInput });
  const restToFull = planRest({ days: Number.MAX_SAFE_INTEGER, ...restInput });
  const restOnAntibiotic = care?.antibiotic
    ? planRest({ days: input.restDays, ...restInput, course: care.antibiotic })
    : null;
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
    care,
    rest,
    restToFull,
    restOnAntibiotic,
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
