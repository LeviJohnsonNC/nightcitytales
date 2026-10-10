/**
 * The city stocks the shops.
 *
 * Finds used to arrive from nowhere: a die per shop per week, and nothing that
 * happened in the city made any difference to what turned up. This reads what
 * the engine already recorded and sends it onto the street:
 *
 *   - a place that GAINED a salvage flag (`raided`, `shut`, `power_out`,
 *     `locked_down`), from its `place_changed` row;
 *   - a job that settled at a place, from its `job_settled` receipt — and when
 *     the job moved standing with an organisation, what came off it is HOT.
 *
 * Each such event reaches, for `windowDays`, the shops in its place's district
 * and every shop that leans in for finds (a fence hears about everything). Each
 * one that reaches a shop adds one to its finds die, up to `maxLean`, and lends
 * the find it produces its provenance. Data: `src/data/atlas/shop-supply.json`,
 * `houseRule: true`.
 *
 * Pure: ledger rows in, supply out. Nothing here is stored.
 */
import supply from "@/data/atlas/shop-supply.json";
import { itemCost, type ItemKind } from "./catalog";
import { isFactionId } from "./factions";
import { looksLikeGadget, provenanceSegment, readGadget, type Provenance } from "./gadgets";
import { districtOfPlace, getPlace } from "./geography";
import {
  LEDGER_EVENTS,
  readJobSettledFactions,
  readJobSettledMeta,
  readPlaceChangedEventData,
} from "./ledger";
import type { Vendor } from "./vendors";

export const SHOP_SUPPLY_IS_HOUSE_RULE: boolean = supply.houseRule;
/** Days a city event keeps sending things to the shops. */
export const SUPPLY_WINDOW_DAYS: number = supply.windowDays;
/** The most a week's supply can add to a shop's finds die. */
export const SUPPLY_MAX_LEAN: number = supply.maxLean;
const SALVAGE_FLAGS = new Set(Object.keys(supply.salvage));

/** Something that happened somewhere, and so sent something onto the street. */
export type SupplyEvent = Provenance & { day: number };

/**
 * Every supply event in a stretch of ledger, oldest first. A row with no day is
 * left out: a supply that cannot be placed in time cannot be said to be fresh.
 */
export function supplyFrom(events: readonly { type: string; data?: unknown }[]): SupplyEvent[] {
  const out: SupplyEvent[] = [];
  for (const event of events) {
    if (event.type === LEDGER_EVENTS.placeChanged) {
      const changed = readPlaceChangedEventData(event.data);
      if (!changed?.set || changed.day === null || !SALVAGE_FLAGS.has(changed.flag)) continue;
      if (!getPlace(changed.placeKey)) continue;
      out.push({
        kind: "salvage",
        placeKey: changed.placeKey,
        flag: changed.flag,
        day: changed.day,
      });
    } else if (event.type === LEDGER_EVENTS.jobSettled) {
      const meta = readJobSettledMeta(event.data);
      if (meta.day === null || !meta.placeKey || !getPlace(meta.placeKey)) continue;
      // One faction is enough to make it hot: the first the job moved.
      const crossed = readJobSettledFactions(event.data).find(isFactionId);
      if (crossed) {
        out.push({ kind: "hot", placeKey: meta.placeKey, factionId: crossed, day: meta.day });
      }
    }
  }
  return out;
}

/**
 * The supply reaching one seller in the week `day` falls in, newest first and
 * at most `SUPPLY_MAX_LEAN` of it: what happened within the window, in the
 * seller's own district, or anywhere if they are a fence. The fixer is a phone
 * call, not a counter, and gets none of it.
 */
export function supplyReaching(input: {
  supply: readonly SupplyEvent[];
  vendor: Vendor;
  day: number;
}): SupplyEvent[] {
  const place = input.vendor.place;
  if (!place) return [];
  const district = districtOfPlace(place)?.key;
  const fence = input.vendor.finds > 0;
  return input.supply
    .filter((e) => e.day <= input.day && input.day - e.day < SUPPLY_WINDOW_DAYS)
    .filter((e) => fence || (district && districtOfPlace(e.placeKey)?.key === district))
    .sort((a, b) => b.day - a.day)
    .slice(0, SUPPLY_MAX_LEAN);
}

/** The provenance segments a list of supply lends to the finds it produces, in order. */
export function supplyProvenance(reaching: readonly SupplyEvent[]): string[] {
  return reaching.map((e) =>
    provenanceSegment(
      e.kind === "salvage"
        ? { kind: "salvage", placeKey: e.placeKey, flag: e.flag }
        : { kind: "hot", placeKey: e.placeKey, factionId: e.factionId },
    ),
  );
}

// ---------------------------------------------------------------------------
// Selling.
// ---------------------------------------------------------------------------

/** How many stock weeks a find you sold stays on that seller's shelf. */
export const RESALE_WEEKS: number = supply.resaleWeeks;
const SELL = supply.sell as { fraction: number; kinds: string[] };

/**
 * What this seller would pay for one of `itemId`, or null when they will not
 * buy it. Half the printed price, less their markup's cut; only the kinds they
 * deal in, plus any find at a shop that leans in for finds. Ammunition and
 * chrome are not bought back at all.
 */
export function sellPrice(vendor: Vendor, kind: ItemKind, itemId: string): number | null {
  if (!SELL.kinds.includes(kind)) return null;
  const find = kind === "gear" && looksLikeGadget(itemId);
  if (find && !readGadget(itemId)) return null;
  if (!vendor.deals.includes(kind) && !(find && vendor.finds > 0)) return null;
  let cost: number;
  try {
    cost = itemCost(kind, itemId);
  } catch {
    return null; // not a thing the catalog knows, so not a thing anyone prices
  }
  const paid = Math.floor((cost * SELL.fraction) / Math.max(1, vendor.markup));
  return paid > 0 ? paid : null;
}
