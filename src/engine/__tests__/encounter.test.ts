import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  beginTurn,
  currentCombatant,
  defeatCombatant,
  joinEncounter,
  outcome,
  performAttack,
  playerCombatant,
  startEncounter,
  type Combatant,
  type EncounterState,
} from "../encounter";

/** Scripted RNG from (face, sides) pairs, so d10 and d6 can be mixed in one call. */
const seq = (rolls: [number, number][]) => {
  let i = 0;
  return () => {
    const pair = rolls[i++]!;
    return (pair[0] - 1) / pair[1];
  };
};

const mk = (id: string, over: Partial<Combatant> = {}): Combatant => ({
  id,
  name: id,
  side: "hostile",
  isPlayer: false,
  ref: 6,
  body: 6,
  hpMax: 40,
  hp: 40,
  seriouslyWoundedThreshold: 20,
  woundState: "none",
  deathSavePenalty: 0,
  spHead: 0,
  spBody: 0,
  defeated: false,
  initiative: null,
  ...over,
});

const stateOf = (combatants: Combatant[], activeIndex = 0): EncounterState => ({
  round: 1,
  order: combatants.map((c) => c.id),
  activeIndex,
  status: "active",
  combatants: Object.fromEntries(combatants.map((c) => [c.id, c])),
});

describe("startEncounter", () => {
  it("rolls REF + 1d10 initiative and orders high-to-low", () => {
    const pc = mk("pc", { side: "friendly", isPlayer: true, ref: 8 });
    const goon = mk("goon", { ref: 6 });
    // pc rolls 5 -> 13, goon rolls 9 -> 15.
    const state = startEncounter(
      [pc, goon],
      seq([
        [5, 10],
        [9, 10],
      ]),
    );
    expect(state.order).toEqual(["goon", "pc"]);
    expect(state.combatants["goon"]!.initiative).toBe(15);
    expect(state.combatants["pc"]!.initiative).toBe(13);
    expect(currentCombatant(state)!.id).toBe("goon");
    expect(playerCombatant(state)!.id).toBe("pc");
  });
});

describe("advanceTurn", () => {
  it("moves to the next combatant and bumps the round on wrap", () => {
    let state = stateOf([mk("a", { side: "friendly" }), mk("b", { side: "hostile" })]);
    state = advanceTurn(state);
    expect(state.activeIndex).toBe(1);
    expect(state.round).toBe(1);
    state = advanceTurn(state);
    expect(state.activeIndex).toBe(0);
    expect(state.round).toBe(2);
  });

  it("skips defeated combatants", () => {
    const state = stateOf([mk("a"), mk("b", { defeated: true }), mk("c")]);
    const next = advanceTurn(state);
    expect(next.activeIndex).toBe(2); // skips b
  });
});

describe("outcome", () => {
  it("is friendlies_won when no hostiles remain", () => {
    const state = stateOf([
      mk("pc", { side: "friendly" }),
      mk("goon", { side: "hostile", defeated: true }),
    ]);
    expect(outcome(state)).toBe("friendlies_won");
  });

  it("is friendlies_lost when no friendlies remain", () => {
    const state = stateOf([
      mk("pc", { side: "friendly", defeated: true }),
      mk("goon", { side: "hostile" }),
    ]);
    expect(outcome(state)).toBe("friendlies_lost");
  });
});

describe("performAttack", () => {
  const attacker = mk("pc", { side: "friendly", ref: 8 });

  it("misses without rolling damage or changing state", () => {
    const target = mk("goon", { hp: 40 });
    const state = stateOf([attacker, target]);
    // die 5 + REF 3 + skill 3 = 11 vs DV15 -> miss.
    const r = performAttack(
      state,
      {
        attackerId: "pc",
        targetId: "goon",
        statLabel: "REF",
        statValue: 3,
        skillLabel: "Handgun",
        skillValue: 3,
        dv: 15,
        damageDice: 3,
      },
      seq([[5, 10]]),
    );
    expect(r.attack.hit).toBe(false);
    expect(r.damage).toBeNull();
    expect(r.state.combatants["goon"]!.hp).toBe(40);
  });

  it("hits, subtracts SP, updates HP + wound state, and ablates armor", () => {
    const target = mk("goon", { hp: 40, spBody: 11 });
    const state = stateOf([attacker, target]);
    // attack die 4 (+8+6)=18 vs DV15 hit; damage 3d6 = 5+5+4 = 14 (no crit).
    const r = performAttack(
      state,
      {
        attackerId: "pc",
        targetId: "goon",
        statLabel: "REF",
        statValue: 8,
        skillLabel: "Handgun",
        skillValue: 6,
        dv: 15,
        damageDice: 3,
      },
      seq([
        [4, 10],
        [5, 6],
        [5, 6],
        [4, 6],
      ]),
    );
    expect(r.attack.hit).toBe(true);
    expect(r.applied!.damageThroughArmor).toBe(3); // 14 - 11
    const goon = r.state.combatants["goon"]!;
    expect(goon.hp).toBe(37);
    expect(goon.spBody).toBe(10); // ablated
    expect(goon.woundState).toBe("light");
  });

  it("applies the attacker's Wound State penalty to the check", () => {
    const wounded = mk("pc", { side: "friendly", ref: 8, woundState: "serious" });
    const target = mk("goon", { hp: 40, spBody: 0 });
    const state = stateOf([wounded, target]);
    const r = performAttack(
      state,
      {
        attackerId: "pc",
        targetId: "goon",
        statLabel: "REF",
        statValue: 8,
        skillLabel: "Handgun",
        skillValue: 6,
        dv: 15,
        damageDice: 1,
      },
      seq([
        [5, 10],
        [3, 6],
      ]),
    );
    // 5 + 8 + 6 - 2 (Wound) = 17
    expect(r.attack.total).toBe(17);
    expect(r.attack.formula).toContain("- Wound(2)");
  });

  it("auto-crits a Mortally Wounded target and raises its Death Save Penalty", () => {
    const target = mk("goon", { hp: 0, woundState: "mortal", spBody: 0, deathSavePenalty: 0 });
    const state = stateOf([attacker, target]);
    // hit (die 6 +8+6=20 vs DV10); damage 1d6 = 3, forced crit -> +5 bonus.
    const r = performAttack(
      state,
      {
        attackerId: "pc",
        targetId: "goon",
        statLabel: "REF",
        statValue: 8,
        skillLabel: "Handgun",
        skillValue: 6,
        dv: 10,
        damageDice: 1,
      },
      seq([
        [6, 10],
        [3, 6],
      ]),
    );
    expect(r.applied!.criticalInjury).toBe(true);
    expect(r.applied!.bonusDamage).toBe(5);
    const goon = r.state.combatants["goon"]!;
    expect(goon.hp).toBe(-8); // 0 - (3 + 5)
    expect(goon.deathSavePenalty).toBe(1);
  });
});

describe("beginTurn", () => {
  it("does nothing for a combatant who is not Mortally Wounded", () => {
    const state = stateOf([mk("a", { woundState: "serious" })]);
    const r = beginTurn(state, seq([[1, 10]]));
    expect(r.deathSave).toBeNull();
    expect(r.died).toBe(false);
  });

  it("survives a Death Save on a roll under BODY and advances the penalty", () => {
    const state = stateOf([mk("a", { woundState: "mortal", body: 6, deathSavePenalty: 0 })]);
    const r = beginTurn(state, seq([[3, 10]]));
    expect(r.deathSave!.survived).toBe(true);
    expect(r.died).toBe(false);
    expect(r.state.combatants["a"]!.deathSavePenalty).toBe(1);
    expect(r.state.combatants["a"]!.defeated).toBe(false);
  });

  it("dies on a failed Death Save and updates the outcome", () => {
    const state = stateOf([
      mk("pc", { side: "friendly", woundState: "mortal", body: 6 }),
      mk("goon", { side: "hostile" }),
    ]);
    const r = beginTurn(state, seq([[10, 10]])); // natural 10 = auto-fail
    expect(r.died).toBe(true);
    expect(r.state.combatants["pc"]!.defeated).toBe(true);
    expect(r.state.status).toBe("friendlies_lost");
  });
});

describe("defeatCombatant", () => {
  it("removes a combatant and recomputes the outcome", () => {
    const state = stateOf([mk("pc", { side: "friendly" }), mk("goon", { side: "hostile" })]);
    const next = defeatCombatant(state, "goon");
    expect(next.combatants["goon"]!.defeated).toBe(true);
    expect(next.status).toBe("friendlies_won");
  });
});

describe("Combat Awareness at the table", () => {
  const attack = {
    statLabel: "REF",
    statValue: 8,
    skillLabel: "Handgun",
    skillValue: 4,
    dv: 13,
    damageDice: 2,
  };

  it("adds Initiative Reaction to the Initiative roll", () => {
    const solo = mk("solo", {
      side: "friendly",
      isPlayer: true,
      ref: 8,
      roleEffects: { initiative: 3 },
    });
    // A d10 of 5: REF 8 + 3 points + 5 = 16, where an ordinary 8 REF gets 13.
    const state = startEncounter([solo], seq([[5, 10]]));
    expect(state.combatants["solo"]!.initiative).toBe(16);
  });

  it("adds Spot Weakness to the first successful attack of a Round only", () => {
    const solo = mk("solo", { side: "friendly", isPlayer: true, roleEffects: { spotWeakness: 2 } });
    const goon = mk("goon", { hp: 40, spBody: 0 });
    const state = stateOf([solo, goon]);

    // To-hit 9 (hits DV13 with +12), damage 3 and 3 = 6, +2 Spot Weakness = 8.
    const first = performAttack(
      state,
      { ...attack, attackerId: "solo", targetId: "goon" },
      seq([
        [9, 10],
        [3, 6],
        [3, 6],
      ]),
    );
    expect(first.applied!.hpAfter).toBe(32);

    // The second hit in the same Round is plain damage: 6 off 32 is 26.
    const second = performAttack(
      first.state,
      { ...attack, attackerId: "solo", targetId: "goon" },
      seq([
        [9, 10],
        [3, 6],
        [3, 6],
      ]),
    );
    expect(second.applied!.hpAfter).toBe(26);
  });

  it("softens the first damage taken in a Round with Damage Deflection", () => {
    const solo = mk("solo", {
      side: "friendly",
      isPlayer: true,
      hp: 40,
      roleEffects: { damageDeflection: 3 },
    });
    const goon = mk("goon");
    const state = stateOf([goon, solo]);

    // 6 damage less 3 deflected = 3.
    const first = performAttack(
      state,
      { ...attack, attackerId: "goon", targetId: "solo" },
      seq([
        [9, 10],
        [3, 6],
        [3, 6],
      ]),
    );
    expect(first.applied!.hpAfter).toBe(37);

    // The next one this Round lands in full: 6 off 37 is 31.
    const second = performAttack(
      first.state,
      { ...attack, attackerId: "goon", targetId: "solo" },
      seq([
        [9, 10],
        [3, 6],
        [3, 6],
      ]),
    );
    expect(second.applied!.hpAfter).toBe(31);
  });

  it("never turns a deflected hit into healing", () => {
    const solo = mk("solo", {
      side: "friendly",
      isPlayer: true,
      hp: 40,
      roleEffects: { damageDeflection: 5 },
    });
    const state = stateOf([mk("goon"), solo]);
    // 2 damage against 5 points of deflection floors at 0, not −3.
    const result = performAttack(
      state,
      { ...attack, attackerId: "goon", targetId: "solo" },
      seq([
        [9, 10],
        [1, 6],
        [1, 6],
      ]),
    );
    expect(result.applied!.hpAfter).toBe(40);
  });

  it("ignores the implosion on a natural 1 with Fumble Recovery", () => {
    const solo = mk("solo", {
      side: "friendly",
      isPlayer: true,
      roleEffects: { fumbleRecovery: true },
    });
    const state = stateOf([solo, mk("goon")]);
    // A natural 1 would normally subtract a second d10; here it just reads 1.
    const result = performAttack(
      state,
      { ...attack, attackerId: "solo", targetId: "goon" },
      seq([[1, 10]]),
    );
    expect(result.attack.rolls).toEqual([1]);
    expect(result.attack.critical).toBeNull();
    expect(result.attack.total).toBe(13); // 1 + REF 8 + Handgun 4
  });

  it("leaves an ordinary attacker's natural 1 imploding", () => {
    const state = stateOf([mk("goon"), mk("mook")]);
    const result = performAttack(
      state,
      { ...attack, attackerId: "goon", targetId: "mook" },
      seq([
        [1, 10],
        [4, 10],
      ]),
    );
    expect(result.attack.critical).toBe("failure");
    expect(result.attack.total).toBe(9); // 1 + 12 − 4
  });
});

describe("joining a fight in progress", () => {
  it("rolls the newcomer's Initiative and slots them into the order", () => {
    const state = stateOf([
      { ...mk("fast", { ref: 9 }), initiative: 18 },
      { ...mk("slow", { ref: 4 }), initiative: 8 },
    ]);
    // REF 6 + a d10 of 6 = 12, which sits between 18 and 8.
    const next = joinEncounter(state, mk("backup", { side: "friendly", ref: 6 }), seq([[6, 10]]));
    expect(next.order).toEqual(["fast", "backup", "slow"]);
    expect(next.combatants["backup"]!.initiative).toBe(12);
  });

  it("leaves the turn with whoever already had it", () => {
    const state = stateOf(
      [
        { ...mk("fast", { ref: 9 }), initiative: 18 },
        { ...mk("slow", { ref: 4 }), initiative: 8 },
      ],
      1, // it is "slow"'s turn
    );
    const next = joinEncounter(state, mk("backup", { side: "friendly", ref: 6 }), seq([[6, 10]]));
    // "slow" moved from index 1 to index 2; the turn moved with them.
    expect(next.order[next.activeIndex]).toBe("slow");
  });

  it("puts a slow arrival at the back rather than dropping them", () => {
    const state = stateOf([{ ...mk("fast", { ref: 9 }), initiative: 18 }]);
    const next = joinEncounter(state, mk("backup", { side: "friendly", ref: 2 }), seq([[1, 10]]));
    expect(next.order).toEqual(["fast", "backup"]);
  });
});
