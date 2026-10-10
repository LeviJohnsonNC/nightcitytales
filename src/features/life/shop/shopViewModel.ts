/**
 * The Counter, as data: how a seller's shelf is laid out on screen.
 *
 * Every rule about what is on the shelf lives in the engine and in
 * `features/campaign/shopping.ts`; this only sorts what they decided into the
 * places the eye goes — the finds on the counter, the shop's own line, the
 * shelves behind, the back room — and says in a word what each thing's state
 * is. Pure, so the layout is tested without a browser.
 */
import { gadgetTags, readGadget } from "@/engine";
import type { StockedItem } from "@/features/campaign/shopping";

export type CounterSections = {
  /** This week's finds, anything sold back, and the thing held for you: the counter itself. */
  counter: StockedItem[];
  /** What the shop always carries: its line. */
  line: StockedItem[];
  /** Everything else, by kind, in the order the seller deals in them. */
  shelves: { kind: string; items: StockedItem[] }[];
  /** What came out of the back for somebody they know. Empty for a stranger. */
  backRoom: StockedItem[];
};

function shelfRank(item: StockedItem): number {
  if (!item.available) return 2;
  return item.layer === "unusual" ? 0 : 1;
}

/** Lay a shelf out. `deals` is the seller's kinds, in their order. */
export function counterSections(
  shelf: readonly StockedItem[],
  deals: readonly string[],
): CounterSections {
  const counter = shelf.filter((i) => i.layer === "find" || i.key === "held");
  const onCounter = new Set(counter.map((i) => `${i.kind}:${i.itemId}`));
  const rest = shelf.filter((i) => !onCounter.has(`${i.kind}:${i.itemId}`));
  // Held first, then what was set aside for you, then the rest, dearest first.
  const rank = (i: StockedItem) => (i.key === "held" ? 0 : i.forYou ? 1 : 2);
  return {
    counter: [...counter].sort((a, b) => rank(a) - rank(b) || b.price - a.price),
    line: rest.filter((i) => i.layer === "line"),
    backRoom: rest.filter((i) => i.layer === "back_room"),
    shelves: deals
      .map((kind) => ({
        kind,
        // What came in this week first, then the everyday stock, then what is
        // out: a long shelf is previewed from the top, and the top should be
        // the part worth reading.
        items: rest
          .filter((i) => i.kind === kind && (i.layer === "staple" || i.layer === "unusual"))
          .sort((a, b) => shelfRank(a) - shelfRank(b) || a.price - b.price),
      }))
      .filter((s) => s.items.length > 0),
  };
}

/** What a kind is called on a shelf label. */
export const SHELF_LABELS: Record<string, string> = {
  weapon: "Weapons",
  armor: "Armor",
  ammunition: "Ammunition",
  gear: "Kit",
};

export type StockMark = {
  /** One word or two for the tag. */
  text: string;
  /** How it should read: in, low, gone, or one of the seller's own. */
  tone: "in" | "low" | "gone" | "theirs" | "hot" | "held";
  /** The longer reason, for a tooltip or the detail. */
  title: string;
};

/** What a row says about its stock, in a word. Null for staple stock, which is simply there. */
export function stockMark(item: StockedItem): StockMark | null {
  switch (item.key) {
    case "ordinary":
      return null;
    case "line":
      return {
        text: `${item.left} this week`,
        tone: "theirs",
        title: "What this shop is for: always carried, a few a week.",
      };
    case "back_room":
      return {
        text: "from the back",
        tone: "theirs",
        title: "Brought out because this place has taken to you.",
      };
    case "reach":
      return {
        text: "on reach",
        tone: "theirs",
        title: "Inside your Operator Reach: you can always source this.",
      };
    case "in":
      return { text: `${item.left} in`, tone: "in", title: "This week's stock roll came up in." };
    case "last_one":
      return {
        text: "last one",
        tone: "low",
        title: "One left, and they know it: the price does not move.",
      };
    case "out":
      return {
        text: "out",
        tone: "gone",
        title: "This week's roll came up empty. It will not change until they restock.",
      };
    case "sold_out":
      return {
        text: "cleared out",
        tone: "gone",
        title: "You bought everything they had of this this week.",
      };
    case "held":
      return {
        text: "held for you",
        tone: "held",
        title: "Held at the price on the day; the deposit comes off at the till.",
      };
    case "resold":
      return {
        text: "yours, once",
        tone: "theirs",
        title: "The one you sold them. Still here, at their price.",
      };
    case "find": {
      const hot = readGadget(item.itemId)?.provenance?.kind === "hot";
      return hot
        ? { text: "hot", tone: "hot", title: "Cheap for a reason. Somebody wants it back." }
        : {
            text: "a find",
            tone: "theirs",
            title: "Turned up this week. One of it, gone once bought.",
          };
    }
  }
}

/**
 * Pips for a counted stock: how many are left out of what a week brings.
 * Null where nothing is counted (staples, reach).
 */
export function stockPips(item: StockedItem): { filled: number; total: number } | null {
  if (item.left === null) return null;
  const total = item.key === "last_one" ? 1 : Math.max(item.left, 1);
  return {
    filled: item.available ? item.left : 0,
    total: item.available ? total : Math.max(total, 1),
  };
}

export type FindCard = {
  /** "Quiet · One use". */
  tags: string;
  /** What the engine guarantees, in the contract's own words. */
  contract: string;
  /** What it physically is. */
  what: string;
  /** Where it came from, when the engine recorded it. */
  origin: string | null;
  quirk: string;
  hot: boolean;
};

/** A find's card copy, split the way the screen splits it: what it does, and what it is. */
export function findCard(itemId: string): FindCard | null {
  const gadget = readGadget(itemId);
  if (!gadget) return null;
  return {
    tags: gadgetTags(gadget),
    contract: gadget.contract,
    what: gadget.what,
    origin: gadget.origin,
    quirk: gadget.quirk,
    hot: gadget.provenance?.kind === "hot",
  };
}

/** "restocks tomorrow" / "restocks in 4 days". */
export function restockLine(days: number | null): string | null {
  if (days === null) return null;
  return days === 1 ? "restocks tomorrow" : `restocks in ${days} days`;
}
