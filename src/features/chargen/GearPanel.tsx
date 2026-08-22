import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AMMUNITION,
  ARMOR,
  CATALOG_PENDING,
  CYBERWARE,
  GEAR,
  WEAPONS,
  type ArmorLocation,
} from "@/engine";
import {
  BudgetBars,
  Cart,
  FashionWarning,
  PurchaseError,
  defaultBudgetFor,
  eb,
  useLoadoutActions,
} from "./market";
import { ItemInfo } from "./ItemInfo";
import { ITEM_FLAVOR, VARIANT_FLAVOR } from "./itemFlavor";
import type { ChargenState } from "./store";

const matches = (name: string, query: string) =>
  !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());

/** Market lists read alphabetically so items are easy to find. */
const byName = <T extends { name: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Every market row shows a description. Terse catalog one-liners ("Explosive")
 * get replaced by the item's house-voice blurb so rows read consistently.
 */
function Blurb({ id, text }: { id: string; text: string | null | undefined }) {
  const flavor = ITEM_FLAVOR[id];
  const body = flavor ?? text;

  if (!body) return null;
  return <p className="mt-1.5 text-xs leading-relaxed text-text-dim">{body}</p>;
}


function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim">
      {label} <span className="tabular-nums text-text-muted">{value}</span>
    </span>
  );
}

function QtyStepper({ qty, setQty }: { qty: number; setQty: (n: number) => void }) {
  return (
    <div className="flex items-center">
      <Button
        variant="outline"
        size="sm"
        aria-label="Decrease quantity"
        disabled={qty <= 1}
        onClick={() => setQty(Math.max(1, qty - 1))}
      >
        −
      </Button>
      <span className="w-8 text-center font-mono text-sm tabular-nums text-text">{qty}</span>
      <Button
        variant="outline"
        size="sm"
        aria-label="Increase quantity"
        onClick={() => setQty(qty + 1)}
      >
        +
      </Button>
    </div>
  );
}

function EmptyRow({ query }: { query: string }) {
  return (
    <p className="p-4 text-sm text-text-muted">
      Nothing matches “{query.trim()}”. Try a different search.
    </p>
  );
}


function WeaponTable({ state, query }: { state: ChargenState; query: string }) {
  const { buy } = useLoadoutActions();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [variant, setVariant] = useState<Record<string, string>>({});
  const rows = byName(WEAPONS.filter((w) => matches(w.name, query)));
  if (rows.length === 0)
    return (
      <div className="border border-hairline bg-surface">
        <EmptyRow query={query} />
      </div>
    );
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((w) => {
        const n = qty[w.id] ?? 1;
        const variants = (w as unknown as { variants?: string[] }).variants;
        const chosen = variants ? (variant[w.id] ?? variants[0]!) : undefined;
        return (
          <div key={w.id} className="flex items-start justify-between gap-4 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm text-text">{w.name}</p>
                <ItemInfo kind="weapon" item={w} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <Stat label="DMG" value={w.damage} />
                <Stat label="MAG" value={w.magazine ?? "None"} />
                <Stat label="ROF" value={w.rof} />
                <Stat label="HANDS" value={w.handsRequired} />
                <Stat label="SKILL" value={w.skill} />
              </div>
              {variants && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                    Pick one
                  </span>
                  {variants.map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={chosen === v}
                      onClick={() => setVariant((p) => ({ ...p, [w.id]: v }))}
                      className={cn(
                        "border px-2 py-0.5 font-mono text-[11px] tracking-wide transition-colors",
                        chosen === v
                          ? "border-ember bg-ember/10 text-ember"
                          : "border-hairline text-text-muted hover:border-ember",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
              {variants ? (
                chosen && VARIANT_FLAVOR[chosen] ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-text-dim">
                    {VARIANT_FLAVOR[chosen]}
                  </p>
                ) : null
              ) : (
                <Blurb id={w.id} text={w.notes} />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <QtyStepper qty={n} setQty={(v) => setQty((p) => ({ ...p, [w.id]: v }))} />
              <span className="font-mono text-sm tabular-nums text-ember">{eb(w.cost * n)}</span>
              <Button
                size="sm"
                aria-label={`Buy ${chosen ?? w.name}`}
                onClick={() =>
                  buy({
                    kind: "weapon",
                    itemId: w.id,
                    qty: n,
                    ...(chosen ? { variant: chosen } : {}),
                    budget: defaultBudgetFor("weapon", w.id, state),
                  })
                }
              >
                Buy
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArmorTable({ state, query }: { state: ChargenState; query: string }) {
  const { buy } = useLoadoutActions();
  const [locations, setLocations] = useState<Record<string, ArmorLocation>>({});
  const rows = byName(ARMOR.filter((a) => matches(a.name, query)));
  if (rows.length === 0)
    return (
      <div className="border border-hairline bg-surface">
        <EmptyRow query={query} />
      </div>
    );
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((a) => {
        const location = locations[a.id] ?? a.locations[0]!;
        return (
          <div key={a.id} className="flex items-start justify-between gap-4 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm text-text">{a.name}</p>
                <ItemInfo kind="armor" item={a} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <Stat label="SP" value={a.sp ?? "None"} />
                <Stat label="HP" value={a.hp ?? undefined} />
                <Stat
                  label="PENALTY"
                  value={a.penalty ? `${a.penalty.value} ${a.penalty.stats.join("/")}` : "none"}
                />
              </div>
              <Blurb id={a.id} text={a.notes} />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {a.locations.length > 1 ? (
                <div className="flex gap-1">
                  {a.locations.map((loc) => (
                    <Button
                      key={loc}
                      size="sm"
                      variant={location === loc ? "default" : "outline"}
                      onClick={() => setLocations((prev) => ({ ...prev, [a.id]: loc }))}
                    >
                      {loc}
                    </Button>
                  ))}
                </div>
              ) : (
                <span className="font-mono text-[11px] uppercase text-text-dim">
                  {a.locations[0]}
                </span>
              )}
              <span className="font-mono text-sm tabular-nums text-ember">{eb(a.cost)}</span>
              <Button
                size="sm"
                aria-label={`Wear ${a.name}`}
                onClick={() =>
                  buy({
                    kind: "armor",
                    itemId: a.id,
                    location,
                    budget: defaultBudgetFor("armor", a.id, state),
                  })
                }
              >
                Wear
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AmmoTable({ state, query }: { state: ChargenState; query: string }) {
  const { buy } = useLoadoutActions();
  const [qty, setQty] = useState<Record<string, number>>({});
  const rows = byName(AMMUNITION.filter((a) => matches(a.name, query)));
  if (rows.length === 0)
    return (
      <div className="border border-hairline bg-surface">
        <EmptyRow query={query} />
      </div>
    );
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((a) => {
        const n = qty[a.id] ?? 1;
        return (
          <div key={a.id} className="flex items-start justify-between gap-4 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm text-text">
                  {a.name} <span className="text-text-dim">({a.unit})</span>
                </p>
                <ItemInfo kind="ammunition" item={a} />
              </div>
              <p className="mt-1 text-xs text-text-dim">{a.types.join(" · ")}</p>
              <Blurb id={a.id} text={a.notes} />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <QtyStepper qty={n} setQty={(v) => setQty((p) => ({ ...p, [a.id]: v }))} />
              <span className="font-mono text-sm tabular-nums text-ember">{eb(a.cost * n)}</span>
              <Button
                size="sm"
                aria-label={`Buy ${a.name}`}
                onClick={() =>
                  buy({
                    kind: "ammunition",
                    itemId: a.id,
                    qty: n,
                    budget: defaultBudgetFor("ammunition", a.id, state),
                  })
                }
              >
                Buy
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GearTable({ state, query }: { state: ChargenState; query: string }) {
  const { buy } = useLoadoutActions();
  const [qty, setQty] = useState<Record<string, number>>({});
  const rows = byName(GEAR.filter((g) => matches(g.name, query)));
  if (rows.length === 0)
    return (
      <div className="border border-hairline bg-surface">
        <EmptyRow query={query} />
      </div>
    );
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((g) => {
        const n = qty[g.id] ?? 1;
        return (
          <div key={g.id} className="flex items-start justify-between gap-4 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm text-text">{g.name}</p>
                <ItemInfo kind="gear" item={g} />
              </div>
              <Blurb id={g.id} text={g.description} />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <QtyStepper qty={n} setQty={(v) => setQty((p) => ({ ...p, [g.id]: v }))} />
              <span className="font-mono text-sm tabular-nums text-ember">{eb(g.cost * n)}</span>
              <Button
                size="sm"
                aria-label={`Buy ${g.name}`}
                onClick={() =>
                  buy({
                    kind: "gear",
                    itemId: g.id,
                    qty: n,
                    budget: defaultBudgetFor("gear", g.id, state),
                  })
                }
              >
                Buy
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FashionTable({ state, query }: { state: ChargenState; query: string }) {
  const { buy } = useLoadoutActions();
  const fashionware = byName(
    CYBERWARE.filter((c) => c.category === "fashionware" && matches(c.name, query)),
  );
  if (fashionware.length === 0)
    return (
      <div className="border border-hairline bg-surface">
        <EmptyRow query={query} />
      </div>
    );
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {fashionware.map((c) => (
        <div key={c.id} className="flex items-start justify-between gap-4 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-text">{c.name}</p>
              <ItemInfo kind="cyberware" item={c} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <Stat label="HL" value={c.humanityLoss} />
              <Stat label="SLOTS" value={c.slotsUsed} />
              <Stat label="INSTALL" value={c.install} />
            </div>
            <Blurb id={c.id} text={c.notes} />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-sm tabular-nums text-ember">{eb(c.cost)}</span>
            <Button
              size="sm"
              aria-label={`Buy ${c.name}`}
              onClick={() =>
                buy({
                  kind: "cyberware",
                  itemId: c.id,
                  budget: defaultBudgetFor("cyberware", c.id, state),
                })
              }
            >
              Buy
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GearPanel({ state }: { state: ChargenState }) {
  const { remove, error } = useLoadoutActions();
  const [query, setQuery] = useState("");

  if (!state.method || !state.roleId) {
    return (
      <div className="border border-dashed border-hairline bg-surface/50 p-6 text-sm text-text-muted">
        Choose a creation method and a Role first. Budgets depend on both.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-hairline bg-surface-raised p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">Night Market</p>
        <p className="mt-2 text-sm text-text-muted">
          Two budgets, and they do not mix. Gear money buys anything and what you do not spend is
          yours. Fashion money buys only Fashion and Fashionware, and anything left of it is gone
          for good.
        </p>
      </div>


      <Tabs defaultValue="weapons">
        {/* Sticky rail: budget + cart + list tabs travel together, fully opaque so
            the lists scroll underneath instead of showing through. */}
        <div className="sticky top-0 z-30 -mx-1 border-b border-border bg-background px-1 pb-3 pt-2 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.9)]">
          <div className="grid gap-4">
            <BudgetBars state={state} className="grid gap-3 sm:grid-cols-2" />
            <Cart state={state} onRemove={remove} />
          </div>

          <FashionWarning state={state} />
          <PurchaseError error={error} />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="weapons">Weapons</TabsTrigger>
              <TabsTrigger value="armor">Armor</TabsTrigger>
              <TabsTrigger value="ammo">Ammunition</TabsTrigger>
              <TabsTrigger value="gear">Gear</TabsTrigger>
              <TabsTrigger value="fashion">Fashion & Fashionware</TabsTrigger>
            </TabsList>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this list…"
              aria-label="Search the current list"
              className="sm:max-w-xs"
            />
          </div>
        </div>

        <TabsContent value="weapons" className="mt-4">
          <WeaponTable state={state} query={query} />
        </TabsContent>
        <TabsContent value="armor" className="mt-4">
          <ArmorTable state={state} query={query} />
          <p className="mt-2 text-xs text-text-dim">
            One worn armor per location. Current SP is stored apart from base SP so ablation works
            in play.
          </p>
        </TabsContent>
        <TabsContent value="ammo" className="mt-4">
          <AmmoTable state={state} query={query} />
        </TabsContent>
        <TabsContent value="gear" className="mt-4">
          <GearTable state={state} query={query} />
        </TabsContent>
        <TabsContent value="fashion" className="mt-4">
          <FashionTable state={state} query={query} />
        </TabsContent>
      </Tabs>

      {CATALOG_PENDING.length > 0 && (
        <div className="border border-dashed border-hairline bg-surface/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
            Catalog coverage
          </p>
          <p className="mt-2 text-sm text-text-muted">
            The catalog does not yet include: {CATALOG_PENDING.join(", ")}. Those rows are marked
            pending in the rules data, so nothing here is invented to fill the gap.
          </p>
        </div>
      )}
    </div>
  );
}
