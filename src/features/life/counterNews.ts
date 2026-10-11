/**
 * What happened at a counter since the narrator last spoke.
 *
 * Buying happens on the Counter, which is not a turn, so the next turn's
 * narrator was never told the character came away with anything: they could
 * buy a jacket and walk out into prose that did not know they were wearing it.
 * This reads the receipts the shop already wrote (purchase, sold, haggle,
 * hold) back into plain lines for the packet: who, and what, and never a price
 * or a count, because a number is never the narrator's to say. Pure.
 */
import {
  HOLD_PLACED_EVENT,
  LEDGER_EVENTS,
  catalogItem,
  getVendor,
  readPurchaseEventData,
  readSoldEventData,
  type ItemKind,
  type Vendor,
} from "@/engine";

/** The rows that end "since they last spoke": a narration the player read. */
const SPOKE = new Set(["life_narration", "life_options"]);
const HAGGLE = "haggle";

function vendorOf(id: string): Vendor | null {
  try {
    return getVendor(id);
  } catch {
    return null;
  }
}

/** Who they dealt with: the keeper's name when there is one, else the shop. */
function whom(vendor: Vendor | null): string {
  if (!vendor) return "a seller";
  if (vendor.keeper) return `${vendor.keeper.name} at ${vendor.label}`;
  return vendor.place ? vendor.label : "their fixer";
}

function nameOf(kind: string, itemId: string): string {
  try {
    return catalogItem(kind as ItemKind, itemId).name;
  } catch {
    return "something";
  }
}

export function counterNews(
  events: readonly { type: string; summary?: string | null; data?: unknown }[],
): string[] {
  let start = events.length;
  while (start > 0 && !SPOKE.has(events[start - 1]!.type)) start -= 1;
  const out: string[] = [];
  for (const e of events.slice(start)) {
    if (e.type === LEDGER_EVENTS.purchase) {
      const p = readPurchaseEventData(e.data);
      if (!p) continue;
      const several = p.quantity > 1 ? " (more than one)" : "";
      out.push(`Bought ${nameOf(p.kind, p.itemId)}${several} from ${whom(vendorOf(p.vendorId))}.`);
    } else if (e.type === LEDGER_EVENTS.sold) {
      const s = readSoldEventData(e.data);
      if (!s) continue;
      out.push(`Sold their ${nameOf(s.kind, s.itemId)} to ${whom(vendorOf(s.vendorId))}.`);
    } else if (e.type === HAGGLE) {
      const d = (e.data ?? {}) as { vendorId?: unknown; won?: unknown };
      const who = whom(typeof d.vendorId === "string" ? vendorOf(d.vendorId) : null);
      out.push(
        d.won === true
          ? `Talked ${who} down on the price.`
          : `Tried to talk ${who} down on the price and got nowhere.`,
      );
    } else if (e.type === HOLD_PLACED_EVENT) {
      const d = (e.data ?? {}) as { vendorId?: unknown; name?: unknown };
      const who = whom(typeof d.vendorId === "string" ? vendorOf(d.vendorId) : null);
      if (typeof d.name === "string") out.push(`Asked ${who} to hold ${d.name} for them.`);
    }
  }
  return out;
}
