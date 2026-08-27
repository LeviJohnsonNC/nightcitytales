import { describe, expect, it } from "vitest";
import {
  MAX_PEOPLE_SITUATIONS,
  PEOPLE_INSISTENT_DAYS,
  PEOPLE_SILENCE_DAYS,
  ageSituation,
  ageSituations,
  deriveNeeds,
  escalatedFor,
  type LifePerson,
  type LifeSituation,
  type LifeStateInput,
} from "@/engine";

/** A character with nothing wrong: no bills, no wounds, no empty magazines. */
const QUIET: LifeStateInput = {
  day: 10,
  eurobucks: 900,
  hpCurrent: 35,
  hpMax: 35,
  woundState: "none",
  billsOwed: 0,
  billsDueDay: 40,
  damagedArmor: [],
  emptyWeapons: [],
  brokenWeapons: [],
  people: [],
};

const person = (over: Partial<LifePerson> & { key: string }): LifePerson => ({
  name: over.key,
  disposition: 0,
  ...over,
});

const peopleSituations = (state: LifeStateInput) =>
  deriveNeeds(state).filter((s) => s.category === "people");

describe("someone going quiet", () => {
  it("says nothing until the silence has actually lasted", () => {
    const day = 10;
    const recent = person({ key: "ilsa", lastSeenDay: day - (PEOPLE_SILENCE_DAYS - 1) });
    expect(peopleSituations({ ...QUIET, day, people: [recent] })).toEqual([]);

    const quiet = person({ key: "ilsa", lastSeenDay: day - PEOPLE_SILENCE_DAYS });
    expect(peopleSituations({ ...QUIET, day, people: [quiet] })).toHaveLength(1);
  });

  it("lets exactly one person come forward, however many are waiting", () => {
    const people = ["a", "b", "c", "d", "e", "f"].map((key, i) =>
      person({ key, lastSeenDay: 1 + i }),
    );
    const out = peopleSituations({ ...QUIET, day: 30, people });
    expect(out).toHaveLength(MAX_PEOPLE_SITUATIONS);
  });

  it("and it is the one who has been waiting longest", () => {
    const people = [
      person({ key: "recent", name: "Recent", lastSeenDay: 6 }),
      person({ key: "ancient", name: "Ancient", lastSeenDay: 1 }),
      person({ key: "middling", name: "Middling", lastSeenDay: 4 }),
    ];
    const out = peopleSituations({ ...QUIET, day: 20, people });
    expect(out[0]?.npcKey).toBe("ancient");
  });

  it("breaks a tie the same way every time, so the loop does not flicker", () => {
    const people = [
      person({ key: "zoya", lastSeenDay: 2 }),
      person({ key: "abel", lastSeenDay: 2 }),
    ];
    const first = peopleSituations({ ...QUIET, day: 20, people });
    const reversed = peopleSituations({ ...QUIET, day: 20, people: [...people].reverse() });
    expect(first[0]?.npcKey).toBe("abel");
    expect(reversed[0]?.npcKey).toBe("abel");
  });

  it("treats a person never dealt with as having waited the whole campaign", () => {
    const out = peopleSituations({ ...QUIET, day: 9, people: [person({ key: "ilsa" })] });
    expect(out).toHaveLength(1);
  });
});

describe("how a person gets back in touch", () => {
  const openerFor = (role: string, name: string) =>
    peopleSituations({
      ...QUIET,
      day: 20,
      people: [person({ key: "k", name, role, lastSeenDay: 1 })],
    })[0]?.title ?? "";

  it("sounds like the person it is", () => {
    expect(openerFor("fixer", "Ilsa")).toContain("Ilsa");
    expect(openerFor("ripperdoc", "Ana")).toContain("chrome");
    expect(openerFor("landlord", "Bern")).toContain("word");
    expect(openerFor("enemy", "Razor")).toContain("asking about you");
    expect(openerFor("old_flame", "Juno")).toContain("comes up");
  });

  it("still works for someone who is not one of the six", () => {
    expect(openerFor("", "A guard")).toContain("A guard");
  });

  it("puts their standing in front of the player, not their dossier", () => {
    const out = peopleSituations({
      ...QUIET,
      day: 20,
      people: [
        person({
          key: "ilsa",
          name: "Ilsa",
          standing: "Your fixer. Takes their cut.",
          lastSeenDay: 1,
        }),
      ],
    });
    expect(out[0]?.summary).toContain("Your fixer.");
    expect(out[0]?.summary).toContain("19 days");
  });
});

describe("how loudly they knock", () => {
  const severityFor = (over: Partial<LifePerson>, day: number) =>
    peopleSituations({
      ...QUIET,
      day,
      people: [person({ key: "k", lastSeenDay: 1, ...over })],
    })[0]?.severity ?? 0;

  it("is louder from someone who does not like you", () => {
    expect(severityFor({ disposition: -2 }, 6)).toBeGreaterThan(severityFor({ disposition: 2 }, 6));
  });

  it("gets louder the longer they are ignored", () => {
    const patient = severityFor({}, 1 + PEOPLE_SILENCE_DAYS);
    const done = severityFor({}, 1 + PEOPLE_INSISTENT_DAYS);
    expect(done).toBeGreaterThan(patient);
  });

  it("never exceeds the scale", () => {
    expect(severityFor({ disposition: -3 }, 400)).toBeLessThanOrEqual(5);
  });
});

describe("the rest of what Life notices", () => {
  it("stays silent when nothing is wrong and nobody is waiting", () => {
    expect(deriveNeeds(QUIET)).toEqual([]);
  });

  it("still raises overdue rent above rent that is merely coming", () => {
    const soon = deriveNeeds({ ...QUIET, billsOwed: 600, billsDueDay: 12 })[0];
    const late = deriveNeeds({ ...QUIET, billsOwed: 600, billsDueDay: 8 })[0];
    expect(late?.severity).toBeGreaterThan(soon?.severity ?? 0);
    expect(late?.category).toBe("pressure");
  });

  it("is deterministic: the same state always yields the same keys", () => {
    const state = {
      ...QUIET,
      billsOwed: 400,
      emptyWeapons: ["heavy pistol"],
      people: [person({ key: "ilsa", lastSeenDay: 1 })],
    };
    expect(deriveNeeds(state).map((s) => s.key)).toEqual(deriveNeeds(state).map((s) => s.key));
  });
});

// ---------------------------------------------------------------------------
// Ageing.
// ---------------------------------------------------------------------------

const situation = (over: Partial<LifeSituation> = {}): LifeSituation => ({
  key: "grudge_vex",
  category: "pressure",
  title: "Vex is still owed a reckoning",
  summary: "Somebody you left standing has not forgotten.",
  status: "live",
  severity: 3,
  dueDay: 16,
  ...over,
});

describe("a deadline passing", () => {
  it("does nothing before the day it comes due", () => {
    expect(ageSituation(situation(), 15)).toEqual(situation());
  });

  it("makes the situation one louder on the day it comes due", () => {
    expect(ageSituation(situation(), 16).severity).toBe(4);
  });

  it("expires an opportunity rather than escalating it", () => {
    const gig = situation({ category: "opportunity" });
    expect(ageSituation(gig, 16).status).toBe("expired");
    expect(ageSituation(gig, 16).severity).toBe(gig.severity);
  });

  it("leaves anything that is not live alone", () => {
    const done = situation({ status: "resolved" });
    expect(ageSituation(done, 99)).toEqual(done);
  });

  it("leaves a situation with no deadline alone forever", () => {
    const { dueDay: _dueDay, ...open } = situation();
    expect(ageSituation(open, 9999)).toEqual(open);
  });
});

describe("escalating only once per deadline", () => {
  it("does not climb again on the same day", () => {
    // This is the bug: ageSituations runs on every load, so a screen mounted
    // three times was three escalations of one deadline.
    const once = ageSituation(situation(), 16);
    expect(ageSituation(once, 16).severity).toBe(4);
    expect(ageSituation(ageSituation(once, 16), 16).severity).toBe(4);
  });

  it("does not climb on the days after, either", () => {
    let s = ageSituation(situation(), 16);
    for (let day = 17; day < 40; day += 1) s = ageSituation(s, day);
    expect(s.severity).toBe(4);
  });

  it("never reaches the top of the scale off one deadline", () => {
    // The reason this matters: selectSituation weights severity first, so a
    // world where everything old has climbed to 5 picks by category and then
    // alphabetically — which is no selection at all.
    let s = situation({ severity: 4 });
    for (let day = 16; day < 60; day += 1) s = ageSituation(s, day);
    expect(s.severity).toBe(5);
    let other = situation({ key: "moved_wakako", severity: 2 });
    for (let day = 16; day < 60; day += 1) other = ageSituation(other, day);
    expect(other.severity).toBe(3);
    expect(other.severity).toBeLessThan(s.severity);
  });

  it("escalates again when it is given a NEW deadline", () => {
    // Rent is the case that matters: each billing period is its own deadline
    // and its own missed payment, not one debt that only ever counts once.
    const missed = ageSituation(situation({ key: "rent", severity: 2 }), 16);
    expect(missed.severity).toBe(3);
    const rebilled = { ...missed, dueDay: 46 };
    expect(ageSituation(rebilled, 45).severity).toBe(3);
    expect(ageSituation(rebilled, 46).severity).toBe(4);
  });

  it("records which deadline it answered to, not just that it did", () => {
    const aged = ageSituation(situation(), 20);
    expect(escalatedFor(aged)).toBe(16);
    expect(aged.data?.["escalatedOnDay"]).toBe(20);
  });

  it("reads nothing out of a situation that has never escalated", () => {
    expect(escalatedFor(situation())).toBeNull();
    expect(escalatedFor(situation({ data: { escalatedForDueDay: "16" } }))).toBeNull();
  });

  it("leaves the deadline where it is, so the world tick can still act on it", () => {
    // worldTick sends somebody to find you when dueDay <= day. Pushing the
    // deadline out to stop the climbing would have quietly cancelled that.
    expect(ageSituation(situation(), 16).dueDay).toBe(16);
  });
});

describe("ageSituations", () => {
  it("ages each one and leaves the rest of the list intact", () => {
    const rows = [situation(), situation({ key: "moved_wakako", dueDay: 99 })];
    const aged = ageSituations(rows, 16);
    expect(aged).toHaveLength(2);
    expect(aged[0]!.severity).toBe(4);
    expect(aged[1]!.severity).toBe(3);
  });

  it("is idempotent, which is the whole point", () => {
    const rows = [situation()];
    expect(ageSituations(ageSituations(rows, 16), 16)).toEqual(ageSituations(rows, 16));
  });
});
