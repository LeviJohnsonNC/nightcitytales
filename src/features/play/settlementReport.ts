/**
 * Reading the settlement back out of the ledger, for the wrap-up screen.
 *
 * The point of showing this is that a number which silently changed teaches
 * the player nothing. Seeing "2 died · 5 shots exchanged → Militech
 * Investigation 2/6 → 5/6" is what makes the pressure feel earned rather than
 * arbitrary, and it is the same argument as showing the oracle rolls: the
 * engine's reasoning should be inspectable.
 *
 * Pure: the ledger row in, a shape the screen can render out.
 */
import {
  OBSERVATION_MEANINGS,
  isObservation,
  type JobMechanicalCost,
  type Observation,
} from "@/engine";
import { SETTLEMENT_EVENT as SETTLED } from "@/features/campaign/aftermath";
import type { CampaignEvent } from "@/lib/backend";

export { SETTLEMENT_EVENT } from "@/features/campaign/aftermath";

export type SettlementLine = {
  observation: Observation;
  count: number;
  /** What the engine read, in its own words. */
  because: string;
  /** What that word means, so the vocabulary explains itself. */
  meaning: string;
};

export type SettlementView = {
  lines: SettlementLine[];
  payment: { key: string; agreed: number; paid: number } | null;
  survivors: string[];
  mechanical: JobMechanicalCost;
  pressure: Array<{
    kind: "clock" | "standing";
    key: string;
    label: string;
    before: number;
    after: number;
  }>;
  people: Array<{ key: string; name: string; before: number | null; after: number }>;
};

function bag(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mechanicalFrom(value: unknown): JobMechanicalCost {
  const raw = bag(value);
  const hp = bag(raw["hp"]);
  const hpBefore = number(hp["before"]);
  const hpAfter = number(hp["after"]);
  const armor = Array.isArray(raw["armor"])
    ? raw["armor"].flatMap((entry) => {
        const row = bag(entry);
        const location = row["location"];
        const before = number(row["before"]);
        const after = number(row["after"]);
        const ablated = number(row["ablated"]);
        return (location === "head" || location === "body") &&
          before !== null &&
          after !== null &&
          ablated !== null
          ? [{ location: location as "head" | "body", before, after, ablated }]
          : [];
      })
    : [];
  const ammunition = Array.isArray(raw["ammunition"])
    ? raw["ammunition"].flatMap((entry) => {
        const row = bag(entry);
        const inventoryId = row["inventoryId"];
        const weapon = row["weapon"];
        const before = number(row["before"]);
        const after = number(row["after"]);
        const spent = number(row["spent"]);
        return typeof inventoryId === "string" &&
          typeof weapon === "string" &&
          before !== null &&
          after !== null &&
          spent !== null
          ? [{ inventoryId, weapon, before, after, spent }]
          : [];
      })
    : [];
  return {
    hp:
      hpBefore !== null && hpAfter !== null
        ? { before: hpBefore, after: hpAfter, lost: number(hp["lost"]) ?? 0 }
        : null,
    armor,
    ammunition,
    criticalInjuries: number(raw["criticalInjuries"]) ?? 0,
  };
}

function changesFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = bag(entry);
    const kind = row["kind"];
    const key = row["key"];
    const label = row["label"];
    const before = number(row["before"]);
    const after = number(row["after"]);
    return (kind === "clock" || kind === "standing") &&
      typeof key === "string" &&
      typeof label === "string" &&
      before !== null &&
      after !== null
      ? [{ kind: kind as "clock" | "standing", key, label, before, after }]
      : [];
  });
}

function peopleFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = bag(entry);
    const key = row["key"];
    const name = row["name"];
    const after = number(row["after"]);
    const before = row["before"] === null ? null : number(row["before"]);
    return typeof key === "string" && typeof name === "string" && after !== null
      ? [{ key, name, before, after }]
      : [];
  });
}

/**
 * The most recent settlement, or null when this campaign has not finished a job.
 *
 * Read from the ledger rather than held in memory so the wrap-up screen shows
 * the same thing after a reload, and so it cannot disagree with what was
 * actually written.
 */
export function settlementFrom(events: CampaignEvent[]): SettlementView | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.type !== SETTLED) continue;
    const data = bag(event.data);

    const lines: SettlementLine[] = [];
    const findings = data["findings"];
    if (Array.isArray(findings)) {
      for (const raw of findings) {
        const finding = bag(raw);
        const observation = finding["observation"];
        const count = finding["count"];
        if (!isObservation(observation)) continue;
        lines.push({
          observation,
          count: typeof count === "number" && count > 0 ? count : 1,
          because: typeof finding["because"] === "string" ? finding["because"] : "",
          meaning: OBSERVATION_MEANINGS[observation],
        });
      }
    }

    const payment = bag(data["payment"]);
    const survivors = Array.isArray(data["survivors"])
      ? data["survivors"].filter((n): n is string => typeof n === "string")
      : [];

    return {
      lines,
      payment:
        typeof payment["paid"] === "number"
          ? {
              key: typeof payment["key"] === "string" ? payment["key"] : "paid",
              agreed: typeof payment["agreed"] === "number" ? payment["agreed"] : 0,
              paid: payment["paid"],
            }
          : null,
      survivors,
      mechanical: mechanicalFrom(data["mechanical"]),
      pressure: changesFrom(data["pressure"]),
      people: peopleFrom(data["people"]),
    };
  }
  return null;
}

/** True when the money did not all arrive. */
export function wasShorted(view: SettlementView): boolean {
  return view.payment !== null && view.payment.paid < view.payment.agreed;
}
