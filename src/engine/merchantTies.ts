/**
 * Sellers who know you.
 *
 * A shop that treats a regular exactly like a stranger is a vending machine
 * with a face painted on it. These are the four things knowing somebody buys,
 * each read off what the ledger already holds and none of them a discount:
 *
 *   - INTERESTS: up to two needs, from the finds' own capabilities ("something
 *     quiet"). A find that matches, at a seller who knows you, is set aside for
 *     you and passed on by word of mouth. It never changes what turns up — the
 *     city does not start stocking itself around the player.
 *   - A HOLD: one thing, citywide, kept for you against a deposit for a stated
 *     number of days at the price on the day. Buy it inside the hold and the
 *     deposit comes off; let it lapse or call it off and they keep it.
 *   - A RANGE: at a shop that has one, your odds with a gun at each printed
 *     range band before you buy it, off the same tables the fight rolls on.
 *   - A RECORD: where a thing in your kit came from and what it has been
 *     through, computed from the ledger and never written down anywhere.
 *
 * Data: the `holds` block of `place-shops.json`, `houseRule: true`.
 * Pure: ledger rows in, plain objects out.
 */
import placeShops from "@/data/atlas/place-shops.json";
import { checkPercent } from "./checkOdds";
import { RANGE_BAND_MAX, singleShotDV } from "./combatTables";
import { GADGET_CAPABILITIES, readGadget } from "./gadgets";
import { payloadOf } from "./ledger";
import { weaponProfile } from "./weaponProfile";

const HOLDS = placeShops.holds;

/** What fraction of the price a hold costs up front. */
export const HOLD_DEPOSIT_FRACTION: number = HOLDS.depositFraction;
/** How many in-world days a seller keeps a thing for you. */
export const HOLD_DAYS: number = HOLDS.days;
/** How many needs a character can have sellers keep an eye out for. */
export const MAX_SHOP_INTERESTS: number = HOLDS.maxInterests;

/** The ledger types these are written under. */
export const SHOP_INTERESTS_EVENT = "shop_interests";
export const HOLD_PLACED_EVENT = "hold_placed";
export const HOLD_ENDED_EVENT = "hold_ended";

// ---------------------------------------------------------------------------
// Interests.
// ---------------------------------------------------------------------------

/** The needs a character can name: the finds' capabilities, and nothing else. */
export const SHOP_INTEREST_IDS: string[] = Object.keys(GADGET_CAPABILITIES);

export function interestLabel(id: string): string {
  return GADGET_CAPABILITIES[id]?.label ?? id;
}

/** The needs a stored list holds: known ones only, no repeats, at most the cap. */
export function cleanInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && SHOP_INTEREST_IDS.includes(v) && !out.includes(v)) out.push(v);
  }
  return out.slice(0, MAX_SHOP_INTERESTS);
}

/** The character's current interests: the newest `shop_interests` event's list. */
export function interestsFrom(events: readonly { type: string; data?: unknown }[]): string[] {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i]!.type === SHOP_INTERESTS_EVENT) {
      return cleanInterests(payloadOf(events[i]!)["needs"]);
    }
  }
  return [];
}

/** True when a find answers one of the character's needs. */
export function answersInterest(itemId: string, interests: readonly string[]): boolean {
  const gadget = readGadget(itemId);
  return !!gadget && interests.includes(gadget.capability);
}

// ---------------------------------------------------------------------------
// Holds.
// ---------------------------------------------------------------------------

export type Hold = {
  vendorId: string;
  vendorLabel: string;
  kind: string;
  itemId: string;
  name: string;
  /** The price on the day it was held: what it costs, deposit included. */
  price: number;
  deposit: number;
  /** The day it was held, and the last day it is kept. */
  day: number;
  until: number;
};

/** The deposit a hold on something at `price` costs. At least 1eb. */
export function holdDeposit(price: number): number {
  return Math.max(1, Math.ceil(Math.max(0, price) * HOLD_DEPOSIT_FRACTION));
}

/** Build a hold's payload. The only place its field names are written. */
export function holdPlacedEventData(input: Omit<Hold, "until"> & { until?: number }): Hold {
  const whole = (n: number) => Math.max(0, Math.trunc(n));
  return {
    vendorId: input.vendorId,
    vendorLabel: input.vendorLabel,
    kind: input.kind,
    itemId: input.itemId,
    name: input.name,
    price: whole(input.price),
    deposit: whole(input.deposit),
    day: whole(input.day),
    until: whole(input.until ?? input.day + HOLD_DAYS),
  };
}

function readHold(raw: unknown): Hold | null {
  const d = payloadOf({ data: raw });
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  const num = (k: string) =>
    typeof d[k] === "number" && Number.isFinite(d[k]) ? Math.trunc(d[k] as number) : null;
  const vendorId = str("vendorId");
  const kind = str("kind");
  const itemId = str("itemId");
  const price = num("price");
  const deposit = num("deposit");
  const day = num("day");
  const until = num("until");
  if (!vendorId || !kind || !itemId || price === null || deposit === null) return null;
  if (day === null || until === null) return null;
  return {
    vendorId,
    vendorLabel: str("vendorLabel") ?? vendorId,
    kind,
    itemId,
    name: str("name") ?? itemId,
    price,
    deposit,
    day,
    until,
  };
}

/**
 * The hold standing on `day`, or null: the newest one placed, unless a later
 * `hold_ended` closed it or its last day has passed. A lapsed hold needs no
 * event to have lapsed; the deposit was already paid and stays paid.
 */
export function activeHold(
  events: readonly { type: string; data?: unknown }[],
  day: number,
): Hold | null {
  let hold: Hold | null = null;
  for (const event of events) {
    if (event.type === HOLD_PLACED_EVENT) hold = readHold(event.data);
    else if (event.type === HOLD_ENDED_EVENT) hold = null;
  }
  return hold && day <= hold.until ? hold : null;
}

/** What is still owed on a held thing at the till: the price less the deposit already paid. */
export function heldBalance(hold: Hold): number {
  return Math.max(0, hold.price - hold.deposit);
}

// ---------------------------------------------------------------------------
// The range.
// ---------------------------------------------------------------------------

export type RangeBand = { max: number; dv: number; percent: number };

/**
 * Your odds with a gun at each printed range band, off the tables the fight
 * rolls on: `base` is the STAT + Skill the shot would be rolled from. Empty for
 * melee and for anything the Range DV table has no row for.
 */
export function rangeTrial(itemId: string, base: number): RangeBand[] {
  let profile;
  try {
    profile = weaponProfile(itemId);
  } catch {
    return [];
  }
  if (profile.melee || !profile.rangeType) return [];
  const out: RangeBand[] = [];
  for (const max of RANGE_BAND_MAX) {
    const dv = singleShotDV(profile.rangeType, max);
    if (dv === null) continue;
    out.push({ max, dv, percent: checkPercent(base, dv) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// A thing's record.
// ---------------------------------------------------------------------------

export type ItemRecord = {
  /** Where and when it was last bought, when the ledger says. */
  bought: { vendorLabel: string; day: number | null } | null;
  /** Times it was used out of the kit, Life and Job alike. */
  uses: number;
  /** Shots fired with it, and how many hit. */
  shots: number;
  hits: number;
};

/**
 * What one thing in the kit has been through, from the ledger: the purchase it
 * came from, the uses the turn loops recorded, and the attacks made with it
 * (matched by the row its rounds came from, or by its name).
 * `vendorLabel` turns a seller id into a name. A thing with no history reads as
 * all zeros and no purchase, which is the honest record of starting kit.
 */
export function itemRecord(
  events: readonly { type: string; data?: unknown }[],
  item: { itemId: string; rowId?: string; name?: string },
  vendorLabel: (vendorId: string) => string,
): ItemRecord {
  const { itemId } = item;
  // An attack names its weapon by name and carries the row its rounds came out
  // of; either is this thing.
  const firedWith = (d: Record<string, unknown>): boolean => {
    const ammo = d["ammo"] as { inventoryId?: unknown } | undefined;
    if (item.rowId && ammo && ammo.inventoryId === item.rowId) return true;
    return d["weapon"] === itemId || (!!item.name && d["weapon"] === item.name);
  };
  const record: ItemRecord = { bought: null, uses: 0, shots: 0, hits: 0 };
  for (const event of events) {
    const d = payloadOf(event);
    if (event.type === "purchase" && d["itemId"] === itemId) {
      const vendorId = typeof d["vendorId"] === "string" ? d["vendorId"] : null;
      if (vendorId) {
        record.bought = {
          vendorLabel: vendorLabel(vendorId),
          day: typeof d["day"] === "number" ? d["day"] : null,
        };
      }
    } else if (event.type === "life_action" && d["item"] === itemId) {
      record.uses += 1;
    } else if (event.type === "attack" && firedWith(d)) {
      record.shots += 1;
      if (d["hit"] === true) record.hits += 1;
    }
  }
  return record;
}

/** The record in a line, or null when there is nothing to say. */
export function describeItemRecord(record: ItemRecord): string | null {
  const parts: string[] = [];
  if (record.bought) {
    parts.push(
      `Bought at ${record.bought.vendorLabel}` +
        (record.bought.day !== null ? `, day ${record.bought.day}` : ""),
    );
  }
  if (record.shots > 0) {
    parts.push(`${record.shots} shot${record.shots === 1 ? "" : "s"}, ${record.hits} hit`);
  }
  if (record.uses > 0) parts.push(`used ${record.uses} time${record.uses === 1 ? "" : "s"}`);
  return parts.length ? `${parts.join(" · ")}.` : null;
}
