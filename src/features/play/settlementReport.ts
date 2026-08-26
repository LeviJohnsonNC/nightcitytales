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
import { OBSERVATION_MEANINGS, isObservation, type Observation } from "@/engine";
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
};

function bag(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
    };
  }
  return null;
}

/** True when the money did not all arrive. */
export function wasShorted(view: SettlementView): boolean {
  return view.payment !== null && view.payment.paid < view.payment.agreed;
}
