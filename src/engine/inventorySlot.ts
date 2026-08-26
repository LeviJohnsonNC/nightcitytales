/**
 * Where a bought thing lands on the sheet.
 *
 * `campaign_inventory` has two descriptive columns and they mean different
 * things: `kind` is the catalog namespace an item_id is resolved in, and `slot`
 * is where the thing sits on the character. Everything downstream keys off
 * `slot` — weaponCapabilities skips any row whose slot is not "weapon",
 * ammunition is counted by slot, armor is worn by location — so a row written
 * without one is a row the game cannot see. A gun you paid for and cannot fire
 * is worse than no gun.
 *
 * The convention is already set by character creation (saveCharacter.ts writes
 * `slot: line.location ?? line.kind`), and this module is that same rule in one
 * named place, so the shop and the sheet cannot drift from chargen.
 */
import { getArmor, type ItemKind } from "./catalog";

/**
 * The slot a given catalog item occupies.
 *
 * Armor is placed by where it is worn, because a helmet and a vest are both
 * armor and the difference is the whole point. Everything else sits in the slot
 * named for its kind.
 */
export function slotFor(kind: ItemKind, itemId: string): string {
  if (kind !== "armor") return kind;
  const locations = getArmor(itemId).locations;
  // Printed armor lists its locations in wear order; the first is where a
  // single piece goes. Nothing in the catalog is location-less, but a piece
  // that ever were would still be armor and still needs a slot.
  return locations[0] ?? "body";
}

/**
 * True when two of a thing are indistinguishable and belong on one row.
 *
 * Weapons and armor are tracked individually because their state diverges the
 * moment they are used: this vest is at SP7 and that one is fresh, this pistol
 * has three rounds left. Ammunition and gear are fungible and stack.
 */
export function stacksInInventory(kind: ItemKind): boolean {
  return kind === "ammunition" || kind === "gear";
}
