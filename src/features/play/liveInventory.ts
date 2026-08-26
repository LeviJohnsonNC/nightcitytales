/**
 * What the character has on them, resolved once.
 *
 * There have been two answers to this question and they disagreed. The GM's
 * capability block read `campaign_inventory` — the live rows the shop writes,
 * combat spends and repair patches. Combat itself read `character.gear`, the
 * frozen record of who walked out of creation. So the model was told about the
 * pistol you bought and the combat engine would not let you fire it, and armor
 * repair wrote a `current_sp` that nothing computing protection ever read.
 *
 * One rule, in one place, so the two cannot drift again: the live rows when
 * there are any, and the sheet only as a fallback for campaigns that started
 * before the kit was copied across.
 */
import { effectiveSlot, isPackageSlot, resolveItemKind } from "@/engine";
import type { CampaignInventoryItem, FullCharacter } from "@/lib/backend";

/**
 * Put a row where it actually belongs on the body.
 *
 * Role package gear is stored under a slot of "package:weaponsArmor", which is
 * neither a weapon slot nor an armor location — so a character created with a
 * package had a rifle combat never offered them and armor that gave no SP.
 * The catalog knows where those things go, so they are placed from it.
 *
 * Package armor is also marked worn. It is the kit the character was created
 * in and the sheet presents it as theirs; leaving it off meant a starting vest
 * protected nothing at all.
 */
function placed(row: CampaignInventoryItem): CampaignInventoryItem {
  const slot = effectiveSlot(row);
  if (slot === row.slot) return row;
  const wearable = slot === "body" || slot === "head" || slot === "shield";
  return {
    ...row,
    slot,
    equipped: row.equipped || (isPackageSlot(row.slot) && wearable),
    kind: row.kind === "gear" ? (resolveItemKind(row.item_id) ?? row.kind) : row.kind,
  };
}

/**
 * The rows to read for anything the character is carrying.
 *
 * The fallback is deliberately a projection of the sheet into inventory shape
 * rather than a second code path: every caller then handles one type, and a
 * pre-inventory campaign behaves exactly like a live one with the same kit.
 */
export function liveInventory(
  inventory: CampaignInventoryItem[],
  character: FullCharacter,
): CampaignInventoryItem[] {
  if (inventory.length > 0) return inventory.map(placed);
  return character.gear
    .map((g) => ({
      id: g.id,
      campaign_id: "",
      // Kind is unknowable from a sheet row, and slot is what every reader here
      // actually branches on, so "gear" is a placeholder rather than a claim.
      kind: "gear",
      item_id: g.item_id,
      quantity: g.quantity,
      equipped: g.equipped,
      slot: g.slot,
      current_sp: g.current_sp,
      notes: g.notes,
      ammo_loaded: null,
      condition: "ok",
    }))
    .map((row) => placed(row as unknown as CampaignInventoryItem));
}
