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
  PACKAGE_FLAGS,
  PACKAGE_NOTES,
  GEAR,
  WEAPONS,
  getGearPackage,
  packageCatalogRow,
  variantOptionsFor,
  isChoice,
  type ArmorLocation,
  type PackageEntry,
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
import { ItemInfo, type ItemKindLabel } from "./ItemInfo";
import type { ChargenState } from "./store";

const matches = (name: string, query: string) =>
  !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());

function Row({ children }: { children: React.ReactNode }) {
  return <div className="border border-hairline bg-surface p-4">{children}</div>;
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
      <Button variant="outline" size="sm" aria-label="Increase quantity" onClick={() => setQty(qty + 1)}>
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

/** The "?" modal for a printed package label, when it maps to a catalog row. */
function PackageItemInfo({ label }: { label: string }) {
  const row = packageCatalogRow(label);
  if (!row || row.kind === "fashion") return null;
  return <ItemInfo kind={row.kind as ItemKindLabel} item={row.item as { id: string; name: string }} />;
}

function VariantPicker({
  id,
  label,
  options,
}: {
  id: string;
  label: string;
  options: string[];
}) {
  const { loadout, setPackageVariant } = useLoadoutActions();
  const picked = loadout.packageVariants?.[id];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
        Pick the specific weapon
      </span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={picked === option}
          aria-label={`${label}: ${option}`}
          onClick={() => setPackageVariant(id, option)}
          className={cn(
            "border px-2 py-0.5 font-mono text-[11px] tracking-wide transition-colors",
            picked === option
              ? "border-ember bg-ember/10 text-ember"
              : "border-hairline text-text-muted hover:border-ember",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function PackageEntries({
  entries,
  field,
}: {
  entries: PackageEntry[];
  field: "weaponsArmor" | "gear" | "cyberware";
}) {
  const { loadout, setChoice } = useLoadoutActions();
  return (
    <ul className="space-y-2">
      {entries.map((entry, i) => {
        const id = `${field}.${i}`;
        if (isChoice(entry)) {
          const picked = loadout.packageChoices[id];
          const variants = picked ? variantOptionsFor(picked) : [];
          return (
            <li key={id} className="border border-dashed border-ember/60 bg-ember/5 p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
                Pick exactly one
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.choice.map((option) => (
                  <span key={option} className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={picked === option ? "default" : "outline"}
                      onClick={() => setChoice(id, option)}
                    >
                      {option}
                    </Button>
                    <PackageItemInfo label={option} />
                  </span>
                ))}
              </div>
              {picked && variants.length > 0 && (
                <VariantPicker id={id} label={picked} options={variants} />
              )}
            </li>
          );
        }
        const variants = variantOptionsFor(entry.item);
        return (
          <li key={`${entry.item}-${i}`} className="text-sm text-text">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                {entry.item}
                <PackageItemInfo label={entry.item} />
              </span>
              <span className="font-mono tabular-nums text-text-dim">×{entry.qty}</span>
            </div>
            {variants.length > 0 && (
              <VariantPicker id={id} label={entry.item} options={variants} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FixedPackage({ roleId }: { roleId: string }) {
  const pkg = getGearPackage(roleId);
  const flags = PACKAGE_FLAGS.filter((f) => f.role === roleId);

  return (
    <div className="space-y-4">
      <Row>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          Weapons & Armor
        </p>
        <div className="mt-3">
          <PackageEntries entries={pkg.weaponsArmor} field="weaponsArmor" />
        </div>
        <p className="mt-3 text-xs text-text-muted">{PACKAGE_NOTES.armor}</p>
      </Row>
      <Row>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">Gear</p>
        <div className="mt-3">
          <PackageEntries entries={pkg.gear} field="gear" />
        </div>
      </Row>
      <Row>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">Outfit</p>
        <ul className="mt-3 space-y-1 text-sm text-text">
          {pkg.outfit.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-text-muted">{PACKAGE_NOTES.outfit}</p>
      </Row>
      {flags.length > 0 ? (
        <Row>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">Good to know</p>
          {flags.map((f) => (
            <p key={f.item} className="mt-2 text-sm text-text-muted">
              <span className="text-text">{f.item}</span>: {f.issue}
            </p>
          ))}
        </Row>
      ) : null}
    </div>
  );
}

function WeaponTable({ state, query }: { state: ChargenState; query: string }) {
  const { buy } = useLoadoutActions();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [variant, setVariant] = useState<Record<string, string>>({});
  const rows = WEAPONS.filter((w) => matches(w.name, query));
  if (rows.length === 0) return <div className="border border-hairline bg-surface"><EmptyRow query={query} /></div>;
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((w) => {
        const n = qty[w.id] ?? 1;
        const variants = (w as unknown as { variants?: string[] }).variants;
        const chosen = variants ? (variant[w.id] ?? variants[0]!) : undefined;
        return (
          <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-[16rem]">
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
              {!variants && w.notes ? <p className="mt-1 text-xs text-text-dim">{w.notes}</p> : null}
            </div>
            <div className="flex items-center gap-3">
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
  const rows = ARMOR.filter((a) => matches(a.name, query));
  if (rows.length === 0) return <div className="border border-hairline bg-surface"><EmptyRow query={query} /></div>;
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((a) => {
        const location = locations[a.id] ?? a.locations[0]!;
        return (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-[16rem]">
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
              {a.notes ? <p className="mt-1 text-xs text-text-dim">{a.notes}</p> : null}
            </div>
            <div className="flex items-center gap-3">
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
  const rows = AMMUNITION.filter((a) => matches(a.name, query));
  if (rows.length === 0) return <div className="border border-hairline bg-surface"><EmptyRow query={query} /></div>;
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((a) => {
        const n = qty[a.id] ?? 1;
        return (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-text">
                  {a.name} <span className="text-text-dim">({a.unit})</span>
                </p>
                <ItemInfo kind="ammunition" item={a} />
              </div>
              <p className="mt-1 text-xs text-text-dim">{a.types.join(" · ")}</p>
              {a.notes ? <p className="mt-1 text-xs text-text-dim">{a.notes}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <QtyStepper qty={n} setQty={(v) => setQty((p) => ({ ...p, [a.id]: v }))} />
              <span className="font-mono text-sm tabular-nums text-ember">{eb(a.cost * n)}</span>
              <Button
                size="sm"
                aria-label={`Buy ${a.name}`}
                onClick={() =>
                  buy({ kind: "ammunition", itemId: a.id, qty: n, budget: defaultBudgetFor("ammunition", a.id, state) })
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
  const rows = GEAR.filter((g) => matches(g.name, query));
  if (rows.length === 0)
    return <div className="border border-hairline bg-surface"><EmptyRow query={query} /></div>;
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((g) => {
        const n = qty[g.id] ?? 1;
        return (
          <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-[16rem]">
              <div className="flex items-center gap-2">
                <p className="text-sm text-text">{g.name}</p>
                <ItemInfo kind="gear" item={g} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <Stat label="PRICE" value={g.priceCategory} />
              </div>
              {g.description ? (
                <p className="mt-1 text-xs text-text-dim">{g.description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <QtyStepper qty={n} setQty={(v) => setQty((p) => ({ ...p, [g.id]: v }))} />
              <span className="font-mono text-sm tabular-nums text-ember">{eb(g.cost * n)}</span>
              <Button
                size="sm"
                aria-label={`Buy ${g.name}`}
                onClick={() =>
                  buy({ kind: "gear", itemId: g.id, qty: n, budget: defaultBudgetFor("gear", g.id, state) })
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
  const fashionware = CYBERWARE.filter((c) => c.category === "fashionware" && matches(c.name, query));
  if (fashionware.length === 0)
    return <div className="border border-hairline bg-surface"><EmptyRow query={query} /></div>;
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {fashionware.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-[16rem]">
            <div className="flex items-center gap-2">
              <p className="text-sm text-text">{c.name}</p>
              <ItemInfo kind="cyberware" item={c} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <Stat label="HL" value={c.humanityLoss} />
              <Stat label="SLOTS" value={c.slotsUsed} />
              <Stat label="INSTALL" value={c.install} />
            </div>
            {c.notes ? <p className="mt-1 text-xs text-text-dim">{c.notes}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm tabular-nums text-ember">{eb(c.cost)}</span>
            <Button
              size="sm"
              aria-label={`Buy ${c.name}`}
              onClick={() =>
                buy({ kind: "cyberware", itemId: c.id, budget: defaultBudgetFor("cyberware", c.id, state) })
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
  const isPackage = state.method === "streetrat" || state.method === "edgerunner";

  if (!state.method || !state.roleId) {
    return (
      <div className="border border-dashed border-hairline bg-surface/50 p-6 text-sm text-text-muted">
        Choose a creation method and a Role first. Gear is issued per Role.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isPackage ? (
        <>
          <div className="border border-hairline bg-surface-raised p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
              Fixed package
            </p>
            <p className="mt-2 text-sm text-text-muted">{PACKAGE_NOTES.choice}</p>
          </div>
          <FixedPackage roleId={state.roleId} />
        </>
      ) : (
        <div className="border border-hairline bg-surface-raised p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
            Night Market
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Two budgets, and they do not mix. Gear money buys anything and what you do not spend
            is yours. Fashion money buys only Fashion and Fashionware, and anything left of it is
            gone for good.
          </p>
        </div>
      )}

      {/* Sticky budget so remaining eb stays in view while you shop. */}
      <div className="sticky top-14 z-10 bg-ground/95 py-2 backdrop-blur">
        <BudgetBars state={state} />
      </div>
      <FashionWarning state={state} />
      <PurchaseError error={error} />

      <Tabs defaultValue="weapons">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      <Cart state={state} onRemove={remove} />

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
