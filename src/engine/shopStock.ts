/**
 * What is on a shop's shelf this week, and why.
 *
 * `vendors.ts` says what a seller COULD have. This says what they DO have, and
 * it is a function rather than a die thrown at the counter. The stock die used
 * to be rolled every time Buy was pressed and never written down, so a rifle
 * that was "not in stock tonight" was in stock if you pressed again: the shelf
 * was a slot machine, and the world it was meant to make honest was a lie with
 * extra steps.
 *
 * Now a shop's stock is derived the way Reputation and the Screamsheet are, from
 * things that do not move under you:
 *
 *   - the campaign's seed, the seller and the stock WEEK (`STOCK_PERIOD_DAYS`),
 *     which seed the printed stock die once per item per week, so the read is
 *     the same every time anybody asks until the week turns;
 *   - what the character bought there this week, read back from the ledger,
 *     which is what has come off the shelf;
 *   - whether the place has taken to them (the `welcome` flag), which opens the
 *     back room.
 *
 * Four layers, so a shop has an identity rather than a copy of the catalog:
 *
 *   - STAPLES: everything through Premium. Always there, never counted, because
 *     a world where you cannot reliably buy bullets is a chore, not grit.
 *   - THE LINE: a shop's `signature`, the unusual things it is for. Always in,
 *     a few a week. Toggle always has a rifle worth saving for.
 *   - THE UNUSUAL: everything else above Premium, on the printed stock die, once
 *     a week per shop. Two gun shops are not the same gun shop on the same week.
 *   - THE BACK ROOM: a shop's `backRoom`, kept off the shelf entirely until the
 *     place is glad to see you.
 *
 * Pure. No React, no backend, no dice except seeded ones.
 */
import placeShops from "@/data/atlas/place-shops.json";
import { seededRng } from "./dice";
import { rollOracle, type OracleResult } from "./oracle";
import {
  STOCK,
  STOCK_REGULAR_BONUS,
  shelfFor,
  withinReach,
  type ShelfItem,
  type Vendor,
} from "./vendors";

const FILE = placeShops.stock;

/** Days in a stock week: how long a shelf stays as it is. House rule. */
export const STOCK_PERIOD_DAYS: number = FILE.periodDays;
/** How many of a rolled item a shop has in a week it is "in". */
export const STOCK_IN_COUNT: number = FILE.in;
/** How many of each signature item a shop carries a week. */
export const STOCK_LINE_COUNT: number = FILE.line;
/** How many of each back-room item come out a week. */
export const STOCK_BACK_ROOM_COUNT: number = FILE.backRoom;

/** The stock week a campaign day falls in. Day 1 is the first day of week 0. */
export function stockPeriod(day: number): number {
  return Math.floor((Math.max(1, Math.trunc(day)) - 1) / STOCK_PERIOD_DAYS);
}

/** Days until the shelf turns over: 1 on the last day of a week. */
export function daysToRestock(day: number): number {
  return STOCK_PERIOD_DAYS - ((Math.max(1, Math.trunc(day)) - 1) % STOCK_PERIOD_DAYS);
}

export const STOCK_LAYERS = ["staple", "line", "unusual", "back_room"] as const;
export type StockLayer = (typeof STOCK_LAYERS)[number];

/**
 * Why an item is or is not there.
 *
 * `ordinary` is staple stock; `line` and `back_room` are the shop's own;
 * `reach` is a Fixer sourcing it on their Operator Reach; `in`, `last_one` and
 * `out` are the week's read of the stock die; `sold_out` is a week's stock the
 * character has already bought.
 */
export type StockKey =
  "ordinary" | "line" | "back_room" | "reach" | "in" | "last_one" | "out" | "sold_out";

export type ShelfStock = ShelfItem & {
  layer: StockLayer;
  key: StockKey;
  /** True when one can be bought right now. */
  available: boolean;
  /** How many are left this week. Null when nobody counts: staples and Reach. */
  left: number | null;
  /** The week's stock roll, for the unusual layer. Null everywhere else. */
  roll: OracleResult | null;
};

export type ShopStockInput = {
  vendor: Vendor;
  /** Anything stable per campaign: its id. */
  seed: string;
  /** The in-world day the shelf is looked at. */
  day: number;
  /** True when the character is known at this seller; shifts the read, as the printed rule does. */
  regular?: boolean;
  /** The character's Operator Rank when they are a Fixer: inside Reach nothing is rolled. */
  operatorRank?: number;
  /** True when the place has taken to the character, which is what opens the back room. */
  backRoomOpen?: boolean;
  /** How many of each item (`kind:itemId`) were bought from this seller this week. */
  bought?: Readonly<Record<string, number>>;
};

/** The key an item is counted under in `bought`. */
export function stockItemKey(item: { kind: string; itemId: string }): string {
  return `${item.kind}:${item.itemId}`;
}

/** FNV-1a: a stable 32-bit number for a string, so a seed is the same on every machine. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The week's one roll of the stock die for one item at one seller. */
function weeklyRoll(input: ShopStockInput, item: ShelfItem, period: number): OracleResult {
  const rng = seededRng(hash(`${input.seed}|${input.vendor.id}|${stockItemKey(item)}|${period}`));
  return rollOracle(STOCK, rng, {
    modifiers: input.regular ? [{ label: "Known here", value: STOCK_REGULAR_BONUS }] : [],
    // The roll is a fact about the week, not about the moment it was looked at.
    now: () => new Date(0),
  });
}

function layerOf(vendor: Vendor, item: ShelfItem): StockLayer {
  if (vendor.backRoom.includes(item.itemId)) return "back_room";
  if (vendor.signature.includes(item.itemId)) return "line";
  return item.tier === "ordinary" ? "staple" : "unusual";
}

/**
 * The seller's shelf on `day`: everything on it, and for each thing whether it
 * can be bought and how many are left.
 *
 * Back-room stock is left OUT, not marked unavailable, until the back room is
 * open: a stranger is not shown what they are not being offered.
 */
export function shopStock(input: ShopStockInput): ShelfStock[] {
  const period = stockPeriod(input.day);
  const bought = input.bought ?? {};
  const out: ShelfStock[] = [];
  for (const item of shelfFor(input.vendor)) {
    const layer = layerOf(input.vendor, item);
    if (layer === "back_room" && !input.backRoomOpen) continue;
    const taken = Math.max(0, bought[stockItemKey(item)] ?? 0);

    const counted = (key: StockKey, of: number, roll: OracleResult | null = null): ShelfStock => {
      const left = Math.max(0, of - taken);
      return left > 0
        ? { ...item, layer, key, available: true, left, roll }
        : { ...item, layer, key: "sold_out", available: false, left: 0, roll };
    };

    if (layer === "staple") {
      out.push({ ...item, layer, key: "ordinary", available: true, left: null, roll: null });
    } else if (layer === "line") {
      out.push(counted("line", STOCK_LINE_COUNT));
    } else if (layer === "back_room") {
      out.push(counted("back_room", STOCK_BACK_ROOM_COUNT));
    } else if (withinReach(item.kind, item.itemId, input.operatorRank ?? 0)) {
      // The printed "always source": inside a Fixer's Reach there is no die and no count.
      out.push({ ...item, layer, key: "reach", available: true, left: null, roll: null });
    } else {
      const roll = weeklyRoll(input, item, period);
      if (roll.key === "out") {
        out.push({ ...item, layer, key: "out", available: false, left: 0, roll });
      } else {
        const lastOne = roll.key === "last_one";
        out.push(counted(lastOne ? "last_one" : "in", lastOne ? 1 : STOCK_IN_COUNT, roll));
      }
    }
  }
  return out;
}

/**
 * What is on the shelf now that was not the last time the character looked.
 *
 * `before` is the same seller's shelf as it stood on the earlier visit (the
 * caller derives it with `shopStock` for that day). Staples never count as new:
 * they were always there. Something bought out last time and back this week is
 * new; something still on the shelf is not.
 */
export function newSinceLastVisit(now: ShelfStock[], before: ShelfStock[]): ShelfStock[] {
  const had = new Set(before.filter((i) => i.available).map(stockItemKey));
  return now.filter((i) => i.layer !== "staple" && i.available && !had.has(stockItemKey(i)));
}

/**
 * The answer to "what's the strangest thing you've got?": what is in that is
 * not staple stock, the back room first and then the dearest.
 */
export function unusualOnShelf(stock: ShelfStock[]): ShelfStock[] {
  const rank: Record<StockLayer, number> = { back_room: 0, line: 1, unusual: 2, staple: 3 };
  return stock
    .filter((i) => i.layer !== "staple" && i.available)
    .sort((a, b) => rank[a.layer] - rank[b.layer] || b.price - a.price);
}
