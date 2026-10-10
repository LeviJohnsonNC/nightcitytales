/**
 * Strange gear: finds whose word the engine keeps.
 *
 * A shop that only ever sells the printed catalog is a menu. The finds are what
 * make a visit worth making: a sound puck at a market stall, foam-jawed cutters
 * at a salvage counter. The trap they could fall into is the one PRODUCT.md
 * ranks highest: prose promising a capability the engine cannot resolve, so the
 * narrator decides whether the trick worked.
 *
 * So a find is a base object, ONE capability and at most one limit, all from a
 * closed list in `src/data/rules/gadgets.json`, and a capability is a rule the
 * engine applies, not a sentence: `quiet` removes a `loud` observation on the
 * turn it is used, `remote` removes `seen`, `quick` halves the in-world time.
 * Whether the plan around it works is still a check, an oracle and the city.
 *
 * A find's identity IS its item id: `gadget.<base>.<capability>.<limit>.<variant>`.
 * Name, price, contract and quirk are derived from that id every time, the way
 * Reputation is derived from receipts, so there is nothing to store, nothing to
 * migrate and nothing for two copies to disagree about.
 *
 * Pure: ids and seeds in, plain objects out.
 */
import catalogData from "@/data/rules/catalog.json";
import data from "@/data/rules/gadgets.json";
import { rollDie, seededRng } from "./dice";
import { buildRollResult, type RollResult } from "./rollLog";
import type { RNG } from "./types";

type Capability = {
  label: string;
  contract: string;
  suppresses: string[];
  timeFactor: number;
};
type Limit = { label: string; contract: string; priceFactor: number; adds?: string[] };
type Base = {
  id: string;
  noun: string;
  what: string;
  capabilities: string[];
  limits: string[];
  cost: number;
  sellers: string[];
  models: string[];
};

export const GADGETS_ARE_HOUSE_RULE: boolean = data.houseRule;
export const GADGET_CAPABILITIES = data.capabilities as Record<string, Capability>;
export const GADGET_LIMITS = data.limits as Record<string, Limit>;
export const GADGET_BASES = data.bases as Base[];
const QUIRKS = data.quirks as string[];
const BASES_BY_ID = new Map(GADGET_BASES.map((b) => [b.id, b]));

/** How many variants a base can come in: every model with every quirk. */
function variantsOf(base: Base): number {
  return base.models.length * QUIRKS.length;
}

const PREFIX = "gadget";

export type Gadget = {
  /** The item id, which is the whole of its identity. */
  id: string;
  base: string;
  capability: string;
  limit: string;
  variant: number;
  /** "Ghost Knocker Sound Puck". */
  name: string;
  /** What it physically is. */
  what: string;
  /** What the engine guarantees it does, and what it costs to use. */
  contract: string;
  /** A cosmetic detail. Flavour, never a rule. */
  quirk: string;
  /** Printed-ladder price, the limit's discount applied. */
  cost: number;
  /** The archetypes whose shops can turn one up. */
  sellers: string[];
  /** Observations the engine removes from the turn it is used in (and works). */
  suppresses: string[];
  /** Observations the engine adds when it is used: a conspicuous thing is seen. */
  adds: string[];
  /** Multiplier on a Life turn's time when it is used (and works). */
  timeFactor: number;
  /** True when using it spends it. */
  singleUse: boolean;
  /** True when using it rolls for whether it works. */
  unreliable: boolean;
};

/** The item id for one find. Throws on a combination the data does not allow. */
export function gadgetId(base: string, capability: string, limit: string, variant: number): string {
  const id = `${PREFIX}.${base}.${capability}.${limit}.${Math.trunc(variant)}`;
  if (!readGadget(id)) throw new Error(`Not a gadget the data allows: ${id}`);
  return id;
}

/** True when this item id is a find rather than a catalog line. Says nothing about whether it is valid. */
export function looksLikeGadget(itemId: string): boolean {
  return itemId.startsWith(`${PREFIX}.`);
}

/** The printed price ladder's steps, cheapest first: 10, 20, 50, 100, 500... */
const LADDER = catalogData._rules.priceCategoryLadder.bands
  .map((b) => b.maxCost)
  .filter((c): c is number => typeof c === "number");

/**
 * A discounted price, put back on the printed ladder: the highest step at or
 * below it. A temperamental 100eb thing is a 50eb thing, never a 50-and-change
 * one, because every price in this game is one the rules print.
 */
function priced(cost: number): number {
  let best = LADDER[0]!;
  for (const step of LADDER) if (step <= cost) best = step;
  return best;
}

/**
 * Everything a find is, from its id. Null for anything that is not a gadget the
 * data allows — an id with an unknown base, a capability the base does not
 * have, a variant out of range — because a row the engine cannot read must not
 * be handed powers by guesswork.
 */
export function readGadget(itemId: string): Gadget | null {
  const parts = itemId.split(".");
  if (parts.length !== 5 || parts[0] !== PREFIX) return null;
  const [, baseId, capabilityId, limitId, variantText] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  const base = BASES_BY_ID.get(baseId);
  const capability = GADGET_CAPABILITIES[capabilityId];
  const limit = GADGET_LIMITS[limitId];
  if (!base || !capability || !limit) return null;
  if (!base.capabilities.includes(capabilityId) || !base.limits.includes(limitId)) return null;
  if (!/^\d+$/.test(variantText)) return null;
  const variant = Number(variantText);
  if (variant >= variantsOf(base)) return null;

  const model = base.models[variant % base.models.length]!;
  const quirk = QUIRKS[Math.floor(variant / base.models.length) % QUIRKS.length]!;
  const contract = [capability.contract, limit.contract].filter(Boolean).join(" ");
  return {
    id: itemId,
    base: base.id,
    capability: capabilityId,
    limit: limitId,
    variant,
    name: `${model} ${base.noun}`,
    what: base.what,
    contract,
    quirk,
    cost: priced(base.cost * limit.priceFactor),
    sellers: base.sellers,
    suppresses: capability.suppresses,
    adds: limit.adds ?? [],
    timeFactor: capability.timeFactor,
    singleUse: limitId === "single_use",
    unreliable: limitId === "unreliable",
  };
}

/** One line for anywhere a find is described: what it is, what it does, its quirk. */
export function describeGadget(gadget: Gadget): string {
  return `${gadget.what} ${gadget.contract} ${gadget.quirk}`;
}

/** The label a find's capability and limit go by, for a badge: "Quiet · One use". */
export function gadgetTags(gadget: Gadget): string {
  const cap = GADGET_CAPABILITIES[gadget.capability]!.label;
  const lim = GADGET_LIMITS[gadget.limit]!.label;
  return [cap, lim].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// What turns up where.
// ---------------------------------------------------------------------------

type FindsRow = { from: number; to: number; count: number };
const FINDS = data.finds as { die: number; table: FindsRow[] };

/** FNV-1a, the same stable hash the shop's stock uses. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(items: readonly T[], rng: RNG): T {
  return items[Math.floor(rng() * items.length) % items.length]!;
}

/**
 * The finds a seller has turned up in one stock week. Usually none.
 *
 * Seeded by campaign, seller and week, so it is the same every time anybody
 * looks and changes only when the week does. `archetype` decides which bases
 * can turn up at all; `lean` is the shop's own shift on the finds die (a
 * salvage counter leans in).
 */
export function gadgetFinds(input: {
  seed: string;
  vendorId: string;
  archetype: string;
  period: number;
  lean?: number;
}): Gadget[] {
  const bases = GADGET_BASES.filter((b) => b.sellers.includes(input.archetype));
  if (!bases.length) return [];
  const rng = seededRng(hash(`${input.seed}|${input.vendorId}|finds|${input.period}`));
  const read = rollDie(FINDS.die, rng) + Math.trunc(input.lean ?? 0);
  const count = FINDS.table.find((r) => read >= r.from && read <= r.to)?.count ?? 0;
  const out: Gadget[] = [];
  const taken = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    const base = pick(bases, rng);
    const capability = pick(base.capabilities, rng);
    const limit = pick(base.limits, rng);
    const variant = Math.floor(rng() * variantsOf(base));
    const gadget = readGadget(`${PREFIX}.${base.id}.${capability}.${limit}.${variant}`)!;
    if (taken.has(gadget.base)) continue; // two of one kind in a week is a delivery, not a find
    taken.add(gadget.base);
    out.push(gadget);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Using one.
// ---------------------------------------------------------------------------

export type GadgetUse = {
  gadget: Gadget;
  /** False when a temperamental thing did nothing this time. */
  worked: boolean;
  /** The reliability roll, for a temperamental thing. Null otherwise. */
  roll: RollResult | null;
};

/** Use one find: a temperamental one rolls for whether it works. */
export function operateGadget(gadget: Gadget, rng?: RNG): GadgetUse {
  if (!gadget.unreliable) return { gadget, worked: true, roll: null };
  const die = data.reliability.die;
  const face = rollDie(die, rng);
  const worked = face > data.reliability.failsAtOrBelow;
  const roll = buildRollResult({ dice: `1d${die}`, rolls: [face], modifiers: [], dv: null });
  return {
    gadget,
    worked,
    roll: {
      ...roll,
      formula: `${roll.formula} → ${worked ? "it works" : "it does nothing"}`,
    },
  };
}

export type GadgetTurnEffect<O extends string> = {
  /** The turn's observations once every find used in it has had its say. */
  observations: O[];
  /** What the turn's in-world time is multiplied by. */
  timeFactor: number;
  /** One ledger line per find that changed something, or that failed. */
  lines: string[];
};

/**
 * What the finds used in one turn do to what the city noticed and how long it
 * took. `observations` are what the narrator reported; the engine removes what
 * a working find suppresses and adds what a conspicuous one costs. Lines are
 * written only when something actually changed, so a sound puck used on a turn
 * nobody saw does not claim to have hidden anyone. `timed: false` is a turn
 * whose time is fixed (a Job's), where a quick find has nothing to shorten.
 */
export function gadgetTurnEffects<O extends string>(
  uses: readonly GadgetUse[],
  observations: readonly O[],
  options: { timed?: boolean } = {},
): GadgetTurnEffect<O> {
  const timed = options.timed ?? true;
  let out = [...observations];
  let timeFactor = 1;
  const lines: string[] = [];
  for (const use of uses) {
    const { gadget } = use;
    if (!use.worked) {
      lines.push(`The ${gadget.name} did nothing this time.`);
      continue;
    }
    const removed = out.filter((o) => gadget.suppresses.includes(o));
    if (removed.length) {
      out = out.filter((o) => !gadget.suppresses.includes(o));
      lines.push(
        `The ${gadget.name} did its job: the city did not record it as ${removed
          .filter((o, i) => removed.indexOf(o) === i)
          .join(" or ")}.`,
      );
    }
    if (timed && gadget.timeFactor !== 1) {
      timeFactor *= gadget.timeFactor;
      lines.push(`The ${gadget.name} made short work of it.`);
    }
    for (const added of gadget.adds) {
      if (!out.includes(added as O)) out.push(added as O);
      lines.push(`Nobody forgets seeing a ${gadget.name}.`);
    }
  }
  return { observations: out, timeFactor, lines };
}
