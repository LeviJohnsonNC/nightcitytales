import { describe, expect, it } from "vitest";
import { HEAT_CLOCK_KEY, factionClock, heatClock, type ObservationReport } from "@/engine";
import type { CampaignClock, CampaignFaction } from "@/lib/backend";
import {
  notableFrom,
  pressureFrom,
  pressureLines,
  readObservations,
  reportSignature,
  standingLines,
  standingsFrom,
} from "../pressure";

function clockRow(key: string, filled: number, factionId: string | null = null): CampaignClock {
  return {
    id: `row-${key}`,
    campaign_id: "campaign-1",
    clock_key: key,
    label: "whatever the row happens to say",
    filled,
    segments: 99,
    hidden: false,
    data: factionId ? { factionId } : {},
  } as unknown as CampaignClock;
}

function factionRow(factionId: string, standing: number): CampaignFaction {
  return {
    id: `row-${factionId}`,
    campaign_id: "campaign-1",
    faction_id: factionId,
    name: "whatever the row happens to say",
    standing,
    notes: null,
  } as unknown as CampaignFaction;
}

describe("reading clocks back", () => {
  it("takes the label and the dial from the engine, not from the row", () => {
    const claws = factionClock("tyger_claws");
    const [live] = pressureFrom([clockRow(claws.key, 3, "tyger_claws")]);
    expect(live?.clock.label).toBe(claws.label);
    expect(live?.clock.segments).toBe(claws.segments);
    expect(live?.definition.payoff).toBe(claws.payoff);
  });

  it("keeps the fill, which is the only thing the campaign owns", () => {
    expect(pressureFrom([clockRow(HEAT_CLOCK_KEY, 4)])[0]?.clock.filled).toBe(4);
  });

  it("clamps a fill the row should never have held", () => {
    expect(pressureFrom([clockRow(HEAT_CLOCK_KEY, 99)])[0]?.clock.filled).toBe(
      heatClock().segments,
    );
    expect(pressureFrom([clockRow(HEAT_CLOCK_KEY, -4)])[0]?.clock.filled).toBe(0);
  });

  it("drops a clock the engine no longer recognises rather than rendering it", () => {
    expect(pressureFrom([clockRow("arasaka_vendetta", 5, "arasaka")])).toEqual([]);
    expect(pressureFrom([clockRow("some_old_clock", 5)])).toEqual([]);
  });

  it("puts the worst first", () => {
    const claws = factionClock("tyger_claws");
    const out = pressureFrom([clockRow(HEAT_CLOCK_KEY, 1), clockRow(claws.key, 5, "tyger_claws")]);
    expect(out.map((p) => p.clock.key)).toEqual([claws.key, HEAT_CLOCK_KEY]);
  });
});

describe("reading standings back", () => {
  it("takes the scale from the engine and the number from the row", () => {
    expect(standingsFrom([factionRow("tyger_claws", -5)])).toEqual([
      { factionId: "tyger_claws", standing: -5 },
    ]);
  });

  it("clamps a standing that has drifted off the scale", () => {
    expect(standingsFrom([factionRow("arasaka", 400)])[0]?.standing).toBe(10);
  });

  it("drops a faction that does not exist", () => {
    expect(standingsFrom([factionRow("the_bozos", -3)])).toEqual([]);
  });

  it("only calls out organisations that have an opinion", () => {
    const rows = [factionRow("arasaka", 0), factionRow("maelstrom", -6)];
    expect(notableFrom(rows).map((s) => s.factionId)).toEqual(["maelstrom"]);
  });
});

describe("rendering", () => {
  it("shows a clock only once something is on it", () => {
    const claws = factionClock("tyger_claws");
    const lines = pressureLines(
      pressureFrom([clockRow(HEAT_CLOCK_KEY, 0), clockRow(claws.key, 2, "tyger_claws")]),
    );
    expect(lines).toEqual([`${claws.label}: 2/${claws.segments}`]);
  });

  it("says who a faction is as well as what they think", () => {
    const [line] = standingLines([{ factionId: "maelstrom", standing: -7 }]);
    expect(line).toContain("Maelstrom");
    expect(line).toContain("hunted");
    expect(line).toContain("Chrome past the point of sense");
  });
});

describe("reading what the model reported", () => {
  it("takes an observation aimed at a real faction", () => {
    expect(readObservations([{ observation: "killed", factionId: "tyger_claws" }])).toEqual([
      { observation: "killed", factionId: "tyger_claws" },
    ]);
  });

  it("takes a bare word, and a display name for the faction", () => {
    expect(readObservations(["loud", { kind: "seen", faction: "Tyger Claws" }])).toEqual([
      { observation: "loud", factionId: null },
      { observation: "seen", factionId: "tyger_claws" },
    ]);
  });

  it("drops a word the engine does not admit", () => {
    expect(readObservations(["vibes", { observation: "murdered" }])).toEqual([]);
  });

  it("keeps the observation when only the faction was invented", () => {
    // Being loud is being loud whether or not anyone owns that street.
    expect(readObservations([{ observation: "loud", factionId: "the_bozos" }])).toEqual([
      { observation: "loud", factionId: null },
    ]);
  });

  it("shrugs off anything that is not a list of observations", () => {
    expect(readObservations(null)).toEqual([]);
    expect(readObservations("killed")).toEqual([]);
    expect(readObservations([null, 7, {}])).toEqual([]);
  });
});

describe("not being charged twice for one body", () => {
  // applyPressure needs a campaign to write to, so the dedupe rule is exercised
  // through the signature it actually compares on.
  const sig = reportSignature;

  const reports = (...items: ObservationReport[]) => items;

  it("is order-independent, because a restatement rarely keeps the order", () => {
    const a = reports(
      { observation: "killed", factionId: "tyger_claws" },
      { observation: "loud", factionId: null },
    );
    const b = reports(
      { observation: "loud", factionId: null },
      { observation: "killed", factionId: "tyger_claws" },
    );
    expect(sig(a)).toBe(sig(b));
  });

  it("does not collapse two genuinely different turns", () => {
    expect(sig(reports({ observation: "killed", factionId: "tyger_claws" }))).not.toBe(
      sig(reports({ observation: "killed", factionId: "maelstrom" })),
    );
    expect(sig(reports({ observation: "killed", factionId: null }))).not.toBe(
      sig(
        reports(
          { observation: "killed", factionId: null },
          { observation: "seen", factionId: null },
        ),
      ),
    );
  });
});
