import { describe, expect, it } from "vitest";
import {
  BROODING_DAYS,
  MOVE_CATEGORY,
  MOVE_DEADLINE,
  MOVE_MEANINGS,
  MOVE_SEVERITY,
  NPC_MOVES,
  WORLD_TICK,
  describeMove,
  isNpcMove,
  moveFitsHour,
  moveFor,
  motivation,
  somebodyMoves,
  tickTheWorld,
  whoMoves,
  type TickPerson,
} from "../worldTick";
import { seededRng } from "../dice";

/** An RNG pinned to one face of the tick die. */
const face = (value: number) => () => (value - 0.5) / WORLD_TICK.die;

const MORNING = 9 * 60;
const NIGHT = 3 * 60;

function person(over: Partial<TickPerson> = {}): TickPerson {
  return { key: "kiro", name: "Kiro Tanaka", disposition: 0, quietDays: 10, ...over };
}

describe("the tick table", () => {
  it("tiles the die with no gaps or overlaps", () => {
    const covered = new Set<number>();
    for (const entry of WORLD_TICK.entries) {
      for (let f = entry.from; f <= entry.to; f += 1) {
        expect(covered.has(f)).toBe(false);
        covered.add(f);
      }
    }
    expect(covered.size).toBe(WORLD_TICK.die);
  });

  it("leaves most days alone", () => {
    const still = WORLD_TICK.entries.find((e) => e.key === "still")!;
    expect((still.to - still.from + 1) / WORLD_TICK.die).toBeGreaterThan(0.5);
  });

  it("is open, so the quiet days are visibly rolled", () => {
    expect(WORLD_TICK.visibility).toBe("open");
  });

  it("only calls its own roll a move", () => {
    expect(somebodyMoves({ tableId: WORLD_TICK.id, key: "moves" } as never)).toBe(true);
    expect(somebodyMoves({ tableId: WORLD_TICK.id, key: "still" } as never)).toBe(false);
    expect(somebodyMoves({ tableId: "street", key: "moves" } as never)).toBe(false);
  });
});

describe("the move vocabulary", () => {
  it("gives every move a meaning, a severity and a category", () => {
    for (const move of NPC_MOVES) {
      expect(MOVE_MEANINGS[move].trim().length).toBeGreaterThan(10);
      expect(MOVE_SEVERITY[move]).toBeGreaterThan(0);
      expect(MOVE_SEVERITY[move]).toBeLessThanOrEqual(5);
      expect(MOVE_CATEGORY[move]).toBeTruthy();
      expect(describeMove(person(), move).length).toBeGreaterThan(0);
    }
  });

  it("never says WHY in a meaning — the why is in a dossier the model cannot see", () => {
    for (const move of NPC_MOVES) {
      expect(MOVE_MEANINGS[move].toLowerCase()).not.toContain("because");
    }
  });

  it("recognises a real move and rejects anything else", () => {
    expect(isNpcMove("asks_a_favour")).toBe(true);
    expect(isNpcMove("declares_war")).toBe(false);
    expect(isNpcMove(null)).toBe(false);
  });

  it("treats somebody coming for you as the loudest thing that can happen", () => {
    expect(MOVE_SEVERITY.comes_looking).toBe(Math.max(...NPC_MOVES.map((m) => MOVE_SEVERITY[m])));
  });
});

describe("who moves", () => {
  it("picks nobody when everyone was seen recently", () => {
    const seen = [person({ quietDays: 0 }), person({ key: "nix", quietDays: BROODING_DAYS - 1 })];
    expect(whoMoves(seen)).toBeNull();
  });

  it("picks nobody out of an empty cast", () => {
    expect(whoMoves([])).toBeNull();
  });

  it("picks the person who has been ignored longest", () => {
    const cast = [
      person({ key: "a", quietDays: 5 }),
      person({ key: "b", quietDays: 20 }),
      person({ key: "c", quietDays: 9 }),
    ];
    expect(whoMoves(cast)?.key).toBe("b");
  });

  it("lets strong feelings outweigh a little silence", () => {
    const cast = [
      person({ key: "neutral", disposition: 0, quietDays: 9 }),
      person({ key: "enemy", disposition: -3, quietDays: 6 }),
    ];
    // 9 vs 6 + 9 = 15.
    expect(whoMoves(cast)?.key).toBe("enemy");
  });

  it("puts somebody with a grudge that has come due ahead of everyone", () => {
    const cast = [
      person({ key: "ignored", quietDays: 200 }),
      person({ key: "vex", quietDays: 1, grudgeDue: true }),
    ];
    expect(whoMoves(cast)?.key).toBe("vex");
  });

  it("is deterministic — the same cast always yields the same person", () => {
    const cast = [person({ key: "b", quietDays: 10 }), person({ key: "a", quietDays: 10 })];
    expect(whoMoves(cast)?.key).toBe(whoMoves([...cast].reverse())?.key);
  });

  it("gives nobody a reason to act after only a day or two", () => {
    expect(motivation(person({ quietDays: 0 }))).toBe(0);
    expect(motivation(person({ quietDays: BROODING_DAYS - 1 }))).toBe(0);
    expect(motivation(person({ quietDays: BROODING_DAYS }))).toBeGreaterThan(0);
  });
});

describe("what they do about it", () => {
  it("has somebody who hates the character act against them", () => {
    expect(["moves_against", "comes_looking"]).toContain(
      moveFor(person({ disposition: -3 }), NIGHT),
    );
  });

  it("has a warm contact offer rather than demand", () => {
    expect(moveFor(person({ disposition: 3 }), MORNING)).toBe("offers_help");
  });

  it("never has somebody who hates you offer to help", () => {
    for (const disposition of [-3, -2, -1]) {
      expect(moveFor(person({ disposition }), MORNING)).not.toBe("offers_help");
    }
  });

  it("sends somebody with a due grudge to come looking", () => {
    expect(moveFor(person({ grudgeDue: true, disposition: 0 }), NIGHT)).toBe("comes_looking");
  });

  it("always returns a move the vocabulary knows, at any hour", () => {
    for (let minute = 0; minute < 24 * 60; minute += 37) {
      for (const disposition of [-3, -2, -1, 0, 1, 2, 3]) {
        for (const grudgeDue of [true, false]) {
          const move = moveFor(person({ disposition, grudgeDue }), minute);
          expect(NPC_MOVES).toContain(move);
        }
      }
    }
  });
});

describe("what the hour allows", () => {
  it("does not have a landlord knocking at four in the morning", () => {
    expect(moveFitsHour("asks_a_favour", NIGHT)).toBe(false);
    expect(moveFitsHour("asks_a_favour", MORNING)).toBe(true);
  });

  it("has somebody come looking when the street is empty", () => {
    expect(moveFitsHour("comes_looking", NIGHT)).toBe(true);
    expect(moveFitsHour("comes_looking", MORNING)).toBe(false);
  });

  it("lets the hour-agnostic moves happen whenever", () => {
    for (let minute = 0; minute < 24 * 60; minute += 61) {
      expect(moveFitsHour("goes_quiet", minute)).toBe(true);
      expect(moveFitsHour("warns_you", minute)).toBe(true);
    }
  });

  it("picks a different move at an hour the first choice does not suit", () => {
    // A friendly contact at 4am cannot be offering help in person.
    const night = moveFor(person({ disposition: 3 }), NIGHT);
    expect(night).not.toBe("offers_help");
    expect(NPC_MOVES).toContain(night);
  });
});

describe("tickTheWorld", () => {
  it("rolls even on a day nobody could move, so the quiet is visible", () => {
    const decision = tickTheWorld({ people: [], minute: MORNING, rng: face(6) });
    expect(decision.roll).toBeTruthy();
    expect(decision.person).toBeNull();
    expect(decision.move).toBeNull();
  });

  it("leaves the day alone when the die says still", () => {
    const decision = tickTheWorld({
      people: [person({ quietDays: 500 })],
      minute: MORNING,
      rng: face(1),
    });
    expect(decision.person).toBeNull();
  });

  it("moves exactly one person when the die says so", () => {
    const decision = tickTheWorld({
      people: [person({ key: "a", quietDays: 10 }), person({ key: "b", quietDays: 20 })],
      minute: MORNING,
      rng: face(6),
    });
    expect(decision.person?.key).toBe("b");
    expect(decision.move).toBeTruthy();
  });

  it("leaves most days quiet over a long run", () => {
    const rng = seededRng(1848);
    const cast = [person({ quietDays: 30 })];
    let moved = 0;
    const days = 2000;
    for (let i = 0; i < days; i += 1) {
      if (tickTheWorld({ people: cast, minute: MORNING, rng }).person) moved += 1;
    }
    // Two faces in six, with room for sampling noise.
    expect(moved / days).toBeGreaterThan(0.28);
    expect(moved / days).toBeLessThan(0.4);
  });
});

describe("which moves carry a deadline", () => {
  it("puts a clock only on the things that actually have one", () => {
    expect(MOVE_DEADLINE.calls_in_debt).toBe(true);
    expect(MOVE_DEADLINE.moves_against).toBe(true);
    expect(MOVE_DEADLINE.comes_looking).toBe(true);
  });

  it("leaves a favour asked without one", () => {
    // engine/life.ts escalates a due people/pressure situation on every load.
    // A favour request with a deadline would climb to severity 5 in a few
    // turns and drown out somebody actually coming to kill you.
    expect(MOVE_DEADLINE.asks_a_favour).toBe(false);
    expect(MOVE_DEADLINE.warns_you).toBe(false);
    expect(MOVE_DEADLINE.goes_quiet).toBe(false);
  });

  it("expires an offer nobody took up", () => {
    // Opportunities expire on their due day rather than escalating.
    expect(MOVE_CATEGORY.offers_help).toBe("opportunity");
    expect(MOVE_DEADLINE.offers_help).toBe(true);
  });

  it("covers every move in the vocabulary", () => {
    for (const move of NPC_MOVES) expect(typeof MOVE_DEADLINE[move]).toBe("boolean");
  });

  it("never puts an escalating clock on a non-pressure move", () => {
    for (const move of NPC_MOVES) {
      if (MOVE_DEADLINE[move] && MOVE_CATEGORY[move] !== "opportunity") {
        // Escalation is only correct for things that genuinely get worse.
        expect(["calls_in_debt", "moves_against", "comes_looking"]).toContain(move);
      }
    }
  });
});
