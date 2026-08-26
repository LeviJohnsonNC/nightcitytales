import { describe, expect, it } from "vitest";
import {
  COMPLICATION,
  MAX_QUESTION_LENGTH,
  OPEN_QUESTION,
  ORACLE_TABLES,
  STREET,
  WIRE_ASKED_AROUND_BONUS,
  WIRE_BROKE_BONUS,
  WORK_ON_THE_WIRE,
  describeOracle,
  entryFor,
  getOracleTable,
  isAnswerableQuestion,
  isRealComplication,
  looksForWork,
  rollOracle,
  streetIntrudes,
  wireOffersWork,
} from "../oracle";
import { seededRng } from "../dice";
import type { RNG } from "../types";

/** Roll a specific face on a table without caring how rollDie maps randomness. */
function faceRng(table: { die: number }, face: number): RNG {
  return () => (face - 0.5) / table.die;
}

describe("oracle tables", () => {
  it("registers every table under its own id", () => {
    for (const table of ORACLE_TABLES) {
      expect(getOracleTable(table.id)).toBe(table);
    }
  });

  it("throws for a table that does not exist", () => {
    expect(() => getOracleTable("what_the_dog_saw")).toThrow(/what_the_dog_saw/);
  });

  it("tiles every face of its die with no gaps and no overlaps", () => {
    for (const table of ORACLE_TABLES) {
      const covered = new Map<number, string>();
      for (const entry of table.entries) {
        expect(entry.from).toBeLessThanOrEqual(entry.to);
        for (let face = entry.from; face <= entry.to; face += 1) {
          expect(covered.has(face)).toBe(false);
          covered.set(face, entry.key);
        }
      }
      for (let face = 1; face <= table.die; face += 1) {
        expect(covered.has(face)).toBe(true);
      }
      expect(covered.size).toBe(table.die);
    }
  });

  it("keeps its entries in ascending order, so clamping means what it says", () => {
    for (const table of ORACLE_TABLES) {
      for (let i = 1; i < table.entries.length; i += 1) {
        expect(table.entries[i]!.from).toBe(table.entries[i - 1]!.to + 1);
      }
      expect(table.entries[0]!.from).toBe(1);
      expect(table.entries[table.entries.length - 1]!.to).toBe(table.die);
    }
  });

  it("gives every entry a distinct key and real prose", () => {
    for (const table of ORACLE_TABLES) {
      const keys = table.entries.map((e) => e.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const entry of table.entries) {
        expect(entry.text.trim().length).toBeGreaterThan(2);
        expect(entry.text.trim()).toBe(entry.text);
      }
    }
  });
});

describe("nothing happens, most of the time", () => {
  it("makes silence the majority result on the wire", () => {
    const nothing = WORK_ON_THE_WIRE.entries.find((e) => e.key === "nothing")!;
    const span = nothing.to - nothing.from + 1;
    expect(span / WORK_ON_THE_WIRE.die).toBeGreaterThan(0.5);
  });

  it("makes a quiet evening the majority result on the street", () => {
    const quiet = STREET.entries.find((e) => e.key === "quiet")!;
    const span = quiet.to - quiet.from + 1;
    expect(span / STREET.die).toBeGreaterThan(0.5);
  });

  it("offers work on exactly one face in six", () => {
    const offer = WORK_ON_THE_WIRE.entries.find((e) => e.key === "offer")!;
    expect(offer.from).toBe(WORK_ON_THE_WIRE.die);
    expect(offer.to).toBe(WORK_ON_THE_WIRE.die);
  });

  it("leaves the job clean on one face of the complication die", () => {
    const clean = COMPLICATION.entries.find((e) => e.key === "none")!;
    expect(clean.to - clean.from + 1).toBe(1);
  });
});

describe("entryFor", () => {
  it("reads each face of a table onto its own entry", () => {
    for (const table of ORACLE_TABLES) {
      for (const entry of table.entries) {
        for (let face = entry.from; face <= entry.to; face += 1) {
          expect(entryFor(table, face).key).toBe(entry.key);
        }
      }
    }
  });

  it("clamps to the first entry when a modifier pushes the read below the table", () => {
    expect(entryFor(WORK_ON_THE_WIRE, 0).key).toBe("nothing");
    expect(entryFor(WORK_ON_THE_WIRE, -12).key).toBe("nothing");
    expect(entryFor(OPEN_QUESTION, 0).key).toBe("no_and");
  });

  it("clamps to the last entry when a modifier pushes the read above it", () => {
    expect(entryFor(WORK_ON_THE_WIRE, 7).key).toBe("offer");
    expect(entryFor(WORK_ON_THE_WIRE, 99).key).toBe("offer");
    expect(entryFor(OPEN_QUESTION, 11).key).toBe("yes_and");
  });
});

describe("rollOracle", () => {
  const now = () => new Date("2077-04-05T21:00:00.000Z");

  it("returns the entry the honest face landed on", () => {
    const result = rollOracle(WORK_ON_THE_WIRE, faceRng(WORK_ON_THE_WIRE, 6), { now });
    expect(result.face).toBe(6);
    expect(result.read).toBe(6);
    expect(result.key).toBe("offer");
    expect(result.tableId).toBe("work_on_the_wire");
    expect(result.label).toBe(WORK_ON_THE_WIRE.label);
    expect(result.visibility).toBe("open");
  });

  it("carries the table's visibility onto the result", () => {
    const secret = rollOracle(COMPLICATION, faceRng(COMPLICATION, 1));
    expect(secret.visibility).toBe("secret");
  });

  it("applies modifiers to the read and leaves the die face honest", () => {
    const result = rollOracle(WORK_ON_THE_WIRE, faceRng(WORK_ON_THE_WIRE, 4), {
      modifiers: [{ label: "Asked around", value: WIRE_ASKED_AROUND_BONUS }],
      now,
    });
    expect(result.face).toBe(4);
    expect(result.read).toBe(6);
    expect(result.key).toBe("offer");
    // The ledger still shows the face that actually came up.
    expect(result.roll.rolls).toEqual([4]);
    expect(result.roll.formula).toContain("1d6(4)");
    expect(result.roll.formula).toContain("Asked around(2)");
  });

  it("stacks the circumstance bonuses", () => {
    const result = rollOracle(WORK_ON_THE_WIRE, faceRng(WORK_ON_THE_WIRE, 3), {
      modifiers: [
        { label: "Broke", value: WIRE_BROKE_BONUS },
        { label: "Asked around", value: WIRE_ASKED_AROUND_BONUS },
      ],
    });
    expect(result.read).toBe(6);
    expect(result.key).toBe("offer");
  });

  it("cannot be pushed off the end of the table into an undefined entry", () => {
    const result = rollOracle(WORK_ON_THE_WIRE, faceRng(WORK_ON_THE_WIRE, 6), {
      modifiers: [{ label: "Desperate", value: 5 }],
    });
    expect(result.read).toBe(11);
    expect(result.key).toBe("offer");
    expect(result.text).toBe(WORK_ON_THE_WIRE.entries[2]!.text);
  });

  it("produces an auditable roll ending in what the table said", () => {
    const result = rollOracle(STREET, faceRng(STREET, 1), { now });
    expect(result.roll.dv).toBeNull();
    expect(result.roll.success).toBeNull();
    expect(result.roll.timestamp).toBe("2077-04-05T21:00:00.000Z");
    expect(result.roll.formula.endsWith(` → ${result.text}`)).toBe(true);
  });

  it("only ever rolls faces the die actually has", () => {
    const rng = seededRng(20770405);
    for (const table of ORACLE_TABLES) {
      for (let i = 0; i < 500; i += 1) {
        const result = rollOracle(table, rng);
        expect(result.face).toBeGreaterThanOrEqual(1);
        expect(result.face).toBeLessThanOrEqual(table.die);
        expect(table.entries.some((e) => e.key === result.key)).toBe(true);
      }
    }
  });

  it("is deterministic for a given seed, so a day's roll can be replayed", () => {
    const a = rollOracle(COMPLICATION, seededRng(1312));
    const b = rollOracle(COMPLICATION, seededRng(1312));
    expect(a.face).toBe(b.face);
    expect(a.key).toBe(b.key);
  });

  it("leaves most nights quiet over a long run", () => {
    const rng = seededRng(2077);
    let offers = 0;
    const nights = 2000;
    for (let i = 0; i < nights; i += 1) {
      if (wireOffersWork(rollOracle(WORK_ON_THE_WIRE, rng))) offers += 1;
    }
    // One face in six, with room for sampling noise.
    expect(offers / nights).toBeGreaterThan(0.1);
    expect(offers / nights).toBeLessThan(0.25);
  });
});

describe("reading results", () => {
  it("only reports work when the wire actually offered some", () => {
    expect(wireOffersWork(rollOracle(WORK_ON_THE_WIRE, faceRng(WORK_ON_THE_WIRE, 6)))).toBe(true);
    expect(wireOffersWork(rollOracle(WORK_ON_THE_WIRE, faceRng(WORK_ON_THE_WIRE, 5)))).toBe(false);
    expect(wireOffersWork(rollOracle(WORK_ON_THE_WIRE, faceRng(WORK_ON_THE_WIRE, 1)))).toBe(false);
  });

  it("does not mistake another table's result for the wire", () => {
    // STREET's sixth face is "intrudes", not an offer of work.
    expect(wireOffersWork(rollOracle(STREET, faceRng(STREET, 6)))).toBe(false);
    expect(streetIntrudes(rollOracle(WORK_ON_THE_WIRE, faceRng(WORK_ON_THE_WIRE, 6)))).toBe(false);
  });

  it("reports an intrusion only on the street's last face", () => {
    expect(streetIntrudes(rollOracle(STREET, faceRng(STREET, 6)))).toBe(true);
    expect(streetIntrudes(rollOracle(STREET, faceRng(STREET, 5)))).toBe(false);
  });

  it("calls every complication real except the clean brief", () => {
    for (const entry of COMPLICATION.entries) {
      const result = rollOracle(COMPLICATION, faceRng(COMPLICATION, entry.from));
      expect(isRealComplication(result)).toBe(entry.key !== "none");
    }
  });

  it("describes a roll for the ledger with its table and its arithmetic", () => {
    const result = rollOracle(WORK_ON_THE_WIRE, faceRng(WORK_ON_THE_WIRE, 5));
    expect(describeOracle(result)).toBe("Work on the wire: 1d6(5) = 5 → " + result.text);
  });
});

describe("isAnswerableQuestion", () => {
  it("accepts a real yes/no question", () => {
    expect(isAnswerableQuestion("Is the guard still on the door?")).toBe(true);
    expect(isAnswerableQuestion("Does Kiro already know about the raid?")).toBe(true);
    expect(isAnswerableQuestion("Has the fixer been paid yet?")).toBe(true);
  });

  it("rejects anything that is not a string", () => {
    for (const bad of [undefined, null, 42, {}, [], true]) {
      expect(isAnswerableQuestion(bad)).toBe(false);
    }
  });

  it("rejects open-ended questions a yes/no table cannot answer", () => {
    for (const bad of [
      "What is in the container?",
      "Which of them is lying?",
      "How many guards are there?",
      "Why did the fixer call?",
      "Who owns this building?",
      "Where did the van go?",
      "When does the shift change?",
    ]) {
      expect(isAnswerableQuestion(bad)).toBe(false);
    }
  });

  it("does not reject a question merely for containing an open-ended word", () => {
    expect(isAnswerableQuestion("Is that what the broker meant?")).toBe(true);
  });

  it("rejects a question too short to be one", () => {
    expect(isAnswerableQuestion("")).toBe(false);
    expect(isAnswerableQuestion("   ")).toBe(false);
    expect(isAnswerableQuestion("Is it?")).toBe(false);
  });

  it("rejects a question longer than the engine will carry", () => {
    expect(isAnswerableQuestion(`Is ${"x".repeat(MAX_QUESTION_LENGTH)}?`)).toBe(false);
  });

  it("measures length after trimming", () => {
    expect(isAnswerableQuestion(`   Is the door locked?   `)).toBe(true);
  });
});

describe("looksForWork", () => {
  it("recognises the character working the phones", () => {
    for (const said of [
      "I spend the evening looking for work.",
      "I ask around for a job.",
      "I hit up my fixer about a contract.",
      "I call Kiro about a gig.",
      "I put out word that I'm available for work.",
      "I go hunting for a score in Watson.",
    ]) {
      expect(looksForWork(said)).toBe(true);
    }
  });

  it("does not fire on work merely being mentioned", () => {
    for (const said of [
      "I tell her the job went badly.",
      "I clean my gun and go to bed.",
      "I think about the last contract while I eat.",
      "The fixer owes me money and I want it.",
      "I look at the scar on my arm.",
    ]) {
      expect(looksForWork(said)).toBe(false);
    }
  });

  it("does not reach across the end of a sentence", () => {
    expect(looksForWork("I look at the ceiling. Then I think about the job.")).toBe(false);
  });

  it("says nothing about an empty turn", () => {
    expect(looksForWork("")).toBe(false);
  });
});
