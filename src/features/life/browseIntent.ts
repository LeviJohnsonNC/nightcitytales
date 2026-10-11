/**
 * "What have you got?", as something the engine can act on.
 *
 * The narrator proposes `browse` when the player asks to see what a seller has,
 * naming at most WHICH seller, in the player's words. This decides what that
 * means where the character stands: open the Counter on a seller here (or the
 * fixer, who is a call from anywhere), or go to the shop they named, or to the
 * nearest one, and open it on arrival. Pure, so the choice is tested without a
 * turn; `lifeOps.ts` does the travelling and the writing.
 */
import {
  FIXER_VENDOR,
  LEDGER_EVENTS,
  getPlace,
  getVendor,
  readShopBrowsedEventData,
  nearestShops,
  shopsAt,
  type TravelMode,
  type Vendor,
} from "@/engine";

export type BrowsePlan =
  /** Open the Counter on this seller. */
  | { kind: "open"; vendor: Vendor }
  /** Nobody sells here: go to this place first, by its atlas name. */
  | { kind: "go"; placeKey: string; name: string }
  /** Nothing to open and nowhere to go. */
  | { kind: "none" };

/** Words that say "a seller" without saying which one. */
const GENERIC = new Set([
  "a",
  "an",
  "the",
  "this",
  "that",
  "here",
  "his",
  "her",
  "their",
  "my",
  "market",
  "markets",
  "shop",
  "shops",
  "store",
  "stall",
  "stalls",
  "stand",
  "vendor",
  "vendors",
  "seller",
  "sellers",
  "counter",
  "place",
  "street",
  "guy",
  "dealer",
  "trader",
  "local",
  "nearest",
  "closest",
  "gun",
  "gear",
  "kit",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The words in what the player said that pick out one seller from another. */
function distinctive(seller: string | undefined): string[] {
  return seller ? words(seller).filter((w) => !GENERIC.has(w)) : [];
}

/** True when every distinctive word they used is in the seller's name or the place's. */
function names(vendor: Vendor, wanted: string[]): boolean {
  if (!wanted.length) return false;
  const said = new Set([
    ...words(vendor.label),
    ...(vendor.place ? words(getPlace(vendor.place)?.name ?? "") : []),
  ]);
  return wanted.every((w) => said.has(w));
}

export function planBrowse(input: {
  /** The atlas place the character is standing in, if any. */
  placeKey: string | null;
  /** Where a trip would start from (the campaign's location key). */
  from: string;
  /** Which seller, in the player's words, when they said. */
  seller?: string | undefined;
  mode?: TravelMode;
}): BrowsePlan {
  const wanted = distinctive(input.seller);
  // The fixer is a phone call, so asking for them works from anywhere.
  if (wanted.includes("fixer") || /\bfixer\b/i.test(input.seller ?? "")) {
    return { kind: "open", vendor: FIXER_VENDOR };
  }
  const here = shopsAt(input.placeKey);
  // They named a seller here: that one.
  const namedHere = here.find((v) => names(v, wanted));
  if (namedHere) return { kind: "open", vendor: namedHere };
  // They named a seller somewhere else: go there. Searched across every shop,
  // not only the nearest few, because they said which one.
  if (wanted.length) {
    const elsewhere = nearestShops(input.from, input.mode, Number.MAX_SAFE_INTEGER).find((s) =>
      s.vendors.some((v) => names(v, wanted)),
    );
    if (elsewhere && elsewhere.placeKey !== input.placeKey) {
      return { kind: "go", placeKey: elsewhere.placeKey, name: elsewhere.name };
    }
  }
  // Anybody here, when they did not say who: the first seller at this place.
  if (here.length) return { kind: "open", vendor: here[0]! };
  const nearest = nearestShops(input.from, input.mode, 1)[0];
  return nearest
    ? { kind: "go", placeKey: nearest.placeKey, name: nearest.name }
    : { kind: "none" };
}

/**
 * The seller a line in the log may offer to open: an arrival somewhere that
 * sells, or an earlier look at a counter. Only while the character is still
 * standing there (or for the fixer, who is a call), so an old line never
 * opens a shop across town. Null when the line offers nothing.
 */
export function browseLinkFor(
  event: { type: string; data?: unknown },
  here: string | null,
): string | null {
  if (event.type === "travelled") {
    const to =
      event.data && typeof event.data === "object" ? (event.data as { to?: unknown }).to : null;
    const seller = typeof to === "string" ? shopsAt(to)[0] : undefined;
    return seller && seller.place === here ? seller.id : null;
  }
  if (event.type === LEDGER_EVENTS.shopBrowsed) {
    const browsed = readShopBrowsedEventData(event.data);
    if (!browsed) return null;
    if (browsed.vendorId === FIXER_VENDOR.id) return browsed.vendorId;
    try {
      return getVendor(browsed.vendorId).place === here ? browsed.vendorId : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** The newest request to look at a counter in the ledger, if any. */
export function newestBrowse(
  events: readonly { id: string; type: string; data?: unknown }[],
): { eventId: string; vendorId: string } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type !== LEDGER_EVENTS.shopBrowsed) continue;
    const browsed = readShopBrowsedEventData(e.data);
    if (browsed) return { eventId: e.id, vendorId: browsed.vendorId };
  }
  return null;
}
