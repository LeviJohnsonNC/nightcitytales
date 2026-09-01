/**
 * Every catalog item narration is allowed to link, keyed by its printed name.
 * Names come from the rules catalog only — nothing here invents an item.
 */
import { AMMUNITION, ARMOR, CYBERWARE, GEAR, WEAPONS } from "@/engine";
import type { ItemKindLabel } from "@/features/chargen/ItemInfo";

export type DirectoryItem = {
  kind: ItemKindLabel;
  item: { id: string; name: string } & Record<string, unknown>;
};

/**
 * Catalog rows whose printed name is an ordinary English phrase. Linking these
 * would light up half of every paragraph, so narration leaves them alone.
 */
const TOO_GENERIC = new Set(
  [
    "Light Melee Weapon",
    "Medium Melee Weapon",
    "Heavy Melee Weapon",
    "Very Heavy Melee Weapon",
    "Basic Ammunition",
    "Grenade",
    "Rope",
    "Handcuffs",
    "Flashlight",
    "Duct Tape",
    "Radio Communicator",
    "Road Flare",
    "Glow Paint",
    "Medtech Bag",
    "Personal CarePak",
  ].map((n) => n.toLowerCase()),
);

const rows: DirectoryItem[] = [
  ...WEAPONS.map((item) => ({ kind: "weapon" as const, item: item as never })),
  ...GEAR.map((item) => ({ kind: "gear" as const, item: item as never })),
  ...ARMOR.map((item) => ({ kind: "armor" as const, item: item as never })),
  ...AMMUNITION.map((item) => ({ kind: "ammunition" as const, item: item as never })),
  ...CYBERWARE.map((item) => ({ kind: "cyberware" as const, item: item as never })),
];

const BY_NAME = new Map<string, DirectoryItem>();
for (const row of rows) {
  const name = row.item.name;
  if (!name || name.length < 4) continue;
  const key = name.toLowerCase();
  if (TOO_GENERIC.has(key)) continue;
  if (!BY_NAME.has(key)) BY_NAME.set(key, row);
}

/** Longest first so "Neural Link" beats "Link". */
export const ITEM_MATCH_KEYS: string[] = [...BY_NAME.values()]
  .map((r) => r.item.name)
  .sort((a, b) => b.length - a.length);

export function resolveItemMention(text: string): DirectoryItem | undefined {
  return BY_NAME.get(text.trim().toLowerCase());
}
