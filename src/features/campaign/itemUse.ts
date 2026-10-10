/**
 * Using something out of the kit, decided once for both loops.
 *
 * Life and a Job now both let the player use what they are carrying, and the
 * reasoning is identical: resolve what the model named against the snapshot
 * legality just judged, ask the engine whether using it uses it up, and work
 * out what each row goes down to. Two copies of that would drift, and the half
 * that drifted last time was the half that wrote nothing at all — a turn that
 * printed "Used 5× Glow Paint" over five untouched cans.
 *
 * Pure: it returns the writes to make and the line to log, and performs
 * neither. The ops modules own the ordering of their own writes.
 */
import {
  findItem,
  gadgetTurnEffects,
  isConsumable,
  planConsumption,
  readGadget,
  operateGadget,
  type CapabilitySnapshot,
  type GadgetUse,
  type RNG,
  type RollResult,
} from "@/engine";
import type { CampaignInventoryItem } from "@/lib/backend";

export type ItemUse = {
  /** The catalog id, when the kit list knew what they meant. */
  itemId: string;
  /** What to call it in the ledger: the catalog's name, else what was said. */
  name: string;
  /** Whether using this spends it. False for equipment, and for an unknown id. */
  consumed: boolean;
  /** How many were actually taken. Zero for equipment. */
  spent: number;
  /** How many remain across every row afterwards. */
  remaining: number;
  /** The rows to set, and to what. Empty unless something was spent. */
  writes: { id: string; quantity: number }[];
  /** The ledger line. Says what happened to the sheet, not what was asked for. */
  summary: string;
};

/**
 * What using `item` costs this character.
 *
 * `capability` is the same snapshot `judgeAction` was handed, so the row that
 * gets spent is the row that was checked rather than a second guess at what
 * the model meant. Call this only after legality has said yes.
 */
export function planItemUse(input: {
  capability: CapabilitySnapshot;
  inventory: CampaignInventoryItem[];
  item: string;
  quantity: number;
}): ItemUse {
  const asked = Math.max(1, Math.trunc(input.quantity));
  const carried = findItem(input.capability, input.item);
  const name = carried?.name ?? input.item;

  if (!carried || !isConsumable(carried.itemId)) {
    // Equipment. They used it, they still have it — and the ledger says so
    // without a count, because "1 left" under a lockpick set is nonsense.
    return {
      itemId: carried?.itemId ?? input.item,
      name,
      consumed: false,
      spent: 0,
      remaining: carried?.quantity ?? 0,
      writes: [],
      summary: `Used ${asked > 1 ? `${asked}× ` : ""}${name}.`,
    };
  }

  const plan = planConsumption(
    input.inventory.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      quantity: row.quantity,
    })),
    carried.itemId,
    asked,
  );

  return {
    itemId: carried.itemId,
    name,
    consumed: true,
    spent: plan.spent,
    remaining: plan.remaining,
    writes: plan.rows.map((row) => ({ id: row.id, quantity: row.to })),
    summary:
      `Used ${plan.spent > 1 ? `${plan.spent}× ` : ""}${name}. ` +
      (plan.remaining > 0 ? `${plan.remaining} left.` : "None left."),
  };
}

/** The inventory as it stands after a use, for the rest of the same turn. */
export function applyItemUse(
  inventory: CampaignInventoryItem[],
  use: ItemUse,
): CampaignInventoryItem[] {
  if (!use.writes.length) return inventory;
  const byId = new Map(use.writes.map((write) => [write.id, write.quantity]));
  return inventory.map((row) => (byId.has(row.id) ? { ...row, quantity: byId.get(row.id)! } : row));
}

// ---------------------------------------------------------------------------
// Finds: what a gadget used this turn does to the turn (engine/gadgets.ts).
// ---------------------------------------------------------------------------

/** What a turn's finds did, for both loops to apply and log the same way. */
export type GadgetTurn<R extends { observation: string }> = {
  /** The observations to price, after every working find has had its say. */
  reports: R[];
  /** What the turn's in-world time is multiplied by. */
  timeFactor: number;
  /** Ledger lines: what changed, and any temperamental thing that did nothing. */
  lines: { summary: string; roll: RollResult | null }[];
};

/**
 * The finds a turn's proposed actions used, and what that did to what the city
 * noticed. Only finds the character is actually carrying count: a `use_item` of
 * something they do not have is refused elsewhere and does nothing here.
 * Observations a working find suppresses are dropped; a conspicuous one adds
 * `seen` with no faction, which is how any unattributed sighting is priced.
 */
export function gadgetTurn<R extends { observation: string; factionId: string | null }>(input: {
  capability: CapabilitySnapshot;
  proposed: readonly { kind: string; item?: string }[];
  reports: readonly R[];
  rng?: RNG;
  /** False where a turn's time is fixed (a Job), so a quick find has nothing to shorten. */
  timed?: boolean;
  /** Builds the report for an observation a find adds. */
  report: (observation: string) => R;
}): GadgetTurn<R> {
  const uses: GadgetUse[] = [];
  const seen = new Set<string>();
  for (const action of input.proposed) {
    if (action.kind !== "use_item" || !action.item) continue;
    const carried = findItem(input.capability, action.item);
    if (!carried || carried.quantity <= 0 || seen.has(carried.itemId)) continue;
    const gadget = readGadget(carried.itemId);
    if (!gadget) continue;
    seen.add(carried.itemId);
    uses.push(operateGadget(gadget, input.rng));
  }
  if (!uses.length) return { reports: [...input.reports], timeFactor: 1, lines: [] };

  const effect = gadgetTurnEffects(
    uses,
    input.reports.map((r) => r.observation),
    { timed: input.timed ?? true },
  );
  const kept = input.reports.filter((r) => effect.observations.includes(r.observation));
  for (const observation of effect.observations) {
    if (!kept.some((r) => r.observation === observation)) kept.push(input.report(observation));
  }
  const rolls = new Map(uses.map((u) => [u.gadget.name, u.roll]));
  return {
    reports: kept,
    timeFactor: effect.timeFactor,
    lines: effect.lines.map((summary) => {
      const failed = uses.find((u) => !u.worked && summary.startsWith(`The ${u.gadget.name} `));
      return {
        summary: failed?.roll ? `${summary} (${failed.roll.formula})` : summary,
        roll: failed ? (rolls.get(failed.gadget.name) ?? null) : null,
      };
    }),
  };
}
