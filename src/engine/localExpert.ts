/**
 * Local Expert — the one Skill that is worth nothing in the wrong place.
 *
 * Cyberpunk RED prints the restriction in the Skill's own description: you
 * choose a specific location whenever you increase it, and that location
 * "cannot be any larger than a single neighborhood or community". So there is
 * no Local Expert (Night City). There is Local Expert (Little China) 5, and
 * three districts over it is worth nothing at all.
 *
 * The atlas's DISTRICTS are already that scale — Little China, Kabuki, The
 * Glen, the University District are neighbourhoods rather than boroughs — so
 * the area a Skill line names is a district key, and every location inside that
 * district is covered by it. That is also the difference between this Skill and
 * `placeIntel` next door: visits are earned one building at a time, and Local
 * Expert is bought a whole neighbourhood at a time.
 *
 * NOTHING HERE ROLLS, and nothing here hands out a bonus. This module answers
 * one question — which area does a Skill line cover — so that the check layer
 * can read the right line, or honestly read no line at all. Before it existed
 * every caller reduced a Skill line to `{ skillId, level }`, so a character
 * with Local Expert (Little China) 6 rolled at +6 in Pacifica, and the GM was
 * shown "Local Expert +9" with no area attached and was right to call for it
 * anywhere in the city.
 *
 * Pure TypeScript.
 */
import intelData from "@/data/atlas/place-intel.json";
import { AREAS, DISTRICTS, districtOfPlace, getDistrict } from "./geography";

/** The printed Skill this module is about. */
export const LOCAL_EXPERT_SKILL_ID = "local_expert";

/**
 * The phrase the printed Role packages put where a district should be.
 *
 * Every Role's Skill package grants "Local Expert (Your Home)" — the rulebook
 * telling the player to fill it in, not a place on the map. It stays on the
 * sheet as written and is resolved through the character's home district every
 * time it is read, rather than being rewritten once when a home is chosen: a
 * character who moves house should become a local somewhere else, not a local
 * nowhere. `__tests__/localExpert.test.ts` holds the rules data to this exact
 * phrase, so a reprint that changes the wording fails a test instead of
 * silently turning every starting character's home turf into free text.
 */
export const HOME_AREA = "Your Home";

/** Whether a stored specialization is the "fill this in later" phrase. */
export function isHomeArea(specialization: string | null | undefined): boolean {
  return (specialization ?? "").trim().toLowerCase() === HOME_AREA.toLowerCase();
}

/**
 * Whether this Skill's specialization names somewhere on the map.
 *
 * Local Expert alone. Language, Science and Martial Arts are specialized too,
 * but a tongue or a field of study is not a district and the engine has no
 * business resolving one against the atlas.
 */
export function isAreaScoped(skillId: string): boolean {
  return skillId === LOCAL_EXPERT_SKILL_ID;
}

/**
 * The district a stored specialization names, or null when it names nowhere.
 *
 * Deliberately forgiving about what it is handed, because three kinds of value
 * are already in the database: a district key from the picker, the "Your Home"
 * phrase from a Role package, and free text somebody typed before there was a
 * picker. `getDistrict` resolves the first and the third between them — it
 * takes a key, a printed district code, and a name like "Little China", which
 * covers almost everything a player would have typed.
 *
 * Anything left over — "Night City", "my block", a typo — resolves to null,
 * which is the honest answer: it is not a neighbourhood the map has, so no
 * ground in the city can be covered by it. Null is never treated as "covers
 * everywhere"; see `coversArea`.
 */
export function areaKeyOf(
  specialization: string | null | undefined,
  homeDistrictKey?: string | null,
): string | null {
  const raw = (specialization ?? "").trim();
  if (!raw) return null;
  if (isHomeArea(raw)) {
    return homeDistrictKey ? (getDistrict(homeDistrictKey)?.key ?? null) : null;
  }
  return getDistrict(raw)?.key ?? null;
}

/**
 * What this Skill line should be called on a sheet, in a roll log, or in a
 * prompt: the district's printed name once it resolves.
 *
 * An unresolved "Your Home" is returned as the phrase itself rather than as a
 * blank or a guess, because that is exactly what it is — a character whose home
 * has not been chosen yet genuinely has no neighbourhood, and the sheet saying
 * so is how the player finds out there is something left to decide.
 */
export function areaLabel(
  specialization: string | null | undefined,
  homeDistrictKey?: string | null,
): string | null {
  const raw = (specialization ?? "").trim();
  if (!raw) return null;
  const key = areaKeyOf(raw, homeDistrictKey);
  if (key) return getDistrict(key)?.name ?? raw;
  return raw;
}

/**
 * Whether a Skill line covers the area a check is being made about.
 *
 * For Local Expert both sides are resolved to a district key and compared, so
 * the printed code, the name and the key are all the same answer, and a line
 * that names nowhere on the map covers nothing. For every other specialized
 * Skill this is a plain text comparison, because the engine has no vocabulary
 * for a tongue or a field of study and should not pretend otherwise.
 */
export function coversArea(args: {
  skillId: string;
  specialization: string | null | undefined;
  /** What the check is about: a district key, code or name for Local Expert. */
  area: string;
  homeDistrictKey?: string | null;
}): boolean {
  const asked = args.area.trim();
  if (!asked) return false;

  if (isAreaScoped(args.skillId)) {
    const held = areaKeyOf(args.specialization, args.homeDistrictKey);
    if (!held) return false;
    const wanted = getDistrict(asked)?.key ?? null;
    return wanted !== null && held === wanted;
  }

  return (args.specialization ?? "").trim().toLowerCase() === asked.toLowerCase();
}

/** One Skill line as the sheet and the database hold it. */
export type AreaSkillLine = {
  skillId: string;
  level: number;
  specialization?: string | null;
};

/**
 * How well this character knows a given district — 0 when they do not.
 *
 * The number a Local Expert check adds, and the number the narrator should be
 * shown for the ground under the character's feet. Several lines can cover the
 * same district once a character has bought Local Expert twice for it (which
 * the rules do not forbid), so the best one wins rather than the first one
 * stored.
 */
export function localExpertLevel(
  skills: AreaSkillLine[],
  districtKey: string | null | undefined,
  homeDistrictKey?: string | null,
): number {
  if (!districtKey) return 0;
  return skills.reduce((best, line) => {
    if (line.skillId !== LOCAL_EXPERT_SKILL_ID) return best;
    const covers = coversArea({
      skillId: line.skillId,
      specialization: line.specialization,
      area: districtKey,
      ...(homeDistrictKey === undefined ? {} : { homeDistrictKey }),
    });
    return covers ? Math.max(best, line.level) : best;
  }, 0);
}

/** Every district this character is a local in, best level first. */
export function localExpertAreas(
  skills: AreaSkillLine[],
  homeDistrictKey?: string | null,
): { districtKey: string; districtName: string; level: number }[] {
  const best = new Map<string, number>();
  for (const line of skills) {
    if (line.skillId !== LOCAL_EXPERT_SKILL_ID) continue;
    const key = areaKeyOf(line.specialization, homeDistrictKey);
    if (!key) continue;
    best.set(key, Math.max(best.get(key) ?? 0, line.level));
  }
  return [...best.entries()]
    .map(([districtKey, level]) => ({
      districtKey,
      districtName: getDistrict(districtKey)?.name ?? districtKey,
      level,
    }))
    .sort((a, b) => b.level - a.level || a.districtName.localeCompare(b.districtName));
}

// ---------------------------------------------------------------------------
// The neighbourhoods a player can actually choose between.
// ---------------------------------------------------------------------------

export type LocalExpertArea = {
  districtKey: string;
  districtName: string;
  /** The part of the city it is in, for grouping a long list. */
  areaKey: string;
  areaName: string;
};

/**
 * Every neighbourhood this Skill may be taken for, grouped by part of the city.
 *
 * The whole district list, in the atlas's own order within each area. There is
 * no filtering to do: a district IS the legal scope, so every one of them is a
 * legal answer — including the ones nobody would choose to know, which is the
 * point of letting a player choose rather than offering them a shortlist.
 *
 * Exists so that the picker cannot offer something `areaKeyOf` would fail to
 * resolve. Before it, the specialization was a free-text box, and "Night City"
 * or a typo went onto the sheet as a Skill that covered no ground in the city.
 */
export function localExpertAreaOptions(): LocalExpertArea[] {
  const order = new Map(AREAS.map((area, index) => [area.key, index]));
  return DISTRICTS.map((district) => ({
    districtKey: district.key,
    districtName: district.name,
    areaKey: district.area,
    areaName: AREAS.find((a) => a.key === district.area)?.name ?? district.area,
  })).sort(
    (a, b) =>
      (order.get(a.areaKey) ?? 0) - (order.get(b.areaKey) ?? 0) ||
      a.districtName.localeCompare(b.districtName),
  );
}

/**
 * Whether a stored specialization is one this Skill can legally carry: a
 * neighbourhood on the map, or the placeholder that will become one.
 *
 * The guard the picker makes unreachable and validation still asks, because a
 * draft saved before the picker existed can hold anything somebody typed.
 */
export function isLegalLocalExpertArea(
  specialization: string | null | undefined,
  homeDistrictKey?: string | null,
): boolean {
  if (isHomeArea(specialization)) return true;
  return areaKeyOf(specialization, homeDistrictKey) !== null;
}

// ---------------------------------------------------------------------------
// Coming to know somewhere new.
// ---------------------------------------------------------------------------

type EarnedRule = { earned: { visits: number; places: number } };

/**
 * What the campaign has to show before a character may BUY this Skill for a
 * neighbourhood they did not start in.
 *
 * A HOUSE RULE, and flagged as one in `place-intel.json`. RED prints no such
 * requirement: it says choose a location. This exists because the alternative
 * is spending Improvement Points on local knowledge of a district the character
 * has never set foot in, which is the one purchase this Skill should not
 * support. Raising a line they already hold is untouched — that is the printed
 * rule and stays the printed rule.
 */
export const EARNED_AREA_RULE: { visits: number; places: number } = (
  intelData as unknown as EarnedRule
).earned;

/** A neighbourhood the campaign says this character has actually spent time in. */
export type EarnedArea = {
  districtKey: string;
  districtName: string;
  /** Visits recorded across every address in the district. */
  visits: number;
  /** How many different addresses in it those visits touched. */
  places: number;
  /** The Level they already hold here. Zero when this would be a new line. */
  level: number;
  /** True when they qualify because they live here rather than by walking it. */
  isHome: boolean;
};

/**
 * The neighbourhoods this character could legitimately take Local Expert for.
 *
 * Two numbers rather than one, and the second is the point: eight evenings in
 * the same bar is knowing a bar, not the neighbourhood the bar is on. So the
 * rule asks for visits AND for those visits to have touched more than one
 * address.
 *
 * The home district is always included. They live there — whatever the campaign
 * has happened to record about their walking about.
 *
 * Sorted by how well the campaign says they know the ground, so the district
 * they have really been living in comes first.
 */
export function earnedLocalExpertAreas(args: {
  /** `campaign_places`, reduced to what this question needs. */
  visitsByPlace: { placeKey: string; visits: number }[];
  skills: AreaSkillLine[];
  homeDistrictKey?: string | null;
}): EarnedArea[] {
  const tally = new Map<string, { visits: number; places: number }>();
  for (const row of args.visitsByPlace) {
    if (row.visits <= 0) continue;
    const district = districtOfPlace(row.placeKey);
    if (!district) continue;
    const seen = tally.get(district.key) ?? { visits: 0, places: 0 };
    seen.visits += row.visits;
    seen.places += 1;
    tally.set(district.key, seen);
  }

  const home = args.homeDistrictKey ? (getDistrict(args.homeDistrictKey)?.key ?? null) : null;
  if (home && !tally.has(home)) tally.set(home, { visits: 0, places: 0 });

  const out: EarnedArea[] = [];
  for (const [districtKey, seen] of tally) {
    const isHome = districtKey === home;
    const qualifies =
      isHome || (seen.visits >= EARNED_AREA_RULE.visits && seen.places >= EARNED_AREA_RULE.places);
    if (!qualifies) continue;
    out.push({
      districtKey,
      districtName: getDistrict(districtKey)?.name ?? districtKey,
      visits: seen.visits,
      places: seen.places,
      level: localExpertLevel(args.skills, districtKey, args.homeDistrictKey),
      isHome,
    });
  }

  return out.sort((a, b) => b.visits - a.visits || a.districtName.localeCompare(b.districtName));
}

/**
 * The same list, narrowed to neighbourhoods they are not a local in yet.
 *
 * What the spend screen offers as a NEW Skill line. A district they already
 * hold a line for is left out because raising that line is already on the
 * board, through the ordinary advancement list.
 */
export function newLocalExpertAreas(args: {
  visitsByPlace: { placeKey: string; visits: number }[];
  skills: AreaSkillLine[];
  homeDistrictKey?: string | null;
}): EarnedArea[] {
  return earnedLocalExpertAreas(args).filter((area) => area.level === 0);
}
