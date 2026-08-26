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
import { AMMUNITION, ARMOR, CYBERWARE, GEAR, WEAPONS, getArmor, type ItemKind } from "./catalog";

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

// ---------------------------------------------------------------------------
// Recovering a kind from an id alone.
// ---------------------------------------------------------------------------

const KIND_INDEX: { kind: ItemKind; ids: Set<string> }[] = [
  { kind: "weapon", ids: new Set(WEAPONS.map((w) => w.id)) },
  { kind: "armor", ids: new Set(ARMOR.map((a) => a.id)) },
  { kind: "ammunition", ids: new Set(AMMUNITION.map((a) => a.id)) },
  { kind: "gear", ids: new Set(GEAR.map((g) => g.id)) },
  { kind: "cyberware", ids: new Set(CYBERWARE.map((c) => c.id)) },
];

/**
 * Which catalog namespace an item id belongs to, when nobody recorded it.
 *
 * Needed because rows exist that were written without a usable kind or slot —
 * Role package gear is filed under a slot of "package:weaponsArmor", which is
 * neither a weapon slot nor an armor location, so the character's starting
 * rifle was never offered in a fight and their starting armor gave no SP.
 *
 * Searched in a fixed order. Nine ids appear in both gear and cyberware
 * (an audio recorder you carry and one in your skull); gear is checked first,
 * which is the right answer for a row that came out of a gear package. Nothing
 * is ambiguous between weapon, armor and ammunition, which is where it matters.
 */
export function resolveItemKind(itemId: string): ItemKind | null {
  for (const entry of KIND_INDEX) {
    if (entry.ids.has(itemId)) return entry.kind;
  }
  return null;
}

/** True when a slot names a Role package bucket rather than a place on the body. */
export function isPackageSlot(slot: string | null | undefined): boolean {
  return typeof slot === "string" && slot.startsWith("package:");
}

/**
 * The slot a stored row should be read at.
 *
 * Rows whose slot is a package bucket, or missing entirely, are placed from the
 * catalog instead. Anything already sitting in a real slot is left alone.
 */
export function effectiveSlot(row: { item_id: string; slot: string | null }): string | null {
  if (row.slot && !isPackageSlot(row.slot)) return row.slot;
  const kind = resolveItemKind(row.item_id);
  return kind ? slotFor(kind, row.item_id) : row.slot;
}
