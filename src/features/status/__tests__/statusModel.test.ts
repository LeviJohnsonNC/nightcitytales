import { describe, expect, it } from "vitest";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";
import type { LifeClock, LifeSituation, MissionObjective } from "@/engine";
import {
  clockSeverity,
  commitmentsStatus,
  dueLabel,
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
 * side of both — the money chip leads with the runway, and the commitments list
 * holds only what the player caused.
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

describe("money leads with the runway, not the balance", () => {
  it("says how long until rent rather than only how much is in the account", () => {
    // Day 10, first month free, so bills are settled through day 30 — and rent
    // is charged in arrears, so the month running 30→60 lands on day 60.
    const money = moneyStatus({
      campaign: campaign(),
      vitals: vitals(4350),
      character: character(),
    });
    expect(money.daysToNextBill).toBe(50);
    expect(money.line).toContain("rent in 50d");
    expect(money.tone).toBe("ok");
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
    expect(money.tone).toBe("due");
    expect(money.line).toContain("owed");
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
  it("names the cheapest thing the character could buy next and the gap to it", () => {
    const growth = growthStatus({ character: character(), improvementPoints: 40 });
    expect(growth.next).not.toBeNull();
    expect(growth.line).toMatch(/^40 IP · \d+ more for /);
    expect(growth.gap).toBeGreaterThan(0);
  });

  it("says it is ready when the points are already there", () => {
    const growth = growthStatus({ character: character(), improvementPoints: 100_000 });
    expect(growth.ready).toBe(true);
    expect(growth.gap).toBe(0);
    expect(growth.line).toContain("ready");
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
