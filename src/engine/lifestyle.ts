/**
 * Starting housing and lifestyle, read verbatim from
 * src/data/rules/creation-rules.json → startingLifestyle, housing[] and
 * lifestyles[]. Nothing here is inferred or hardcoded.
 */
import { CREATION_RULES } from "./rulesData";

export type HousingOption = {
  id: string;
  name: string;
  rent: number | null;
  buy: number | null;
  note?: string;
};

export type LifestyleOption = {
  id: string;
  name: string;
  monthlyCost: number;
  entails: string;
};

type ExecProvision = {
  applies: boolean;
  rule: string;
  housing: string;
  rent: number;
  rentNote: string;
  lifestyleStillPaid: boolean;
  lifestyleNote: string;
};

type StartingLifestyleRecord = {
  housing: string;
  location: string[];
  lifestyle: string;
  rent: number;
  rentPeriod: string;
  lifestyleCost: number;
  lifestyleCostPeriod: string;
  firstMonthFree: boolean;
  firstMonthNote: string;
  lifestyleFailureNote: string;
  execProvision: ExecProvision;
};

const RECORD = CREATION_RULES.startingLifestyle as unknown as StartingLifestyleRecord;

/** Every printed housing option. Only the starting one is selectable at creation. */
export const HOUSING_OPTIONS = CREATION_RULES.housing as unknown as HousingOption[];
/** Every printed Lifestyle. Only the starting one is selectable at creation. */
export const LIFESTYLE_OPTIONS = CREATION_RULES.lifestyles as unknown as LifestyleOption[];

function findHousing(name: string): HousingOption | undefined {
  return HOUSING_OPTIONS.find((h) => name.toLowerCase().includes(h.name.toLowerCase()));
}

function findLifestyle(name: string): LifestyleOption | undefined {
  return LIFESTYLE_OPTIONS.find((l) => l.name.toLowerCase() === name.toLowerCase());
}

export const STARTING_HOUSING = RECORD.housing;
export const STARTING_LIFESTYLE = RECORD.lifestyle;
export const STARTING_LOCATIONS: string[] = RECORD.location;
export const STARTING_RENT: number = RECORD.rent;
export const STARTING_RENT_PERIOD = RECORD.rentPeriod;
export const STARTING_LIFESTYLE_COST: number = RECORD.lifestyleCost;
export const STARTING_LIFESTYLE_COST_PERIOD = RECORD.lifestyleCostPeriod;
export const FIRST_MONTH_FREE: boolean = RECORD.firstMonthFree;
export const FIRST_MONTH_NOTE = RECORD.firstMonthNote;
export const LIFESTYLE_FAILURE_NOTE = RECORD.lifestyleFailureNote;
export const EXEC_PROVISION = RECORD.execProvision;

/** The Role whose Role Ability grants housing, per the exec provision in the rules file. */
const EXEC_ROLE_ID = "exec";

export type StartingLifestylePlan = {
  housingName: string;
  housingOption: HousingOption | undefined;
  rent: number;
  rentPeriod: string;
  rentNote: string | null;
  requiresLocation: boolean;
  locations: string[];
  lifestyleName: string;
  lifestyleOption: LifestyleOption | undefined;
  lifestyleCost: number;
  lifestyleCostPeriod: string;
  lifestyleNote: string | null;
  firstMonthFree: boolean;
  firstMonthNote: string;
  grantedByRoleAbility: boolean;
  grantRule: string | null;
};

/**
 * The starting housing/Lifestyle a Role receives. Execs get the Corporate Housing
 * their Teamwork Role Ability grants at Rank 2; everyone else rents.
 */
export function startingLifestylePlan(roleId: string | null): StartingLifestylePlan {
  const isExec = roleId === EXEC_ROLE_ID && EXEC_PROVISION.applies;
  const lifestyleOption = findLifestyle(RECORD.lifestyle);
  const base = {
    lifestyleName: lifestyleOption?.name ?? RECORD.lifestyle,
    lifestyleOption,
    lifestyleCost: lifestyleOption?.monthlyCost ?? RECORD.lifestyleCost,
    lifestyleCostPeriod: RECORD.lifestyleCostPeriod,
    firstMonthFree: RECORD.firstMonthFree,
    firstMonthNote: RECORD.firstMonthNote,
  };

  if (isExec) {
    const housingOption = findHousing(EXEC_PROVISION.housing);
    return {
      ...base,
      housingName: EXEC_PROVISION.housing,
      housingOption,
      rent: housingOption?.rent ?? EXEC_PROVISION.rent,
      rentPeriod: RECORD.rentPeriod,
      rentNote: EXEC_PROVISION.rentNote,
      requiresLocation: false,
      locations: [],
      lifestyleNote: EXEC_PROVISION.lifestyleStillPaid ? EXEC_PROVISION.lifestyleNote : null,
      grantedByRoleAbility: true,
      grantRule: EXEC_PROVISION.rule,
    };
  }

  return {
    ...base,
    housingName: RECORD.housing,
    housingOption: findHousing(RECORD.housing),
    rent: RECORD.rent,
    rentPeriod: RECORD.rentPeriod,
    rentNote: null,
    requiresLocation: true,
    locations: RECORD.location,
    lifestyleNote: null,
    grantedByRoleAbility: false,
    grantRule: null,
  };
}

/**
 * Where the character lives.
 *
 * `location` is the printed choice and the only part the rules speak to: one of
 * the two categories on Core p.109, or null for a Role that is given housing
 * instead of renting it. The other two say WHICH suburb and WHICH building,
 * which the rulebook does not ask for and does not forbid — picking Eagle Rock
 * Stadium is a way of being in the Overcrowded Suburbs, not an addition to it.
 * `startingHome.ts` owns what may go in them.
 */
export type LifestyleChoice = {
  /** A printed category, or null. Null for the Exec, who is given a conapt. */
  location: string | null;
  /** Atlas district key. */
  districtKey: string | null;
  /** Atlas location key: the actual building. */
  placeKey: string | null;
};

export const EMPTY_LIFESTYLE: LifestyleChoice = {
  location: null,
  districtKey: null,
  placeKey: null,
};

/**
 * Read a stored choice back.
 *
 * Tolerates the shape this used to have — a lone `location` string — because
 * characters and half-finished drafts were saved with it. Those come back as a
 * category with no address, which is what they are: the player is asked to
 * finish the choice rather than having one invented for them or being reset.
 */
export function readLifestyle(raw: unknown): LifestyleChoice {
  if (!raw || typeof raw !== "object") return EMPTY_LIFESTYLE;
  const value = raw as Partial<LifestyleChoice>;
  const text = (field: unknown): string | null =>
    typeof field === "string" && field ? field : null;
  return {
    location:
      typeof value.location === "string" && STARTING_LOCATIONS.includes(value.location)
        ? value.location
        : null,
    districtKey: text(value.districtKey),
    placeKey: text(value.placeKey),
  };
}

/**
 * What is still missing.
 *
 * The address is required, which is stricter than the rulebook and deliberately
 * so: the campaign starts the character at home, and "the Combat Zone" is not
 * somewhere anybody can be put. Whether the values name real ground is
 * `startingHome.ts`'s question, asked through `validateStartingHome`, so this
 * module keeps knowing only what the rules file prints.
 */
export function validateLifestyle(choice: LifestyleChoice, roleId: string | null = null): string[] {
  const plan = startingLifestylePlan(roleId);
  const violations: string[] = [];
  if (plan.requiresLocation && !choice.location) {
    violations.push(
      `Pick where your ${plan.housingName} is parked: ${plan.locations.join(" or ")}.`,
    );
  }
  if (!choice.districtKey) violations.push("Pick the district you live in.");
  if (!choice.placeKey) violations.push(`Pick the building your ${plan.housingName} is at.`);
  return violations;
}
