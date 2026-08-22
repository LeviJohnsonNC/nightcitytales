/**
 * Maps the printed labels used in src/data/rules/gear-packages.json onto rows
 * in src/data/rules/catalog.json.
 *
 * This file authors NO rules values. It only says which printed string refers
 * to which catalog row (plus a quantity or armor location when the label
 * itself states one). Anything it cannot match returns null, so the UI shows
 * the printed text unchanged rather than guessing.
 */
import {
  AMMUNITION,
  ARMOR,
  CYBERWARE,
  GEAR,
  WEAPONS,
  catalogItem,
  getCyberware,
  type ArmorLocation,
  type CatalogCyberware,
  type ItemKind,
} from "./catalog";

export type ResolvedPackageItem = {
  kind: ItemKind;
  id: string;
  /** Quantity stated inside the label, e.g. "… x100". */
  qty: number | null;
  /** Armor location stated inside the label, e.g. "… Head Armor". */
  location: ArmorLocation | null;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Catalog rows addressable by their own printed name. */
const BY_NAME = new Map<string, { kind: ItemKind; id: string }>();
for (const w of WEAPONS) BY_NAME.set(normalize(w.name), { kind: "weapon", id: w.id });
for (const a of ARMOR) BY_NAME.set(normalize(a.name), { kind: "armor", id: a.id });
for (const a of AMMUNITION) BY_NAME.set(normalize(a.name), { kind: "ammunition", id: a.id });
for (const g of GEAR) BY_NAME.set(normalize(g.name), { kind: "gear", id: g.id });

/**
 * Cyberware is resolved from its own name map, kept apart from BY_NAME because
 * several cyberware names collide with Gear (Audio Recorder, Memory Chip,
 * Medscanner, …). Package cyberware entries must never resolve to a Gear row.
 */
const CYBERWARE_BY_NAME = new Map<string, string>();
for (const c of CYBERWARE) CYBERWARE_BY_NAME.set(normalize(c.name), c.id);

/** The cyberware id behind a package cyberware label, or null if unmatched. */
export function resolvePackageCyberware(label: string): string | null {
  return CYBERWARE_BY_NAME.get(normalize(baseLabel(label))) ?? null;
}

/** The cyberware row behind a package cyberware label, for the info modal. */
export function packageCyberwareRow(label: string): CatalogCyberware | null {
  const id = resolvePackageCyberware(label);
  return id ? getCyberware(id) : null;
}

/**
 * Package labels that do not match a catalog name character-for-character.
 * Keys are normalized labels; values are catalog rows.
 */
const ALIASES: Record<string, { kind: ItemKind; id: string }> = {
  // Gear worded differently in the package tables.
  "cyberdeck 7 slots": { kind: "gear", id: "cyberdeck" },
  "disposable cellphone": { kind: "gear", id: "disposable_cell_phone" },
  "disposable phone": { kind: "gear", id: "disposable_cell_phone" },
  "electric guitar": { kind: "gear", id: "electric_guitar_other_instrument" },
  "pocket amp": { kind: "gear", id: "pocket_amplifier" },
  rope: { kind: "gear", id: "rope_60m_yd" },
  "inflatable bed sleep bag": { kind: "gear", id: "inflatable_bed_sleep_bag" },

  // Ammunition: the package names the calibre, the catalog names the type.
  "basic h pistol ammunition": { kind: "ammunition", id: "basic_ammo" },
  "basic vh pistol ammunition": { kind: "ammunition", id: "basic_ammo" },
  "basic rifle ammunition": { kind: "ammunition", id: "basic_ammo" },
  "basic shotgun shell ammunition": { kind: "ammunition", id: "basic_ammo" },
  "basic slug ammunition": { kind: "ammunition", id: "basic_ammo" },
  "incendiary rifle ammunition": { kind: "ammunition", id: "incendiary_ammo" },
  "incendiary shotgun shell ammunition": { kind: "ammunition", id: "incendiary_ammo" },
  "smoke grenade": { kind: "ammunition", id: "smoke_ammo" },
  "flashbang grenade": { kind: "ammunition", id: "flashbang_ammo" },
  "teargas grenade": { kind: "ammunition", id: "teargas_ammo" },

  // Armor: the package spells out the location and the SP.
  "light armorjack body armor": { kind: "armor", id: "light_armorjack" },
  "light armorjack head armor": { kind: "armor", id: "light_armorjack" },
};

function statedQty(label: string): number | null {
  const match = /\sx(\d+)\b/i.exec(label);
  return match ? Number(match[1]) : null;
}

function statedLocation(label: string): ArmorLocation | null {
  const lower = label.toLowerCase();
  if (lower.includes("head armor")) return "head";
  if (lower.includes("body armor")) return "body";
  if (lower.includes("shield")) return "shield";
  return null;
}

/** Strip the quantity suffix and any parenthetical the label carries. */
function baseLabel(label: string): string {
  return label
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+x\d+\b/gi, "")
    .trim();
}

export function resolvePackageItem(label: string): ResolvedPackageItem | null {
  const key = normalize(baseLabel(label));
  const hit = ALIASES[key] ?? BY_NAME.get(key);
  if (!hit) return null;
  return {
    kind: hit.kind,
    id: hit.id,
    qty: statedQty(label),
    location: hit.kind === "armor" ? statedLocation(label) : null,
  };
}

/** The catalog row behind a package label, ready for the info modal. */
export function packageCatalogRow(label: string) {
  const resolved = resolvePackageItem(label);
  if (!resolved) return null;
  return { ...resolved, item: catalogItem(resolved.kind, resolved.id) };
}

/**
 * Specific weapons a generic package label stands for (e.g. "Heavy Melee
 * Weapon" → Lead Pipe / Sword / Spiked Bat), taken from catalog.json.
 */
export function variantOptionsFor(label: string): string[] {
  const resolved = resolvePackageItem(label);
  if (!resolved || resolved.kind !== "weapon") return [];
  const weapon = WEAPONS.find((w) => w.id === resolved.id) as unknown as
    { variants?: string[] } | undefined;
  return weapon?.variants ?? [];
}

export function requiresVariant(label: string): boolean {
  return variantOptionsFor(label).length > 0;
}
