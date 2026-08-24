import { describe, expect, it } from "vitest";
import { OPPOSED_CHECK_TIE_GOES_TO } from "../rulesData";
import { opposedCheckForCharacter, resolveOpposedCheck, type OpposedSide } from "../opposedCheck";
import type { RNG } from "../types";

/** An RNG that returns the given d10 faces in order, then throws. */
function faces(...values: number[]): RNG {
  let i = 0;
  return () => {
    const value = values[i++];
    if (value === undefined) throw new Error("rng: out of scripted rolls");
    return (value - 1) / 10 + 0.001; // lands inside the face's band
  };
}

const talker: OpposedSide = {
  name: "Vincent Kang",
  statLabel: "COOL",
  statValue: 6,
  skillLabel: "Persuasion",
  skillValue: 4,
};

const mark: OpposedSide = {
  name: "Trace Santiago",
  statLabel: "INT",
  statValue: 5,
  skillLabel: "Human Perception",
  skillValue: 3,
};

describe("resolveOpposedCheck", () => {
  it("rolls both sides as STAT + Skill + 1d10", () => {
    const result = resolveOpposedCheck(talker, mark, faces(7, 4));
    expect(result.actor.total).toBe(17); // COOL 6 + Persuasion 4 + 7
    expect(result.opponent.total).toBe(12); // INT 5 + Human Perception 3 + 4
    expect(result.success).toBe(true);
    expect(result.margin).toBe(5);
    expect(result.tie).toBe(false);
  });

  it("fails when the opposing total is higher", () => {
    const result = resolveOpposedCheck(talker, mark, faces(2, 9));
    expect(result.actor.total).toBe(12);
    expect(result.opponent.total).toBe(17);
    expect(result.success).toBe(false);
    expect(result.margin).toBe(-5);
  });

  it("gives a tie to the defender: the actor must exceed, not match", () => {
    // COOL 6 + Persuasion 4 + 5 = 15; INT 5 + Human Perception 3 + 7 = 15.
    const result = resolveOpposedCheck(talker, mark, faces(5, 7));
    expect(result.actor.total).toBe(result.opponent.total);
    expect(result.tie).toBe(true);
    expect(result.margin).toBe(0);
    expect(result.success).toBe(false);
    expect(OPPOSED_CHECK_TIE_GOES_TO).toBe("defender");
  });

  it("applies each side's criticals independently", () => {
    // Actor rolls a natural 10 (+6 crit die); opponent rolls a natural 1 (-3).
    const result = resolveOpposedCheck(talker, mark, faces(10, 6, 1, 3));
    expect(result.actor.critical).toBe("success");
    expect(result.actor.total).toBe(26); // 10 + 6 crit + COOL 6 + Persuasion 4
    expect(result.opponent.critical).toBe("failure");
    expect(result.opponent.total).toBe(6); // 1 − 3 crit + INT 5 + Human Perception 3
    expect(result.success).toBe(true);
  });

  it("carries each side's modifiers into its own roll", () => {
    const result = resolveOpposedCheck(
      { ...talker, modifiers: [{ label: "Disposition", value: 2 }] },
      mark,
      faces(5, 5),
    );
    expect(result.actor.total).toBe(17); // 5 + COOL 6 + Persuasion 4 + 2
    expect(result.actor.formula).toContain("Disposition");
  });
});

describe("opposedCheckForCharacter", () => {
  const actor = {
    stats: { cool: 6, int: 5, ref: 7 },
    skills: [{ skillId: "persuasion", level: 4 }],
  };

  it("reads each side's governing STAT from the printed skill entry", () => {
    const result = opposedCheckForCharacter(
      actor,
      "persuasion",
      { name: "Trace Santiago", skillId: "human_perception", skillLevel: 3, statValue: 5 },
      faces(7, 4),
    );
    expect(result.actorSide).toMatchObject({ statLabel: "COOL", statValue: 6, skillValue: 4 });
    expect(result.opponentSide).toMatchObject({
      name: "Trace Santiago",
      statLabel: "EMP", // Human Perception is printed under EMP, not INT
      statValue: 5,
      skillValue: 3,
    });
  });

  it("rolls an untrained skill at Level 0 rather than refusing", () => {
    const result = opposedCheckForCharacter(
      { stats: { cool: 6 }, skills: [] },
      "persuasion",
      { name: "Doorman", skillId: "concentration", skillLevel: 2, statValue: 5 },
      faces(5, 5),
    );
    expect(result.actorSide.skillValue).toBe(0);
    expect(result.actor.total).toBe(11); // 5 + COOL 6 + 0
  });

  it("refuses a check the character has no STAT for", () => {
    expect(() =>
      opposedCheckForCharacter(
        { stats: {}, skills: [] },
        "persuasion",
        { name: "Doorman", skillId: "concentration", skillLevel: 2, statValue: 5 },
        faces(5, 5),
      ),
    ).toThrow(/no COOL value/);
  });
});
