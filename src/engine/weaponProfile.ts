/**
 * Turning a catalog weapon into the numbers the combat engine needs: how many
 * d6 of damage it rolls, which Skill and STAT swing it, and which printed Range
 * DV table it uses (CP:R pg. 173).
 *
 * Nothing here is inferred. Damage dice are parsed from the catalog's own
 * `damage` string, the Skill comes from the catalog's `skill` field, and the
 * range type is an explicit lookup against the printed table names. Weapons the
 * core rules do not place on the Range DV table (exotics, flamethrowers) map to
 * null, and the caller must say so rather than substitute a similar weapon.
 *
 * NOT modeled here: melee resolution. A melee attack is opposed rather than
 * rolled against a printed DV, so melee weapons carry no DV and the play loop
 * refuses to resolve them instead of guessing a number.
 */
import { getWeapon, type CatalogWeapon } from "./catalog";
import { findSkillByName } from "./rulesData";
import { singleShotDV, type WeaponRangeType } from "./combatTables";

/**
 * Catalog weapon id → the printed Range DV table it is rolled against
 * (src/data/rules/catalog.json → weapons, CP:R pg. 173). null means the core
 * rules give this weapon no entry on that table.
 */
export const WEAPON_RANGE_TYPE: Record<string, WeaponRangeType | null> = {
  medium_pistol: "pistol",
  heavy_pistol: "pistol",
  very_heavy_pistol: "pistol",
  smg: "smg",
  heavy_smg: "smg",
  shotgun: "shotgun_slug",
  assault_rifle: "assault_rifle",
  hurricane_assault: "assault_rifle",
  sniper_rifle: "sniper_rifle",
  bows_crossbows: "bow_crossbow",
  grenade_launcher: "grenade_launcher",
  rocket_launcher: "rocket_launcher",
  tsunami_helix: "smg",
  // Exotics and special weapons with no printed Range DV entry:
  air_pistol: null,
  dartgun: null,
  stun_gun: null,
  microwaver: null,
  shrieker: null,
  malorian_3516: null,
  flamethrower: null,
  cowboy_u56: null,
  rhinemetall_railgun: null,
};

/** Parse a catalog damage string such as "3d6" into its dice count. */
export function damageDiceFor(damage: string | null | undefined): number | null {
  if (!damage) return null;
  const match = /^(\d+)d6$/i.exec(damage.trim());
  return match ? Number(match[1]) : null;
}

export type WeaponProfile = {
  itemId: string;
  name: string;
  /** Melee weapons are resolved opposed, not against the Range DV table. */
  melee: boolean;
  skillName: string;
  skillId: string | null;
  /** Governing STAT for the To-Hit check, from the skill definition. */
  statKey: string | null;
  damageDice: number | null;
  rangeType: WeaponRangeType | null;
  rof: number;
  magazine: number | null;
  raw: CatalogWeapon;
};

export function weaponProfile(itemId: string): WeaponProfile {
  const w = getWeapon(itemId);
  const skill = findSkillByName(w.skill);
  return {
    itemId: w.id,
    name: w.name,
    melee: w.category === "melee",
    skillName: w.skill,
    skillId: skill?.id ?? null,
    statKey: skill?.stat ?? null,
    damageDice: damageDiceFor(w.damage),
    rangeType: WEAPON_RANGE_TYPE[w.id] ?? null,
    rof: w.rof,
    magazine: w.magazine,
    raw: w,
  };
}

/**
 * The Single Shot DV for this weapon at a distance, or null when the weapon has
 * no printed range profile or the target is out of range.
 */
export function weaponAttackDv(profile: WeaponProfile, meters: number): number | null {
  if (profile.melee || !profile.rangeType) return null;
  return singleShotDV(profile.rangeType, meters);
}

/**
 * Why this weapon cannot be resolved as a ranged attack right now, phrased for
 * the player, or null when it can. Never guesses a substitute value.
 */
export function weaponAttackGap(profile: WeaponProfile, meters: number): string | null {
  if (profile.melee) {
    return "Melee attacks are resolved with an opposed roll, which this table does not model yet.";
  }
  if (!profile.rangeType) {
    return `${profile.name} has no Range DV entry in the rules data (catalog.json → weapons).`;
  }
  if (profile.damageDice === null) {
    return `${profile.name} has no Nd6 damage value in the rules data (catalog.json → weapons).`;
  }
  if (weaponAttackDv(profile, meters) === null) {
    return `${profile.name} cannot reach a target at ${meters} m.`;
  }
  return null;
}
