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

describe("the options tell the two sides apart by more than the model's own variation", () => {
  const opts = (...labels: string[]) => turn({ offeredOptions: labels });
  const solo = () => opts("Kick the door", "Check the corridor");
  const runner = () => opts("Jack the terminal", "Trace the network");
  const four = (make: () => CheckableTurn) => [make(), make(), make(), make()];
  const ctx: PairedContext = { ...CTX, optionsDiffer: true };
  const rate = (a: CheckableTurn[], b: CheckableTurn[]) => optionsDiverge.rate!(a, b, ctx);

  it("holds, and says every turn was told apart, when each side is consistent and the sides differ", () => {
    const r = rate(four(solo), four(runner))!;
    expect(r.runs).toBe(8);
    expect(r.failing).toEqual([]);
    expect(r.held).toBe(true);
    expect(optionsDiverge.run(four(solo), four(runner), ctx)).toEqual([]);
  });

  it("does not hold when the two sides offer the same options", () => {
    const r = rate(four(solo), four(solo))!;
    expect(r.failing).toHaveLength(8);
    expect(r.held).toBe(false);
    expect(optionsDiverge.run(four(solo), four(solo), ctx)[0]!.quote).toContain("p =");
  });

  it("is a rate: one odd run costs one, and does not flip the verdict at the default five runs", () => {
    const five = (make: () => CheckableTurn) => [...four(make), make()];
    const a = [...four(solo), runner()];
    const r = rate(a, five(runner))!;
    // The odd turn looks like the other side, and only it is misattributed.
    expect(r.runs).toBe(10);
    expect(r.failing).toHaveLength(1);
    expect(r.held).toBe(true);
  });

  it("cannot hold with a single odd run at four a side: there are too few ways to split eight turns", () => {
    const a = [solo(), solo(), solo(), runner()];
    expect(rate(a, four(runner))!.held).toBe(false);
  });

  it("gives the same answer every time for the same turns", () => {
    const a = [solo(), opts("Kick the door", "Wait"), solo(), solo()];
    const b = [runner(), opts("Trace the network", "Wait"), runner(), runner()];
    expect(rate(a, b)).toEqual(rate(a, b));
  });

  it("says nothing with fewer runs than it takes to tell anything apart", () => {
    expect(rate([solo(), solo(), solo()], [runner(), runner(), runner()])).toBeNull();
    expect(optionsDiverge.run([solo()], [runner()], ctx)).toEqual([]);
  });
});

describe("the uptake check as a rate", () => {
  const ctx: PairedContext = { ...CTX, cues: [["grey"], ["young*"]] };

  it("counts the runs that showed the cue, and holds when half did", () => {
    const a = [turn({ narration: "grey hair" }), turn({ narration: "nothing" })];
    const b = [turn({ narration: "so young" }), turn({ narration: "so young" })];
    const r = usesTheReading.rate!(a, b, ctx)!;
    expect(r.runs).toBe(4);
    expect(r.failing).toHaveLength(1);
    expect(r.failing[0]!.quote).toContain("old man run 2");
    expect(r.held).toBe(true);
  });

  it("does not hold when fewer than half showed it", () => {
    const a = [turn(), turn(), turn(), turn({ narration: "grey" })];
    expect(usesTheReading.rate!(a, [turn({ narration: "young" })], ctx)!.held).toBe(false);
  });

  it("has no rate when there are no cues to count", () => {
    expect(usesTheReading.rate!([turn()], [turn()], { ...CTX, cues: [[], []] })).toBeNull();
  });
});
