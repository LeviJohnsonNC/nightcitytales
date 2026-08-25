import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEGMENTS,
  FACTIONS,
  FACTION_STANDING_MAX,
  FACTION_STANDING_MIN,
  HEAT_CLOCK_KEY,
  MAX_TURN_STANDING,
  MAX_TURN_TICK,
  OBSERVATIONS,
  OBSERVATION_COSTS,
  OBSERVATION_MEANINGS,
  applyObservations,
  clampStanding,
  clockDefinitionFor,
  factionClock,
  findFactionIn,
  fired,
  generateJob,
  formatStanding,
  getFaction,
  hasFilled,
  heatClock,
  isClockKind,
  isFactionId,
  isHostile,
  isObservation,
  notableStandings,
  resolveFactionId,
  standingBand,
  type ObservationReport,
} from "@/engine";

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13);

const report = (
  observation: (typeof OBSERVATIONS)[number],
  factionId: Parameters<typeof getFaction>[0] | null = null,
): ObservationReport => ({ observation, factionId });

describe("the faction roster", () => {
  it("gives every faction a name, a blurb and a posture", () => {
    for (const faction of FACTIONS) {
      expect(faction.name).not.toBe("");
      expect(faction.blurb).not.toBe("");
      expect(typeof faction.investigates).toBe("boolean");
      expect(getFaction(faction.id)).toEqual(faction);
    }
  });

  it("has both kinds of trouble in it", () => {
    expect(FACTIONS.some((f) => f.investigates)).toBe(true);
    expect(FACTIONS.some((f) => !f.investigates)).toBe(true);
  });

  it("recognises an id, a display name, and nothing else", () => {
    expect(resolveFactionId("tyger_claws")).toBe("tyger_claws");
    expect(resolveFactionId("Tyger Claws")).toBe("tyger_claws");
    expect(resolveFactionId("TYGER-CLAWS")).toBe("tyger_claws");
    expect(resolveFactionId("The Bozos")).toBeNull();
    expect(resolveFactionId(7)).toBeNull();
    expect(isFactionId("arasaka")).toBe(true);
    expect(isFactionId("arasaka_subsidiary")).toBe(false);
  });

  it("knows what people actually call them", () => {
    expect(resolveFactionId("scavvers")).toBe("scavengers");
    expect(resolveFactionId("the cops")).toBe("ncpd");
    expect(resolveFactionId("6th Street")).toBe("sixth_street");
  });

  it("will not file a grudge off a mention buried in prose", () => {
    // resolveFactionId reads a field the MODEL filled in. Matching loosely
    // there means "nothing to do with Arasaka" files an Arasaka grudge.
    expect(resolveFactionId("nothing to do with Arasaka")).toBeNull();
    expect(resolveFactionId("a Tyger Claws crew")).toBeNull();
  });

  it("does find a faction named inside content this project wrote", () => {
    expect(findFactionIn("a Tyger Claws crew, and they are not new at this")).toBe("tyger_claws");
    expect(findFactionIn("a scavver crew working out of a laundry")).toBe("scavengers");
    expect(findFactionIn("Militech contractors, paid by the hour")).toBe("militech");
    expect(findFactionIn("corporate security, badge numbers filed off")).toBeNull();
    expect(findFactionIn(null)).toBeNull();
  });

  it("resolves the opposition of every job the generator can produce", () => {
    // Not every job names a faction, and that is fine: those raise Heat and
    // nothing else. What would be wrong is content naming Maelstrom in a way
    // the engine cannot see.
    const named = SEEDS.map((seed) => generateJob(seed))
      .map((job) => job.offer?.opposition ?? "")
      .filter(Boolean);
    const resolved = named.filter((text) => findFactionIn(text) !== null);
    expect(resolved.length).toBeGreaterThan(named.length / 2);
  });

  it("throws rather than inventing a faction it does not have", () => {
    expect(() => getFaction("acme" as never)).toThrow(/No registered faction/);
  });
});

describe("standing", () => {
  it("stays on the scale", () => {
    expect(clampStanding(999)).toBe(FACTION_STANDING_MAX);
    expect(clampStanding(-999)).toBe(FACTION_STANDING_MIN);
    expect(clampStanding(Number.NaN)).toBe(0);
    expect(clampStanding(2.4)).toBe(2);
  });

  it("reads as words, and the words get worse in the right direction", () => {
    expect(standingBand(0).label).toBe("unknown");
    expect(standingBand(-9).label).toBe("hunted");
    expect(standingBand(9).label).toBe("connected");
    expect(isHostile(-5)).toBe(true);
    expect(isHostile(-1)).toBe(false);
    expect(isHostile(6)).toBe(false);
  });

  it("covers the whole scale with no gaps", () => {
    for (let v = FACTION_STANDING_MIN; v <= FACTION_STANDING_MAX; v += 1) {
      expect(standingBand(v).label).not.toBe("");
    }
  });

  it("names the faction when it reports one", () => {
    expect(formatStanding("tyger_claws", -5)).toContain("Tyger Claws");
    expect(formatStanding("tyger_claws", -5)).toContain("hostile");
  });

  it("only calls out the people who have an opinion", () => {
    const out = notableStandings([
      { factionId: "arasaka", standing: 0 },
      { factionId: "tyger_claws", standing: -4 },
      { factionId: "nomads", standing: 3 },
    ]);
    expect(out.map((s) => s.factionId)).toEqual(["tyger_claws", "nomads"]);
  });
});

describe("clock definitions", () => {
  it("gives corps a file and gangs a visit", () => {
    expect(factionClock("arasaka").kind).toBe("investigation");
    expect(factionClock("arasaka").label).toContain("Investigation");
    expect(factionClock("tyger_claws").kind).toBe("retaliation");
    expect(factionClock("tyger_claws").label).toContain("Retaliation");
  });

  it("gives every faction a clock with a payoff and a real dial", () => {
    for (const faction of FACTIONS) {
      const clock = factionClock(faction.id);
      expect(clock.segments).toBe(DEFAULT_SEGMENTS);
      expect(clock.payoff).toContain(faction.name);
      expect(clock.factionId).toBe(faction.id);
      expect(isClockKind(clock.kind)).toBe(true);
    }
  });

  it("rebuilds a definition from a stored key", () => {
    expect(clockDefinitionFor(HEAT_CLOCK_KEY, null)).toEqual(heatClock());
    const claws = factionClock("tyger_claws");
    expect(clockDefinitionFor(claws.key, "tyger_claws")).toEqual(claws);
  });

  it("refuses a key it cannot account for", () => {
    expect(clockDefinitionFor("arasaka_vendetta", "arasaka")).toBeNull();
    expect(clockDefinitionFor("something_else", null)).toBeNull();
  });
});

describe("the observation vocabulary", () => {
  it("prices every observation it admits", () => {
    for (const observation of OBSERVATIONS) {
      expect(OBSERVATION_COSTS[observation]).toBeDefined();
      expect(OBSERVATION_MEANINGS[observation]).not.toBe("");
    }
  });

  it("recognises its own words and nothing else", () => {
    expect(isObservation("killed")).toBe(true);
    expect(isObservation("murdered")).toBe(false);
    expect(isObservation(null)).toBe(false);
  });

  it("makes killing cost more than being seen", () => {
    expect(OBSERVATION_COSTS.killed.faction).toBeGreaterThan(OBSERVATION_COSTS.seen.faction);
    expect(OBSERVATION_COSTS.killed.heat).toBeGreaterThan(OBSERVATION_COSTS.seen.heat);
    expect(OBSERVATION_COSTS.killed.standing).toBeLessThan(OBSERVATION_COSTS.seen.standing);
  });

  it("lets working clean take pressure back off", () => {
    expect(OBSERVATION_COSTS.clean.faction).toBeLessThan(0);
    expect(OBSERVATION_COSTS.clean.heat).toBeLessThan(0);
  });

  it("makes a favour the only thing that buys standing", () => {
    const positive = OBSERVATIONS.filter((o) => OBSERVATION_COSTS[o].standing > 0);
    expect(positive).toEqual(["favour"]);
  });
});

describe("applying observations", () => {
  it("does nothing with nothing", () => {
    expect(applyObservations([])).toEqual({ ticks: [], standings: [], notes: [] });
  });

  it("moves the faction's own clock and the city's attention together", () => {
    const change = applyObservations([report("killed", "tyger_claws")]);
    const keys = change.ticks.map((t) => t.definition.key);
    expect(keys).toContain(factionClock("tyger_claws").key);
    expect(keys).toContain(HEAT_CLOCK_KEY);
    expect(change.standings).toEqual([{ factionId: "tyger_claws", delta: -2 }]);
  });

  it("still raises heat when nobody in particular was on the end of it", () => {
    const change = applyObservations([report("loud", null)]);
    expect(change.ticks.map((t) => t.definition.key)).toEqual([HEAT_CLOCK_KEY]);
    expect(change.standings).toEqual([]);
  });

  it("aggregates a turn into one tick per clock, not a row per body", () => {
    const change = applyObservations([
      report("killed", "maelstrom"),
      report("killed", "maelstrom"),
      report("seen", "maelstrom"),
    ]);
    const maelstrom = change.ticks.filter(
      (t) => t.definition.key === factionClock("maelstrom").key,
    );
    expect(maelstrom).toHaveLength(1);
  });

  it("will not let one evening fill a whole dial", () => {
    const change = applyObservations(
      Array.from({ length: 12 }, () => report("killed", "maelstrom")),
    );
    for (const tick of change.ticks) {
      expect(Math.abs(tick.delta)).toBeLessThanOrEqual(MAX_TURN_TICK);
    }
    for (const shift of change.standings) {
      expect(Math.abs(shift.delta)).toBeLessThanOrEqual(MAX_TURN_STANDING);
    }
  });

  it("nets a mixed turn out rather than applying both halves", () => {
    const change = applyObservations([report("seen", "maelstrom"), report("clean", "maelstrom")]);
    // seen +1 and clean -1 on the same clock cancel, so nothing is written.
    const key = factionClock("maelstrom").key;
    expect(change.ticks.find((t) => t.definition.key === key)).toBeUndefined();
  });

  it("does not give the NCPD two dials for the same interest in you", () => {
    // Heat IS the police clock. A second "NCPD Investigation" would be the same
    // organisation's attention split across two numbers that drift apart.
    expect(factionClock("ncpd")).toEqual(heatClock());
    const change = applyObservations([report("killed", "ncpd")]);
    expect(change.ticks).toHaveLength(1);
    expect(change.ticks[0]?.definition.key).toBe(HEAT_CLOCK_KEY);
    // Killed is worth 2 on the faction dial, not 2 + 2 double-counted.
    expect(change.ticks[0]?.delta).toBe(OBSERVATION_COSTS.killed.faction);
  });

  it("keeps two factions' books separate", () => {
    const change = applyObservations([report("killed", "maelstrom"), report("favour", "nomads")]);
    expect(change.standings).toEqual(
      expect.arrayContaining([
        { factionId: "maelstrom", delta: -2 },
        { factionId: "nomads", delta: 2 },
      ]),
    );
  });

  it("writes a ledger line for everything it noticed", () => {
    const change = applyObservations([report("named", "arasaka"), report("loud", null)]);
    expect(change.notes).toHaveLength(2);
    expect(change.notes[0]).toContain("Arasaka");
  });

  it("ignores an observation it does not recognise", () => {
    const change = applyObservations([
      { observation: "vibes" as never, factionId: "arasaka" },
      report("seen", "arasaka"),
    ]);
    expect(change.notes).toHaveLength(1);
  });
});

describe("firing", () => {
  const clock = (key: string, filled: number, segments = DEFAULT_SEGMENTS) => ({
    key,
    filled,
    segments,
  });

  it("comes due only at the end of the dial", () => {
    expect(hasFilled(clock("a", 5))).toBe(false);
    expect(hasFilled(clock("a", 6))).toBe(true);
    expect(hasFilled(clock("a", 7))).toBe(true);
  });

  it("never fires a clock with no dial", () => {
    expect(hasFilled(clock("a", 0, 0))).toBe(false);
  });

  it("hands over the worst first, deterministically", () => {
    const out = fired([clock("b", 6), clock("c", 8), clock("a", 2), clock("d", 6)]);
    expect(out.map((c) => c.key)).toEqual(["c", "b", "d"]);
  });
});
