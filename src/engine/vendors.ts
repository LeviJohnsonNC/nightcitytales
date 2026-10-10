/**
 * Who sells what, and whether they have it.
 *
 * A catalogue of everything, always available, is a store menu. Night City is
 * people: a guy in a lockup off Longshore who has ammo and three pistols, an
 * armorer who will not touch chrome, a fixer who can get you anything if you
 * can stand the markup and the fact that now they know you wanted it.
 *
 * So this module answers two questions and nothing else:
 *
 *   - Which items would this person plausibly have on the shelf at all?
 *   - Is the unusual thing actually there tonight?
 *
 * The second is a die, not a decision. The ordinary stock — ammunition, basic
 * armor, everyday kit — is always there, because a world where you cannot
 * reliably buy bullets is not gritty, it is annoying. Anything expensive or
 * exotic is rolled for, so a big purchase becomes a small story and "they're
 * out" is an answer nobody authored.
 *
 * Pure TypeScript: catalog in, shelves out. No React, no backend, no dice
 * unless one is injected.
 */
import placeShops from "@/data/atlas/place-shops.json";
import { ARMOR, AMMUNITION, GEAR, WEAPONS, itemCost, type ItemKind } from "./catalog";
import { defaultRng } from "./dice";
import { districtOfPlace, getPlace, placeKeyOf, travelMinutes, type TravelMode } from "./geography";
import { priceCategoryContext, priceCategoryForCost } from "./priceCategory";
import { entryFor, rollOracle, type OracleResult, type OracleTable } from "./oracle";
import type { RNG } from "./types";

/**
 * Whether a thing is on the shelf as a matter of course, or has to be found.
 *
 * The line is drawn on price because price is what the rules already say about
 * how hard a thing is to come by — the Night Market cost ladder IS the
 * availability ladder, and inventing a second one would be inventing a fact.
 */
export const SHELF_TIERS = ["ordinary", "unusual"] as const;
export type ShelfTier = (typeof SHELF_TIERS)[number];

/**
 * Above this, a vendor has to actually go and look.
 *
 * The published cost ladder is Cheap 10, Everyday 20, Costly 50, Premium 100,
 * Expensive 500, Very Expensive 1000. The line is drawn at the top of Premium,
 * so everything through 100eb is shelf stock and the jump to Expensive — which
 * in this catalog is a fivefold step, not a nudge — is where a vendor starts
 * having to make calls. Nothing here invents a threshold: it names one the
 * rules already print.
 */
export const UNUSUAL_ABOVE = 100;

export function shelfTier(kind: ItemKind, itemId: string): ShelfTier {
  return itemCost(kind, itemId) > UNUSUAL_ABOVE ? "unusual" : "ordinary";
}

/**
 * Is it in tonight?
 *
 * Only ever consulted for the unusual, and open: the player watches this one,
 * because watching the shop roll empty is what makes the shop feel like a place
 * rather than a vending machine.
 */
export const STOCK: OracleTable = {
  id: "stock",
  label: "On the shelf",
  die: 6,
  visibility: "open",
  entries: [
    {
      from: 1,
      to: 2,
      key: "out",
      text: "Not in stock. They can talk about it; they cannot sell it.",
    },
    {
      from: 3,
      to: 3,
      key: "last_one",
      text: "One left, and they know it. The price does not move and neither do they.",
    },
    { from: 4, to: 6, key: "in", text: "In stock." },
  ],
};

/** What a vendor's standing with the character is worth when they go looking. */
export const STOCK_REGULAR_BONUS = 1;

/** True when this roll of the shelf means the item can actually be bought. */
export function inStock(result: OracleResult): boolean {
  return result.tableId === STOCK.id && result.key !== "out";
}

// ---------------------------------------------------------------------------
// The people.
// ---------------------------------------------------------------------------

export const VENDOR_IDS = ["street", "gun_shop", "armorer", "fixer"] as const;
export type VendorId = (typeof VENDOR_IDS)[number];

export type Vendor = {
  /** An archetype's id, or `archetype@place` for one sold at a place in the atlas. */
  id: string;
  /** What this place is, in the character's own words. */
  label: string;
  /** One line of who they are, shown above the shelf. */
  line: string;
  /** The kinds they deal in at all. Anything else, they do not sell. */
  deals: ItemKind[];
  /**
   * The cast role this vendor IS, when the campaign already has that person.
   * A fixer you know is not a shop; it is a phone call to somebody with a name.
   */
  castRole?: string;
  /** The atlas place this seller is at. Absent for an archetype, and for the fixer, who is a call. */
  place?: string;
  /** Minutes it takes to go and deal with them, there and back (at the counter, once at a place). */
  minutes: number;
  /**
   * What they add to the printed price. A fixer's Reach costs money; the street
   * is the street. Expressed as a multiplier on the Night Market cost.
   */
  markup: number;
  /** What they say when asked for something outside what they deal in. */
  refusal: string;
  /**
   * Who is on the other side of the table when the price is argued about.
   *
   * COOL and Trading, which is the printed Haggle opposition. A pitch on a
   * folding table argues less well than a fixer whose whole living is this.
   */
  haggle: { cool: number; trading: number };
};

export const VENDORS: Vendor[] = [
  {
    id: "street",
    label: "The street market",
    line: "Tarps, folding tables, and whoever is working the pitch tonight.",
    deals: ["ammunition", "gear"],
    minutes: 45,
    markup: 1,
    refusal: "Nobody out here is selling you a gun in daylight. Ammo and kit, that's the pitch.",
    haggle: { cool: 4, trading: 3 },
  },
  {
    id: "gun_shop",
    label: "The gun shop",
    line: "A steel door, a buzzer, and a man who watches your hands.",
    deals: ["weapon", "ammunition"],
    minutes: 90,
    markup: 1,
    refusal: "He sells guns and what goes in them. Armor is two doors down and not his problem.",
    haggle: { cool: 5, trading: 4 },
  },
  {
    id: "armorer",
    label: "The armorer",
    line: "A back room that smells of solvent, with plate hanging on hooks.",
    deals: ["armor", "gear"],
    minutes: 90,
    markup: 1,
    refusal: "Armor and the kit to keep it working. He does not stock weapons and says so often.",
    haggle: { cool: 5, trading: 4 },
  },
  {
    id: "fixer",
    label: "Your fixer",
    line: "One call, and then a wait, and then a price.",
    deals: ["weapon", "armor", "ammunition", "gear"],
    castRole: "fixer",
    minutes: 120,
    // Reach is a service and it is billed. The premium is the point: it is the
    // difference between shopping and asking someone to owe somebody for you.
    markup: 1.25,
    refusal: "They can get most things. Most is not all, and they will say which.",
    haggle: { cool: 7, trading: 6 },
  },
];

const VENDORS_BY_ID = new Map(VENDORS.map((v) => [v.id, v]));

// ---------------------------------------------------------------------------
// The places.
// ---------------------------------------------------------------------------

/** One seller at one place in the atlas, as `place-shops.json` states it. */
type PlaceShop = {
  place: string;
  vendor: VendorId;
  label: string;
  line: string;
};

export const PLACE_SHOPS_ARE_HOUSE_RULE: boolean = placeShops.houseRule;
export const PLACE_SHOPS = placeShops.shops as PlaceShop[];
/** What a visit costs once the character is already standing at the counter. */
export const PLACE_VISIT_MINUTES: number = placeShops.visitMinutes;

/** Separates an archetype from the place it is sold at in a vendor's id. */
const AT = "@";

/** The id of the seller `vendor` at `place`: what is stored in the ledger and in a regular's flag. */
export function placeVendorId(vendor: VendorId, place: string): string {
  return `${vendor}${AT}${place}`;
}

function placeShopFor(vendor: string, place: string): PlaceShop | undefined {
  return PLACE_SHOPS.find((s) => s.vendor === vendor && s.place === place);
}

/** A seller at a place: the archetype's way of selling, under the place's name and in its voice. */
function atPlace(shop: PlaceShop): Vendor {
  const base = VENDORS_BY_ID.get(shop.vendor)!;
  return {
    ...base,
    id: placeVendorId(shop.vendor, shop.place),
    label: shop.label,
    line: shop.line,
    place: shop.place,
    minutes: PLACE_VISIT_MINUTES,
  };
}

/**
 * Everyone who will sell to a character standing at `placeKey`. Empty
 * anywhere that is not a shop: a character in the street has to go somewhere.
 */
export function shopsAt(placeKey: string | null | undefined): Vendor[] {
  const key = placeKeyOf(placeKey);
  if (!key) return [];
  return PLACE_SHOPS.filter((s) => s.place === key).map(atPlace);
}

/** Your fixer, who is a person and a phone call, and so is the one seller that is not somewhere. */
export const FIXER_VENDOR: Vendor = VENDORS_BY_ID.get("fixer")!;

export type ShopPlace = {
  placeKey: string;
  name: string;
  districtName: string | undefined;
  minutes: number;
  vendors: Vendor[];
};

/**
 * The places that sell, nearest first, priced as a trip from where the
 * character stands. The trip is the atlas's own, in whatever they would travel
 * by, so what the sheet quotes is what the map will charge.
 */
export function nearestShops(
  from: string | null | undefined,
  mode?: TravelMode,
  limit = 4,
): ShopPlace[] {
  const places = [...new Set(PLACE_SHOPS.map((s) => s.place))];
  return places
    .map((placeKey) => ({
      placeKey,
      name: getPlace(placeKey)?.name ?? placeKey,
      districtName: districtOfPlace(placeKey)?.name,
      minutes: travelMinutes(from, placeKey, mode),
      vendors: shopsAt(placeKey),
    }))
    .sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function getVendor(id: string): Vendor {
  const [archetype, place] = id.split(AT);
  const base = VENDORS_BY_ID.get(archetype as VendorId);
  if (!base) throw new Error(`No vendor "${id}".`);
  if (place === undefined) return base;
  const shop = placeShopFor(archetype!, place);
  if (!shop) throw new Error(`No vendor "${id}".`);
  return atPlace(shop);
}

export function isVendorId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    getVendor(value);
    return true;
  } catch {
    return false;
  }
}

export function vendorPrice(vendor: Vendor, kind: ItemKind, itemId: string): number {
  return Math.round(itemCost(kind, itemId) * vendor.markup);
}

// ---------------------------------------------------------------------------
// The shelf.
// ---------------------------------------------------------------------------

export type ShelfItem = {
  kind: ItemKind;
  itemId: string;
  name: string;
  /** What this vendor wants for it, markup included. */
  price: number;
  tier: ShelfTier;
};

function itemsOfKind(kind: ItemKind): { id: string; name: string }[] {
  switch (kind) {
    case "weapon":
      return WEAPONS.map((w) => ({ id: w.id, name: w.name }));
    case "armor":
      return ARMOR.map((a) => ({ id: a.id, name: a.name }));
    case "ammunition":
      return AMMUNITION.map((a) => ({ id: a.id, name: a.name }));
    case "gear":
      return GEAR.map((g) => ({ id: g.id, name: g.name }));
    // Chrome is a surgical procedure, not a purchase, and belongs to the
    // ripperdoc. Fashion is bought as a Lifestyle, not off a shelf.
    case "cyberware":
    case "fashion":
      return [];
  }
}

/**
 * Everything this vendor could conceivably sell, priced and tiered.
 *
 * Deterministic and complete: what is actually available tonight is a separate
 * question, asked per item and only for the unusual, so that the shelf itself
 * stays stable while the stock does not.
 */
export function shelfFor(vendor: Vendor): ShelfItem[] {
  const out: ShelfItem[] = [];
  for (const kind of vendor.deals) {
    for (const item of itemsOfKind(kind)) {
      out.push({
        kind,
        itemId: item.id,
        name: item.name,
        price: vendorPrice(vendor, kind, item.id),
        tier: shelfTier(kind, item.id),
      });
    }
  }
  return out.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
}

/** True when this vendor deals in this kind at all. */
export function vendorDealsIn(vendor: Vendor, kind: ItemKind): boolean {
  return vendor.deals.includes(kind);
}

export type StockCheck = {
  /** True when the item can be bought right now. */
  available: boolean;
  /** The roll, when one was needed. Null for ordinary stock, which is just there. */
  roll: OracleResult | null;
  /** Why: "ordinary" when it never needed asking, "reach" when a Fixer sourced
   * it on their own Operator Reach, otherwise the oracle's key. */
  key: string;
};

/**
 * The price category an item sits in.
 *
 * Gear lines carry their own printed category; weapons, armor and ammunition do
 * not, so those are read off the cost ladder instead.
 */
export function itemPriceCategory(kind: ItemKind, itemId: string): string | null {
  if (kind === "gear") {
    const entry = GEAR.find((g) => g.id === itemId);
    if (entry?.priceCategory) return entry.priceCategory;
  }
  return priceCategoryForCost(itemCost(kind, itemId));
}

/**
 * True when this Fixer's Operator Reach always sources this item.
 *
 * The Reach rank per category is parsed from the Fixer's own rules text in
 * priceCategory.ts; a category the ladder does not know, or a rank the text
 * states no tier for, is not within anybody's Reach.
 */
export function withinReach(kind: ItemKind, itemId: string, operatorRank: number): boolean {
  const rank = Math.max(0, Math.trunc(operatorRank));
  if (rank <= 0) return false;
  const category = itemPriceCategory(kind, itemId);
  const context = priceCategoryContext(category);
  if (!context || context.fixerRank === null) return false;
  return rank >= context.fixerRank;
}

export type StockCheckOptions = {
  /** True when the character has dealt with this vendor before and it showed. */
  regular?: boolean;
  /**
   * The character's own Operator Rank, when they are a Fixer.
   *
   * Reach is the printed half of Operator that nobody could reach: "the highest
   * price category the Fixer can always source". Always means always, so within
   * their Reach the shelf is not rolled for at all — which is the difference
   * between knowing a guy and being the guy.
   */
  operatorRank?: number;
  rng?: RNG;
};

/**
 * Ask whether the unusual thing is actually here.
 *
 * Ordinary stock short-circuits without a die: asking whether the ammo counter
 * has ammo is not a story, it is a delay. Being known to the vendor shifts the
 * read rather than the die, so the ledger shows the honest face.
 */
export function checkStock(
  vendor: Vendor,
  item: ShelfItem,
  options: StockCheckOptions = {},
): StockCheck {
  if (!vendorDealsIn(vendor, item.kind)) {
    return { available: false, roll: null, key: "not_dealt" };
  }
  if (item.tier === "ordinary") return { available: true, roll: null, key: "ordinary" };
  // A Fixer inside their own Reach does not roll. The rules say "always source",
  // and a die that can answer no is not always.
  if (withinReach(item.kind, item.itemId, options.operatorRank ?? 0)) {
    return { available: true, roll: null, key: "reach" };
  }

  const roll = rollOracle(STOCK, options.rng ?? defaultRng, {
    modifiers: options.regular ? [{ label: "Known here", value: STOCK_REGULAR_BONUS }] : [],
  });
  return { available: inStock(roll), roll, key: roll.key };
}

/** The entry a given read of the stock die lands on, for tests and display. */
export function stockEntryFor(read: number) {
  return entryFor(STOCK, read);
}
