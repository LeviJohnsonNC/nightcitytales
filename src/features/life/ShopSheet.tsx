/**
 * The shop, as a place you go rather than a menu you open.
 *
 * You pick a person, you see what they have, and what they have depends on who
 * they are: the street pitch does not sell rifles and the armorer does not sell
 * guns. Everything is listed whether or not you can afford it, because seeing
 * the rifle you cannot afford is the point of walking in.
 *
 * Presentational only. What a thing costs, whether it is on the shelf tonight
 * and what happens to the character's kit are all decided elsewhere.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DockTile } from "./hud/DockTile";
import { GoThere } from "./GoThere";
import { ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  catalogItem,
  getArmor,
  getGear,
  getWeapon,
  nearestShops,
  gadgetTags,
  readGadget,
  stacksInInventory,
  unusualOnShelf,
  DEFAULT_START,
  type ItemKind,
  type TravelMode,
} from "@/engine";
import { ItemInfo, type ItemKindLabel } from "@/features/chargen/ItemInfo";
import type { StockedItem } from "@/features/campaign/shopping";
import { useShop } from "./useShop";
import type { LifeBundle } from "./lifeOps";

/**
 * Arguing about the price, offered once per visit.
 *
 * Everyone may try; what winning is worth is the Fixer's printed Haggle band
 * and a smaller house-rule one for everybody else. Once it has been asked, win
 * or lose, the button is spent — which is what makes asking a decision.
 */
function HaggleRow({ shop }: { shop: ReturnType<typeof useShop> }) {
  if (shop.haggleSpent) {
    return (
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {shop.haggleDiscount > 0
          ? `price argued down ${shop.haggleDiscount}% this visit`
          : "price already argued this visit"}
      </p>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={shop.busy} onClick={() => shop.haggle()}>
        {shop.busy ? "…" : "Talk the price down"}
      </Button>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Trading, opposed · worth {shop.hagglePercent}% · one run at it
      </span>
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  weapon: "Weapons",
  armor: "Armor",
  ammunition: "Ammo",
  gear: "Gear",
};

/** The two or three numbers that decide whether you want this thing. */
function summarize(kind: ItemKind, itemId: string): string {
  try {
    if (kind === "weapon") {
      const w = getWeapon(itemId);
      const mag = w.magazine === null ? "—" : `${w.magazine} rds`;
      return `${w.damage} · ${mag} · ROF ${w.rof}${w.concealable ? " · concealable" : ""}`;
    }
    if (kind === "armor") {
      const a = getArmor(itemId);
      const penalty = a.penalty ? ` · ${a.penalty.value} ${a.penalty.stats.join("/")}` : "";
      return `SP ${a.sp ?? "—"}${penalty} · ${a.locations.join(", ")}`;
    }
    if (kind === "ammunition") {
      const a = catalogItem(kind, itemId) as { unit?: string };
      return a.unit ?? "";
    }
    if (kind === "gear") return getGear(itemId).priceCategory;
  } catch {
    return "";
  }
  return "";
}

/**
 * What the shelf says about one thing, in a word: why it is there, or why not.
 *
 * Inside a Fixer's Reach the die is never rolled, so the shelf says so rather
 * than letting the player find out by being told no; a week's roll is shown as
 * what it came to, never as a promise that asking again will change it.
 */
function StockBadge({ item }: { item: StockedItem }) {
  const badge: Record<string, { text: string; title: string; tone: string } | undefined> = {
    line: {
      text: `their line · ${item.left} left`,
      title: "What this shop is for: always carried, a few a week",
      tone: "text-accent",
    },
    back_room: {
      text: `from the back · ${item.left} left`,
      title: "Brought out because this place has taken to you",
      tone: "text-accent",
    },
    reach: {
      text: "reach",
      title: "Inside your Operator Reach — you can always source this, no stock roll",
      tone: "text-accent",
    },
    in: {
      text: `in this week · ${item.left} left`,
      title: "This week's stock roll came up in",
      tone: "text-muted-foreground",
    },
    last_one: {
      text: "one left",
      title: "One left, and they know it: the price does not move",
      tone: "text-muted-foreground",
    },
    out: {
      text: "out this week",
      title: "This week's stock roll came up empty. It will not change until they restock",
      tone: "text-muted-foreground",
    },
    sold_out: {
      text: "you bought them out",
      title: "You have bought everything they had of this this week",
      tone: "text-muted-foreground",
    },
  };
  if (item.key === "find") {
    const gadget = readGadget(item.itemId);
    return (
      <span
        className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-accent"
        title="Strange gear this shop turned up this week. One of it, and gone once bought"
      >
        a find{gadget ? ` · ${gadgetTags(gadget)}` : ""}
      </span>
    );
  }
  const shown = badge[item.key];
  if (!shown) return null;
  return (
    <span
      className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] ${shown.tone}`}
      title={shown.title}
    >
      {shown.text}
    </span>
  );
}

function Row({
  item,
  busy,
  eurobucks,
  onBuy,
}: {
  item: StockedItem;
  busy: boolean;
  /** What the character is actually holding, so the button cannot lie. */
  eurobucks: number;
  onBuy: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const stackable = stacksInInventory(item.kind);
  const raw = useMemo(() => {
    try {
      return catalogItem(item.kind, item.itemId) as { id: string; name: string } & Record<
        string,
        unknown
      >;
    } catch {
      return null;
    }
  }, [item.kind, item.itemId]);
  const total = item.price * (stackable ? quantity : 1);
  // A week's stock is what it is: the stepper stops where the shelf does.
  const most = item.left ?? Infinity;

  return (
    <li className="flex items-start gap-2 border-b border-border/60 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-sm ${item.affordable ? "" : "text-muted-foreground"}`}>
            {item.name}
          </span>
          {raw && <ItemInfo kind={item.kind as ItemKindLabel} item={raw} />}
          <StockBadge item={item} />
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {summarize(item.kind, item.itemId)}
        </p>
      </div>

      {stackable && item.available && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={busy || quantity <= 1}
            aria-label={`One fewer ${item.name}`}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            −
          </Button>
          <span className="num w-5 text-center text-xs font-bold">{quantity}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={busy || quantity >= most}
            aria-label={`One more ${item.name}`}
            onClick={() => setQuantity((q) => Math.min(most, q + 1))}
          >
            +
          </Button>
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        className="num shrink-0"
        disabled={busy || !item.available || total > eurobucks}
        onClick={() => onBuy(quantity)}
      >
        {item.available ? `${total}eb` : "—"}
      </Button>
    </li>
  );
}

/**
 * Somewhere that is not a shop: the places that are, nearest first, each a
 * trip the map will charge for. Going is the same travel the map offers.
 */
function NoShopHere({
  from,
  mode,
  busy,
  onTravel,
}: {
  from: string;
  mode?: TravelMode | undefined;
  busy: boolean;
  onTravel: (placeKey: string) => void;
}) {
  const near = nearestShops(from, mode);
  return (
    <div className="mt-3 border border-border bg-card/50 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Nothing for sale where you are standing
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Your fixer will get you things by phone, for a price. For anything else you have to go to
        somebody who sells it.
      </p>
      <GoThere
        busy={busy}
        onTravel={onTravel}
        places={near.map((place) => ({
          placeKey: place.placeKey,
          name: place.name,
          detail: [
            place.districtName,
            place.vendors.map((v) => KIND_NOUN[v.id.split("@")[0]!]).join(" · "),
          ]
            .filter(Boolean)
            .join(" · "),
          minutes: place.minutes,
        }))}
      />
    </div>
  );
}

/** What a seller does, in a word, for the list of places to go. */
const KIND_NOUN: Record<string, string> = {
  street: "ammo & kit",
  gun_shop: "guns",
  armorer: "armor",
};

export function ShopSheet({
  bundle,
  onTravel,
  travelBusy = false,
  travelMode,
}: {
  bundle: LifeBundle;
  /** Take the character to somewhere that sells, the way the map would. */
  onTravel?: (placeKey: string) => void;
  travelBusy?: boolean;
  travelMode?: TravelMode | undefined;
}) {
  const [open, setOpen] = useState(false);
  const shop = useShop(bundle, open);
  const [kind, setKind] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** "What's the strangest thing you've got?" — the shelf narrowed to what is not staple stock. */
  const [unusualOnly, setUnusualOnly] = useState(false);

  const kinds = shop.vendor.deals;
  const active = kind && kinds.includes(kind as ItemKind) ? kind : kinds[0]!;

  // The week's finds have their own box; the "new" strip is everything else.
  const finds = useMemo(() => shop.shelf.filter((i) => i.layer === "find"), [shop.shelf]);
  const fresh = useMemo(() => shop.fresh.filter((i) => i.layer !== "find"), [shop.fresh]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (unusualOnly) return unusualOnShelf(shop.shelf) as StockedItem[];
    return shop.shelf
      .filter((i) => i.kind === active && i.layer !== "find")
      .filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [shop.shelf, active, query, unusualOnly]);

  return (
    <Sheet
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) shop.endVisit();
      }}
    >
      <SheetTrigger asChild>
        <DockTile icon={<ShoppingBag className="size-6" />} label="Shop" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Spending money</SheetTitle>
        </SheetHeader>

        <p className="num mt-1 text-sm">
          You have <span className="font-bold">{shop.eurobucks}eb</span>
        </p>

        {!shop.atShop && onTravel && (
          <NoShopHere
            from={bundle.campaign.location_key ?? DEFAULT_START}
            mode={travelMode}
            busy={travelBusy}
            onTravel={onTravel}
          />
        )}

        {/* Who you go and see. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shop.vendors.map((v) => (
            <Button
              key={v.id}
              size="sm"
              variant={v.id === shop.vendor.id ? "default" : "outline"}
              onClick={() => {
                shop.setVendor(v.id);
                setKind(null);
                setQuery("");
                setUnusualOnly(false);
              }}
            >
              {v.label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-sm italic text-muted-foreground">{shop.vendor.line}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          about {shop.vendor.minutes} min {shop.vendor.place ? "at the counter" : "there and back"}
          {shop.vendor.markup > 1
            ? ` · +${Math.round((shop.vendor.markup - 1) * 100)}% for reach`
            : ""}
          {shop.restockIn !== null &&
            ` · restocks ${shop.restockIn === 1 ? "tomorrow" : `in ${shop.restockIn} days`}`}
        </p>
        {shop.backRoomClosed && (
          <p className="mt-1 text-xs text-muted-foreground">
            There is a back room. They do not open it for people they do not know.
          </p>
        )}

        {finds.length > 0 && (
          <div className="mt-3 border border-accent/50 bg-accent/5 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              Turned up this week
            </p>
            <ul className="mt-1">
              {finds.map((item) => (
                <Row
                  key={`find:${item.itemId}`}
                  item={item}
                  busy={shop.busy}
                  eurobucks={shop.eurobucks}
                  onBuy={(quantity) => shop.buy(item, quantity)}
                />
              ))}
            </ul>
          </div>
        )}

        {fresh.length > 0 && (
          <div className="mt-3 border border-accent/50 bg-accent/5 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              New since your last visit
            </p>
            <ul className="mt-1">
              {fresh.map((item) => (
                <Row
                  key={`fresh:${item.kind}:${item.itemId}`}
                  item={item}
                  busy={shop.busy}
                  eurobucks={shop.eurobucks}
                  onBuy={(quantity) => shop.buy(item, quantity)}
                />
              ))}
            </ul>
          </div>
        )}

        <HaggleRow shop={shop} />

        {shop.message && (
          <p
            className={`mt-3 border-l-2 px-3 py-2 text-sm ${
              shop.message.tone === "bought"
                ? "border-accent bg-accent/10 text-foreground"
                : "border-destructive bg-destructive/10 text-destructive"
            }`}
          >
            {shop.message.text}
          </p>
        )}

        {/* Reloading is not shopping, but it is the other thing you came to do. */}
        {shop.reloadable.length > 0 && (
          <div className="mt-3 border border-border bg-card/50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Load up · {shop.spareRounds} spare rounds
            </p>
            <ul className="mt-1.5 space-y-1">
              {shop.reloadable.map((w) => (
                <li key={w.row.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="num truncate">
                    {w.name}{" "}
                    <span className="text-muted-foreground">
                      {w.loaded}/{w.magazine}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={shop.busy}
                    onClick={() => shop.reload(w.row.id)}
                  >
                    Reload
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <Button
              key={k}
              size="sm"
              variant={k === active && !unusualOnly ? "secondary" : "ghost"}
              onClick={() => {
                setKind(k);
                setUnusualOnly(false);
              }}
            >
              {KIND_LABELS[k] ?? k}
            </Button>
          ))}
          <Button
            size="sm"
            variant={unusualOnly ? "secondary" : "ghost"}
            onClick={() => setUnusualOnly(true)}
          >
            What&apos;s unusual?
          </Button>
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what he has…"
          className="mt-2"
        />

        <ul className="mt-1 flex-1 overflow-y-auto pr-1">
          {shop.loading ? (
            <li className="py-6 text-sm text-muted-foreground">Looking over the shelves…</li>
          ) : shown.length === 0 ? (
            <li className="py-6 text-sm text-muted-foreground">
              {unusualOnly
                ? "Nothing out of the ordinary this week. Ammo, kit, the usual."
                : "Nothing here matches that."}
            </li>
          ) : (
            shown.map((item) => (
              <Row
                key={`${item.kind}:${item.itemId}`}
                item={item}
                busy={shop.busy}
                eurobucks={shop.eurobucks}
                onBuy={(quantity) => shop.buy(item, quantity)}
              />
            ))
          )}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
