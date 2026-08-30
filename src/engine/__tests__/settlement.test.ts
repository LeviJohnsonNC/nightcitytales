import { describe, expect, it } from "vitest";
import {
  LOUD_SHOT_THRESHOLD,
  MAX_PER_OBSERVATION,
  describeSettlement,
  eventsForThisJob,
  looksLikeAPerson,
  readSettlement,
  readMechanicalCost,
  reportsFrom,
  survivorsFrom,
  type SettlementEvent,
} from "../settlement";
import { OBSERVATIONS } from "../clocks";

const PLAYER = "Vela Ruiz";

const ev = (type: string, data: Record<string, unknown> = {}): SettlementEvent => ({ type, data });
const died = (name: string) => ev("death_save", { combatant: name, died: true });
const survived = (name: string) => ev("death_save", { combatant: name, died: false });
const hit = (target: string, through = 5) =>
  ev("attack", { attacker: PLAYER, target, hit: true, through_armor: through });
const missed = (target: string) => ev("attack", { attacker: PLAYER, target, hit: false });
const stealth = (success: boolean) => ev("skill_check", { skill_id: "stealth", success });

function read(events: SettlementEvent[]) {
  return readSettlement({ events, playerName: PLAYER });
}
function keys(events: SettlementEvent[]) {
  return read(events).map((f) => f.observation);
}
function countOf(events: SettlementEvent[], observation: string) {
  return read(events).find((f) => f.observation === observation)?.count ?? 0;
}

describe("only this job", () => {
  it("starts counting at the last mission_started", () => {
    const events = [died("old ganger"), ev("mission_started"), died("new ganger")];
    expect(eventsForThisJob(events)).toHaveLength(1);
    expect(countOf(events, "killed")).toBe(1);
  });

  it("reads the whole ledger when no job has started", () => {
    expect(eventsForThisJob([ev("gm_narration")])).toHaveLength(1);
  });

  it("does not charge this job for the last one's bodies", () => {
    const events = [ev("mission_started"), died("a"), died("b"), ev("mission_started"), died("c")];
    expect(countOf(events, "killed")).toBe(1);
  });
});

describe("the physical bill", () => {
  it("reconstructs player harm, armor ablation, ammunition and criticals", () => {
    const result = readMechanicalCost({
      playerName: PLAYER,
      events: [
        ev("mission_started"),
        ev("attack", {
          attacker: "Vex",
          target: PLAYER,
          hp_before: 40,
          hp_after: 34,
          sp_before: 11,
          sp_after: 10,
          armor_location: "body",
          critical_injury: true,
        }),
        ev("attack", {
          attacker: PLAYER,
          target: "Vex",
          weapon: "Very Heavy Pistol",
          ammo: { inventoryId: "weapon-1", before: 8, after: 7 },
        }),
      ],
    });
    expect(result).toEqual({
      hp: { before: 40, after: 34, lost: 6 },
      armor: [{ location: "body", before: 11, after: 10, ablated: 1 }],
      ammunition: [
        {
          inventoryId: "weapon-1",
          weapon: "Very Heavy Pistol",
          before: 8,
          after: 7,
          spent: 1,
        },
      ],
      criticalInjuries: 1,
    });
  });
});

describe("bodies", () => {
  it("counts a failed Death Save as a death", () => {
    expect(countOf([ev("mission_started"), died("Vex")], "killed")).toBe(1);
  });

  it("does not count the player's own Death Save as a kill", () => {
    expect(countOf([ev("mission_started"), died(PLAYER)], "killed")).toBe(0);
  });

  it("does not count a Death Save somebody survived", () => {
    expect(countOf([ev("mission_started"), survived("Vex")], "killed")).toBe(0);
  });

  it("caps what one job can report", () => {
    const many = Array.from({ length: 12 }, (_, i) => died(`ganger ${i}`));
    expect(countOf([ev("mission_started"), ...many], "killed")).toBe(MAX_PER_OBSERVATION);
  });
});

describe("people who were hurt and lived", () => {
  it("counts somebody the player put damage through armor on", () => {
    expect(countOf([ev("mission_started"), hit("Vex")], "wounded")).toBe(1);
  });

  it("counts each person once, however many times they were hit", () => {
    expect(countOf([ev("mission_started"), hit("Vex"), hit("Vex"), hit("Vex")], "wounded")).toBe(1);
  });

  it("does not count somebody who then died — they are a body, not a casualty", () => {
    const events = [ev("mission_started"), hit("Vex"), died("Vex")];
    expect(countOf(events, "wounded")).toBe(0);
    expect(countOf(events, "killed")).toBe(1);
  });

  it("does not count a miss, or a hit that armor stopped", () => {
    expect(countOf([ev("mission_started"), missed("Vex")], "wounded")).toBe(0);
    expect(countOf([ev("mission_started"), hit("Vex", 0)], "wounded")).toBe(0);
  });

  it("does not count somebody the player did not shoot", () => {
    const crossfire = ev("attack", {
      attacker: "Some other ganger",
      target: "Vex",
      hit: true,
      through_armor: 9,
    });
    expect(countOf([ev("mission_started"), crossfire], "wounded")).toBe(0);
  });
});

describe("how loudly", () => {
  it("says nothing about one or two shots in a back room", () => {
    const quiet = Array.from({ length: LOUD_SHOT_THRESHOLD - 1 }, () => missed("Vex"));
    expect(keys([ev("mission_started"), ...quiet])).not.toContain("loud");
  });

  it("calls a real firefight loud", () => {
    const fight = Array.from({ length: LOUD_SHOT_THRESHOLD }, () => missed("Vex"));
    expect(countOf([ev("mission_started"), ...fight], "loud")).toBe(1);
  });

  it("counts a firefight as loud once, not once per shot", () => {
    const long = Array.from({ length: 30 }, () => missed("Vex"));
    expect(countOf([ev("mission_started"), ...long], "loud")).toBe(1);
  });

  it("treats backup that actually came as people who saw you", () => {
    const called = ev("backup_called", { responded: true });
    expect(countOf([ev("mission_started"), called], "witness")).toBe(1);
  });

  it("ignores a call nobody answered", () => {
    const unanswered = ev("backup_called", { responded: false });
    expect(countOf([ev("mission_started"), unanswered], "witness")).toBe(0);
  });
});

describe("being seen", () => {
  it("counts a blown Stealth check as being clocked", () => {
    expect(countOf([ev("mission_started"), stealth(false)], "seen")).toBe(1);
  });

  it("does not count a Stealth check that worked", () => {
    expect(countOf([ev("mission_started"), stealth(true)], "seen")).toBe(0);
  });

  it("does not count some other skill going wrong", () => {
    const failedTrading = ev("skill_check", { skill_id: "trading", success: false });
    expect(countOf([ev("mission_started"), failedTrading], "seen")).toBe(0);
  });
});

describe("working clean", () => {
  it("is reported when there was no fight and nothing was noticed", () => {
    const events = [ev("mission_started"), stealth(true), ev("gm_narration")];
    expect(keys(events)).toEqual(["clean"]);
  });

  it("is not reported when there was a fight, even a bloodless one", () => {
    const events = [ev("mission_started"), ev("encounter_started")];
    expect(keys(events)).not.toContain("clean");
  });

  it("is not reported when anything else was found", () => {
    expect(keys([ev("mission_started"), stealth(false)])).not.toContain("clean");
    expect(keys([ev("mission_started"), died("Vex")])).not.toContain("clean");
  });

  it("is the whole answer for a job nobody noticed", () => {
    expect(keys([ev("mission_started")])).toEqual(["clean"]);
  });
});

describe("the shape of what it returns", () => {
  it("only ever reports words the clock vocabulary knows", () => {
    const busy = [
      ev("mission_started"),
      died("a"),
      hit("b"),
      stealth(false),
      ev("encounter_started"),
      ev("backup_called", { responded: true }),
      ...Array.from({ length: 5 }, () => missed("c")),
    ];
    for (const finding of read(busy)) {
      expect(OBSERVATIONS).toContain(finding.observation);
      expect(finding.count).toBeGreaterThan(0);
      expect(finding.because.trim().length).toBeGreaterThan(0);
    }
  });

  it("survives a ledger full of nonsense without inventing anything", () => {
    const junk = [
      ev("mission_started"),
      { type: "attack", data: null } as SettlementEvent,
      { type: "death_save" } as SettlementEvent,
      { type: "skill_check", data: "not an object" } as SettlementEvent,
      ev("attack", { attacker: PLAYER, target: 42, hit: true, through_armor: 5 }),
    ];
    expect(() => read(junk)).not.toThrow();
    expect(keys(junk)).not.toContain("wounded");
  });

  it("expands findings into one report per occurrence, aimed at the faction", () => {
    const findings = read([ev("mission_started"), died("a"), died("b")]);
    const reports = reportsFrom(findings, "militech");
    expect(reports).toEqual([
      { observation: "killed", factionId: "militech" },
      { observation: "killed", factionId: "militech" },
    ]);
  });

  it("aims at nobody in particular when the job named nobody", () => {
    const reports = reportsFrom(read([ev("mission_started"), died("a")]), null);
    expect(reports[0]!.factionId).toBeNull();
  });

  it("describes itself for the wrap-up screen", () => {
    const findings = read([ev("mission_started"), died("a"), stealth(false)]);
    expect(describeSettlement(findings)).toContain("1 died");
    expect(describeSettlement([])).toBe("Nothing the city noticed.");
  });
});

describe("who walked away", () => {
  it("names somebody the player fought who did not die", () => {
    const events = [ev("mission_started"), hit("Vex"), ev("encounter_ended")];
    expect(survivorsFrom({ events, playerName: PLAYER }).map((s) => s.name)).toEqual(["Vex"]);
  });

  it("leaves out the dead", () => {
    const events = [ev("mission_started"), hit("Vex"), died("Vex")];
    expect(survivorsFrom({ events, playerName: PLAYER })).toEqual([]);
  });

  it("leaves out anyone the player never fought", () => {
    const crossfire = ev("attack", { attacker: "Some ganger", target: "Vex", hit: true });
    const events = [ev("mission_started"), crossfire];
    expect(survivorsFrom({ events, playerName: PLAYER })).toEqual([]);
  });

  it("names each survivor once, however many times they were shot at", () => {
    const events = [ev("mission_started"), missed("Vex"), hit("Vex"), missed("Vex")];
    expect(survivorsFrom({ events, playerName: PLAYER })).toHaveLength(1);
  });

  it("counts somebody shot at and missed — they still saw you", () => {
    const events = [ev("mission_started"), missed("Vex")];
    expect(survivorsFrom({ events, playerName: PLAYER }).map((s) => s.name)).toEqual(["Vex"]);
  });

  it("only reads this job", () => {
    const events = [hit("Old Enemy"), ev("mission_started"), hit("Vex")];
    expect(survivorsFrom({ events, playerName: PLAYER }).map((s) => s.name)).toEqual(["Vex"]);
  });
});

describe("looksLikeAPerson", () => {
  it("accepts a name that reads as somebody", () => {
    for (const name of ["Vex", "Kiro Tanaka", "Maelstrom Sasha", "Royce"]) {
      expect(looksLikeAPerson(name)).toBe(true);
    }
  });

  it("rejects a job description", () => {
    for (const name of ["Guard", "guard", "Ganger", "Security", "Corpo Enforcer", "Thugs"]) {
      expect(looksLikeAPerson(name)).toBe(false);
    }
  });

  it("rejects anything numbered — a spawn is not a person", () => {
    for (const name of ["Ganger 2", "Guard #3", "Vex 2"]) {
      expect(looksLikeAPerson(name)).toBe(false);
    }
  });

  it("accepts a real name that happens to sit beside a job word", () => {
    // "Guard Captain Reyes" has a name in it; "Guard Captain" does not.
    expect(looksLikeAPerson("Guard Captain Reyes")).toBe(true);
  });

  it("rejects nonsense lengths", () => {
    expect(looksLikeAPerson("")).toBe(false);
    expect(looksLikeAPerson("X")).toBe(false);
    expect(looksLikeAPerson("a".repeat(60))).toBe(false);
  });
});
