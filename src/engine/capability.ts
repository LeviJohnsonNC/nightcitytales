/**
 * The capability snapshot — a deterministic answer to "what can this character
 * actually do right now?".
 *
 * Pure TypeScript over plain shapes: no React, no backend rows. The play layer
 * (src/features/play/capabilityModel.ts) maps persisted state into this, the GM
 * context prints it so the model stops proposing the impossible, and
 * ./legality.ts judges proposed actions against it.
 *
 * Nothing here invents a rules value. Magazine sizes, ROF and range bands come
 * from src/data/rules/catalog.json via ./weaponProfile; anything the printed
 * rules data does not cover is reported as UNKNOWN rather than guessed at (see
 * ./legality.ts, which never refuses on an unknown).
 */
import type { WeaponRangeType } from "./combatTables";
import { RANGE_BAND_MAX, singleShotDV } from "./combatTables";
import type { WoundStateCode } from "./campaign";

/** One weapon the character is carrying, as the legality layer sees it. */
export type WeaponCapability = {
  /** Catalog id, e.g. "heavy_pistol". */
  itemId: string;
  name: string;
  melee: boolean;
  /** Printed Rate of Fire — attacks per Turn with this weapon (catalog.json). */
  rof: number;
  /** Printed magazine size, or null for weapons the catalog gives none. */
  magazine: number | null;
  /** Rounds currently loaded, or null when the weapon takes no ammunition. */
  roundsLoaded: number | null;
  /** Spare rounds of any compatible ammunition in the kit. */
  spareRounds: number;
  /** Range DV table this weapon is rolled against, or null when it has none. */
  rangeType: WeaponRangeType | null;
  damageDice: number | null;
  /** A weapon that has been broken or rendered unusable in play. */
  broken: boolean;
};

/** Anything else in the kit, with what is left of it. */
export type ItemCapability = {
  itemId: string;
  name: string;
  kind: string;
  quantity: number;
};

export type CyberwareCapability = {
  itemId: string;
  name: string;
  /** The catalog's `requires` field, if this piece needs a foundation. */
  requires: string | null;
  /** True when the requirement is satisfied by something else installed. */
  prerequisiteMet: boolean;
};

export type RoleAbilityCapability = {
  abilityId: string;
  abilityName: string;
  rank: number;
};

/** A combatant the player can currently see and shoot at. */
export type TargetCapability = {
  /** The stable key the GM uses for this combatant. */
  key: string;
  id: string;
  name: string;
  distance: number;
  defeated: boolean;
  /** False when the fiction has put them out of sight (smoke, cover, gone). */
  perceivable: boolean;
  /**
   * What is standing in the way, when cover is why they cannot be shot.
   *
   * Named so the refusal can say "the dumpster is between you" rather than the
   * generic out-of-sight line, and so the GM is told the shape of the problem
   * instead of being left to invent one.
   */
  coverLabel?: string;
};

/** What is left of the player's Turn (CP:R pg. 165: one Action, one Move). */
export type TurnEconomy = {
  /** Whether a fight is running at all; outside combat nothing is budgeted. */
  inCombat: boolean;
  /** Absent on legacy callers; live encounters supply whose Turn this is. */
  isPlayerTurn?: boolean;
  /** True once the player has taken their Action this Round. */
  actionUsed: boolean;
  /** Attacks already made this Round, checked against the weapon's ROF. */
  shotsThisRound: number;
  /** The weapon those shots were made with, if any. */
  shotWeaponId: string | null;
  /** Metres already moved this Round. */
  metresMoved: number;
  /** The character's MOVE stat. */
  move: number;
};

/** A check already failed in this beat, for the no-free-retry rule. */
export type FailedAttempt = {
  skillId: string;
  intent: string;
};

export type CapabilitySnapshot = {
  hp: number;
  hpMax: number;
  woundState: WoundStateCode;
  /** Mortally Wounded and not yet stabilised: most actions are off the table. */
  incapacitated: boolean;
  eurobucks: number;
  luck: number;
  move: number;
  weapons: WeaponCapability[];
  items: ItemCapability[];
  cyberware: CyberwareCapability[];
  roleAbility: RoleAbilityCapability | null;
  targets: TargetCapability[];
  turn: TurnEconomy;
  failedAttempts: FailedAttempt[];
};

export const EMPTY_TURN_ECONOMY: TurnEconomy = {
  inCombat: false,
  actionUsed: false,
  shotsThisRound: 0,
  shotWeaponId: null,
  metresMoved: 0,
  move: 0,
};

function normalise(text: string): string {
  return text.trim().toLowerCase();
}

/** Find a carried weapon by catalog id or printed name. */
export function findWeapon(
  snapshot: CapabilitySnapshot,
  idOrName: string,
): WeaponCapability | null {
  const needle = normalise(idOrName);
  return (
    snapshot.weapons.find((w) => normalise(w.itemId) === needle) ??
    snapshot.weapons.find((w) => normalise(w.name) === needle) ??
    snapshot.weapons.find((w) => normalise(w.name).includes(needle)) ??
    null
  );
}

/** Find a possessed item by catalog id or printed name. */
export function findItem(snapshot: CapabilitySnapshot, idOrName: string): ItemCapability | null {
  const needle = normalise(idOrName);
  return (
    snapshot.items.find((i) => normalise(i.itemId) === needle) ??
    snapshot.items.find((i) => normalise(i.name) === needle) ??
    snapshot.items.find((i) => normalise(i.name).includes(needle)) ??
    null
  );
}

export function findCyberware(
  snapshot: CapabilitySnapshot,
  idOrName: string,
): CyberwareCapability | null {
  const needle = normalise(idOrName);
  return (
    snapshot.cyberware.find((c) => normalise(c.itemId) === needle) ??
    snapshot.cyberware.find((c) => normalise(c.name) === needle) ??
    snapshot.cyberware.find((c) => normalise(c.name).includes(needle)) ??
    null
  );
}

export function findTargetCapability(
  snapshot: CapabilitySnapshot,
  key: string,
): TargetCapability | null {
  const needle = normalise(key);
  return (
    snapshot.targets.find((t) => normalise(t.key) === needle) ??
    snapshot.targets.find((t) => normalise(t.id) === needle) ??
    snapshot.targets.find((t) => normalise(t.name) === needle) ??
    null
  );
}

/** True when this weapon has a printed Range DV at that distance. */
export function withinPrintedRange(weapon: WeaponCapability, metres: number): boolean {
  if (!weapon.rangeType) return true; // no printed table: not ours to refuse
  return singleShotDV(weapon.rangeType, metres) !== null;
}

/** Weapons that can actually be fired right now, in carry order. */
export function usableWeapons(snapshot: CapabilitySnapshot): WeaponCapability[] {
  return snapshot.weapons.filter(
    (w) => !w.broken && (w.roundsLoaded === null || w.roundsLoaded > 0),
  );
}

/**
 * The Range DV for this weapon at this distance, or null when there is none.
 *
 * The single answer to "how hard is this shot", in the shape the capability
 * layer holds a weapon in. Melee is null because RED resolves it as an opposed
 * roll rather than against a printed DV, and a weapon the core rules give no
 * table entry is null rather than approximated to a similar gun.
 */
export function weaponDvAt(weapon: WeaponCapability, metres: number): number | null {
  if (weapon.melee || !weapon.rangeType) return null;
  return singleShotDV(weapon.rangeType, metres);
}

/** One printed range band: everything out to `max` metres is this hard to hit. */
export type WeaponBand = {
  /** Upper bound of the band, in metres (CP:R pg. 173). */
  max: number;
  dv: number;
};

/**
 * Every band this weapon has a printed DV for, nearest first.
 *
 * Read straight off the table in combatTables.ts rather than described
 * anywhere, so the rings a board paints are the same numbers the To-Hit is
 * rolled against and cannot drift from them. Bands the table leaves blank are
 * OUT OF RANGE and are simply absent — a weapon's furthest ring is the edge of
 * what it can reach, which is the fact worth seeing.
 */
export function weaponBands(weapon: WeaponCapability): WeaponBand[] {
  if (weapon.melee || !weapon.rangeType) return [];
  const out: WeaponBand[] = [];
  for (const max of RANGE_BAND_MAX) {
    const dv = singleShotDV(weapon.rangeType, max);
    if (dv === null) continue;
    out.push({ max, dv });
  }
  return out;
}

/** A one-line description of a weapon for the GM's context block. */
export function describeWeapon(weapon: WeaponCapability): string {
  const parts: string[] = [weapon.name];
  if (weapon.melee) parts.push("melee");
  if (weapon.roundsLoaded !== null) {
    parts.push(
      `${weapon.roundsLoaded}/${weapon.magazine ?? "?"} loaded` +
        (weapon.spareRounds > 0 ? `, ${weapon.spareRounds} spare` : ", no spare ammo"),
    );
  }
  parts.push(`ROF ${weapon.rof}`);
  if (weapon.broken) parts.push("BROKEN — unusable");
  else if (weapon.roundsLoaded === 0) parts.push("EMPTY — cannot be fired until reloaded");
  return parts.join(", ");
}
