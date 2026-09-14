/**
 * A Tech building a thing.
 *
 * Fabrication Expertise is the half of Maker that makes a Tech a Tech: "Build
 * an existing or self-invented item from materials. Roll TECH + the item's
 * usual repair Skill + this Rank + 1d10; buy materials one price category below
 * the item. DV and time scale with price category; a failure means starting
 * over with materials intact."
 *
 * Every one of those numbers was already in the repository and none of them had
 * a consumer. `priceCategory.ts` has been parsing the Maker DV-and-time table
 * out of the Tech's own rules text since it was written, for nobody; the price
 * ladder that says what materials cost went in with the Fixer's Reach. This
 * module is the arithmetic that joins them, and it is the whole rule:
 *
 *  - WHAT IT COSTS is the category below, so a Tech turns 100eb of parts into a
 *    500eb weapon. That is the fantasy, and it is printed.
 *  - WHAT IT COSTS YOU is time. A week at the bench is a week of rent, and the
 *    calendar is what makes building a decision rather than a discount.
 *  - A FAILURE COSTS THE TIME AND NOT THE MATERIALS. The rules are explicit,
 *    and it is the better rule: the loss is the fortnight, which the player
 *    feels, rather than the parts, which are a number going down.
 *
 * Invention Expertise is deliberately absent. It requires the GM to approve a
 * new item and set its rules and Price Category — an AI authoring mechanical
 * values, which is the one thing this architecture does not do. Upgrade
 * Expertise is absent for a duller reason: it modifies an item that already
 * exists, and per-row modifications are not modelled anywhere yet.
 *
 * Pure TypeScript: a catalog id in, a plan out. It rolls only when handed an
 * RNG and it writes nothing.
 */
import catalogData from "@/data/rules/catalog.json";
import { itemCost, itemName, type ItemKind } from "./catalog";
import { defaultRng, type CheckResult } from "./dice";
import { MINUTES_PER_DAY } from "./clock";
import { PRICE_CATEGORY_LADDER, priceCategoryContext, priceCategoryForCost } from "./priceCategory";
import { DOWNTIME_MONTH_DAYS } from "./downtime";
import { resolveSkillCheck } from "./skillCheck";
import type { RNG } from "./types";

const REPAIR_SKILLS = (
  catalogData as unknown as {
    _rules: { repairSkills: { byKind: Record<string, string>; byItem: Record<string, string> } };
  }
)._rules.repairSkills;

/**
 * The kinds a Tech can build.
 *
 * Cyberware is excluded and not for a rules reason: an implant is only useful
 * once a ripperdoc has installed it, and the install scene prices and schedules
 * a PURCHASE. Handing it an implant that was never bought is a different
 * feature. Fashion is bought as a Lifestyle rather than owned as an item.
 */
export const FABRICABLE_KINDS: ItemKind[] = ["weapon", "armor", "ammunition", "gear"];

export function canFabricate(kind: ItemKind): boolean {
  return FABRICABLE_KINDS.includes(kind);
}

/** The Skill that repairs — and therefore builds — this kind of item. */
export function repairSkillFor(kind: ItemKind, itemId: string): string {
  return REPAIR_SKILLS.byItem[itemId] ?? REPAIR_SKILLS.byKind[kind] ?? "basic_tech";
}

// ---------------------------------------------------------------------------
// Time.
// ---------------------------------------------------------------------------

/**
 * The Maker table's time column, in minutes.
 *
 * The strings come from the rules text ("1 hour", "6 hours", "1 day", "1 week",
 * "2 weeks", "1 month", "1 month per 10,000eb of Cost") and are parsed rather
 * than restated, so the table stays the one in roles.json. A month is the
 * project's own 30 days, the same length rent is charged against.
 */
const UNIT_MINUTES: Record<string, number> = {
  hour: 60,
  day: MINUTES_PER_DAY,
  week: 7 * MINUTES_PER_DAY,
  month: DOWNTIME_MONTH_DAYS * MINUTES_PER_DAY,
};

/** Eurobucks of Cost per repetition, for the Super Luxury "per 10,000eb" row. */
function perCostStep(time: string): number | null {
  const match = /per\s+([\d,]+)\s*eb/i.exec(time);
  if (!match) return null;
  const value = Number((match[1] ?? "").replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function makerTimeMinutes(time: string, itemPrice: number): number {
  const match = /(\d+)\s*(hour|day|week|month)/i.exec(time);
  if (!match) return 0;
  const unit = UNIT_MINUTES[(match[2] ?? "").toLowerCase()] ?? 0;
  const base = Number(match[1] ?? 0) * unit;
  const step = perCostStep(time);
  if (step === null) return base;
  // "1 month per 10,000eb of Cost": the row repeats, and a part-step still
  // costs its whole month — you do not build three quarters of a thing.
  return base * Math.max(1, Math.ceil(Math.max(0, itemPrice) / step));
}

/** "1 week", "3 days", "5 hours" — the plan's own duration, read back. */
export function describeDuration(minutes: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const monthMinutes = UNIT_MINUTES["month"] ?? 0;
  if (monthMinutes > 0 && minutes >= monthMinutes && minutes % monthMinutes === 0) {
    return plural(minutes / monthMinutes, "month");
  }
  if (minutes >= 7 * MINUTES_PER_DAY && minutes % (7 * MINUTES_PER_DAY) === 0) {
    return plural(minutes / (7 * MINUTES_PER_DAY), "week");
  }
  if (minutes >= MINUTES_PER_DAY) return plural(Math.round(minutes / MINUTES_PER_DAY), "day");
  return plural(Math.round(minutes / 60), "hour");
}

// ---------------------------------------------------------------------------
// Materials.
// ---------------------------------------------------------------------------

/** The category one rung below this one, or null at the bottom of the ladder. */
export function categoryBelow(category: string): string | null {
  const index = PRICE_CATEGORY_LADDER.findIndex(
    (label) => label.toLowerCase() === category.toLowerCase(),
  );
  return index > 0 ? (PRICE_CATEGORY_LADDER[index - 1] ?? null) : null;
}

/** What a category of materials costs: the top of that band on the cost ladder. */
export function categoryCost(category: string): number | null {
  // The ladder is defined by its boundaries, so the cost OF a category is the
  // most an item in it can cost — which is what "materials of category X" means
  // when you go and buy some.
  for (const price of [10, 20, 50, 100, 500, 1000, 5000, 10000]) {
    if (priceCategoryForCost(price)?.toLowerCase() === category.toLowerCase()) return price;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The plan.
// ---------------------------------------------------------------------------

export type FabricationPlan = {
  kind: ItemKind;
  itemId: string;
  itemName: string;
  /** What the thing would cost to simply buy, at catalog price. */
  itemPrice: number;
  /** The item's own price category. */
  category: string;
  /** The category of materials the build consumes, one rung below. */
  materialsCategory: string;
  materialsCost: number;
  /** The Maker table's DV for this category. */
  dv: number;
  /** The Maker table's time, as printed and in minutes. */
  timeLabel: string;
  minutes: number;
  /** The Skill the roll is made with. */
  skillId: string;
};

/**
 * What building this item would take, or null when the catalog or the ladder
 * cannot answer — which is the honest result for an item with no price category
 * rather than a guessed DV.
 */
export function planFabrication(kind: ItemKind, itemId: string): FabricationPlan | null {
  if (!canFabricate(kind)) return null;
  let itemPrice: number;
  try {
    itemPrice = itemCost(kind, itemId);
  } catch {
    return null;
  }
  const category = priceCategoryForCost(itemPrice);
  const context = priceCategoryContext(category);
  if (!category || !context) return null;

  // "buy materials one price category below the item (Super Luxury items need
  // materials worth half their Price)". Cheap is the bottom of the ladder and
  // has no rung below it, so the cheapest things cost their own category in
  // parts rather than nothing — free is not a price.
  const materialsCategory = categoryBelow(category) ?? category;
  const materialsCost =
    category.toLowerCase() === "super luxury"
      ? Math.ceil(itemPrice / 2)
      : (categoryCost(materialsCategory) ?? itemPrice);

  return {
    kind,
    itemId,
    itemName: itemName(kind, itemId),
    itemPrice,
    category: context.label,
    materialsCategory,
    materialsCost,
    dv: context.techDV,
    timeLabel: context.techTime,
    minutes: makerTimeMinutes(context.techTime, itemPrice),
    skillId: repairSkillFor(kind, itemId),
  };
}

// ---------------------------------------------------------------------------
// The roll.
// ---------------------------------------------------------------------------

export type FabricationResult = CheckResult & {
  plan: FabricationPlan;
  built: boolean;
};

/**
 * Roll the build: TECH + the repair Skill + the Fabrication Expertise Rank
 * + 1d10 against the table's DV.
 *
 * The STAT and the Skill Level are passed in rather than looked up, because the
 * caller is the layer holding the live sheet — the same division every other
 * check in the engine makes.
 */
export function rollFabrication(
  input: {
    plan: FabricationPlan;
    /** The character's TECH. */
    tech: number;
    /** Their Level in the item's repair Skill. */
    skillLevel: number;
    /** Their Fabrication Expertise Rank, which rides on the roll as printed. */
    specialtyRank: number;
    /** Anything else the caller has already worked out (wounds, Luck). */
    modifiers?: { label: string; value: number }[];
  },
  rng: RNG = defaultRng,
): FabricationResult {
  const rank = Math.max(0, Math.trunc(input.specialtyRank));
  const result = resolveSkillCheck(
    {
      statLabel: "TECH",
      statValue: Math.max(0, Math.trunc(input.tech)),
      skillLabel: "Repair",
      skillValue: Math.max(0, Math.trunc(input.skillLevel)),
      dv: input.plan.dv,
      modifiers: [
        ...(rank > 0 ? [{ label: "Fabrication Expertise", value: rank }] : []),
        ...(input.modifiers ?? []),
      ],
    },
    rng,
  );
  return { ...result, plan: input.plan, built: result.success === true };
}
