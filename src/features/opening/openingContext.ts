/**
 * The facts the cold open is written from.
 *
 * Everything here already exists: the character's sheet, their Lifepath, the
 * building they live in, the neighbourhood around it, what they owe, and the
 * six people the campaign seeded. Nothing is generated to make the prompt
 * richer, and nothing the model is not allowed to change is sent as a number
 * it could restate — money reaches it as a BAND, because the style guide's
 * hardest rule is that numbers belong to the engine.
 *
 * Pure. No React, no network, no writes.
 */
import {
  billsDue,
  districtOfPlace,
  getCyberware,
  getPlace,
  roleAffordance,
  type CastMember,
} from "@/engine";
import { lifestyleRates, paidThroughDay } from "@/features/downtime/downtimeModel";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";

/**
 * How the money feels, rather than what it is.
 *
 * The model must never print a eurobuck figure it was handed, and the surest
 * way to stop it is to never hand it one. A band is also what the character
 * actually knows at a glance.
 */
export type MoneyBand = "desperate" | "thin" | "comfortable" | "flush";

export function moneyBand(eurobucks: number, perMonth: number): MoneyBand {
  if (perMonth <= 0) return eurobucks < 500 ? "thin" : "comfortable";
  const months = eurobucks / perMonth;
  if (months < 0.5) return "desperate";
  if (months < 1.5) return "thin";
  if (months < 4) return "comfortable";
  return "flush";
}

const BAND_MEANING: Record<MoneyBand, string> = {
  desperate: "cannot cover this month. Something has to give, soon.",
  thin: "can cover about a month and no more. No cushion at all.",
  comfortable: "has a few months of breathing room. Not rich, not frightened.",
  flush: "is doing genuinely well by Night City standards, which never lasts.",
};

export type OpeningFacts = {
  name: string;
  handle: string | null;
  role: string | null;
  roleAbility: string | null;
  /** The building they actually live in, and the neighbourhood around it. */
  home: { name: string; blurb: string } | null;
  district: { name: string; blurb: string; security: string; gangs: string[] } | null;
  housing: string;
  lifestyle: string;
  money: { band: MoneyBand; meaning: string; behind: boolean };
  /** Wounds, only when there are any. A fresh character has none. */
  condition: string | null;
  lifepath: {
    facts: { label: string; value: string }[];
    lifeGoal: string | null;
    friends: string[];
    enemies: { who: string | null; cause: string | null; throwAtYou: string | null }[];
    tragicLove: string | null;
    language: string | null;
  };
  /** Who they already know, so a door can point at a real name. */
  people: { name: string; role: string; standing: string; tie: string | null }[];
  /**
   * Chrome, by name. Gear is deliberately not sent: a pistol in a drawer is a
   * prop, and chrome is on the body, cost Humanity to get, and shows.
   */
  cyberware: string[];
  hour: string;
  /**
   * What this Role reaches for, from `role-affordances.json` — the same house
   * rule the narrator's own context uses. Only the "role_action" door needs it,
   * but it costs nothing to hand to the model unconditionally: it is written
   * for exactly this purpose (a shape of move only this Role thinks of first,
   * never a line to read back verbatim), and it is null for a Role the data
   * does not know rather than missing the field entirely.
   */
  roleReach: { reach: string; options: string[] } | null;
};

function entryText(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as { value?: unknown; custom?: unknown };
  if (typeof entry.value === "string" && entry.value.trim()) return entry.value.trim();
  if (typeof entry.custom === "string" && entry.custom.trim()) return entry.custom.trim();
  return null;
}

/** The single-answer Lifepath tables, as label/value pairs the model can use. */
function lifepathFacts(character: FullCharacter): { label: string; value: string }[] {
  const general = (character.lifepath?.general ?? {}) as { entries?: unknown };
  const entries = general.entries;
  if (!entries || typeof entries !== "object") return [];
  const out: { label: string; value: string }[] = [];
  for (const [id, raw] of Object.entries(entries as Record<string, unknown>)) {
    const value = entryText(raw);
    if (!value) continue;
    out.push({ label: id.replace(/_/g, " "), value });
  }
  return out;
}

function lifepathTies(character: FullCharacter) {
  const general = (character.lifepath?.general ?? {}) as {
    friends?: unknown;
    enemies?: unknown;
    tragicLove?: unknown;
    language?: unknown;
  };
  const friends = Array.isArray(general.friends)
    ? general.friends.map(entryText).filter((v): v is string => v !== null)
    : [];
  const enemies = Array.isArray(general.enemies)
    ? general.enemies.map((raw) => {
        const record = (raw ?? {}) as { who?: unknown; cause?: unknown; throwAtYou?: unknown };
        return {
          who: entryText(record.who),
          cause: entryText(record.cause),
          throwAtYou: entryText(record.throwAtYou),
        };
      })
    : [];
  const loves = Array.isArray(general.tragicLove)
    ? general.tragicLove.map(entryText).filter((v): v is string => v !== null)
    : [];
  return {
    friends,
    enemies,
    tragicLove: loves[0] ?? null,
    language: entryText(general.language),
  };
}

/** Installed chrome, by its printed name. An id the catalog disowns is skipped. */
function cyberwareNames(character: FullCharacter): string[] {
  const names: string[] = [];
  for (const row of character.cyberware.slice(0, 8)) {
    try {
      names.push(getCyberware(row.item_id).name);
    } catch {
      // A piece the catalog no longer knows is not worth failing the opening for.
    }
  }
  return names;
}

/** Roughly what time it is, in words. The engine owns the clock. */
export function hourWords(minute: number): string {
  const hour = Math.floor((((minute % 1440) + 1440) % 1440) / 60);
  if (hour < 4) return "the small hours";
  if (hour < 7) return "just before dawn";
  if (hour < 11) return "morning";
  if (hour < 14) return "the middle of the day";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "evening";
  return "late evening";
}

export function buildOpeningFacts(input: {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  cast: CastMember[];
}): OpeningFacts {
  const { campaign, vitals, character } = input;
  const rates = lifestyleRates(character);
  const bills = billsDue({
    day: campaign.day ?? 0,
    paidThroughDay: paidThroughDay(campaign, rates),
    rent: rates.rent,
    lifestyleCost: rates.lifestyleCost,
  });
  const band = moneyBand(vitals.eurobucks, rates.perMonth);

  const homeKey = character.finance?.home_place_key ?? campaign.location_key ?? null;
  const place = homeKey ? getPlace(homeKey) : undefined;
  const district = homeKey ? districtOfPlace(homeKey) : undefined;
  const ties = lifepathTies(character);
  const affordance = roleAffordance(character.character.role);

  return {
    name: character.character.name,
    handle: character.character.handle?.trim() || null,
    role: character.character.role ?? null,
    roleAbility: character.roleAbility?.ability_id?.replace(/_/g, " ") ?? null,
    home: place ? { name: place.name, blurb: place.blurb } : null,
    district: district
      ? {
          name: district.name,
          blurb: district.blurb,
          security: district.security,
          gangs: district.gangs,
        }
      : null,
    housing: rates.housingName,
    lifestyle: rates.lifestyleName,
    money: { band, meaning: BAND_MEANING[band], behind: bills.total > 0 },
    condition: vitals.hp_current < vitals.hp_max ? `carrying an injury that has not healed` : null,
    lifepath: {
      facts: lifepathFacts(character),
      lifeGoal: null,
      friends: ties.friends,
      enemies: ties.enemies,
      tragicLove: ties.tragicLove,
      language: ties.language,
    },
    people: input.cast.map((member) => ({
      name: member.name,
      role: member.role,
      standing: member.standing,
      tie: member.tie,
    })),
    cyberware: cyberwareNames(character),
    hour: hourWords(campaign.minute ?? 0),
    roleReach: affordance ? { reach: affordance.reach, options: affordance.options } : null,
  };
}

/**
 * The facts as the model receives them.
 *
 * JSON rather than prose on purpose: a fact list the model has to read as
 * English is a fact list it starts paraphrasing. The instruction half lives in
 * openingPrompt.ts and is applied server-side, so the browser cannot choose
 * what the model is told to be.
 */
export function renderOpeningPrompt(facts: OpeningFacts): string {
  return ["Write the cold open for this character.", "", JSON.stringify(facts, null, 2)].join("\n");
}
