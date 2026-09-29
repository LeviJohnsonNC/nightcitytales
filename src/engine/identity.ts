/**
 * Who a character is on sight: their sex and their age.
 *
 * The book prints neither as a mechanic, and this does not make them one. It is
 * a small record the narrator is handed, so that the first thing a stranger
 * assumes about a 71-year-old man is not the first thing they assume about a
 * 22-year-old woman. No die, DV or price reads it (`data/rules/identity.json`
 * is a house rule, flagged as one).
 *
 * It rides in the saved general Lifepath under `IDENTITY_KEY`, the way the cast
 * plan does, because `characters` has no column for it and a jsonb key needs no
 * migration.
 */
import data from "@/data/rules/identity.json";

export type Sex = "male" | "female";
export type Identity = { sex: Sex | null; age: number | null };

export const SEXES: Sex[] = ["male", "female"];
export const AGE_MIN: number = data.age.min;
export const AGE_MAX: number = data.age.max;

/** The key in the saved general Lifepath that carries this. */
export const IDENTITY_KEY = "identity";

export type AgeBand = { id: string; label: string };
const BANDS = data.bands as { id: string; from: number; label: string }[];

/** A typed age, or null when it is not a whole number inside the range. */
export function validAge(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n)) return null;
  return n >= AGE_MIN && n <= AGE_MAX ? n : null;
}

/** Which stage of life an age is, for the narrator and for nothing else. */
export function ageBand(age: number): AgeBand {
  let found = BANDS[0]!;
  for (const band of BANDS) if (age >= band.from) found = band;
  return { id: found.id, label: found.label };
}

export function sexLabel(sex: Sex): string {
  return data.sex[sex].label;
}

/** "he/him" or "she/her": the only pronouns the file now carries. */
export function pronounsFor(sex: Sex): string {
  return data.sex[sex].pronouns;
}

/** Sex as it was, from pronouns a draft saved before the file asked for it. */
export function sexFromPronouns(pronouns: string | null | undefined): Sex | null {
  const p = (pronouns ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (p === "she/her") return "female";
  if (p === "he/him") return "male";
  return null;
}

/** Read a stored identity back, or an empty one when there is none. */
export function readIdentity(value: unknown): Identity {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sex = v["sex"] === "male" || v["sex"] === "female" ? v["sex"] : null;
  return { sex, age: validAge(v["age"]) };
}

/**
 * The line the narrator reads: "man, 71, elderly". Null unless there is
 * something to say, so an older character with no record adds nothing.
 */
export function identityLine(identity: Identity): string | null {
  const parts: string[] = [];
  if (identity.sex) parts.push(data.sex[identity.sex].noun);
  if (identity.age !== null) parts.push(String(identity.age), ageBand(identity.age).label);
  return parts.length ? parts.join(", ") : null;
}
