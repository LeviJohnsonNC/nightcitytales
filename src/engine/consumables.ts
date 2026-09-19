/**
 * What using something costs you.
 *
 * `legality.ts` already decides whether a character may use an item — do they
 * have one, do they have enough. This decides what is left afterwards, which
 * is the half that was missing: a Life turn checked the Glow Paint, printed
 * "Used 5× Glow Paint" in the ledger, and left all five cans on the sheet.
 *
 * The distinction the rules do not make is the one this file exists for. The
 * book prices a Food Stick and an Electric Guitar the same way and never says
 * that eating the first leaves you with none and playing the second leaves you
 * with a guitar — a table does not need telling. So the list lives in
 * `src/data/rules/consumables.json`, flagged `houseRule`, judged from each
 * item's own printed description, and anything not on it is equipment: used,
 * not spent. Ammunition is consumable as a class, because every round and
 * grenade in the catalog is spent when it is used.
 *
 * Pure, like the rest of the engine: rows in, a plan out. Nothing here writes.
 */
import CONSUMABLES from "@/data/rules/consumables.json";
import { AMMUNITION } from "./catalog";

const CONSUMABLE_GEAR = new Set(
  (CONSUMABLES.gear as { id: string }[]).map((entry) => entry.id.trim().toLowerCase()),
);

const CONSUMABLE_KINDS = new Set(
  (CONSUMABLES.consumableKinds as string[]).map((kind) => kind.trim().toLowerCase()),
);

const AMMUNITION_IDS = new Set(AMMUNITION.map((a) => a.id.trim().toLowerCase()));

/**
 * Whether using one of these uses it up.
 *
 * Keyed off the catalog id alone: an id in the ammunition catalog is spent
 * because ammunition is, and a gear id is spent only when the house rule says
 * so. Anything unknown — a legacy row, an id the catalog has never heard of —
 * is NOT consumable, because silently deleting something a player is carrying
 * on the strength of a name nobody recognises is the worse mistake.
 */
export function isConsumable(itemId: string): boolean {
  const id = itemId.trim().toLowerCase();
  if (CONSUMABLE_KINDS.has("ammunition") && AMMUNITION_IDS.has(id)) return true;
  return CONSUMABLE_GEAR.has(id);
}

/** A carried line, as little of it as this module needs. */
export type ConsumableRow = { id: string; itemId: string; quantity: number };

export type ConsumptionPlan = {
  /** What each row goes down to. Empty when nothing is spent. */
  rows: { id: string; from: number; to: number }[];
  /** How many were actually taken — never more than are carried. */
  spent: number;
  /** How many of this item remain across every row afterwards. */
  remaining: number;
};

export const EMPTY_CONSUMPTION: ConsumptionPlan = { rows: [], spent: 0, remaining: 0 };

/**
 * Take `quantity` of an item out of the rows carrying it.
 *
 * Spends the smallest stacks first, so a player with a 1 and a 4 ends up with
 * one row of 4 rather than two ragged ones. Asking for more than is carried
 * takes everything and reports what it actually took — legality refuses that
 * case before it reaches here, and a plan that lies about what it did would be
 * worse than one that under-delivers honestly.
 */
export function planConsumption(
  rows: ConsumableRow[],
  itemId: string,
  quantity: number,
): ConsumptionPlan {
  const id = itemId.trim().toLowerCase();
  const matching = rows
    .filter((row) => row.itemId.trim().toLowerCase() === id && row.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity);
  const carried = matching.reduce((sum, row) => sum + row.quantity, 0);
  let owed = Math.max(0, Math.trunc(quantity));
  const out: ConsumptionPlan["rows"] = [];
  for (const row of matching) {
    if (owed <= 0) break;
    const taken = Math.min(owed, row.quantity);
    owed -= taken;
    out.push({ id: row.id, from: row.quantity, to: row.quantity - taken });
  }
  const spent = out.reduce((sum, row) => sum + (row.from - row.to), 0);
  return { rows: out, spent, remaining: carried - spent };
}
