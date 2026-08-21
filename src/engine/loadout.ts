/**
 * Purchasing, armor and cyberware-install math. Pure functions over a plain
 * Loadout object. Every limit is read from the rules data via ./catalog and
 * ./gearPackages — nothing is hardcoded here.
 */
import {
  ARMOR,
  COMPLETE_PACKAGE_BUDGETS,
  NON_FOUNDATIONAL_CATEGORY_SLOT_CAP,
  catalogItem,
  foundationRule,
  getArmor,
  getCyberware,
  itemName,
  type ArmorLocation,
  type ItemKind,
} from "./catalog";
import { PACKAGE_FREE_EUROBUCKS, PACKAGE_UNSPENT_KEPT } from "./gearPackages";
import { applyCyberwareHumanityLoss, type HumanityLossResult } from "./humanity";
import type { CreationMethod } from "./types";

export type BudgetId = "free" | "gear" | "fashion";

export type CartLine = {
  lineId: string;
  kind: ItemKind;
  itemId: string;
  qty: number;
  budget: BudgetId;
  /** Flavor variant of a generic item (e.g. "Combat Knife"). Cosmetic only. */
  variant?: string | null;
  /** Armor only: which location it is worn on. */
  location?: ArmorLocation | null;
  /** Armor only: ablates in play, so it is tracked apart from the base SP. */
  currentSp?: number | null;
  /** Cyberware options only: the foundation install line this slots into. */
  foundationLineId?: string | null;
};

export type Loadout = {
  /** Fixed-package either/or picks, keyed by choice point id. */
  packageChoices: Record<string, string>;
  /**
   * Specific weapon picked for a package entry that only names a class,
   * keyed by the same choice-point id.
   */
  packageVariants?: Record<string, string>;
  lines: CartLine[];
};

export const EMPTY_LOADOUT: Loadout = { packageChoices: {}, packageVariants: {}, lines: [] };

export type BudgetDefinition = {
  id: BudgetId;
  label: string;
  limit: number;
  unspentKept: boolean;
  /** True when only Fashion / Fashionware may be bought with it. */
  fashionOnly: boolean;
};

export function budgetsForMethod(method: CreationMethod): BudgetDefinition[] {
  if (method === "complete_package") {
    return [
      {
        id: "gear",
        label: "Weapons, armor, gear & cyberware",
        limit: COMPLETE_PACKAGE_BUDGETS.gearEurobucks,
        unspentKept: COMPLETE_PACKAGE_BUDGETS.gearUnspentKept,
        fashionOnly: false,
      },
      {
        id: "fashion",
        label: "Fashion & Fashionware only",
        limit: COMPLETE_PACKAGE_BUDGETS.fashionEurobucks,
        unspentKept: COMPLETE_PACKAGE_BUDGETS.fashionUnspentKept,
        fashionOnly: true,
      },
    ];
  }
  return [
    {
      id: "free",
      label: "Free spend on top of your package",
      limit: PACKAGE_FREE_EUROBUCKS,
      unspentKept: PACKAGE_UNSPENT_KEPT,
      fashionOnly: false,
    },
  ];
}

/** Fashion money may only buy Fashion or Fashionware. */
export function isFashionItem(kind: ItemKind, itemId: string): boolean {
  if (kind === "fashion") return true;
  return kind === "cyberware" && getCyberware(itemId).category === "fashionware";
}

/** The fashion pieces bought so far, as cart lines. */
export function fashionLines(loadout: Loadout): CartLine[] {
  return loadout.lines.filter((l) => l.kind === "fashion");
}

export function lineCost(line: CartLine): number {
  return catalogItem(line.kind, line.itemId).cost * line.qty;
}

export type BudgetState = BudgetDefinition & {
  spent: number;
  remaining: number;
  overspent: boolean;
};

export function budgetStates(method: CreationMethod, loadout: Loadout): BudgetState[] {
  return budgetsForMethod(method).map((budget) => {
    const spent = loadout.lines
      .filter((l) => l.budget === budget.id)
      .reduce((sum, l) => sum + lineCost(l), 0);
    return {
      ...budget,
      spent,
      remaining: budget.limit - spent,
      overspent: spent > budget.limit,
    };
  });
}

/** Eurobucks the character walks away with. Budgets marked unspentKept:false evaporate. */
export function eurobucksKept(method: CreationMethod, loadout: Loadout): number {
  return budgetStates(method, loadout)
    .filter((b) => b.unspentKept)
    .reduce((sum, b) => sum + Math.max(0, b.remaining), 0);
}

/** Budgets that still hold money that will be lost on leaving. */
export function evaporatingBudgets(method: CreationMethod, loadout: Loadout): BudgetState[] {
  return budgetStates(method, loadout).filter((b) => !b.unspentKept && b.remaining > 0);
}

/* ------------------------------------------------------------------ armor */

export function wornArmor(loadout: Loadout): Partial<Record<ArmorLocation, CartLine>> {
  const out: Partial<Record<ArmorLocation, CartLine>> = {};
  for (const line of loadout.lines) {
    if (line.kind === "armor" && line.location) out[line.location] = line;
  }
  return out;
}

export function armorLocations(itemId: string): ArmorLocation[] {
  return getArmor(itemId).locations;
}

export const ARMOR_ITEMS = ARMOR;

/* ------------------------------------------------------- cyberware installs */

export type FoundationState = {
  line: CartLine;
  itemId: string;
  name: string;
  slots: number;
  used: number;
  free: number;
};

export function foundations(loadout: Loadout): FoundationState[] {
  return loadout.lines
    .filter((l) => l.kind === "cyberware" && getCyberware(l.itemId).foundational)
    .map((line) => {
      const item = getCyberware(line.itemId);
      const slots = item.providesSlots ?? foundationRule(item.id).slots;
      const used = loadout.lines
        .filter((l) => l.foundationLineId === line.lineId)
        .reduce((sum, l) => sum + getCyberware(l.itemId).slotsUsed, 0);
      return { line, itemId: item.id, name: item.name, slots, used, free: slots - used };
    });
}

/** Slots consumed per category by cyberware that has no foundation. */
export function categorySlotUsage(loadout: Loadout): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of loadout.lines) {
    if (line.kind !== "cyberware") continue;
    const item = getCyberware(line.itemId);
    if (item.foundational || item.requires) continue;
    out[item.category] = (out[item.category] ?? 0) + item.slotsUsed * line.qty;
  }
  return out;
}

/** Preset Humanity Loss per installed piece. Dice are not rolled at creation. */
export function humanityLossRolls(loadout: Loadout): number[] {
  return loadout.lines
    .filter((l) => l.kind === "cyberware")
    .flatMap((l) => Array.from({ length: l.qty }, () => getCyberware(l.itemId).humanityLoss))
    .filter((loss) => loss > 0);
}

export function loadoutHumanity(humanityMax: number, loadout: Loadout): HumanityLossResult {
  return applyCyberwareHumanityLoss(humanityMax, humanityLossRolls(loadout));
}

/* ------------------------------------------------------------- purchasing */

export type PurchaseRequest = {
  kind: ItemKind;
  itemId: string;
  budget: BudgetId;
  qty?: number;
  location?: ArmorLocation | null;
  foundationLineId?: string | null;
  /** Flavor variant of a generic item (e.g. "Combat Knife"). Cosmetic only. */
  variant?: string | null;
};

export type PurchaseCheck = { ok: boolean; reason: string | null };

export function canPurchase(
  method: CreationMethod,
  loadout: Loadout,
  request: PurchaseRequest,
): PurchaseCheck {
  const qty = request.qty ?? 1;
  const budget = budgetStates(method, loadout).find((b) => b.id === request.budget);
  if (!budget) {
    return { ok: false, reason: `This creation method has no "${request.budget}" budget.` };
  }

  const name = itemName(request.kind, request.itemId);

  if (budget.fashionOnly && !isFashionItem(request.kind, request.itemId)) {
    return {
      ok: false,
      reason: `You cannot buy ${name} with fashion money: the ${budget.limit}eb Fashion budget only buys Fashion and Fashionware.`,
    };
  }

  const cost = catalogItem(request.kind, request.itemId).cost * qty;
  if (cost > budget.remaining) {
    return {
      ok: false,
      reason: `${name} costs ${cost}eb and you have ${Math.max(0, budget.remaining)}eb left in "${budget.label}".`,
    };
  }

  if (request.kind === "armor") {
    const armor = getArmor(request.itemId);
    const location = request.location ?? armor.locations[0]!;
    if (!armor.locations.includes(location)) {
      return { ok: false, reason: `${name} cannot be worn on the ${location} location.` };
    }
    const worn = wornArmor(loadout)[location];
    if (worn) {
      return {
        ok: false,
        reason: `You are already wearing ${itemName("armor", worn.itemId)} on your ${location}. Only one armor per location.`,
      };
    }
  }

  if (request.kind === "cyberware") {
    const item = getCyberware(request.itemId);

    if (item.foundational) {
      const rule = foundationRule(item.id);
      if (rule.maxInstalls !== undefined) {
        const installed = loadout.lines.filter((l) => l.itemId === item.id).length;
        if (installed >= rule.maxInstalls) {
          return {
            ok: false,
            reason: `You can only install ${rule.maxInstalls} ${item.name}.`,
          };
        }
      }
    } else if (item.requires) {
      const foundationItem = getCyberware(item.requires);
      if (!foundationItem.foundational) {
        // A prerequisite that is not itself a foundation (e.g. a Chipware
        // Socket) only has to be present; it provides no Option Slots.
        const present = loadout.lines.some((l) => l.itemId === item.requires);
        if (!present) {
          return {
            ok: false,
            reason: `${name} requires a ${foundationItem.name}. Install a ${foundationItem.name} first.`,
          };
        }
        return { ok: true, reason: null };
      }
      const available = foundations(loadout).filter((f) => f.itemId === item.requires);
      if (available.length === 0) {
        return {
          ok: false,
          reason: `${name} slots into a ${foundationItem.name}. Install a ${foundationItem.name} first.`,
        };
      }
      const target = request.foundationLineId
        ? available.find((f) => f.line.lineId === request.foundationLineId)
        : available.find((f) => f.free >= item.slotsUsed);
      if (!target) {
        return {
          ok: false,
          reason: `Every ${foundationItem.name} is full. ${name} needs ${item.slotsUsed} Option Slot(s).`,
        };
      }
      if (target.free < item.slotsUsed) {
        return {
          ok: false,
          reason: `That ${foundationItem.name} has ${target.free} of ${target.slots} Option Slots free and ${name} needs ${item.slotsUsed}.`,
        };
      }
    } else if (NON_FOUNDATIONAL_CATEGORY_SLOT_CAP !== null && item.slotsUsed > 0) {
      const used = categorySlotUsage(loadout)[item.category] ?? 0;
      if (used + item.slotsUsed * qty > NON_FOUNDATIONAL_CATEGORY_SLOT_CAP) {
        return {
          ok: false,
          reason: `You may only implant ${NON_FOUNDATIONAL_CATEGORY_SLOT_CAP} Option Slots of ${item.category} and you have used ${used}.`,
        };
      }
    }
  }

  return { ok: true, reason: null };
}

let lineCounter = 0;
function nextLineId(): string {
  lineCounter += 1;
  return `line-${Date.now().toString(36)}-${lineCounter}`;
}

/** Adds a purchase. Throws when canPurchase rejects it, so callers must check first. */
export function addPurchase(
  method: CreationMethod,
  loadout: Loadout,
  request: PurchaseRequest,
): Loadout {
  const check = canPurchase(method, loadout, request);
  if (!check.ok) throw new Error(check.reason ?? "Purchase not allowed");

  const qty = request.qty ?? 1;
  const line: CartLine = {
    lineId: nextLineId(),
    kind: request.kind,
    itemId: request.itemId,
    qty,
    budget: request.budget,
  };

  if (request.variant) line.variant = request.variant;

  if (request.kind === "armor") {
    const armor = getArmor(request.itemId);
    line.location = request.location ?? armor.locations[0]!;
    line.currentSp = armor.sp;
  }

  if (request.kind === "cyberware") {
    const item = getCyberware(request.itemId);
    if (!item.foundational && item.requires && getCyberware(item.requires).foundational) {
      const available = foundations(loadout).filter((f) => f.itemId === item.requires);
      const target = request.foundationLineId
        ? available.find((f) => f.line.lineId === request.foundationLineId)
        : available.find((f) => f.free >= item.slotsUsed);
      line.foundationLineId = target?.line.lineId ?? null;
    } else {
      line.foundationLineId = null;
    }
  }

  return { ...loadout, lines: [...loadout.lines, line] };
}

/** Removing a foundation removes everything slotted into it. */
export function removeLine(loadout: Loadout, lineId: string): Loadout {
  return {
    ...loadout,
    lines: loadout.lines.filter((l) => l.lineId !== lineId && l.foundationLineId !== lineId),
  };
}
