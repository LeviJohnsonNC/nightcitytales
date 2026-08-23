/**
 * Combat lookup tables, transcribed verbatim from the Cyberpunk RED core rules
 * (Friday Night Firefight, pg. 173-174). Pure data + lookups, no dependencies.
 *
 * These are the printed Range DV tables. They are the authoritative numbers a
 * ranged To-Hit is rolled against; the weapon-data layer maps a specific weapon
 * (e.g. "Heavy Pistol") to one of these range types.
 */

export type WeaponRangeType =
  | "pistol"
  | "smg"
  | "shotgun_slug"
  | "assault_rifle"
  | "sniper_rifle"
  | "bow_crossbow"
  | "grenade_launcher"
  | "rocket_launcher";

/** Only SMGs and Assault Rifles have an Autofire mode. */
export type AutofireRangeType = "smg" | "assault_rifle";

/** Upper bound (m/yds) of each of the 8 range bands (CP:R pg. 173). */
export const RANGE_BAND_MAX = [6, 12, 25, 50, 100, 200, 400, 800] as const;

/** Single Shot DVs by weapon type × range band (CP:R pg. 173). null = out of range. */
export const SINGLE_SHOT_DV: Record<WeaponRangeType, (number | null)[]> = {
  pistol: [13, 15, 20, 25, 30, 30, null, null],
  smg: [15, 13, 15, 20, 25, 25, 30, null],
  shotgun_slug: [13, 15, 20, 25, 30, 35, null, null],
  assault_rifle: [17, 16, 15, 13, 15, 20, 25, 30],
  sniper_rifle: [30, 25, 25, 20, 15, 16, 17, 20],
  bow_crossbow: [15, 13, 15, 17, 20, 22, null, null],
  grenade_launcher: [16, 15, 15, 17, 20, 22, 25, null],
  rocket_launcher: [17, 16, 15, 15, 20, 20, 25, 30],
};

/** Autofire DVs by weapon type × range band (CP:R pg. 173). Only 5 bands exist. */
export const AUTOFIRE_DV: Record<AutofireRangeType, (number | null)[]> = {
  smg: [15, 13, 15, 20, 25],
  assault_rifle: [17, 16, 15, 13, 15],
};

/** Autofire damage-multiplier cap by weapon type (CP:R pg. 173): SMG 3, AR 4. */
export const AUTOFIRE_MAX_MULTIPLIER: Record<AutofireRangeType, number> = {
  smg: 3,
  assault_rifle: 4,
};

/** The 0-based range band for a distance in m/yds, or null if beyond 800. */
export function rangeBandIndex(meters: number): number | null {
  if (meters < 0) throw new Error(`rangeBandIndex: distance cannot be negative (${meters}).`);
  const index = RANGE_BAND_MAX.findIndex((max) => meters <= max);
  return index === -1 ? null : index;
}

/** Single Shot DV for a weapon type at a distance, or null if out of range. */
export function singleShotDV(type: WeaponRangeType, meters: number): number | null {
  const band = rangeBandIndex(meters);
  if (band === null) return null;
  return SINGLE_SHOT_DV[type][band] ?? null;
}

/** Autofire DV for a weapon type at a distance, or null if out of range. */
export function autofireDV(type: AutofireRangeType, meters: number): number | null {
  const band = rangeBandIndex(meters);
  if (band === null || band >= AUTOFIRE_DV[type].length) return null;
  return AUTOFIRE_DV[type][band] ?? null;
}
