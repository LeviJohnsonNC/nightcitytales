import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CYBERWARE,
  HUMANITY_LOSS_AT_CREATION_RULE,
  NON_FOUNDATIONAL_CATEGORY_SLOT_CAP,
  categorySlotUsage,
  foundations,
  getCyberware,
  installQuantity,
} from "@/engine";
import {
  BudgetBars,
  Cart,
  CyberwareSlots,
  FashionWarning,
  HumanityMeter,
  PurchaseError,
  defaultBudgetFor,
  eb,
  useLoadoutActions,
} from "./market";
import { ItemInfo } from "./ItemInfo";
import type { ChargenState } from "./store";

/** Tab order and display labels for the eight official RED cyberware categories. */
const CATEGORIES: { id: string; label: string }[] = [
  { id: "fashionware", label: "Fashionware" },
  { id: "neuralware", label: "Neuralware" },
  { id: "cyberoptics", label: "Cyberoptics" },
  { id: "cyberaudio", label: "Cyberaudio" },
  { id: "internal", label: "Internal" },
  { id: "external", label: "External" },
  { id: "cyberlimbs", label: "Cyberlimbs" },
  { id: "borgware", label: "Borgware" },
];

const matches = (name: string, query: string) =>
  !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());

function CyberwareRow({ state, id }: { state: ChargenState; id: string }) {
  const item = getCyberware(id);
  const { buy, check, loadout } = useLoadoutActions();
  const budget = defaultBudgetFor("cyberware", item.id, state);
  const result = check({ kind: "cyberware", itemId: item.id, budget });
  const installed = loadout.lines.filter((l) => l.itemId === item.id).length;
  const requires = item.requires ? getCyberware(item.requires) : null;
  const quantity = installQuantity(item.id);
  const quotedCost = item.cost * quantity;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 p-3">
      <div className="min-w-[18rem] max-w-xl">
        <div className="flex items-center gap-2">
          <p className="text-sm text-text">
            {item.name}
            {installed > 0 ? (
              <span className="ml-2 font-mono text-[11px] uppercase text-ember">
                installed ×{installed}
              </span>
            ) : null}
          </p>
          <ItemInfo kind="cyberware" item={item} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim">
          <span>
            HL <span className="tabular-nums text-danger">{item.humanityLoss}</span>
            {item.humanityLossDice ? (
              <span className="ml-1 text-text-dim">
                ({item.humanityLossDice} after play starts)
              </span>
            ) : null}
          </span>
          <span>
            SLOTS <span className="tabular-nums text-text-muted">{item.slotsUsed}</span>
          </span>
          {item.foundational ? (
            <span>
              PROVIDES <span className="tabular-nums text-text-muted">{item.providesSlots}</span>
            </span>
          ) : null}
          <span>
            INSTALL <span className="text-text-muted">{item.install}</span>
          </span>
          {requires ? <span className="text-text-muted">REQUIRES {requires.name}</span> : null}
          {quantity > 1 ? <span className="text-text-muted">PAIRED ×{quantity}</span> : null}
        </div>
        {item.notes ? <p className="mt-1 text-xs text-text-dim">{item.notes}</p> : null}
        {!result.ok && result.reason ? (
          <p className="mt-2 text-xs text-danger">{result.reason}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm tabular-nums text-ember">{eb(quotedCost)}</span>
        <Button
          size="sm"
          disabled={!result.ok}
          aria-label={`Install ${item.name}`}
          onClick={() => buy({ kind: "cyberware", itemId: item.id, budget })}
        >
          Install
        </Button>
      </div>
    </div>
  );
}

function CyberwareTable({
  state,
  category,
  query,
}: {
  state: ChargenState;
  category: string;
  query: string;
}) {
  const rows = CYBERWARE.filter((c) => c.category === category && matches(c.name, query));
  if (rows.length === 0) {
    return (
      <p className="border border-hairline bg-surface p-4 text-sm text-text-muted">
        {query.trim() ? `Nothing matches “${query.trim()}” here.` : "Nothing in this category."}
      </p>
    );
  }
  return (
    <div className="divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((c) => (
        <CyberwareRow key={c.id} state={state} id={c.id} />
      ))}
    </div>
  );
}

export function CyberwarePanel({ state }: { state: ChargenState }) {
  const { remove, removeStack, changeQty, error, loadout } = useLoadoutActions();
  const [query, setQuery] = useState("");

  if (!state.method || !state.roleId) {
    return (
      <div className="border border-dashed border-hairline bg-surface/50 p-6 text-sm text-text-muted">
        Choose a creation method and a Role first.
      </div>
    );
  }

  const usage = categorySlotUsage(loadout);
  const installedCount = loadout.lines.filter((l) => l.kind === "cyberware").length;

  return (
    <div className="space-y-6">
      <div className="border border-hairline bg-surface-raised p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
          Humanity is the price
        </p>
        <p className="mt-2 text-sm text-text-muted">{HUMANITY_LOSS_AT_CREATION_RULE}</p>
      </div>

      <HumanityMeter state={state} />
      <CyberwareSlots loadout={loadout} />

      {NON_FOUNDATIONAL_CATEGORY_SLOT_CAP !== null && Object.keys(usage).length > 0 ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          {Object.entries(usage)
            .map(([cat, used]) => `${cat} ${used}/${NON_FOUNDATIONAL_CATEGORY_SLOT_CAP} slots`)
            .join(" · ")}
        </p>
      ) : null}

      <Tabs defaultValue="fashionware">
        {/* Sticky rail: spend tracker + cart + category tabs travel together. */}
        <div className="sticky top-0 z-30 -mx-1 border-b border-border bg-background px-1 pb-3 pt-2 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.9)]">
          <div className="grid gap-4">
            <BudgetBars state={state} className="grid gap-3 sm:grid-cols-2" />
            <Cart state={state} onRemove={remove} onRemoveStack={removeStack} onQty={changeQty} />
          </div>

          <FashionWarning state={state} />
          <PurchaseError error={error} />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="flex-wrap">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.label}
                </TabsTrigger>
              ))}
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

        {CATEGORIES.map((c) => (
          <TabsContent key={c.id} value={c.id} className="mt-4">
            <CyberwareTable state={state} category={c.id} query={query} />
          </TabsContent>
        ))}
      </Tabs>

      {installedCount === 0 ? (
        <p className="text-sm text-text-muted">
          Nothing installed. A character with no cyberware keeps their full Humanity, which is a
          legitimate build, not an unfinished one.
        </p>
      ) : null}
      {foundations(loadout).length === 0 && installedCount > 0 ? (
        <p className="text-sm text-text-muted">
          No foundational piece installed yet. Options that slot into a Neural Link, Cybereye,
          Cyberaudio Suite, Cyberarm or Cyberleg stay locked until their foundation is in.
        </p>
      ) : null}
    </div>
  );
}
