/**
 * The Counter: a shop, inline in the main column, instead of a drawer over it.
 *
 * Opening a shop turns the scene into the shop: its own painting across the
 * top, this week's finds on the counter, the shop's line, the shelves behind,
 * the back room, and selling across the counter. Tapping anything opens it in
 * place, with what the engine guarantees it does set apart from what it is.
 *
 * Presentational only. Everything here is read off `ShopController`
 * (`useShop`), which reads the engine; nothing on this screen decides stock,
 * price or consequence. `/shop-review` renders it from fixtures.
 */
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, DoorClosed, MapPin, Phone, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HOLD_DAYS,
  MAX_SHOP_INTERESTS,
  SHOP_INTEREST_IDS,
  catalogItem,
  getArmor,
  getGear,
  getWeapon,
  holdDeposit,
  interestLabel,
  stacksInInventory,
  type RangeBand,
  type ShopPlace,
} from "@/engine";
import type { StockedItem } from "@/features/campaign/shopping";
import { cn } from "@/lib/utils";
import type { ShopController } from "../useShop";
import { ItemThumb } from "./ItemThumb";
import {
  SHELF_LABELS,
  counterSections,
  findCard,
  restockLine,
  stockMark,
  type StockMark,
} from "./shopViewModel";

/** What a seller does, in a word, for the list of places to go. */
const KIND_NOUN: Record<string, string> = {
  street: "ammo & kit",
  gun_shop: "guns",
  armorer: "armor",
};

/** How many rows a shelf shows before "show the whole shelf". */
const SHELF_PREVIEW = 8;

const itemKey = (item: { kind: string; itemId: string }) => `${item.kind}:${item.itemId}`;

// ---------------------------------------------------------------------------
// Small pieces.
// ---------------------------------------------------------------------------

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

const MARK_TONE: Record<StockMark["tone"], string> = {
  in: "border-cool/50 text-cool",
  low: "border-amber/60 text-amber",
  gone: "border-hairline text-text-muted line-through decoration-1",
  theirs: "border-accent/60 text-accent",
  hot: "border-danger/70 bg-danger/10 text-danger",
  held: "border-success/60 bg-success/10 text-success",
};

/** A stamped tag: the shelf's word on one thing. */
function Stamp({ mark }: { mark: StockMark }) {
  return (
    <span
      title={mark.title}
      className={cn(
        "inline-block -rotate-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]",
        MARK_TONE[mark.tone],
      )}
    >
      {mark.text}
    </span>
  );
}

/** The two or three numbers that decide whether you want a catalog thing. */
function summarize(kind: string, itemId: string): string {
  try {
    if (kind === "weapon") {
      const w = getWeapon(itemId);
      const mag = w.magazine === null ? "" : ` · ${w.magazine} rds`;
      return `${w.damage}${mag} · ROF ${w.rof}${w.concealable ? " · concealable" : ""}`;
    }
    if (kind === "armor") {
      const a = getArmor(itemId);
      const penalty = a.penalty ? ` · ${a.penalty.value} ${a.penalty.stats.join("/")}` : "";
      return `SP ${a.sp ?? "—"}${penalty} · ${a.locations.join(", ")}`;
    }
    if (kind === "ammunition")
      return (catalogItem("ammunition", itemId) as { unit?: string }).unit ?? "";
    if (kind === "gear") return getGear(itemId).priceCategory;
  } catch {
    return "";
  }
  return "";
}

/** What a catalog thing does, in its own printed words. */
function printedText(kind: string, itemId: string): string | null {
  try {
    const raw = catalogItem(kind as never, itemId) as {
      description?: string | null;
      notes?: string | null;
    };
    return raw.description ?? raw.notes ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The storefront.
// ---------------------------------------------------------------------------

function Storefront({
  shop,
  image,
  onClose,
}: {
  shop: ShopController;
  image: string | null;
  onClose: () => void;
}) {
  const v = shop.vendor;
  const restock = restockLine(shop.restockIn);
  return (
    <header className="relative overflow-hidden border border-hairline bg-surface">
      <div className="relative aspect-[16/7] w-full sm:aspect-[16/6]">
        {image ? (
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full animate-[counter-enter_1.6s_ease-out_both] object-cover motion-reduce:animate-none"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(161,92,255,0.35),transparent_60%),radial-gradient(ellipse_at_80%_80%,rgba(255,61,154,0.25),transparent_55%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 flex items-center gap-1 border border-hairline bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur hover:text-foreground"
        >
          <X className="size-3" /> Leave
        </button>
        <div className="num absolute left-2 top-2 border border-hairline bg-background/80 px-2 py-1 text-sm font-bold backdrop-blur">
          {shop.eurobucks}eb
        </div>
      </div>
      <div className="relative -mt-14 space-y-2 px-4 pb-4 sm:-mt-16">
        <h2 className="font-display text-3xl font-extrabold leading-none tracking-tight text-text drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)] sm:text-4xl">
          {v.label}
        </h2>
        <p className="max-w-prose text-sm italic text-text-muted">{v.line}</p>
        <div className="flex flex-wrap gap-1.5">
          {shop.knowsYou && (
            <Stamp
              mark={{ text: "they know you", tone: "held", title: "You have bought here before." }}
            />
          )}
          {shop.backRoomClosed && (
            <Stamp
              mark={{
                text: "back room shut",
                tone: "gone",
                title: "They do not open it for people they do not know.",
              }}
            />
          )}
          {v.range && (
            <Stamp
              mark={{ text: "range out back", tone: "in", title: "Try a gun before you buy it." }}
            />
          )}
          {restock && (
            <span className="border border-dashed border-hairline px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-text-muted">
              ⟳ {restock}
            </span>
          )}
          {v.markup > 1 && (
            <span className="border border-hairline px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-text-muted">
              +{Math.round((v.markup - 1) * 100)}% for reach
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Your tab: the hold, what you asked for, and the word from people who know you.
// ---------------------------------------------------------------------------

function YourTab({ shop }: { shop: ShopController }) {
  const { hold, word, interests } = shop;
  const toggle = (id: string) => {
    const next = interests.includes(id)
      ? interests.filter((i) => i !== id)
      : [...interests, id].slice(-MAX_SHOP_INTERESTS);
    shop.setInterests(next);
  };
  return (
    <section className="space-y-2">
      {hold && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 border-dashed border-success/70 bg-success/5 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-success">
            Held
          </span>
          <span className="text-sm">
            <b>{hold.name}</b> at {hold.vendorLabel} · until day {hold.until} ·{" "}
            <span className="num">{hold.deposit}eb</span> down,{" "}
            <span className="num">{Math.max(0, hold.price - hold.deposit)}eb</span> to pay
          </span>
          <button
            type="button"
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted hover:text-danger"
            disabled={shop.busy}
            onClick={() => shop.callOffHold(hold)}
          >
            call it off · they keep the deposit
          </button>
        </div>
      )}
      {word.length > 0 && (
        <div className="border border-accent/40 bg-accent/5 px-3 py-2">
          <Label className="text-accent">Word from people who know you</Label>
          <ul className="mt-1 space-y-0.5 text-sm">
            {word.map(({ vendor, item }) => (
              <li key={`${vendor.id}:${item.itemId}`}>
                <b>{vendor.label}</b> put a {item.name} aside for you ·{" "}
                <span className="num">{item.price}eb</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Label>Keep an eye out for</Label>
        {SHOP_INTEREST_IDS.map((id) => {
          const on = interests.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              disabled={shop.busy}
              title="Sellers who know you set aside a find that fits, and pass the word"
              onClick={() => toggle(id)}
              className={cn(
                "border px-2 py-0.5 text-xs transition-colors",
                on
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-hairline text-text-muted hover:border-accent/50",
              )}
            >
              something {interestLabel(id).toLowerCase()}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The counter: this week's finds, large.
// ---------------------------------------------------------------------------

function FindCardView({ item, onOpen }: { item: StockedItem; onOpen: () => void }) {
  const card = findCard(item.itemId);
  const mark = stockMark(item);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative flex flex-row overflow-hidden border bg-surface text-left sm:flex-col transition-[transform,box-shadow] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none",
        card?.hot
          ? "border-danger/50 hover:shadow-[0_0_18px_-6px_var(--color-danger)]"
          : "border-accent/40 hover:shadow-[0_0_18px_-6px_var(--color-accent)]",
        !item.available && "opacity-75",
      )}
    >
      <ItemThumb
        kind={item.kind}
        itemId={item.itemId}
        hot={card?.hot ?? false}
        className="aspect-square w-28 shrink-0 sm:aspect-[16/10] sm:w-full"
      />
      {item.forYou && (
        <span className="absolute right-2 top-2 z-10 hidden rotate-2 bg-amber sm:inline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-background shadow">
          set aside for you
        </span>
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {mark && <Stamp mark={mark} />}
          {item.forYou && (
            <span className="bg-amber px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-background sm:hidden">
              set aside for you
            </span>
          )}
          {card && (
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-muted">
              {card.tags}
            </span>
          )}
        </div>
        <p className="font-display text-lg font-bold leading-tight">{item.name}</p>
        {card?.origin && (
          <p className={cn("text-xs italic", card.hot ? "text-danger" : "text-text-muted")}>
            {card.origin}
          </p>
        )}
        <p className="num mt-auto pt-1 text-sm font-bold">{item.price}eb</p>
      </div>
    </button>
  );
}

function Counter({ items, onOpen }: { items: StockedItem[]; onOpen: (item: StockedItem) => void }) {
  return (
    <section>
      <Label>On the counter this week</Label>
      {items.length === 0 ? (
        <p className="mt-1 border border-dashed border-hairline px-3 py-4 text-sm text-text-muted">
          Nothing strange in this week. Ammo, kit, the usual.
        </p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <FindCardView key={itemKey(item)} item={item} onOpen={() => onOpen(item)} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// The line and the shelves: rows.
// ---------------------------------------------------------------------------

function ShelfRow({ item, onOpen }: { item: StockedItem; onOpen: () => void }) {
  const mark = stockMark(item);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-center gap-3 border-b border-hairline/60 py-2 text-left hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent",
          !item.available && "opacity-75",
        )}
      >
        <ItemThumb kind={item.kind} itemId={item.itemId} className="size-11 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn("truncate text-sm", !item.affordable && "text-text-muted")}>
              {item.name}
            </span>
            {mark && <Stamp mark={mark} />}
          </span>
          <span className="block truncate font-mono text-[11px] text-text-muted">
            {summarize(item.kind, item.itemId)}
          </span>
        </span>
        <span
          className={cn("num shrink-0 text-sm font-bold", !item.affordable && "text-text-muted")}
        >
          {item.available ? `${item.price}eb` : "—"}
        </span>
      </button>
    </li>
  );
}

function Shelves({
  sections,
  onOpen,
}: {
  sections: { kind: string; items: StockedItem[] }[];
  onOpen: (item: StockedItem) => void;
}) {
  const [kind, setKind] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const active = sections.find((s) => s.kind === kind) ?? sections[0];
  if (!active) return null;
  const q = query.trim().toLowerCase();
  const matching = active.items.filter((i) => !q || i.name.toLowerCase().includes(q));
  // A long shelf shows the first few until asked; a search shows everything it found.
  const items = all || q ? matching : matching.slice(0, SHELF_PREVIEW);
  return (
    <section>
      <div className="flex flex-wrap items-center gap-1.5">
        <Label className="mr-1">The shelves</Label>
        {sections.map((s) => (
          <button
            key={s.kind}
            type="button"
            onClick={() => {
              setKind(s.kind);
              setAll(false);
            }}
            className={cn(
              "border-b-2 px-1.5 pb-0.5 text-sm",
              s.kind === active.kind
                ? "border-accent text-foreground"
                : "border-transparent text-text-muted hover:text-foreground",
            )}
          >
            {SHELF_LABELS[s.kind] ?? s.kind}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the shelf…"
          className="ml-auto w-40 border border-hairline bg-background/60 px-2 py-1 text-xs placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>
      <ul className="mt-1">
        {items.length === 0 ? (
          <li className="py-4 text-sm text-text-muted">Nothing on this shelf matches that.</li>
        ) : (
          items.map((item) => (
            <ShelfRow key={itemKey(item)} item={item} onOpen={() => onOpen(item)} />
          ))
        )}
      </ul>
      {matching.length > items.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-1 w-full border border-dashed border-hairline py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted hover:text-foreground"
        >
          Show the whole shelf · {matching.length}
        </button>
      )}
    </section>
  );
}

function BackRoom({
  shop,
  items,
  onOpen,
}: {
  shop: ShopController;
  items: StockedItem[];
  onOpen: (item: StockedItem) => void;
}) {
  if (!shop.backRoomClosed && items.length === 0) return null;
  return (
    <section className="border border-hairline bg-[repeating-linear-gradient(90deg,rgba(53,45,107,0.25)_0_2px,transparent_2px_14px)] p-3">
      <div className="flex items-center gap-2">
        <DoorClosed className="size-4 text-text-muted" aria-hidden />
        <Label>The back room</Label>
      </div>
      {shop.backRoomClosed ? (
        <p className="mt-1 text-sm text-text-muted">
          A door at the back, and a look that says it stays shut for people they do not know.
        </p>
      ) : (
        <ul className="mt-1">
          {items.map((item) => (
            <ShelfRow key={itemKey(item)} item={item} onOpen={() => onOpen(item)} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Across the counter: selling.
// ---------------------------------------------------------------------------

function SellCounter({ shop }: { shop: ShopController }) {
  if (!shop.offers.length) {
    return (
      <p className="py-4 text-sm text-text-muted">
        Nothing you are carrying is anything they would buy.
      </p>
    );
  }
  return (
    <ul>
      {shop.offers.map((offer) => {
        const record = shop.recordOf(offer.row, offer.name);
        return (
          <li
            key={offer.row.id}
            className="flex items-center gap-3 border-b border-hairline/60 py-2"
          >
            <ItemThumb
              kind={offer.row.kind}
              itemId={offer.row.item_id}
              className="size-11 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {offer.name}
                {offer.row.quantity > 1 && (
                  <span className="text-text-muted"> ×{offer.row.quantity}</span>
                )}
                {offer.row.equipped && (
                  <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">
                    worn
                  </span>
                )}
              </span>
              <span className="block truncate font-mono text-[10px] text-text-muted">
                {record ?? "No history worth telling."}
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="num shrink-0"
              disabled={shop.busy}
              onClick={() => shop.sell(offer.row.id)}
            >
              Sell · {offer.price}eb
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// One thing, opened in place.
// ---------------------------------------------------------------------------

function RangeChart({ bands }: { bands: RangeBand[] }) {
  if (!bands.length) {
    return (
      <p className="text-xs text-text-muted">
        Nothing on this range tells you anything about that one.
      </p>
    );
  }
  return (
    <div
      className="flex items-end gap-1.5"
      role="img"
      aria-label="Your chance to hit at each range"
    >
      {bands.map((b) => (
        <div key={b.max} className="flex flex-1 flex-col items-center gap-1">
          <span className="num text-[10px] text-text-muted">{b.percent}%</span>
          <div className="flex h-20 w-full items-end bg-hairline/30">
            <div
              className={cn(
                "w-full",
                b.percent >= 60 ? "bg-cool" : b.percent >= 30 ? "bg-amber" : "bg-danger",
              )}
              style={{ height: `${Math.max(4, b.percent)}%` }}
            />
          </div>
          <span className="font-mono text-[9px] text-text-muted">≤{b.max}m</span>
        </div>
      ))}
    </div>
  );
}

function ItemDetail({
  shop,
  item,
  onBack,
}: {
  shop: ShopController;
  item: StockedItem;
  onBack: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [bands, setBands] = useState<RangeBand[] | null>(null);
  const card = findCard(item.itemId);
  const mark = stockMark(item);
  const stackable = stacksInInventory(item.kind as never) && item.layer !== "find";
  const most = item.left ?? 99;
  const total = item.price * (stackable ? quantity : 1);
  const canHold =
    shop.knowsYou && !shop.hold && item.available && item.layer !== "staple" && item.key !== "held";
  const printed = card ? null : printedText(item.kind, item.itemId);

  return (
    <section className="border border-accent/40 bg-surface">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Back to the counter
      </button>
      <div className="grid gap-4 p-3 pt-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ItemThumb
          kind={item.kind}
          itemId={item.itemId}
          hot={card?.hot ?? false}
          large
          className="aspect-[16/10] w-full border border-hairline sm:aspect-square"
        />
        <div className="space-y-3">
          <div>
            <div className="flex flex-wrap gap-1.5">{mark && <Stamp mark={mark} />}</div>
            <h3 className="mt-1 font-display text-2xl font-extrabold leading-tight">{item.name}</h3>
            <p className="font-mono text-[11px] text-text-muted">
              {card?.tags ?? summarize(item.kind, item.itemId)}
            </p>
          </div>

          <div className="border border-cool/40 bg-cool/5 p-2.5">
            <Label className="text-cool">What it does</Label>
            <p className="mt-1 font-mono text-[12px] leading-relaxed text-text">
              {card?.contract ?? printed ?? summarize(item.kind, item.itemId)}
            </p>
          </div>

          {card && (
            <div className="space-y-1">
              <Label>What it is</Label>
              <p className="text-sm italic text-text-muted">{card.what}</p>
              {card.origin && (
                <p className={cn("text-sm italic", card.hot ? "text-danger" : "text-text-muted")}>
                  {card.origin}
                </p>
              )}
              <p className="text-xs text-text-muted">{card.quirk}</p>
            </div>
          )}

          {shop.vendor.range && item.kind === "weapon" && (
            <div className="space-y-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 font-mono text-[10px] uppercase tracking-[0.14em]"
                onClick={() => setBands(bands ? null : shop.tryOnRange(item.itemId))}
              >
                {bands ? "Put it down" : "Try it on the range"}
              </Button>
              {bands && <RangeChart bands={bands} />}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
            {stackable && item.available && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  disabled={quantity <= 1}
                  aria-label="One fewer"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  −
                </Button>
                <span className="num w-6 text-center text-sm font-bold">{quantity}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  disabled={quantity >= most}
                  aria-label="One more"
                  onClick={() => setQuantity((q) => Math.min(most, q + 1))}
                >
                  +
                </Button>
              </div>
            )}
            <Button
              className="num"
              disabled={shop.busy || !item.available || total > shop.eurobucks}
              onClick={() => shop.buy(item, quantity)}
            >
              {item.available ? `Buy · ${total}eb` : "Not this week"}
            </Button>
            {canHold && (
              <Button
                variant="outline"
                disabled={shop.busy || holdDeposit(item.price) > shop.eurobucks}
                title={`They keep it ${HOLD_DAYS} days at this price. Let it lapse and they keep the deposit.`}
                onClick={() => shop.placeHold(item)}
              >
                Hold · {holdDeposit(item.price)}eb down
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Away from any shop.
// ---------------------------------------------------------------------------

function WhereToShop({
  near,
  imageOf,
  busy,
  onTravel,
  onCallFixer,
}: {
  near: ShopPlace[];
  imageOf: (placeKey: string) => string | null;
  busy: boolean;
  onTravel?: ((placeKey: string) => void) | undefined;
  onCallFixer: () => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <Label>Nothing for sale where you are standing</Label>
        <p className="mt-1 text-sm text-text-muted">
          Go to somebody who sells it, or call your fixer and pay for the favour.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {near.map((place) => {
          const image = imageOf(place.placeKey);
          return (
            <div
              key={place.placeKey}
              className="flex overflow-hidden border border-hairline bg-surface"
            >
              <div className="relative w-24 shrink-0 bg-hairline/30">
                {image ? (
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <Store className="m-auto mt-6 size-8 text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1 p-2.5">
                <p className="truncate font-display font-bold">{place.name}</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  {[
                    place.districtName,
                    ...place.vendors.map((v) => KIND_NOUN[v.id.split("@")[0]!] ?? ""),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {onTravel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 gap-1 px-2 text-xs"
                    disabled={busy}
                    onClick={() => onTravel(place.placeKey)}
                  >
                    <MapPin className="size-3" /> Go · {place.minutes} min
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCallFixer}
        className="flex w-full items-center gap-3 border border-accent/40 bg-accent/5 p-3 text-left hover:bg-accent/10"
      >
        <Phone className="size-5 text-accent" aria-hidden />
        <span>
          <span className="block font-display font-bold">Call your fixer</span>
          <span className="block text-xs text-text-muted">
            One call, then a wait, then a price. Works from anywhere.
          </span>
        </span>
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The whole counter.
// ---------------------------------------------------------------------------

export function CounterView({
  shop,
  image,
  near,
  imageOf,
  onClose,
  onTravel,
  travelBusy = false,
  onTalk,
}: {
  shop: ShopController;
  /** The painting of where this seller is, or null to draw the stand-in. */
  image: string | null;
  /** The shops nearest, for when the character is standing nowhere that sells. */
  near: ShopPlace[];
  imageOf: (placeKey: string) => string | null;
  onClose: () => void;
  onTravel?: ((placeKey: string) => void) | undefined;
  travelBusy?: boolean;
  /** Leave the counter to say something to whoever is behind it. */
  onTalk?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const sections = useMemo(
    () => counterSections(shop.shelf, shop.vendor.deals),
    [shop.shelf, shop.vendor.deals],
  );
  const opened = open ? (shop.shelf.find((i) => itemKey(i) === open) ?? null) : null;
  const away =
    !shop.atShop && !shop.vendor.place && shop.vendor.id === "fixer" && !shop.fixerChosen;

  return (
    <div className="flex flex-col gap-4">
      {away ? (
        <>
          <header className="flex items-center justify-between border-b border-hairline pb-2">
            <h2 className="font-display text-2xl font-extrabold">Spending money</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted hover:text-foreground"
            >
              <X className="size-3" /> Close
            </button>
          </header>
          <WhereToShop
            near={near}
            imageOf={imageOf}
            busy={travelBusy}
            onTravel={onTravel}
            onCallFixer={() => shop.chooseFixer()}
          />
          <YourTab shop={shop} />
        </>
      ) : (
        <>
          <Storefront shop={shop} image={image} onClose={onClose} />

          {shop.vendors.length > 1 && (
            <nav className="-mt-2 flex flex-wrap gap-1.5" aria-label="Who you deal with">
              {shop.vendors.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    shop.setVendor(v.id);
                    setOpen(null);
                  }}
                  className={cn(
                    "border px-2.5 py-1 text-sm",
                    v.id === shop.vendor.id
                      ? "border-accent bg-accent/15"
                      : "border-hairline text-text-muted hover:border-accent/50",
                  )}
                >
                  {v.place ? v.label : "Call your fixer"}
                </button>
              ))}
            </nav>
          )}

          {shop.message && (
            <p
              className={cn(
                "border-l-2 px-3 py-2 text-sm",
                shop.message.tone === "bought"
                  ? "border-success bg-success/10"
                  : "border-danger bg-danger/10 text-danger",
              )}
            >
              {shop.message.text}
            </p>
          )}

          <YourTab shop={shop} />

          <div className="flex flex-wrap items-center gap-3 border-b border-hairline">
            {(["buy", "sell"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setOpen(null);
                }}
                className={cn(
                  "-mb-px border-b-2 px-1 pb-1.5 font-display text-lg font-bold",
                  tab === t
                    ? "border-accent text-foreground"
                    : "border-transparent text-text-muted hover:text-foreground",
                )}
              >
                {t === "buy" ? "Buying" : "Across the counter"}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-2 pb-1">
              {shop.haggleSpent ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  {shop.haggleDiscount > 0
                    ? `${shop.haggleDiscount}% off this visit`
                    : "price argued"}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={shop.busy}
                  onClick={() => shop.haggle()}
                >
                  Talk the price down · {shop.hagglePercent}%
                </Button>
              )}
              {onTalk && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onTalk}>
                  Talk to them
                </Button>
              )}
            </span>
          </div>

          {shop.loading ? (
            <p className="py-6 text-sm text-text-muted">Looking over the shelves…</p>
          ) : tab === "sell" ? (
            <SellCounter shop={shop} />
          ) : opened ? (
            <ItemDetail shop={shop} item={opened} onBack={() => setOpen(null)} />
          ) : (
            <>
              <Counter items={sections.counter} onOpen={(i) => setOpen(itemKey(i))} />
              {sections.line.length > 0 && (
                <section>
                  <Label>Their line · always carried</Label>
                  <ul className="mt-1">
                    {sections.line.map((item) => (
                      <ShelfRow
                        key={itemKey(item)}
                        item={item}
                        onOpen={() => setOpen(itemKey(item))}
                      />
                    ))}
                  </ul>
                </section>
              )}
              <BackRoom shop={shop} items={sections.backRoom} onOpen={(i) => setOpen(itemKey(i))} />
              <Shelves sections={sections.shelves} onOpen={(i) => setOpen(itemKey(i))} />
            </>
          )}

          {shop.reloadable.length > 0 && tab === "buy" && !opened && (
            <section className="border border-hairline p-3">
              <Label>Load up · {shop.spareRounds} spare rounds</Label>
              <ul className="mt-1 space-y-1">
                {shop.reloadable.map((w) => (
                  <li key={w.row.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="num truncate">
                      {w.name}{" "}
                      <span className="text-text-muted">
                        {w.loaded}/{w.magazine}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={shop.busy}
                      onClick={() => shop.reload(w.row.id)}
                    >
                      Reload
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
