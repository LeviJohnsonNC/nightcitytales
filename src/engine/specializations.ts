/**
 * The names a specialised Skill can be raised under.
 *
 * Language, Science, Martial Arts and Play Instrument each make the player name
 * a thing, and a text box for it invites "Frnch", "french" and "French" as three
 * different Skills. This is the pick-list: Language from the Cultural Origin
 * tables the Lifepath already uses, the rest from
 * `data/rules/skill-specializations.json`. It is only ever a list of
 * suggestions — the picker keeps an "Other" entry, and validation accepts any
 * non-empty name — so it narrows the common case without restricting anyone.
 *
 * Local Expert is not here: it takes a district the map can resolve, which is
 * `localExpert.ts`'s business.
 */
import specializations from "@/data/rules/skill-specializations.json";
import { LIFEPATH_GENERAL } from "./rulesData";

const LISTED = specializations.options as Record<string, string[]>;

function languages(): string[] {
  const names = new Set<string>(specializations.extraLanguages);
  const entries = (
    LIFEPATH_GENERAL as unknown as {
      tables: Record<string, { entries?: { languages?: string[] }[] }>;
    }
  ).tables?.["cultural_origin"]?.entries;
  for (const entry of entries ?? []) for (const name of entry.languages ?? []) names.add(name);
  return [...names].sort((a, b) => a.localeCompare(b));
}

const LANGUAGES = languages();

/** The common names for a specialised Skill, or null when it takes none from a list. */
export function specializationOptions(skillId: string): readonly string[] | null {
  if (skillId === "language") return LANGUAGES;
  return LISTED[skillId] ?? null;
}
