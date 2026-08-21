import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AMMUNITION,
  ARMOR,
  CATALOG_PENDING,
  CYBERWARE,
  PACKAGE_FLAGS,
  PACKAGE_NOTES,
  WEAPONS,
  choicePoints,
  getGearPackage,
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
import { ItemInfo } from "./ItemInfo";
import type { ChargenState } from "./store";

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

function PackageEntries({ entries, choiceIds }: { entries: PackageEntry[]; choiceIds: string[] }) {
  const { loadout, setChoice } = useLoadoutActions();
  let choiceIndex = -1;
  return (
    <ul className="space-y-2">
      {entries.map((entry, i) => {
        if (isChoice(entry)) {
          choiceIndex += 1;
          const id = choiceIds[choiceIndex]!;
          const picked = loadout.packageChoices[id];
          return (
            <li key={id} className="border border-dashed border-ember/60 bg-ember/5 p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
                Pick exactly one
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.choice.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={picked === option ? "default" : "outline"}
                    onClick={() => setChoice(id, option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </li>
          );
        }
        return (
          <li key={`${entry.item}-${i}`} className="flex justify-between text-sm text-text">
            <span>{entry.item}</span>
            <span className="font-mono tabular-nums text-text-dim">×{entry.qty}</span>
          </li>
        );
      })}
    </ul>
  );
}

function FixedPackage({ roleId }: { roleId: string }) {
  const pkg = getGearPackage(roleId);
  const points = choicePoints(roleId);
  const idsFor = (field: "weaponsArmor" | "gear" | "cyberware") =>
    points.filter((p) => p.field === field).map((p) => p.id);
  const flags = PACKAGE_FLAGS.filter((f) => f.role === roleId);

  return (
    <div className="space-y-4">
      <Row>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          Weapons & Armor
        </p>
        <div className="mt-3">
          <PackageEntries entries={pkg.weaponsArmor} choiceIds={idsFor("weaponsArmor")} />
        </div>
        <p className="mt-3 text-xs text-text-muted">{PACKAGE_NOTES.armor}</p>
      </Row>
      <Row>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">Gear</p>
        <div className="mt-3">
          <PackageEntries entries={pkg.gear} choiceIds={idsFor("gear")} />
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
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
            Source flag — read before you commit
          </p>
          {flags.map((f) => (
            <p key={f.item} className="mt-2 text-sm text-text-muted">
              <span className="text-text">{f.item}</span> — {f.issue} (confidence: {f.confidence})
            </p>
          ))}
        </Row>
      ) : null}
    </div>
  );
}

function WeaponTable({ state }: { state: ChargenState }) {
  const { buy } = useLoadoutActions();
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {WEAPONS.map((w) => (
        <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-[16rem]">
            <div className="flex items-center gap-2">
              <p className="text-sm text-text">{w.name}</p>
              <ItemInfo kind="weapon" item={w} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <Stat label="DMG" value={w.damage} />
              <Stat label="MAG" value={w.magazine ?? "—"} />
              <Stat label="ROF" value={w.rof} />
              <Stat label="HANDS" value={w.handsRequired} />
              <Stat label="SKILL" value={w.skill} />
            </div>
            {w.notes ? <p className="mt-1 text-xs text-text-dim">{w.notes}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm tabular-nums text-ember">{eb(w.cost)}</span>
            <Button
              size="sm"
              onClick={() => buy({ kind: "weapon", itemId: w.id, budget: defaultBudgetFor("weapon", w.id, state) })}
            >
              Buy
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArmorTable({ state }: { state: ChargenState }) {
  const { buy } = useLoadoutActions();
  const [locations, setLocations] = useState<Record<string, ArmorLocation>>({});
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {ARMOR.map((a) => {
        const location = locations[a.id] ?? a.locations[0]!;
        return (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-[16rem]">
              <div className="flex items-center gap-2">
                <p className="text-sm text-text">{a.name}</p>
                <ItemInfo kind="armor" item={a} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <Stat label="SP" value={a.sp ?? "—"} />
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

function AmmoTable({ state }: { state: ChargenState }) {
  const { buy } = useLoadoutActions();
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {AMMUNITION.map((a) => (
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
            <span className="font-mono text-sm tabular-nums text-ember">{eb(a.cost)}</span>
            <Button
              size="sm"
              onClick={() =>
                buy({ kind: "ammunition", itemId: a.id, budget: defaultBudgetFor("ammunition", a.id, state) })
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

function FashionTable({ state }: { state: ChargenState }) {
  const { buy } = useLoadoutActions();
  const fashionware = CYBERWARE.filter((c) => c.category === "fashionware");
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
  const isPackage = state.method === "streetrat" || state.method === "edgerunner";

  if (!state.method || !state.roleId) {
    return (
      <div className="border border-dashed border-hairline bg-surface/50 p-6 text-sm text-text-muted">
        Choose a creation method and a Role first — gear is issued per Role.
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

      <BudgetBars state={state} />
      <FashionWarning state={state} />
      <PurchaseError error={error} />

      <Tabs defaultValue="weapons">
        <TabsList>
          <TabsTrigger value="weapons">Weapons</TabsTrigger>
          <TabsTrigger value="armor">Armor</TabsTrigger>
          <TabsTrigger value="ammo">Ammunition</TabsTrigger>
          <TabsTrigger value="fashion">Fashion & Fashionware</TabsTrigger>
        </TabsList>
        <TabsContent value="weapons" className="mt-4">
          <WeaponTable state={state} />
        </TabsContent>
        <TabsContent value="armor" className="mt-4">
          <ArmorTable state={state} />
          <p className="mt-2 text-xs text-text-dim">
            One worn armor per location. Current SP is stored apart from base SP so ablation works
            in play.
          </p>
        </TabsContent>
        <TabsContent value="ammo" className="mt-4">
          <AmmoTable state={state} />
        </TabsContent>
        <TabsContent value="fashion" className="mt-4">
          <FashionTable state={state} />
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
