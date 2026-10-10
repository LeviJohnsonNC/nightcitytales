/**
 * Going to see somebody, and buying something from them.
 *
 * The old buy path debited eurobucks and wrote a ledger line. It did not write
 * a slot, so a bought weapon was a row the game could not see, and it passed a
 * kind the database's CHECK constraint rejected outright, so three of the four
 * categories on offer could not be inserted at all. You paid and got nothing,
 * or you paid and got an error.
 *
 * What replaces it is deliberately not a store. You go to a person; it costs
 * you part of an evening; they have what they have; and whether the expensive
 * thing is actually on the shelf tonight is a die nobody at the table controls
 * (engine/vendors.ts). Ammunition and everyday kit are always there, because a
 * world where you cannot reliably buy bullets is not gritty, it is a chore.
 */
import {
  LEDGER_EVENTS,
  advanceClock,
  canAfford,
  daysToRestock,
  describeReload,
  getVendor,
  haggledPrice,
  hagglePercent,
  hasFlag,
  looksLikeGadget,
  newSinceLastVisit,
  purchaseEventData,
  readPurchaseEventData,
  readShopSeenEventData,
  shopSeenEventData,
  shopStock,
  startingState,
  stockItemKey,
  stockPeriod,
  opposedCheckForCharacter,
  planReload,
  shelfFor,
  slotFor,
  stacksInInventory,
  vendorPrice,
  weaponProfile,
  type GameClock,
  type ItemKind,
  type OpposedCheckResult,
  type PlaceState,
  type ShelfStock,
  type SkillCheckActor,
  type Vendor,
} from "@/engine";
import {
  addInventoryItem,
  appendCampaignEvent,
  getCampaign,
  listCampaignFlags,
  listLatestCampaignEventsOfTypes,
  setCampaignFlag,
  setCampaignClock,
  setInventoryAmmo,
  setInventoryEquipped,
  setInventoryQuantity,
  updateCampaignVitals,
  type CampaignEvent,
  type CampaignFlag,
  type CampaignInventoryItem,
  type Json,
} from "@/lib/backend";
import { standingAt } from "./favours";
import { logOpenOracle } from "./oracles";
import { loadPlaceStates } from "./placeState";

/** The ledger type a purchase is written under. */
export const PURCHASE_EVENT = LEDGER_EVENTS.purchase;
/** The ledger type a look at a seller's shelf is written under. */
export const SHOP_SEEN_EVENT = LEDGER_EVENTS.shopSeen;
/** Every ledger type a shelf is read back from. */
export const SHOP_EVENT_TYPES = [PURCHASE_EVENT, SHOP_SEEN_EVENT] as const;
/** The ledger type a reload is written under. */
export const RELOAD_EVENT = "reload";

// ---------------------------------------------------------------------------
// What is on the shelf, and what it costs you.
// ---------------------------------------------------------------------------

export type StockedItem = ShelfStock & {
  /** True when the character can afford one at this vendor's price. */
  affordable: boolean;
};

/**
 * The shelf, priced against what the character is actually holding.
 *
 * Everything on it is listed, affordable or not: seeing the rifle you cannot
 * afford is the point of walking in, and a list filtered down to your budget
 * quietly tells you your budget is all there is.
 */
export function stockedShelf(stock: ShelfStock[], eurobucks: number): StockedItem[] {
  return stock.map((item) => ({ ...item, affordable: item.price <= eurobucks }));
}

// ---------------------------------------------------------------------------
// What is on the shelf this week (engine/shopStock.ts), read off the ledger.
// ---------------------------------------------------------------------------

/** How many of each item the character bought from this seller in `day`'s stock week. */
export function boughtThisWeek(
  events: readonly { type: string; data?: unknown }[],
  vendorId: string,
  day: number,
): Record<string, number> {
  const week = stockPeriod(day);
  const out: Record<string, number> = {};
  for (const event of events) {
    if (event.type !== PURCHASE_EVENT) continue;
    const bought = readPurchaseEventData(event.data);
    if (!bought || bought.vendorId !== vendorId || bought.day === null) continue;
    if (stockPeriod(bought.day) !== week) continue;
    const key = stockItemKey(bought);
    out[key] = (out[key] ?? 0) + bought.quantity;
  }
  return out;
}

/** The last time the character looked at this seller's shelf in an EARLIER week than `day`'s. */
export function lastLookedBefore(
  events: readonly { type: string; data?: unknown }[],
  vendorId: string,
  day: number,
): { day: number; backRoom: boolean } | null {
  const week = stockPeriod(day);
  let found: { day: number; backRoom: boolean } | null = null;
  for (const event of events) {
    if (event.type !== SHOP_SEEN_EVENT) continue;
    const seen = readShopSeenEventData(event.data);
    if (!seen || seen.vendorId !== vendorId || stockPeriod(seen.day) >= week) continue;
    if (!found || seen.day >= found.day) found = { day: seen.day, backRoom: seen.backRoom };
  }
  return found;
}

/** True when the character has already looked at this seller's shelf this stock week. */
export function lookedThisWeek(
  events: readonly { type: string; data?: unknown }[],
  vendorId: string,
  day: number,
): boolean {
  const week = stockPeriod(day);
  return events.some((event) => {
    if (event.type !== SHOP_SEEN_EVENT) return false;
    const seen = readShopSeenEventData(event.data);
    return !!seen && seen.vendorId === vendorId && stockPeriod(seen.day) === week;
  });
}

/** True when the place this seller is at has taken to the character: the back room is open. */
export function backRoomOpenAt(
  places: Readonly<Record<string, PlaceState>>,
  vendor: Vendor,
): boolean {
  if (!vendor.place) return false;
  return hasFlag(places[vendor.place] ?? startingState(vendor.place), "welcome");
}

export type ShopContext = {
  /** Recent purchases and looks, oldest first. */
  events: readonly { type: string; data?: unknown }[];
  flags: CampaignFlag[];
  places: Readonly<Record<string, PlaceState>>;
};

/** Everything a shelf is read from that a Life bundle does not already carry. */
export async function loadShopContext(campaignId: string): Promise<Omit<ShopContext, "places">> {
  const [events, flags] = await Promise.all([
    listLatestCampaignEventsOfTypes(campaignId, SHOP_EVENT_TYPES),
    listCampaignFlags(campaignId),
  ]);
  return { events, flags };
}

export type ShopShelf = {
  /** Everything on offer to the character, priced. */
  shelf: StockedItem[];
  /** What is in that was not the last time they looked. Empty on a first visit. */
  fresh: StockedItem[];
  /** True when there is a back room and it is not open to them. */
  backRoomClosed: boolean;
  /** Days until the week turns and the shelf is restocked. */
  restockIn: number;
  /** True when they have not yet looked at this shelf this week. */
  firstLookThisWeek: boolean;
};

/**
 * The seller's shelf as the character finds it, the one question both the sheet
 * and the purchase ask, so the shelf on screen and the stock at the till cannot
 * disagree.
 */
export function shopShelf(input: {
  vendor: Vendor;
  campaignId: string;
  day: number;
  eurobucks: number;
  context: ShopContext;
  operatorRank?: number;
}): ShopShelf {
  const { vendor, day, context } = input;
  const backRoomOpen = backRoomOpenAt(context.places, vendor);
  const base = {
    vendor,
    seed: input.campaignId,
    regular: isRegularAt(context.flags, vendor.id),
    operatorRank: input.operatorRank ?? 0,
  };
  const stock = shopStock({
    ...base,
    day,
    backRoomOpen,
    bought: boughtThisWeek(context.events, vendor.id, day),
  });
  const last = lastLookedBefore(context.events, vendor.id, day);
  const fresh = last
    ? newSinceLastVisit(
        stock,
        shopStock({
          ...base,
          day: last.day,
          backRoomOpen: last.backRoom,
          bought: boughtThisWeek(context.events, vendor.id, last.day),
        }),
      )
    : [];
  return {
    shelf: stockedShelf(stock, input.eurobucks),
    fresh: stockedShelf(fresh, input.eurobucks),
    backRoomClosed: vendor.backRoom.length > 0 && !backRoomOpen,
    restockIn: daysToRestock(day),
    firstLookThisWeek: !lookedThisWeek(context.events, vendor.id, day),
  };
}

/** Remember that the character looked at this shelf this week, for "new since your last visit". */
export async function recordShopSeen(input: {
  campaignId: string;
  vendor: Vendor;
  day: number;
  places: Readonly<Record<string, PlaceState>>;
}): Promise<void> {
  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: SHOP_SEEN_EVENT,
    summary: `Looked over what ${input.vendor.label} has this week.`,
    data: shopSeenEventData({
      vendorId: input.vendor.id,
      day: input.day,
      backRoom: backRoomOpenAt(input.places, input.vendor),
    }) as unknown as Json,
  });
}

/** The vendors the character has bought from before. */
export const REGULARS_FLAG = "vendor_regulars";

/** The stored set of vendors the character is known at. */
export function regularsFrom(flags: CampaignFlag[]): string[] {
  const value = flags.find((f) => f.flag === REGULARS_FLAG)?.value;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * True when the character has dealt with this vendor before.
 *
 * Stored rather than scanned. This used to walk the entire campaign ledger
 * looking for a purchase, which meant every visit to a shop got more expensive
 * for the rest of the campaign — and "have I ever bought here" is a fact about
 * the character, not something to re-derive from history each time it is asked.
 */
export function isRegularAt(flags: CampaignFlag[], vendorId: string): boolean {
  return regularsFrom(flags).includes(vendorId);
}

/** Remember that the character has now bought from this vendor. */
async function rememberRegular(
  campaignId: string,
  flags: CampaignFlag[],
  vendorId: string,
): Promise<void> {
  const known = regularsFrom(flags);
  if (known.includes(vendorId)) return;
  await setCampaignFlag(campaignId, REGULARS_FLAG, [...known, vendorId] as unknown as Json);
}

// ---------------------------------------------------------------------------
// Buying.
// ---------------------------------------------------------------------------

export type PurchaseInput = {
  campaignId: string;
  vendorId: string;
  kind: ItemKind;
  itemId: string;
  quantity: number;
  /**
   * The character's Operator Rank, when they are a Fixer. Zero otherwise.
   *
   * Two printed things ride on it: Reach, which takes the stock die off the
   * table inside the Fixer's own price categories, and the size of the band a
   * won Haggle buys.
   */
  operatorRank?: number;
  isFixer?: boolean;
  /**
   * True when the price has already been argued down at this vendor.
   *
   * The percentage is NOT passed in — it is worked out here from the Role and
   * the Rank, so a caller cannot name its own discount.
   */
  haggleWon?: boolean;
};

export type PurchaseOutcome =
  | {
      ok: true;
      spent: number;
      quantity: number;
      name: string;
      stockKey: string;
      /** Eurobucks the argument saved, when one was won. */
      saved: number;
    }
  | { ok: false; reason: string; stockKey: string };

/**
 * Buy one thing from one person.
 *
 * Two orderings matter here.
 *
 * Availability is settled BEFORE any money moves, so a vendor who turns out not
 * to have it has not taken anything, and the stock roll reaches the log either
 * way.
 *
 * And the money is read live rather than taken from the caller, the way
 * spendFiredClock reads its own clocks: a React bundle is a snapshot from the
 * last render, and two quick presses of a Buy button would otherwise both price
 * themselves against the same balance and spend it twice.
 */
export async function purchase(input: PurchaseInput): Promise<PurchaseOutcome> {
  const vendor = getVendor(input.vendorId);
  const quantity = Math.max(1, Math.trunc(input.quantity));
  // A find is not in the catalog the vendor sells from; whether this week turned
  // one up is the shelf's question, asked below.
  const find = input.kind === "gear" && looksLikeGadget(input.itemId);
  const listed = shelfFor(vendor).find((i) => i.kind === input.kind && i.itemId === input.itemId);
  if (!listed && !find) {
    return { ok: false, reason: vendor.refusal, stockKey: "not_dealt" };
  }

  const full = await getCampaign(input.campaignId);
  if (!full?.vitals) return { ok: false, reason: "Campaign not found.", stockKey: "no_campaign" };
  // A shop is somewhere you are. The sheet only offers the one you are standing
  // in, and this holds it to that when a stale page or a replay asks otherwise.
  if (vendor.place && standingAt(full.campaign) !== vendor.place) {
    return { ok: false, reason: `You are not at ${vendor.label}.`, stockKey: "not_here" };
  }
  const eurobucks = full.vitals.eurobucks;

  // Is it here at all? The shelf is this week's (engine/shopStock.ts), read off
  // the same ledger the sheet read it from, so pressing Buy again cannot reroll
  // it and the sheet and the till cannot disagree.
  const day = full.campaign.day ?? 1;
  const [context, places] = await Promise.all([
    loadShopContext(input.campaignId),
    loadPlaceStates(input.campaignId),
  ]);
  const { shelf, restockIn } = shopShelf({
    vendor,
    campaignId: input.campaignId,
    day,
    eurobucks,
    context: { ...context, places },
    operatorRank: input.isFixer ? (input.operatorRank ?? 0) : 0,
  });
  const stock = shelf.find((i) => i.kind === input.kind && i.itemId === input.itemId);
  if (!stock) {
    return find
      ? { ok: false, reason: `${vendor.label} has nothing like that this week.`, stockKey: "out" }
      : {
          ok: false,
          reason: `${vendor.label} does not bring that out for just anybody.`,
          stockKey: "back_room",
        };
  }
  const item = stock;
  if (stock.roll) await logOpenOracle(input.campaignId, stock.roll);
  if (!stock.available) {
    const when = restockIn === 1 ? "tomorrow" : `in ${restockIn} days`;
    return {
      ok: false,
      reason:
        stock.key === "sold_out"
          ? `${vendor.label}: you have bought all they had this week. They restock ${when}.`
          : `${vendor.label}: not in this week. They restock ${when}.`,
      stockKey: stock.key,
    };
  }

  // "One left" means one, and a week's stock is what it is, whatever the player asked for.
  const allowed = stock.left === null ? quantity : Math.min(quantity, stock.left);
  // "One left, and they know it. The price does not move" — the stock table says
  // so in as many words, so a won argument does not survive that read.
  const percent =
    input.haggleWon === true && stock.key !== "last_one"
      ? hagglePercent({
          isFixer: input.isFixer === true,
          operatorRank: input.operatorRank ?? 0,
        })
      : 0;
  const list = item.layer === "find" ? item.price : vendorPrice(vendor, item.kind, item.itemId);
  const unit = haggledPrice(list, percent);
  const cost = unit * allowed;
  const saved = (list - unit) * allowed;
  if (!canAfford(eurobucks, cost)) {
    return {
      ok: false,
      reason: `That is ${cost}eb and you have ${eurobucks}eb.`,
      stockKey: stock.key,
    };
  }

  const row = await addInventoryItem(input.campaignId, {
    kind: item.kind,
    itemId: item.itemId,
    quantity: allowed,
    stack: stacksInInventory(item.kind),
  });

  // You put armor on when you buy it. Only worn armor gives SP, and asking the
  // player to find a second button before their new vest does anything is how a
  // purchase silently fails to matter. One piece per location: the old one comes
  // off, because you cannot wear two vests and the best-of rule would otherwise
  // hand out free protection that carries none of armor's REF penalty.
  if (item.kind === "armor") {
    const slot = slotFor(item.kind, item.itemId);
    for (const worn of full.inventory) {
      if (worn.id !== row.id && worn.equipped && worn.slot === slot) {
        await setInventoryEquipped(worn.id, false);
      }
    }
    await setInventoryEquipped(row.id, true);
  }
  await updateCampaignVitals(input.campaignId, { eurobucks: eurobucks - cost });
  await rememberRegular(input.campaignId, full.flags, vendor.id);
  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: PURCHASE_EVENT,
    summary:
      `Bought ${allowed > 1 ? `${allowed}× ` : ""}${item.name} for ${cost}eb at ` +
      `${vendor.label.toLowerCase()}` +
      (saved > 0 ? `, ${saved}eb off the asking price.` : ".") +
      (stock.key === "reach" ? " Sourced on Reach." : ""),
    data: {
      ...purchaseEventData({
        vendorId: vendor.id,
        kind: item.kind,
        itemId: item.itemId,
        quantity: allowed,
        cost,
        saved,
        stockKey: stock.key,
        day,
      }),
      slot: slotFor(item.kind, item.itemId),
    } as unknown as Json,
  });

  return { ok: true, spent: cost, quantity: allowed, name: item.name, stockKey: stock.key, saved };
}

/** The ledger type a haggle is written under. */
export const HAGGLE_EVENT = "haggle";

export type HaggleOutcome = {
  result: OpposedCheckResult;
  won: boolean;
  /** The percentage off a win is worth to this character. */
  percent: number;
};

/**
 * Argue about the price.
 *
 * One opposed Trading check against the person behind the counter, exactly as
 * the Fixer's printed Haggle describes it — COOL + Trading + Operator Rank
 * against their COOL + Trading. The Rank rides on the roll through the caller's
 * modifiers, the same way it does on every other check; what a win is WORTH is
 * `hagglePercent`, which is the Fixer's printed band and a smaller house-rule
 * band for everybody else.
 *
 * The check is rolled here and the result is written to the ledger win or lose,
 * because a failed argument is a thing that happened.
 */
export async function haggle(input: {
  campaignId: string;
  vendorId: string;
  /** Built by the caller, which is the layer that knows the live sheet. */
  actor: SkillCheckActor;
  actorName: string;
  isFixer: boolean;
  operatorRank: number;
  /** Role and situational modifiers the caller has already worked out. */
  modifiers?: { label: string; value: number }[];
}): Promise<HaggleOutcome> {
  const vendor = getVendor(input.vendorId);
  const result = opposedCheckForCharacter(
    input.actor,
    "trading",
    {
      name: vendor.label,
      skillId: "trading",
      skillLevel: vendor.haggle.trading,
      statValue: vendor.haggle.cool,
    },
    undefined,
    {
      actorName: input.actorName,
      ...(input.modifiers?.length ? { modifiers: input.modifiers } : {}),
    },
  );
  const percent = hagglePercent({ isFixer: input.isFixer, operatorRank: input.operatorRank });
  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: HAGGLE_EVENT,
    summary: result.success
      ? `Talked ${vendor.label.toLowerCase()} down ${percent}%.`
      : `${vendor.label} would not move on the price.`,
    data: {
      vendorId: vendor.id,
      won: result.success,
      percent: result.success ? percent : 0,
      actorTotal: result.actor.total,
      opponentTotal: result.opponent.total,
    } as unknown as Json,
  });
  return { result, won: result.success, percent };
}

/**
 * Spend the time the visit took.
 *
 * Charged once per visit rather than per item, because the evening goes on
 * whether you buy one box of rounds or six. Reads the clock it is about to
 * move: advancing from a snapshot could rewind time a Life turn already spent.
 */
export async function spendVisit(campaignId: string, vendorId: string): Promise<GameClock | null> {
  const vendor = getVendor(vendorId);
  const full = await getCampaign(campaignId);
  if (!full) return null;
  const after = advanceClock(
    { day: full.campaign.day, minute: full.campaign.minute },
    vendor.minutes,
  );
  await setCampaignClock(campaignId, after);
  return after;
}

// ---------------------------------------------------------------------------
// Reloading.
// ---------------------------------------------------------------------------

/** Loose rounds the character is carrying, across every ammunition row. */
export function spareRounds(inventory: CampaignInventoryItem[]): number {
  return inventory
    .filter((row) => row.kind === "ammunition" || row.slot === "ammunition")
    .reduce((sum, row) => sum + Math.max(0, row.quantity), 0);
}

export type ReloadOutcome = { ok: true; summary: string } | { ok: false; reason: string };

/**
 * Put rounds back in a gun.
 *
 * The rounds come off the ammunition rows the character is actually carrying,
 * cheapest row first, so a reload spends real ammunition rather than a counter.
 */
export async function reloadWeapon(
  campaignId: string,
  weaponRowId: string,
): Promise<ReloadOutcome> {
  // Live, for the same reason a purchase is: two quick presses against one
  // snapshot would each load a full magazine from the same rounds.
  const full = await getCampaign(campaignId);
  if (!full) return { ok: false, reason: "Campaign not found." };
  const inventory = full.inventory;
  const weapon = inventory.find((row) => row.id === weaponRowId);
  if (!weapon) return { ok: false, reason: "That weapon is not in your kit." };

  const plan = planReload({
    itemId: weapon.item_id,
    loaded: weapon.ammo_loaded,
    spareRounds: spareRounds(inventory),
  });
  if (!plan.possible) return { ok: false, reason: plan.reason ?? "Nothing to do." };

  await setInventoryAmmo(weapon.id, plan.loadedAfter);
  await spendRounds(inventory, plan.rounds);
  const summary = describeReload(weapon.item_id, plan);
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: RELOAD_EVENT,
    summary,
    data: {
      itemId: weapon.item_id,
      rounds: plan.rounds,
      loaded: plan.loadedAfter,
    } as unknown as Json,
  });
  return { ok: true, summary };
}

/** Take rounds off the ammunition rows, in order, until the count is paid. */
async function spendRounds(inventory: CampaignInventoryItem[], rounds: number): Promise<void> {
  let owed = rounds;
  const rows = inventory
    .filter((row) => row.kind === "ammunition" || row.slot === "ammunition")
    .filter((row) => row.quantity > 0);
  for (const row of rows) {
    if (owed <= 0) break;
    const taken = Math.min(owed, row.quantity);
    owed -= taken;
    await setInventoryQuantity(row.id, Math.max(0, row.quantity - taken));
  }
}

/** Every weapon in the kit that could take a reload right now. */
export function reloadableWeapons(inventory: CampaignInventoryItem[]): {
  row: CampaignInventoryItem;
  name: string;
  loaded: number;
  magazine: number;
}[] {
  const spare = spareRounds(inventory);
  const out = [];
  for (const row of inventory) {
    if (row.slot !== "weapon") continue;
    let magazine: number | null;
    let name: string;
    try {
      const profile = weaponProfile(row.item_id);
      magazine = profile.magazine;
      name = profile.name;
    } catch {
      continue;
    }
    if (magazine === null) continue;
    const loaded = row.ammo_loaded === null ? magazine : Math.max(0, row.ammo_loaded);
    if (loaded >= magazine || spare <= 0) continue;
    out.push({ row, name, loaded, magazine });
  }
  return out;
}
