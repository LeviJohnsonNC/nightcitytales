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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  catalogItem,
  getArmor,
  getGear,
  getWeapon,
  stacksInInventory,
  type ItemKind,
} from "@/engine";
import { ItemInfo, type ItemKindLabel } from "@/features/chargen/ItemInfo";
import type { StockedItem } from "@/features/campaign/shopping";
import { useShop } from "./useShop";
import type { LifeBundle } from "./useLife";

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

  return (
    <li className="flex items-start gap-2 border-b border-border/60 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-sm ${item.affordable ? "" : "text-muted-foreground"}`}>
            {item.name}
          </span>
          {raw && <ItemInfo kind={item.kind as ItemKindLabel} item={raw} />}
          {item.tier === "unusual" && (
            <span
              className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground"
              title="Not shelf stock — they have to go and look"
            >
              order
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {summarize(item.kind, item.itemId)}
        </p>
      </div>

      {stackable && (
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
            disabled={busy}
            aria-label={`One more ${item.name}`}
            onClick={() => setQuantity((q) => q + 1)}
          >
            +
          </Button>
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        className="num shrink-0"
        disabled={busy || total > eurobucks}
        onClick={() => onBuy(quantity)}
      >
        {total}eb
      </Button>
    </li>
  );
}

export function ShopSheet({ bundle }: { bundle: LifeBundle }) {
  const shop = useShop(bundle);
  const [kind, setKind] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const kinds = shop.vendor.deals;
  const active = kind && kinds.includes(kind as ItemKind) ? kind : kinds[0]!;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shop.shelf
      .filter((i) => i.kind === active)
      .filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [shop.shelf, active, query]);

  return (
    <Sheet onOpenChange={(open) => !open && shop.endVisit()}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          Go shopping
        </Button>
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
              }}
            >
              {v.label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-sm italic text-muted-foreground">{shop.vendor.line}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          about {shop.vendor.minutes} min there and back
          {shop.vendor.markup > 1
            ? ` · +${Math.round((shop.vendor.markup - 1) * 100)}% for reach`
            : ""}
        </p>

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
              variant={k === active ? "secondary" : "ghost"}
              onClick={() => setKind(k)}
            >
              {KIND_LABELS[k] ?? k}
            </Button>
          ))}
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what he has…"
          className="mt-2"
        />

        <ul className="mt-1 flex-1 overflow-y-auto pr-1">
          {shown.length === 0 ? (
            <li className="py-6 text-sm text-muted-foreground">Nothing here matches that.</li>
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
