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

/** The Skills a Medtech's own training is measured by, for self-care. */
export const SELF_CARE_SKILLS: string[] = RECOVERY_RULES.medtechSelfCare.skillIds;

/**
 * The standing bonus somebody who does medicine for a living gets on their own
 * wounds, in HP a day.
 *
 * A house rule, and a small one on purpose — see medtechSelfCare._provenance in
 * recovery.json. The printed way a Medtech recovers faster is the drugs they
 * synthesize, which are modelled as printed; this is what they have on the days
 * the bag is empty. It is capped well below BODY so the printed rate stays the
 * rate, and it is zero for everybody without the Skill, which is everybody who
 * is not a Medtech.
 */
export function selfCareBonus(skillLevel: number): number {
  const rule = RECOVERY_RULES.medtechSelfCare;
  const level = Math.max(0, Math.trunc(skillLevel));
  const per = Math.max(1, rule.hpPerDayPerSkillLevels);
  return Math.min(rule.maxBonusHpPerDay, Math.floor(level / per));
}

/**
 * A course of something taken over the days of a rest.
 *
 * Antibiotic is the printed case: +2 HP a day for a week, one at a time. It is
 * a COURSE rather than a rate because it runs out — a fortnight in bed on one
 * course is seven better days and seven ordinary ones — and a bonus with no end
 * would quietly turn one dose into unlimited healing.
 */
export type HealingCourse = {
  hpPerDay: number;
  /** How many days of the rest the course covers. */
  days: number;
};

/** Days in a month, for charging monthly costs against a day counter. */
export const DOWNTIME_MONTH_DAYS: number = RECOVERY_RULES.month.days;

export type RestInput = {
  days: number;
  hpCurrent: number;
  hpMax: number;
  body: number;
  /** Standing HP a day beyond BODY — a Medtech's self-care. Zero for everyone else. */
  perDayBonus?: number;
  /** A course running through this rest, when one has been started. */
  course?: HealingCourse | null;
};

export type RestPlan = {
  /** Days actually spent — never more than the wound needs. */
  days: number;
  hpHealed: number;
  hpAfter: number;
  /** Days it would take to reach full HP from here. */
  daysToFull: number;
  /** HP a day this character recovers: BODY plus any standing bonus. */
  perDay: number;
  /** HP a day while a course is still running, when one is. */
  perDayOnCourse: number;
  /** Days of this rest the course actually covered. */
  courseDays: number;
};

/**
 * What resting for a stretch of days does.
 *
 * Rest is capped at what the injury needs: a character who is two days from
 * whole cannot burn a week of rent lying in bed for no gain. Someone already at
 * full HP rests zero days no matter what they asked for.
 *
 * A course runs out partway through a long rest, so the sum is the course days
 * at the better rate and the rest at the ordinary one — which is also why
 * `daysToFull` has to be worked out day by day rather than by division.
 */
export function planRest(input: RestInput): RestPlan {
  const perDay = healingPerDay(input.body) + Math.max(0, Math.trunc(input.perDayBonus ?? 0));
  const courseDaysAvailable = Math.max(0, Math.trunc(input.course?.days ?? 0));
  const coursePerDay = perDay + Math.max(0, Math.trunc(input.course?.hpPerDay ?? 0));
  const missing = Math.max(0, input.hpMax - input.hpCurrent);

  /** HP recovered over `days`, with the course spent first. */
  const healedOver = (days: number): number => {
    const onCourse = Math.min(days, courseDaysAvailable);
    return onCourse * coursePerDay + (days - onCourse) * perDay;
  };

  // Day by day, because the rate changes when the course runs out. Bounded by
  // the injury: nothing here can run away, and a rate of zero stops at once.
  let daysToFull = 0;
  if (perDay > 0 || coursePerDay > 0) {
    while (healedOver(daysToFull) < missing) {
      daysToFull += 1;
      // A course that heals nothing and a BODY of zero would never converge.
      if (daysToFull > courseDaysAvailable && perDay <= 0) {
        daysToFull = courseDaysAvailable;
        break;
      }
    }
  }

  const days = Math.max(0, Math.min(Math.trunc(input.days), daysToFull));
  const hpHealed = Math.min(missing, healedOver(days));
  return {
    days,
    hpHealed,
    hpAfter: input.hpCurrent + hpHealed,
    daysToFull,
    perDay,
    perDayOnCourse: coursePerDay,
    courseDays: Math.min(days, courseDaysAvailable),
  };
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
