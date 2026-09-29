import { describe, expect, it } from "vitest";
import type { CheckableTurn } from "../narratorChecks";
import {
  mentions,
  optionsDiverge,
  readingDoesNotMoveTheDice,
  usesTheReading,
  type PairedContext,
} from "../pairedChecks";

const turn = (over: Partial<CheckableTurn> = {}): CheckableTurn => ({
  narration: "The guard looks up.",
  offeredOptions: [],
  npcKeys: [],
  observations: [],
  walkOns: [],
  proposedActionCount: 0,
  ...over,
});

const roll = (dv: number, skillId = "persuasion") => ({ skillId, dv, lowStakes: false });
const CTX: PairedContext = { labels: ["old man", "young woman"] };

describe("the difference did not change the dice", () => {
  const run = (a: CheckableTurn[], b: CheckableTurn[]) =>
    readingDoesNotMoveTheDice.run(a, b, { ...CTX, sameDice: true });

  it("passes when both sides face the same difficulty, with the model's own spread", () => {
    const a = [
      turn({ checks: [roll(13)] }),
      turn({ checks: [roll(15)] }),
      turn({ checks: [roll(13)] }),
    ];
    const b = [
      turn({ checks: [roll(15)] }),
      turn({ checks: [roll(13)] }),
      turn({ checks: [roll(13)] }),
    ];
    expect(run(a, b)).toEqual([]);
  });

  it("flags a skill that was harder in every run of one side than in every run of the other", () => {
    const a = [turn({ checks: [roll(17)] }), turn({ checks: [roll(17)] })];
    const b = [turn({ checks: [roll(13)] }), turn({ checks: [roll(13)] })];
    const found = run(a, b);
    expect(found).toHaveLength(1);
    expect(found[0]!.quote).toContain("persuasion");
    expect(found[0]!.quote).toContain("17");
  });

  it("flags one side always going to the dice while the other never does", () => {
    const a = [turn({ checks: [roll(13)] }), turn({ checks: [roll(13)] })];
    const b = [turn(), turn()];
    expect(run(a, b)[0]!.note).toContain("whether to roll");
  });

  it("counts an opposed check as a roll, and flags a porter who is stronger for one of them", () => {
    const fight = (total: number) =>
      turn({
        opposed: [
          {
            skillId: "persuasion",
            npcKey: "porter",
            opposingSkillId: "resist",
            opposingTotal: total,
          },
        ],
      });
    // Both sides rolled, at overlapping strengths: nothing to say.
    expect(run([fight(12), fight(14)], [fight(14), fight(12)])).toEqual([]);
    // One side always gets the roll and the other never does.
    expect(run([fight(12)], [turn()])[0]!.note).toContain("whether to roll");
    // Every run of one side faced stronger opposition than every run of the other.
    const found = run([fight(16), fight(17)], [fight(11), fight(12)]);
    expect(found).toHaveLength(1);
    expect(found[0]!.quote).toContain("opposition");
  });

  it("says nothing when neither side rolled, and only applies when the scenario says the dice must match", () => {
    expect(run([turn()], [turn()])).toEqual([]);
    expect(readingDoesNotMoveTheDice.applies(CTX)).toBe(false);
  });
});

describe("the narrator used the difference it was given", () => {
  const ctx: PairedContext = {
    ...CTX,
    cues: [
      ["grey", "elderly"],
      ["young", "girl"],
    ],
  };

  it("passes when at least half the runs of each side reach for a cue", () => {
    const a = [turn({ narration: "He eyes your grey hair." }), turn({ narration: "Nothing." })];
    const b = [turn({ narration: "A young face." }), turn({ narration: "A girl, he thinks." })];
    expect(usesTheReading.run(a, b, ctx)).toEqual([]);
  });

  it("flags a side whose runs never show it, and quotes the count", () => {
    const a = [turn(), turn(), turn()];
    const b = [turn({ narration: "So young." }), turn({ narration: "A girl." }), turn()];
    const found = usesTheReading.run(a, b, ctx);
    expect(found).toHaveLength(1);
    expect(found[0]!.quote).toContain("old man: 0/3");
  });

  it("matches a cue as a whole word unless it is marked as a stem", () => {
    expect(mentions("They saw the missing women, and a kidnap.", "miss")).toBe(false);
    expect(mentions("seventy-odd years of mileage", "seventy*")).toBe(true);
    expect(mentions("Miss, you can't be here.", "miss")).toBe(true);
  });

  it("matches 'old' as a word, so it does not fire on 'bolder'", () => {
    const only: PairedContext = { ...CTX, cues: [["old"], []] };
    expect(
      usesTheReading.run([turn({ narration: "A bolder look." })], [turn()], only),
    ).toHaveLength(1);
    expect(usesTheReading.run([turn({ narration: "An old look." })], [turn()], only)).toEqual([]);
  });

  it("also reads the options, where a Role's move shows", () => {
    const only: PairedContext = { ...CTX, cues: [[], ["deck"]] };
    const b = [turn({ offeredOptions: ["Jack the deck into the terminal"] })];
    expect(usesTheReading.run([turn()], b, only)).toEqual([]);
  });
});

describe("the options differ more between the two than the model differs from itself", () => {
  const run = (a: CheckableTurn[], b: CheckableTurn[]) =>
    optionsDiverge.run(a, b, { ...CTX, optionsDiffer: true });
  const opts = (...labels: string[]) => turn({ offeredOptions: labels });

  it("passes when each side is consistent and the two sides are not alike", () => {
    const a = [
      opts("Kick the door", "Check the corridor"),
      opts("Kick the door", "Check the corridor"),
    ];
    const b = [
      opts("Jack the terminal", "Trace the network"),
      opts("Jack the terminal", "Trace the network"),
    ];
    expect(run(a, b)).toEqual([]);
  });

  it("flags two sides that are no less alike than one side is with itself", () => {
    const same = () => opts("Kick the door", "Check the corridor");
    expect(run([same(), same()], [same(), same()])).toHaveLength(1);
  });

  it("says nothing with one run a side, because there is no variation to compare with", () => {
    expect(run([opts("Kick the door")], [opts("Kick the door")])).toEqual([]);
  });
});
