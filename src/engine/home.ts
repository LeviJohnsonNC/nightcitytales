/**
 * Moving house: where a character lives once the campaign has started.
 *
 * Creation puts every character somewhere — a rented Cargo Container, or the
 * Exec's Corporate Conapt — and `lifestyle.ts` reads that line of the book
 * verbatim. The book also prints every other rent and every Lifestyle
 * (creation-rules.json's `housing` and `lifestyles`), and then says nothing
 * about moving between them: not what it costs to get in, not how long it
 * takes, not which buildings rent which kind of home. `moving-house.json`
 * (`houseRule: true`) says those three things, and this module prices a move
 * with them.
 *
 * A move is a trade-off, not a reward. A better flat is a bigger deposit now
 * and a bigger bill every month for as long as the character stays; a cheaper
 * one is money back every month and a worse place to come home to. Neither
 * moves a die.
 *
 * Pure: the character's current home and purse in, a priced plan or the reason
 * there is none out. The feature layer writes it through `move_house`.
 */
import movingData from "@/data/rules/moving-house.json";
import { advanceClock } from "./clock";
import type { GameClock } from "./campaign";
import { billsDue } from "./downtime";
import { DISTRICTS, getPlace } from "./geography";
import {
  HOUSING_OPTIONS,
  LIFESTYLE_OPTIONS,
  startingLifestylePlan,
  type HousingOption,
  type LifestyleOption,
} from "./lifestyle";
import { placeProfile, type PlaceProfile } from "./places";

type HousingRule = {
  id: string;
  granted?: boolean;
  allOf: string[];
  noneOf: string[];
};

const DATA = movingData as unknown as {
  depositMonths: number;
  moveMinutes: number;
  housing: HousingRule[];
};

/** Months of the new rent paid up front to get the keys. */
export const MOVE_DEPOSIT_MONTHS: number = DATA.depositMonths;
/** How long a move takes on the clock. */
export const MOVE_MINUTES: number = DATA.moveMinutes;

/** Where somebody lives and what they eat, as ids into the printed tables. */
export type Home = {
  housingId: string;
  lifestyleId: string;
  /** Atlas location key of the building; null for a home with no address yet. */
  placeKey: string | null;
};

/** The home a character starts the campaign in, from what creation gave their Role. */
export function startingHomeOf(roleId: string | null, placeKey: string | null): Home {
  const plan = startingLifestylePlan(roleId);
  return {
    housingId: plan.housingOption?.id ?? "cargo_container",
    lifestyleId: plan.lifestyleOption?.id ?? "kibble",
    placeKey,
  };
}

export function housingById(id: string): HousingOption | undefined {
  return HOUSING_OPTIONS.find((h) => h.id === id);
}

export function lifestyleById(id: string): LifestyleOption | undefined {
  return LIFESTYLE_OPTIONS.find((l) => l.id === id);
}

/** Monthly rent and Lifestyle at a home, from the printed tables. */
export function homeRates(home: Home): { rent: number; lifestyleCost: number } {
  return {
    rent: Math.max(0, housingById(home.housingId)?.rent ?? 0),
    lifestyleCost: Math.max(0, lifestyleById(home.lifestyleId)?.monthlyCost ?? 0),
  };
}

/** Whether this Role is handed a granted kind of home (the Exec's conapt). */
function grantedTo(roleId: string | null, housingId: string): boolean {
  return startingLifestylePlan(roleId).housingOption?.id === housingId;
}

/** The kinds of home this character could move into, in printed order. */
export function housingChoices(roleId: string | null): HousingOption[] {
  return DATA.housing
    .filter((rule) => !rule.granted || grantedTo(roleId, rule.id))
    .map((rule) => housingById(rule.id))
    .filter((h): h is HousingOption => h !== undefined)
    .sort((a, b) => HOUSING_OPTIONS.indexOf(a) - HOUSING_OPTIONS.indexOf(b));
}

/** Every building that rents this kind of home. Empty for a kind not on the list. */
export function buildingsFor(housingId: string): PlaceProfile[] {
  const rule = DATA.housing.find((r) => r.id === housingId);
  if (!rule) return [];
  const out: PlaceProfile[] = [];
  for (const district of DISTRICTS) {
    for (const location of district.locations) {
      const profile = placeProfile(location.key);
      if (!profile) continue;
      const tags = profile.tags as string[];
      if (!rule.allOf.every((t) => tags.includes(t))) continue;
      if (rule.noneOf.some((t) => tags.includes(t))) continue;
      out.push(profile);
    }
  }
  return out;
}

export type MoveInput = {
  roleId: string | null;
  current: Home;
  target: Home;
  eurobucks: number;
  clock: GameClock;
  /** The day through which rent and Lifestyle are settled, free month applied. */
  paidThroughDay: number;
};

export type MovePlan = {
  /** True when the building or the kind of home changes; false for a new Lifestyle only. */
  moving: boolean;
  deposit: number;
  rentBefore: number;
  rentAfter: number;
  lifestyleBefore: number;
  lifestyleAfter: number;
  /** Monthly total before and after. */
  perMonthBefore: number;
  perMonthAfter: number;
  minutes: number;
  clockAfter: GameClock;
};

export type MoveVerdict = { ok: true; plan: MovePlan } | { ok: false; reason: string };

/**
 * What a move would cost, or why it cannot happen.
 *
 * Refused when nothing would change, when the kind of home is not one this
 * character can take, when the building does not rent it, when rent is owed
 * under the old roof, or when the deposit is more than they have.
 */
export function planMove(input: MoveInput): MoveVerdict {
  const { current, target } = input;
  const moving = target.housingId !== current.housingId || target.placeKey !== current.placeKey;
  if (!moving && target.lifestyleId === current.lifestyleId) {
    return { ok: false, reason: "That is where you live and what you eat already." };
  }
  if (!lifestyleById(target.lifestyleId)) {
    return { ok: false, reason: "That is not a Lifestyle anybody sells." };
  }
  if (moving) {
    const housing = housingById(target.housingId);
    if (!housing || !housingChoices(input.roleId).some((h) => h.id === target.housingId)) {
      return { ok: false, reason: "That is not a home on offer to you." };
    }
    if (!target.placeKey || !getPlace(target.placeKey)) {
      return { ok: false, reason: "Pick the building." };
    }
    if (!buildingsFor(target.housingId).some((p) => p.key === target.placeKey)) {
      return { ok: false, reason: `Nobody rents a ${housing.name} there.` };
    }
  }

  const before = homeRates(current);
  const after = homeRates(target);
  const owed = billsDue({
    day: input.clock.day,
    paidThroughDay: input.paidThroughDay,
    rent: before.rent,
    lifestyleCost: before.lifestyleCost,
  });
  if (owed.months > 0) {
    return { ok: false, reason: `Settle the ${owed.total}eb you owe where you are first.` };
  }

  const deposit = moving ? after.rent * MOVE_DEPOSIT_MONTHS : 0;
  if (deposit > input.eurobucks) {
    return { ok: false, reason: `The deposit is ${deposit}eb; you have ${input.eurobucks}eb.` };
  }
  const minutes = moving ? MOVE_MINUTES : 0;
  return {
    ok: true,
    plan: {
      moving,
      deposit,
      rentBefore: before.rent,
      rentAfter: after.rent,
      lifestyleBefore: before.lifestyleCost,
      lifestyleAfter: after.lifestyleCost,
      perMonthBefore: before.rent + before.lifestyleCost,
      perMonthAfter: after.rent + after.lifestyleCost,
      minutes,
      clockAfter: advanceClock(input.clock, minutes),
    },
  };
}
