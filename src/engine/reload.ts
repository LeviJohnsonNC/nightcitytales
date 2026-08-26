/**
 * Putting rounds back in the gun.
 *
 * `ammo_loaded` has been on the inventory row since armor repair shipped, and
 * combat has been counting it down ever since — but nothing ever put a round
 * back. A magazine that only empties is a countdown, not a resource, and the
 * ammunition the character was carrying may as well not have been there.
 *
 * The rules this encodes are small and deliberate:
 *
 *   - You cannot load more than the magazine holds.
 *   - You cannot load rounds you are not carrying.
 *   - A weapon with no printed magazine (melee, and the exotics printed without
 *     one) cannot be reloaded, because there is nothing to reload.
 *
 * Pure arithmetic. What it costs in time and what it does to the database are
 * the caller's business.
 */
import { weaponProfile } from "./weaponProfile";

export type ReloadRequest = {
  /** The weapon's catalog id. */
  itemId: string;
  /** What is in it now. Null means nobody has ever tracked it: assume full. */
  loaded: number | null;
  /** Loose rounds the character is carrying, across every ammunition row. */
  spareRounds: number;
};

export type ReloadPlan = {
  /** True when there is anything worth doing. */
  possible: boolean;
  /** Rounds that actually go in. */
  rounds: number;
  /** What the magazine holds after loading. */
  loadedAfter: number;
  /** Spare rounds remaining once they are in the gun. */
  spareAfter: number;
  /** Magazine capacity, for display. */
  magazine: number | null;
  /** Why not, when it is not possible. */
  reason: string | null;
};

const NOTHING = (magazine: number | null, loaded: number, spare: number, reason: string) => ({
  possible: false,
  rounds: 0,
  loadedAfter: loaded,
  spareAfter: spare,
  magazine,
  reason,
});

/**
 * Work out what a reload of this weapon would actually do.
 *
 * Deliberately total: every refusal is a described one, so a UI can say why the
 * button is dead rather than presenting a button that silently does nothing.
 */
export function planReload(request: ReloadRequest): ReloadPlan {
  let magazine: number | null;
  let name: string;
  try {
    const profile = weaponProfile(request.itemId);
    magazine = profile.magazine;
    name = profile.name;
  } catch {
    return NOTHING(null, 0, request.spareRounds, "That is not a weapon this catalog knows.");
  }

  if (magazine === null) {
    return NOTHING(null, 0, request.spareRounds, `The ${name} has nothing to reload.`);
  }

  // An untracked magazine is a full one: a campaign that predates ammunition
  // counting should not have its guns retroactively emptied.
  const loaded = Math.max(0, Math.min(magazine, request.loaded ?? magazine));
  const spare = Math.max(0, request.spareRounds);
  const room = magazine - loaded;

  if (room <= 0) return NOTHING(magazine, loaded, spare, `The ${name} is already full.`);
  if (spare <= 0) return NOTHING(magazine, loaded, spare, "No spare rounds to load.");

  const rounds = Math.min(room, spare);
  return {
    possible: true,
    rounds,
    loadedAfter: loaded + rounds,
    spareAfter: spare - rounds,
    magazine,
    reason: null,
  };
}

/** "Reloaded the Heavy Pistol — 5 rounds, 8/8." for the ledger. */
export function describeReload(itemId: string, plan: ReloadPlan): string {
  const name = (() => {
    try {
      return weaponProfile(itemId).name;
    } catch {
      return itemId;
    }
  })();
  return `Reloaded the ${name} — ${plan.rounds} round${plan.rounds === 1 ? "" : "s"}, ${plan.loadedAfter}/${plan.magazine}.`;
}
