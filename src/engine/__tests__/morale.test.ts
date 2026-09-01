/**
 * Morale — the printed answer to the one-character action economy.
 *
 * A solo Edgerunner facing four people takes one Action to their four, and no
 * amount of good play fixes arithmetic. Cyberpunk RED: Single Player Mode does
 * not answer that by making the character tougher; it answers it by letting the
 * opposition leave. These tests pin the table exactly as printed, because the
 * whole value of it is that the numbers are not ours to tune.
 */
import { describe, expect, it } from "vitest";
import { MENTALITIES, mentalityFor, mentalityRow, moraleTriggerFor, rollMorale } from "../morale";
import type { Combatant, EncounterState } from "../encounter";

const hostile = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: "h1",
    name: "Street Thug",
    side: "hostile",
    isPlayer: false,
    ref: 5,
    body: 5,
    hpMax: 20,
    hp: 20,
    seriouslyWoundedThreshold: 10,
    woundState: "none",
    deathSavePenalty: 0,
    spHead: 7,
    spBody: 7,
    defeated: false,
    initiative: 10,
    ...over,
  }) as Combatant;

const fight = (combatants: Combatant[], round = 1): EncounterState =>
  ({
    round,
    order: combatants.map((c) => c.id),
    activeIndex: 0,
    status: "active",
    combatants: Object.fromEntries(combatants.map((c) => [c.id, c])),
  }) as unknown as EncounterState;

describe("the printed Morale table", () => {
  // Transcribed from Cyberpunk RED: Single Player Mode. If one of these ever
  // fails, the table was edited — and the table is not ours to edit.
  const printed: [string, number][] = [
    ["fanatical", 2],
    ["driven", 4],
    ["trained", 6],
    ["inexperienced", 8],
    ["streetrat", 9],
  ];

  it("carries the End Fight column exactly", () => {
    for (const [key, endFightUpTo] of printed) {
      expect(mentalityRow(key).endFightUpTo).toBe(endFightUpTo);
    }
    expect(MENTALITIES).toHaveLength(printed.length);
  });

  it("falls back to the plainest mentality rather than throwing", () => {
    expect(mentalityRow("cyber_dragon").key).toBe("streetrat");
    expect(mentalityRow(null).key).toBe("streetrat");
  });

  it("maps our three threat tiers onto the book's archetypes", () => {
    expect(mentalityFor("mook")).toBe("streetrat");
    expect(mentalityFor("lieutenant")).toBe("trained");
    expect(mentalityFor("boss")).toBe("driven");
  });
});

describe("rollMorale", () => {
  const rigged = (face: number) => () => (face - 0.5) / 10;

  it("ends the fight at or under the End Fight number", () => {
    expect(rollMorale("streetrat", "round", rigged(9)).broke).toBe(true);
    expect(rollMorale("streetrat", "round", rigged(10)).broke).toBe(false);
  });

  it("makes cannon fodder break on nine faces out of ten", () => {
    // Not a bug in the table: an ordinary Mook does not want to die, and a game
    // where fodder fights to the last man is one that had to invent a reason
    // for the hero to survive.
    let broke = 0;
    for (let face = 1; face <= 10; face += 1) {
      if (rollMorale("streetrat", "seriously_wounded", rigged(face)).broke) broke += 1;
    }
    expect(broke).toBe(9);
  });

  it("makes a fanatic break on two", () => {
    let broke = 0;
    for (let face = 1; face <= 10; face += 1) {
      if (rollMorale("fanatical", "round", rigged(face)).broke) broke += 1;
    }
    expect(broke).toBe(2);
  });

  it("reports the roll it made, so nothing downstream re-decides it", () => {
    const check = rollMorale("trained", "half_the_side_down", rigged(3));
    expect(check).toMatchObject({
      roll: 3,
      endFightUpTo: 6,
      broke: true,
      mentality: "trained",
      trigger: "half_the_side_down",
    });
  });
});

describe("when a check is owed", () => {
  it("is not owed on a fresh, unhurt fight", () => {
    const h = hostile();
    expect(moraleTriggerFor(fight([h]), h)).toBeNull();
  });

  it("is owed once the combatant is Seriously Wounded", () => {
    const h = hostile({ woundState: "serious" });
    expect(moraleTriggerFor(fight([h]), h)).toBe("seriously_wounded");
  });

  it("is owed when more than half their side is down", () => {
    const up = hostile({ id: "a" });
    const state = fight([
      up,
      hostile({ id: "b", defeated: true }),
      hostile({ id: "c", defeated: true }),
    ]);
    expect(moraleTriggerFor(state, up)).toBe("half_the_side_down");
  });

  it("is not owed at exactly half — more than half is the printed example", () => {
    const up = hostile({ id: "a" });
    const state = fight([up, hostile({ id: "b", defeated: true })]);
    expect(moraleTriggerFor(state, up)).toBeNull();
  });

  it("is owed once the fight drags into Round 5", () => {
    const h = hostile();
    expect(moraleTriggerFor(fight([h], 4), h)).toBeNull();
    expect(moraleTriggerFor(fight([h], 5), h)).toBe("round");
  });

  it("does not ask the same combatant the same question twice", () => {
    // "Once the opposition reaches their stress point" is a moment, not a
    // standing condition. Re-rolling it every Round would empty the room by
    // attrition rather than by anything that happened.
    const h = hostile({ woundState: "serious" });
    expect(moraleTriggerFor(fight([h]), h, ["seriously_wounded"])).toBeNull();
  });

  it("still asks a NEW question after an old one is spent", () => {
    const h = hostile({ woundState: "serious" });
    expect(moraleTriggerFor(fight([h], 5), h, ["seriously_wounded"])).toBe("round");
  });

  it("never asks the player, and never asks the dead", () => {
    const player = hostile({ id: "p", isPlayer: true, side: "friendly", woundState: "serious" });
    expect(moraleTriggerFor(fight([player]), player)).toBeNull();
    const gone = hostile({ woundState: "serious", defeated: true });
    expect(moraleTriggerFor(fight([gone]), gone)).toBeNull();
  });
});
