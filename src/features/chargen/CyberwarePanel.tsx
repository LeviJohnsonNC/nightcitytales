import { Button } from "@/components/ui/button";
import {
  CYBERWARE,
  HUMANITY_LOSS_AT_CREATION_RULE,
  NON_FOUNDATIONAL_CATEGORY_SLOT_CAP,
  categorySlotUsage,
  foundations,
  getCyberware,
} from "@/engine";
import {
  Cart,
  CyberwareSlots,
  HumanityMeter,
  PurchaseError,
  defaultBudgetFor,
  eb,
  useLoadoutActions,
} from "./market";
import type { ChargenState } from "./store";

const CATEGORY_ORDER = Array.from(new Set(CYBERWARE.map((c) => c.category)));

function CyberwareRow({ state, id }: { state: ChargenState; id: string }) {
  const item = getCyberware(id);
  const { buy, check, loadout } = useLoadoutActions();
  const budget = defaultBudgetFor("cyberware", item.id, state);
  const result = check({ kind: "cyberware", itemId: item.id, budget });
  const installed = loadout.lines.filter((l) => l.itemId === item.id).length;
  const requires = item.requires ? getCyberware(item.requires) : null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 p-3">
      <div className="min-w-[18rem]">
        <p className="text-sm text-text">
          {item.name}
          {installed > 0 ? (
            <span className="ml-2 font-mono text-[11px] uppercase text-ember">
              installed ×{installed}
            </span>
          ) : null}
        </p>
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
        </div>
        {item.notes ? <p className="mt-1 text-xs text-text-dim">{item.notes}</p> : null}
        {!result.ok && result.reason ? (
          <p className="mt-2 text-xs text-danger">{result.reason}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm tabular-nums text-ember">{eb(item.cost)}</span>
        <Button
          size="sm"
          disabled={!result.ok}
          onClick={() => buy({ kind: "cyberware", itemId: item.id, budget })}
        >
          Install
        </Button>
      </div>
    </div>
  );
}

export function CyberwarePanel({ state }: { state: ChargenState }) {
  const { remove, error, loadout } = useLoadoutActions();

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
      <PurchaseError error={error} />

      {NON_FOUNDATIONAL_CATEGORY_SLOT_CAP !== null && Object.keys(usage).length > 0 ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          {Object.entries(usage)
            .map(([cat, used]) => `${cat} ${used}/${NON_FOUNDATIONAL_CATEGORY_SLOT_CAP} slots`)
            .join(" · ")}
        </p>
      ) : null}

      <div className="space-y-4">
        {CATEGORY_ORDER.map((category) => (
          <div key={category} className="border border-hairline bg-surface">
            <p className="border-b border-hairline px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
              {category}
            </p>
            <div className="divide-y divide-hairline">
              {CYBERWARE.filter((c) => c.category === category).map((c) => (
                <CyberwareRow key={c.id} state={state} id={c.id} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Cart state={state} onRemove={remove} />

      {installedCount === 0 ? (
        <p className="text-sm text-text-muted">
          Nothing installed. A character with no cyberware keeps their full Humanity — that is a
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
