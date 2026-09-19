/**
 * Using something out of the kit, decided once for both loops.
 *
 * Life and a Job now both let the player use what they are carrying, and the
 * reasoning is identical: resolve what the model named against the snapshot
 * legality just judged, ask the engine whether using it uses it up, and work
 * out what each row goes down to. Two copies of that would drift, and the half
 * that drifted last time was the half that wrote nothing at all — a turn that
 * printed "Used 5× Glow Paint" over five untouched cans.
 *
 * Pure: it returns the writes to make and the line to log, and performs
 * neither. The ops modules own the ordering of their own writes.
 */
import { findItem, isConsumable, planConsumption, type CapabilitySnapshot } from "@/engine";
import type { CampaignInventoryItem } from "@/lib/backend";

export type ItemUse = {
  /** The catalog id, when the kit list knew what they meant. */
  itemId: string;
  /** What to call it in the ledger: the catalog's name, else what was said. */
  name: string;
  /** Whether using this spends it. False for equipment, and for an unknown id. */
  consumed: boolean;
  /** How many were actually taken. Zero for equipment. */
  spent: number;
  /** How many remain across every row afterwards. */
  remaining: number;
  /** The rows to set, and to what. Empty unless something was spent. */
  writes: { id: string; quantity: number }[];
  /** The ledger line. Says what happened to the sheet, not what was asked for. */
  summary: string;
};

/**
 * What using `item` costs this character.
 *
 * `capability` is the same snapshot `judgeAction` was handed, so the row that
 * gets spent is the row that was checked rather than a second guess at what
 * the model meant. Call this only after legality has said yes.
 */
export function planItemUse(input: {
  capability: CapabilitySnapshot;
  inventory: CampaignInventoryItem[];
  item: string;
  quantity: number;
}): ItemUse {
  const asked = Math.max(1, Math.trunc(input.quantity));
  const carried = findItem(input.capability, input.item);
  const name = carried?.name ?? input.item;

  if (!carried || !isConsumable(carried.itemId)) {
    // Equipment. They used it, they still have it — and the ledger says so
    // without a count, because "1 left" under a lockpick set is nonsense.
    return {
      itemId: carried?.itemId ?? input.item,
      name,
      consumed: false,
      spent: 0,
      remaining: carried?.quantity ?? 0,
      writes: [],
      summary: `Used ${asked > 1 ? `${asked}× ` : ""}${name}.`,
    };
  }

  const plan = planConsumption(
    input.inventory.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      quantity: row.quantity,
    })),
    carried.itemId,
    asked,
  );

  return {
    itemId: carried.itemId,
    name,
    consumed: true,
    spent: plan.spent,
    remaining: plan.remaining,
    writes: plan.rows.map((row) => ({ id: row.id, quantity: row.to })),
    summary:
      `Used ${plan.spent > 1 ? `${plan.spent}× ` : ""}${name}. ` +
      (plan.remaining > 0 ? `${plan.remaining} left.` : "None left."),
  };
}

/** The inventory as it stands after a use, for the rest of the same turn. */
export function applyItemUse(
  inventory: CampaignInventoryItem[],
  use: ItemUse,
): CampaignInventoryItem[] {
  if (!use.writes.length) return inventory;
  const byId = new Map(use.writes.map((write) => [write.id, write.quantity]));
  return inventory.map((row) => (byId.has(row.id) ? { ...row, quantity: byId.get(row.id)! } : row));
}
