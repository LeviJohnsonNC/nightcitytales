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
  advanceClock,
  canAfford,
  checkStock,
  describeReload,
  getVendor,
  planReload,
  shelfFor,
  slotFor,
  stacksInInventory,
  vendorPrice,
  weaponProfile,
  type GameClock,
  type ItemKind,
  type ShelfItem,
  type Vendor,
} from "@/engine";
import {
  addInventoryItem,
  appendCampaignEvent,
  getCampaign,
  listCampaignEvents,
  setCampaignClock,
  setInventoryAmmo,
  setInventoryQuantity,
  updateCampaignVitals,
  type CampaignEvent,
  type CampaignInventoryItem,
  type Json,
} from "@/lib/backend";
import { logOpenOracle } from "./oracles";

/** The ledger type a purchase is written under. */
export const PURCHASE_EVENT = "purchase";
/** The ledger type a reload is written under. */
export const RELOAD_EVENT = "reload";

// ---------------------------------------------------------------------------
// What is on the shelf, and what it costs you.
// ---------------------------------------------------------------------------

export type StockedItem = ShelfItem & {
  /** True when the character can afford one at this vendor's price. */
  affordable: boolean;
};

/**
 * The vendor's shelf, priced against what the character is actually holding.
 *
 * Everything is listed, affordable or not: seeing the rifle you cannot afford
 * is the point of walking in, and a list filtered down to your budget quietly
 * tells you your budget is all there is.
 */
export function stockedShelf(vendor: Vendor, eurobucks: number): StockedItem[] {
  return shelfFor(vendor).map((item) => ({ ...item, affordable: item.price <= eurobucks }));
}

/**
 * True when the character has dealt with this vendor before.
 *
 * Read off the ledger rather than stored, so it cannot drift from what actually
 * happened, and so it is true for campaigns that predate the flag existing.
 */
export function isRegularAt(events: CampaignEvent[], vendorId: string): boolean {
  return events.some(
    (e) =>
      e.type === PURCHASE_EVENT && (e.data as { vendorId?: unknown } | null)?.vendorId === vendorId,
  );
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
};

export type PurchaseOutcome =
  | { ok: true; spent: number; quantity: number; name: string; stockKey: string }
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
  const item = shelfFor(vendor).find((i) => i.kind === input.kind && i.itemId === input.itemId);
  if (!item) {
    return { ok: false, reason: vendor.refusal, stockKey: "not_dealt" };
  }

  const full = await getCampaign(input.campaignId);
  if (!full?.vitals) return { ok: false, reason: "Campaign not found.", stockKey: "no_campaign" };
  const eurobucks = full.vitals.eurobucks;
  const events = await listCampaignEvents(input.campaignId);

  // Is it here at all? Ordinary stock never asks; the unusual gets a die the
  // player watches, shifted by whether this vendor knows their face.
  const stock = checkStock(vendor, item, { regular: isRegularAt(events, vendor.id) });
  if (stock.roll) await logOpenOracle(input.campaignId, stock.roll);
  if (!stock.available) {
    return {
      ok: false,
      reason: `${vendor.label}: not in stock tonight.`,
      stockKey: stock.key,
    };
  }

  // "One left" means one, whatever the player asked for.
  const allowed = stock.key === "last_one" ? 1 : quantity;
  const cost = vendorPrice(vendor, item.kind, item.itemId) * allowed;
  if (!canAfford(eurobucks, cost)) {
    return {
      ok: false,
      reason: `That is ${cost}eb and you have ${eurobucks}eb.`,
      stockKey: stock.key,
    };
  }

  await addInventoryItem(input.campaignId, {
    kind: item.kind,
    itemId: item.itemId,
    quantity: allowed,
    stack: stacksInInventory(item.kind),
  });
  await updateCampaignVitals(input.campaignId, { eurobucks: eurobucks - cost });
  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: PURCHASE_EVENT,
    summary: `Bought ${allowed > 1 ? `${allowed}× ` : ""}${item.name} for ${cost}eb at ${vendor.label.toLowerCase()}.`,
    data: {
      vendorId: vendor.id,
      kind: item.kind,
      itemId: item.itemId,
      quantity: allowed,
      cost,
      slot: slotFor(item.kind, item.itemId),
    } as unknown as Json,
  });

  return { ok: true, spent: cost, quantity: allowed, name: item.name, stockKey: stock.key };
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
