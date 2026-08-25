import { describe, expect, it } from "vitest";
import {
  MAX_PEOPLE_SITUATIONS,
  PEOPLE_INSISTENT_DAYS,
  PEOPLE_SILENCE_DAYS,
  deriveNeeds,
  type LifePerson,
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
