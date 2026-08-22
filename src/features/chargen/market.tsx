import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ARMOR,
  addPurchase,
  budgetStates,
  canPurchase,
  catalogItem,
  deriveStats,
  evaporatingBudgets,
  eurobucksKept,
  foundations,
  getCyberware,
  isFashionItem,
  itemName,
  lineCost,
  loadoutHumanity,
  removeLine,
  type BudgetId,
  type CartLine,
  type ItemKind,
  type Loadout,
  type PurchaseRequest,
  type StatBlock,
} from "@/engine";
import { STAT_ORDER } from "@/engine";
import { useChargenStore, type ChargenState } from "./store";

/** Single place where purchases are applied. All rule checks live in the engine. */
export function useLoadoutActions() {
  const patch = useChargenStore((s) => s.patch);
  const loadout = useChargenStore((s) => s.loadout);
  const method = useChargenStore((s) => s.method);
  const [error, setError] = useState<string | null>(null);

  function buy(request: PurchaseRequest) {
    if (!method) return;
    const check = canPurchase(method, loadout, request);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setError(null);
    patch({ loadout: addPurchase(method, loadout, request) });
  }

  function remove(lineId: string) {
    setError(null);
    patch({ loadout: removeLine(loadout, lineId) });
  }

  function removeStackByKey(key: string) {
    setError(null);
    patch({ loadout: removeStack(loadout, key) });
  }

  function changeStackQty(key: string, delta: number) {
    if (!method) return;
    const check = canChangeQty(method, loadout, key, delta);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setError(null);
    patch({ loadout: changeQty(method, loadout, key, delta) });
  }

  function setChoice(choiceId: string, option: string) {
    const variants = { ...(loadout.packageVariants ?? {}) };
    // A different option means any specific weapon picked for it no longer applies.
    if (loadout.packageChoices[choiceId] !== option) delete variants[choiceId];
    patch({
      loadout: {
        ...loadout,
        packageChoices: { ...loadout.packageChoices, [choiceId]: option },
        packageVariants: variants,
      },
    });
  }

  function setPackageVariant(choiceId: string, variant: string) {
    patch({
      loadout: {
        ...loadout,
        packageVariants: { ...(loadout.packageVariants ?? {}), [choiceId]: variant },
      },
    });
  }

  function check(request: PurchaseRequest) {
    return method ? canPurchase(method, loadout, request) : { ok: false, reason: null };
  }

  return {
    loadout,
    method,
    buy,
    remove,
    removeStack: removeStackByKey,
    changeQty: changeStackQty,
    setChoice,
    setPackageVariant,
    check,
    error,
    clearError: () => setError(null),
  };
}

export function eb(value: number) {
  return `${value.toLocaleString()}eb`;
}

export function BudgetBars({ state, className }: { state: ChargenState; className?: string }) {
  if (!state.method) return null;
  const budgets = budgetStates(state.method, state.loadout);
  return (
    <div className={className ?? "grid gap-3 sm:grid-cols-2"}>
      {budgets.map((b) => {
        const pct = Math.min(100, (b.spent / b.limit) * 100);
        return (
          <div
            key={b.id}
            className={`border p-4 ${
              budgets.length === 1 ? "col-span-full" : ""
            } ${
              b.unspentKept ? "border-hairline bg-surface" : "border-danger/60 bg-danger/5"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
                {b.label}
              </p>
              <p
                className={`font-mono text-lg tabular-nums ${
                  b.overspent ? "text-danger" : "text-ember"
                }`}
              >
                {eb(b.remaining)}
              </p>
            </div>
            <div className="mt-3 h-1.5 w-full bg-hairline">
              <div
                className={`h-full ${b.overspent ? "bg-danger" : "bg-ember"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[11px] tabular-nums text-text-dim">
              {eb(b.spent)} of {eb(b.limit)} spent.{" "}
              {b.unspentKept ? "Unspent is KEPT" : "Unspent is LOST when you leave"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function FashionWarning({ state }: { state: ChargenState }) {
  if (!state.method) return null;
  const evaporating = evaporatingBudgets(state.method, state.loadout);
  if (evaporating.length === 0) return null;
  return (
    <div className="border border-danger/60 bg-danger/10 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-danger">
        Money about to evaporate
      </p>
      {evaporating.map((b) => (
        <p key={b.id} className="mt-1 text-sm text-text">
          You still have <span className="font-mono tabular-nums">{eb(b.remaining)}</span> in "
          {b.label}". That money is lost the moment you finish. It cannot be carried into play.
        </p>
      ))}
    </div>
  );
}

const CART_PAGE_SIZE = 10;
const CART_COLUMN_SIZE = CART_PAGE_SIZE / 2;

type CartLineShape = ChargenState["loadout"]["lines"][number];

function CartLine({ line, onRemove }: { line: CartLineShape; onRemove: (id: string) => void }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-text">
          {line.variant ?? itemName(line.kind, line.itemId)}
          {line.variant ? (
            <span className="ml-1 text-text-dim">({itemName(line.kind, line.itemId)})</span>
          ) : null}
          {line.qty > 1 ? ` ×${line.qty}` : ""}
          {line.location ? (
            <span className="ml-2 font-mono text-[11px] uppercase text-text-dim">
              {line.location}
            </span>
          ) : null}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim">
          {line.budget === "fashion" ? "fashion money" : "gear money"} · {line.kind}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-sm tabular-nums text-text-muted">{eb(lineCost(line))}</span>
        <Button size="sm" variant="ghost" onClick={() => onRemove(line.lineId)}>
          Remove
        </Button>
      </div>
    </li>
  );
}

export function Cart({ state, onRemove }: { state: ChargenState; onRemove: (id: string) => void }) {
  const lines = state.loadout.lines;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(lines.length / CART_PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);
  if (!state.method) return null;
  const kept = eurobucksKept(state.method, state.loadout);
  const visible = lines.slice(current * CART_PAGE_SIZE, current * CART_PAGE_SIZE + CART_PAGE_SIZE);
  // Column-major fill: read top-to-bottom on the left, then the right column.
  const left = visible.slice(0, CART_COLUMN_SIZE);
  const right = visible.slice(CART_COLUMN_SIZE);
  return (
    <div className="border border-hairline bg-surface">
      <p className="border-b border-hairline px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
        Cart · {lines.length} line{lines.length === 1 ? "" : "s"}
      </p>
      {lines.length === 0 ? (
        <p className="px-4 py-6 text-sm text-text-muted">Nothing bought yet.</p>
      ) : (
        <div className="max-h-[45vh] overflow-y-auto lg:grid lg:grid-cols-2">
          <ul className="divide-y divide-hairline lg:border-r lg:border-hairline">
            {left.map((line) => (
              <CartLine key={line.lineId} line={line} onRemove={onRemove} />
            ))}
          </ul>
          {right.length > 0 ? (
            <ul className="divide-y divide-hairline border-t border-hairline lg:border-t-0">
              {right.map((line) => (
                <CartLine key={line.lineId} line={line} onRemove={onRemove} />
              ))}
            </ul>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
      )}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
            Page {current + 1} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
      <p className="border-t border-hairline px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
        Carried into play: <span className="text-ember tabular-nums">{eb(kept)}</span>
      </p>
    </div>
  );
}


export function PurchaseError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-text">{error}</div>
  );
}

/** Live Humanity / EMP readout driven entirely by the engine's humanity module. */
export function HumanityMeter({ state }: { state: ChargenState }) {
  const complete = STAT_ORDER.every((s) => typeof state.stats[s] === "number");
  if (!complete) {
    return (
      <div className="border border-dashed border-hairline bg-surface/50 p-4 text-sm text-text-muted">
        Humanity tracking needs a complete STAT block first.
      </div>
    );
  }
  const derived = deriveStats(state.stats as StatBlock);
  const humanity = loadoutHumanity(derived.humanityMax, state.loadout);
  const empBefore = (state.stats as StatBlock).emp;
  const near = humanity.humanityCurrent > 0 && humanity.humanityCurrent <= 10;

  return (
    <div
      className={`border p-4 ${
        humanity.cyberpsychosisRisk
          ? "border-danger bg-danger/10"
          : near
            ? "border-ember bg-ember/5"
            : "border-hairline bg-surface"
      }`}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
        Humanity & EMP
      </p>
      <div className="mt-2 grid grid-cols-3 gap-3 font-mono tabular-nums">
        <div>
          <p className="text-2xl text-text">{humanity.humanitySheet}</p>
          <p className="text-[11px] uppercase text-text-dim">
            Humanity (was {humanity.humanityBefore})
          </p>
        </div>
        <div>
          <p className="text-2xl text-danger">−{humanity.humanityLost}</p>
          <p className="text-[11px] uppercase text-text-dim">Lost to cyberware</p>
        </div>
        <div>
          <p className={`text-2xl ${humanity.emp < empBefore ? "text-danger" : "text-text"}`}>
            {humanity.emp}
          </p>
          <p className="text-[11px] uppercase text-text-dim">EMP (was {empBefore})</p>
        </div>
      </div>
      {humanity.cyberpsychosisRisk ? (
        <p className="mt-3 text-sm text-text">
          Humanity has dropped below zero. This character is in cyberpsychosis and cannot be played.
          Remove cyberware until Humanity is at zero or above.
        </p>
      ) : near ? (
        <p className="mt-3 text-sm text-text">
          Careful: {humanity.humanitySheet} Humanity left. One more heavy piece can tip this
          character into cyberpsychosis.
        </p>
      ) : null}
    </div>
  );
}

export function CyberwareSlots({ loadout }: { loadout: Loadout }) {
  const found = foundations(loadout);
  if (found.length === 0) return null;
  return (
    <div className="border border-hairline bg-surface p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
        Installed foundations
      </p>
      <ul className="mt-2 space-y-1">
        {found.map((f) => (
          <li key={f.line.lineId} className="flex justify-between font-mono text-sm tabular-nums">
            <span className="text-text">{f.name}</span>
            <span className={f.free === 0 ? "text-danger" : "text-text-muted"}>
              {f.used}/{f.slots} Option Slots
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function defaultBudgetFor(kind: ItemKind, itemId: string, state: ChargenState): BudgetId {
  if (state.method !== "complete_package") return "free";
  if (!isFashionItem(kind, itemId)) return "gear";
  const fashion = budgetStates(state.method, state.loadout).find((b) => b.id === "fashion");
  const cost = catalogItem(kind, itemId).cost;
  return fashion && fashion.remaining >= cost ? "fashion" : "gear";
}

export function armorLineFor(loadout: Loadout, itemId: string): CartLine | undefined {
  return loadout.lines.find((l) => l.kind === "armor" && l.itemId === itemId);
}

export const ARMOR_ROWS = ARMOR;
export { getCyberware };
