/**
 * Typed access to the v1 Night Market catalog in src/data/rules/catalog.json.
 * No value here is inferred: every number is read from the file.
 */
import catalogData from "@/data/rules/catalog.json";

export type CatalogWeapon = {
  id: string;
  name: string;
  category: string;
  skill: string;
  damage: string;
  magazine: number | null;
  rof: number;
  handsRequired: string;
  concealable: boolean;
  cost: number;
  notes?: string | null;
};

export type ArmorLocation = "head" | "body" | "shield";

export type CatalogArmor = {
  id: string;
  name: string;
  sp: number | null;
  hp?: number | null;
  penalty: { stats: string[]; value: number } | null;
  cost: number;
  locations: ArmorLocation[];
  notes?: string | null;
};

export type CatalogAmmunition = {
  id: string;
  name: string;
  cost: number;
  unit: string;
  types: string[];
  notes?: string | null;
};

export type CatalogCyberware = {
  id: string;
  name: string;
  category: string;
  install: string;
  cost: number;
  /** Preset flat Humanity Loss used at Character Generation. */
  humanityLoss: number;
  humanityLossDice: string | null;
  slotsUsed: number;
  requires: string | null;
  foundational: boolean;
  providesSlots: number | null;
  notes?: string | null;
};

export const WEAPONS = catalogData.weapons as CatalogWeapon[];
export const ARMOR = catalogData.armor as unknown as CatalogArmor[];
export const AMMUNITION = catalogData.ammunition as CatalogAmmunition[];
export const CYBERWARE = catalogData.cyberware as CatalogCyberware[];

export const CATALOG_RULES = catalogData._rules;

/** Row counts the file itself flags as not yet extracted. */
export const CATALOG_PENDING = catalogData._pending as string[];

export type ItemKind = "weapon" | "armor" | "ammunition" | "cyberware";

const WEAPONS_BY_ID = new Map(WEAPONS.map((w) => [w.id, w]));
const ARMOR_BY_ID = new Map(ARMOR.map((a) => [a.id, a]));
const AMMO_BY_ID = new Map(AMMUNITION.map((a) => [a.id, a]));
const CYBER_BY_ID = new Map(CYBERWARE.map((c) => [c.id, c]));

export function getWeapon(id: string): CatalogWeapon {
  const w = WEAPONS_BY_ID.get(id);
  if (!w) throw new Error(`Unknown weapon "${id}" (src/data/rules/catalog.json → weapons)`);
  return w;
}
export function getArmor(id: string): CatalogArmor {
  const a = ARMOR_BY_ID.get(id);
  if (!a) throw new Error(`Unknown armor "${id}" (src/data/rules/catalog.json → armor)`);
  return a;
}
export function getAmmunition(id: string): CatalogAmmunition {
  const a = AMMO_BY_ID.get(id);
  if (!a) throw new Error(`Unknown ammunition "${id}" (src/data/rules/catalog.json → ammunition)`);
  return a;
}
export function getCyberware(id: string): CatalogCyberware {
  const c = CYBER_BY_ID.get(id);
  if (!c) throw new Error(`Unknown cyberware "${id}" (src/data/rules/catalog.json → cyberware)`);
  return c;
}

export function itemName(kind: ItemKind, id: string): string {
  return catalogItem(kind, id).name;
}

export function itemCost(kind: ItemKind, id: string): number {
  return catalogItem(kind, id).cost;
}

export function catalogItem(
  kind: ItemKind,
  id: string,
): CatalogWeapon | CatalogArmor | CatalogAmmunition | CatalogCyberware {
  switch (kind) {
    case "weapon":
      return getWeapon(id);
    case "armor":
      return getArmor(id);
    case "ammunition":
      return getAmmunition(id);
    case "cyberware":
      return getCyberware(id);
  }
}

/** Complete Package budgets, straight from catalog.json _rules. */
export const COMPLETE_PACKAGE_BUDGETS = CATALOG_RULES.completePackageBudgets;

/** Foundation slot counts and the non-foundational per-category cap. */
const OPTION_SLOT_RULES = CATALOG_RULES.optionSlots as unknown as {
  foundational: Record<string, { slots: number; perUnit?: boolean; maxInstalls?: number; notes?: string }>;
  nonFoundational: string;
  default: string;
};

export function foundationRule(id: string): { slots: number; perUnit?: boolean; maxInstalls?: number } {
  const rule = OPTION_SLOT_RULES.foundational[id];
  if (!rule) {
    throw new Error(
      `No option-slot rule for foundation "${id}" (src/data/rules/catalog.json → _rules.optionSlots.foundational)`,
    );
  }
  return rule;
}

/**
 * "a Character may still only implant 7 Option Slots worth of each category"
 * — parsed from _rules.optionSlots.nonFoundational so the number is not typed here.
 */
export const NON_FOUNDATIONAL_CATEGORY_SLOT_CAP: number | null = (() => {
  const match = /(\d+)\s+Option Slots/.exec(OPTION_SLOT_RULES.nonFoundational);
  return match ? Number(match[1]) : null;
})();

export const HUMANITY_LOSS_AT_CREATION_RULE = CATALOG_RULES.humanityLossAtCreation;
