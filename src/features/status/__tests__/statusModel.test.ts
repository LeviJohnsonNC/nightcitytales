import { describe, expect, it } from "vitest";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";
import type { LifeClock, LifeSituation, MissionObjective } from "@/engine";
import {
  clockSeverity,
  commitmentsStatus,
  dueClause,
  dueLabel,
  formatMoney,
  growthStatus,
  moneyStatus,
  COMMITTED_CATEGORIES,
} from "../statusModel";

/**
 * The status rail.
 *
 * PRODUCT.md is not neutral about this screen: money "should produce decisions,
 * not a score", and a list that "will always find something" is "a quest board
 * with a skin on". These tests pin the two rulings that keep it on the right
 * side of both — the money chip's colour and panel still carry the runway even
 * though its face is now the balance alone, and the commitments list holds only
 * what the player caused.
 */

const campaign = (over: Partial<Campaign> = {}): Campaign =>
  ({ id: "c1", day: 10, bills_paid_through_day: 0, ...over }) as Campaign;

const vitals = (eurobucks: number): CampaignVitals => ({ eurobucks }) as CampaignVitals;

const character = (over: Partial<FullCharacter> = {}): FullCharacter =>
  ({
    character: { id: "ch1", name: "V", role: "solo" },
    skills: [{ skill_id: "handgun", level: 4, specialization: null }],
    finance: { improvement_points: 0, home_district_key: null },
    ...over,
  }) as unknown as FullCharacter;

const situation = (over: Partial<LifeSituation>): LifeSituation => ({
  key: "s",
  category: "need",
  title: "Rent",
  summary: "The landlord called.",
  status: "live",
  severity: 3,
  ...over,
});

describe("money shows the balance, and keeps the runway behind it", () => {
  it("does not count down to a bill too far away to act on", () => {
    // Day 10, first month free, so bills are settled through day 30 — and rent
    // is charged in arrears, so the month running 30→60 lands on day 60. Fifty
    // days out is arithmetically true and emotionally inert, so nothing is
    // counted down to at all.
    const money = moneyStatus({
      campaign: campaign(),
      vitals: vitals(4350),
      character: character(),
    });
    expect(money.daysToNextBill).toBe(50);
    expect(money.nextUp).toBeNull();
    expect(money.line).toBe("€4,350");
    expect(money.tone).toBe("ok");
  });

  it("picks up the rent once the bill is inside the horizon", () => {
    const money = moneyStatus({
      campaign: campaign({ day: 40 }),
      vitals: vitals(4350),
      character: character(),
    });
    // The face of the chip stays the balance; what is coming is in `nextUp`,
    // which MoneyDetail prints and the colour is chosen from.
    expect(money.line).toBe("€4,350");
    expect(money.nextUp).toEqual({ label: "rent", inDays: 20 });
    expect(dueClause(money.nextUp!)).toBe("rent in 20d");
  });

  it("takes a debt that lands before the rent does", () => {
    const money = moneyStatus({
      campaign: campaign({ day: 40 }),
      vitals: vitals(4350),
      character: character(),
      nearestDue: { label: "The clinic", inDays: 3 },
    });
    expect(money.nextUp).toEqual({ label: "The clinic", inDays: 3 });
    expect(money.tone).toBe("soon");
  });

  it("still carries a debt even when the rent is over the horizon", () => {
    const money = moneyStatus({
      campaign: campaign(),
      vitals: vitals(4350),
      character: character(),
      nearestDue: { label: "The clinic", inDays: 12 },
    });
    expect(money.nextUp).toEqual({ label: "The clinic", inDays: 12 });
  });

  it("says today and late in words a player can act on", () => {
    expect(dueClause({ label: "Kiro's money", inDays: 0 })).toBe("Kiro's money today");
    expect(dueClause({ label: "Kiro's money", inDays: -2 })).toBe("Kiro's money 2d late");
    expect(dueClause({ label: "rent", inDays: 11 })).toBe("rent in 11d");
  });

  it("never lets anything else onto the face of the chip", () => {
    // Every shape that used to add a clause: a debt today, an overdue bill, a
    // rent countdown. The balance is the whole line in all of them.
    const cases = [
      moneyStatus({
        campaign: campaign({ day: 40 }),
        vitals: vitals(1200),
        character: character(),
        nearestDue: { label: "Kiro's money", inDays: 0 },
      }),
      moneyStatus({
        campaign: campaign({ day: 65 }),
        vitals: vitals(1200),
        character: character(),
      }),
      moneyStatus({
        campaign: campaign({ day: 55 }),
        vitals: vitals(1200),
        character: character(),
      }),
    ];
    for (const money of cases) expect(money.line).toBe("€1,200");
  });

  it("writes money with the eurodollar sign and no dollar sign", () => {
    expect(formatMoney(0)).toBe("€0");
    expect(formatMoney(1250)).toBe("€1,250");
    expect(formatMoney(1250)).not.toContain("$");
  });

  it("turns on the pressure inside a week of the bill", () => {
    const money = moneyStatus({
      campaign: campaign({ day: 55 }),
      vitals: vitals(4350),
      character: character(),
    });
    expect(money.daysToNextBill).toBe(5);
    expect(money.tone).toBe("soon");
  });

  it("leads with what is owed once the month has turned", () => {
    const money = moneyStatus({
      campaign: campaign({ day: 65 }),
      vitals: vitals(100),
      character: character(),
    });
    expect(money.owed).toBeGreaterThan(0);
    // What is owed reaches the player as the colour and the panel, not as a
    // clause on the line — but it must still reach them.
    expect(money.tone).toBe("due");
    expect(money.line).toBe("€100");
  });

  it("says how far short they are, which is the number that produces a decision", () => {
    const money = moneyStatus({
      campaign: campaign({ day: 65 }),
      vitals: vitals(100),
      character: character(),
    });
    expect(money.short).toBe(money.owed - 100);
  });

  it("is square when the take covers the bill", () => {
    const money = moneyStatus({
      campaign: campaign({ day: 65 }),
      vitals: vitals(999_999),
      character: character(),
    });
    expect(money.short).toBe(0);
  });
});

describe("growth is a distance, not a total", () => {
  it("gives the gap to the next Skill without naming which one it is", () => {
    const growth = growthStatus({ character: character(), improvementPoints: 40 });
    expect(growth.next).not.toBeNull();
    expect(growth.gap).toBeGreaterThan(0);
    expect(growth.line).toBe(`40 IP · ${growth.gap} to next Skill`);
    // The name is still there for the panel; it is just not on the chip.
    expect(growth.line).not.toContain(growth.next!.skillName);
  });

  it("says it is ready when the points are already there", () => {
    const growth = growthStatus({ character: character(), improvementPoints: 100_000 });
    expect(growth.ready).toBe(true);
    expect(growth.gap).toBe(0);
    expect(growth.line).toBe("100000 IP · next Skill ready");
    expect(growth.line).not.toContain(growth.next!.skillName);
  });

  it("never offers a line already at the in-play ceiling", () => {
    const maxed = character({
      skills: [{ skill_id: "handgun", level: 10, specialization: null }],
    } as unknown as Partial<FullCharacter>);
    expect(growthStatus({ character: maxed, improvementPoints: 999 }).next).toBeNull();
  });
});

describe("commitments hold what the player caused, and nothing else", () => {
  const clocks: LifeClock[] = [
    { key: "heat", label: "NCPD Heat", filled: 2, segments: 6, hidden: false },
  ];

  it("does not count the night's premise as something owed", () => {
    // The opening's "just living" door: a `need`, so the narrator keeps seeing
    // it, but nobody is waiting. Counting it opened a fresh campaign on
    // "1 open · 1 due today" over a summary saying nothing was expected.
    const premise = situation({
      key: "opening_just_living",
      category: "need",
      title: "Your own place, for a change",
      summary: "Nobody is expecting you anywhere tonight.",
      data: { premise: true },
    });
    const status = commitmentsStatus({ day: 1, clocks: [], situations: [premise] });
    expect(status.commitments).toEqual([]);
    expect(status.leads).toEqual([]);
    expect(status.open).toBe(0);
    expect(status.dueToday).toBe(0);
    expect(status.line).toBe("Nothing owed");
  });

  it("still counts an ordinary need that happens to have no due day", () => {
    const real = situation({ key: "wounded", category: "need", title: "You are bleeding" });
    expect(commitmentsStatus({ day: 1, clocks: [], situations: [real] }).open).toBe(1);
  });

  it("keeps the premise off the money chip as well", () => {
    const premise = situation({
      key: "opening_just_living",
      category: "need",
      title: "Your own place, for a change",
      dueDay: 1,
      data: { premise: true },
    });
    const commitments = commitmentsStatus({ day: 1, clocks: [], situations: [premise] });
    // nearestMoneyDue reads the commitments, so leaving it out of the list is
    // what stops the balance line counting down to the character's own flat.
    expect(commitments.commitments).toEqual([]);
  });

  it("excludes opportunities and hooks, which are the world dangling something", () => {
    // The quest-board line. A lead is not a commitment however loud it is.
    expect(COMMITTED_CATEGORIES).toEqual(["need", "people", "pressure"]);
    const status = commitmentsStatus({
      day: 10,
      clocks: [],
      situations: [
        situation({ key: "rent", category: "need" }),
        situation({ key: "gig", category: "opportunity", severity: 5 }),
        situation({ key: "call", category: "hook", severity: 5 }),
      ],
    });
    expect(status.commitments.map((c) => c.key)).toEqual(["situation:rent"]);
    expect(status.leads.map((l) => l.key)).toEqual(["gig", "call"]);
    expect(status.open).toBe(1);
  });

  it("counts a job's objectives as commitments, because taking the job was the choice", () => {
    const objectives: MissionObjective[] = [
      { id: "a", text: "Recover Lucy", status: "active" },
      { id: "b", text: "Nobody dies", status: "failed" },
    ];
    const status = commitmentsStatus({
      day: 10,
      clocks: [],
      situations: [],
      objectives,
      missionTitle: "A Night at the Opera",
    });
    expect(status.open).toBe(1);
    // A closed objective still shows — it is the record of how the job is going
    // — but it sinks below what is left to do.
    expect(status.commitments.map((c) => c.status)).toEqual(["active", "failed"]);
  });

  it("carries a visible clock as pressure the player started", () => {
    const status = commitmentsStatus({ day: 10, clocks, situations: [] });
    // The fill rides as a meter rather than a string, so the row draws the
    // six-segment dial the clock already is instead of printing a fraction.
    expect(status.commitments[0]).toMatchObject({
      kind: "clock",
      meter: { filled: 2, segments: 6 },
    });
  });

  it("puts the soonest due first, and the loudest first among the undated", () => {
    const status = commitmentsStatus({
      day: 10,
      clocks: [],
      situations: [
        situation({ key: "later", dueDay: 20 }),
        situation({ key: "quiet", severity: 1 }),
        situation({ key: "today", dueDay: 10 }),
        situation({ key: "loud", severity: 5 }),
      ],
    });
    expect(status.commitments.map((c) => c.key)).toEqual([
      "situation:today",
      "situation:later",
      "situation:loud",
      "situation:quiet",
    ]);
  });

  it("counts what is due today and what is already late", () => {
    const status = commitmentsStatus({
      day: 10,
      clocks: [],
      situations: [situation({ key: "today", dueDay: 10 }), situation({ key: "late", dueDay: 7 })],
    });
    expect(status.dueToday).toBe(1);
    expect(status.overdue).toBe(1);
    // Overdue is the louder fact, so it is the one the chip says.
    expect(status.line).toBe("2 open · 1 overdue");
  });

  it("marks the situation this turn is actually about", () => {
    // Without it the thing the narrator just put in front of the player looks
    // exactly like the things that are merely true.
    const status = commitmentsStatus({
      day: 10,
      clocks: [],
      situations: [situation({ key: "rent" }), situation({ key: "kiro", category: "people" })],
      currentKey: "kiro",
    });
    expect(status.commitments.find((c) => c.key === "situation:kiro")?.current).toBe(true);
    expect(status.commitments.find((c) => c.key === "situation:rent")?.current).toBeUndefined();
  });

  it("says so plainly when nothing is owed", () => {
    expect(commitmentsStatus({ day: 1, clocks: [], situations: [] }).line).toBe("Nothing owed");
  });
});

describe("clockSeverity", () => {
  it("scales the fill onto the same 1-5 the situations use, so they sort together", () => {
    const c = (filled: number): LifeClock => ({
      key: "k",
      label: "L",
      filled,
      segments: 6,
      hidden: false,
    });
    expect(clockSeverity(c(0))).toBe(1);
    expect(clockSeverity(c(6))).toBe(5);
    expect(clockSeverity(c(3))).toBeGreaterThan(clockSeverity(c(1)));
  });
});

describe("dueLabel", () => {
  it("reads as a date a player can act on", () => {
    expect(dueLabel(null)).toBeNull();
    expect(dueLabel(0)).toBe("due today");
    expect(dueLabel(1)).toBe("due tomorrow");
    expect(dueLabel(3)).toBe("due in 3 days");
    expect(dueLabel(-1)).toBe("1 day late");
    expect(dueLabel(-4)).toBe("4 days late");
  });
});
