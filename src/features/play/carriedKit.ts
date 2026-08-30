/**
 * Reading the campaign's live inventory into something a sheet can show.
 *
 * The assembled character sheet renders `character_gear`: who the character was
 * when they walked out of creation, which never changes again. That is the
 * right thing for a sheet to be and the wrong thing to check when you want to
 * know whether you still have a spare magazine.
 *
 * This is the live half — `campaign_inventory`, the same rows combat spends,
 * the shop writes and armor repair patches. Pure: rows in, groups out.
 */
import { catalogItem, getCyberware, weaponProfile, type ItemKind } from "@/engine";
import type { CampaignCyberware, CampaignInventoryItem } from "@/lib/backend";

export type KitLine = {
  id: string;
  name: string;
  /** What is worth saying beyond the name: rounds loaded, SP remaining. */
  detail: string;
  quantity: number;
};

export type KitGroup = { kind: ItemKind; label: string; lines: KitLine[] };

const GROUP_ORDER: { kind: ItemKind; label: string }[] = [
  { kind: "weapon", label: "Weapons" },
  { kind: "armor", label: "Armor" },
  { kind: "ammunition", label: "Ammunition" },
  { kind: "gear", label: "Gear" },
  { kind: "cyberware", label: "Chrome" },
];

const ARMOR_SLOTS = ["body", "head", "shield"];

/**
 * The kind a row belongs to.
 *
 * `slot` is trusted ahead of `kind` on purpose: character creation has always
 * written slot, and until the kind constraint was widened every copied row was
 * filed as 'gear' whatever it actually was. Reading slot first means campaigns
 * that predate the fix group correctly without needing to have been migrated.
 */
export function kindOf(row: CampaignInventoryItem): ItemKind {
  const kind = row.kind as ItemKind;
  if (kind === "cyberware") return "cyberware";
  if (row.slot === "weapon") return "weapon";
  if (row.slot === "ammunition") return "ammunition";
  if (row.slot && ARMOR_SLOTS.includes(row.slot)) return "armor";
  if (["weapon", "armor", "ammunition", "fashion", "gear"].includes(kind)) return kind;
  return "gear";
}

/** What is worth saying about this row beyond its name. */
export function detailFor(kind: ItemKind, row: CampaignInventoryItem): string {
  if (kind === "weapon") {
    try {
      const profile = weaponProfile(row.item_id);
      if (profile.magazine === null) return profile.damageDice ? String(profile.damageDice) : "";
      // An untracked magazine is a full one, the same reading planReload uses.
      const loaded = row.ammo_loaded === null ? profile.magazine : Math.max(0, row.ammo_loaded);
      return `${loaded}/${profile.magazine} loaded`;
    } catch {
      return "";
    }
  }
  if (kind === "armor") {
    const worn = row.slot ?? "";
    // current_sp is what the armor is at NOW, the only number that matters
    // once somebody has shot at it.
    return row.current_sp === null ? worn : `${worn} · SP ${row.current_sp}`.trim();
  }
  return "";
}

/** The name the catalog gives this row, falling back to its id. */
export function nameFor(kind: ItemKind, itemId: string): string {
  try {
    return catalogItem(kind, itemId).name;
  } catch {
    // A row the catalog does not know is still something the character is
    // carrying. Showing the id beats dropping it off the sheet.
    return itemId;
  }
}

/** Everything the character is carrying, grouped and ordered for display. */
export function carriedKit(
  inventory: CampaignInventoryItem[],
  cyberware: CampaignCyberware[] = [],
): KitGroup[] {
  return GROUP_ORDER.map(({ kind, label }) => {
    if (kind === "cyberware" && cyberware.length > 0) {
      return {
        kind,
        label,
        lines: cyberware.map((row) => ({
          id: row.id,
          name: getCyberware(row.item_id).name,
          detail: `installed day ${row.installed_day}`,
          quantity: 1,
        })),
      };
    }
    const lines: KitLine[] = [];
    for (const row of inventory) {
      if (kindOf(row) !== kind || row.quantity <= 0) continue;
      lines.push({
        id: row.id,
        name: nameFor(kind, row.item_id),
        detail: detailFor(kind, row),
        quantity: row.quantity,
      });
    }
    return { kind, label, lines };
  }).filter((group) => group.lines.length > 0);
}
