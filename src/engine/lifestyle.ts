/**
 * Starting housing and lifestyle, read verbatim from
 * src/data/rules/creation-rules.json → startingLifestyle. Nothing here is
 * inferred: fields the file does not carry resolve to null so the UI can show
 * a visible TODO instead of a made-up number.
 */
import { CREATION_RULES } from "./rulesData";

type StartingLifestyleRecord = {
  housing: string;
  location: string[];
  lifestyle: string;
  rent?: number | null;
  _UNRESOLVED?: string;
};

const RECORD = CREATION_RULES.startingLifestyle as unknown as StartingLifestyleRecord;

export const STARTING_HOUSING = RECORD.housing;
export const STARTING_LIFESTYLE = RECORD.lifestyle;
export const STARTING_LOCATIONS: string[] = RECORD.location;

/**
 * Rent is NOT present in creation-rules.json → startingLifestyle. It stays null
 * until the field is extracted; callers must surface that, never invent a value.
 */
export const STARTING_RENT: number | null = RECORD.rent ?? null;

export const STARTING_LIFESTYLE_UNRESOLVED: string | null = RECORD._UNRESOLVED ?? null;

export type LifestyleChoice = { location: string | null };

export const EMPTY_LIFESTYLE: LifestyleChoice = { location: null };

export function readLifestyle(raw: unknown): LifestyleChoice {
  if (!raw || typeof raw !== "object") return EMPTY_LIFESTYLE;
  const value = (raw as LifestyleChoice).location;
  return { location: typeof value === "string" && STARTING_LOCATIONS.includes(value) ? value : null };
}

export function validateLifestyle(choice: LifestyleChoice): string[] {
  if (!choice.location) {
    return [
      `Pick where your ${STARTING_HOUSING} is parked: ${STARTING_LOCATIONS.join(" or ")}.`,
    ];
  }
  return [];
}