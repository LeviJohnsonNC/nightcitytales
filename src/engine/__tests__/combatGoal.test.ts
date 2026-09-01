/**
 * Why they are shooting at you, and when they stop.
 *
 * Cyberpunk RED: Single Player Mode tells the solo player to establish the
 * opposition's reason before a fight starts. Every encounter in this app used
 * to have the same implicit one — reduce the player to zero and keep going —
 * which for a character with no Medtech and no crew is not grit, it is the only
 * failure state there is.
 */
import { describe, expect, it } from "vitest";
import {
  COMBAT_GOALS,
  DEFAULT_COMBAT_GOAL,
  combatGoalFor,
  describeGoal,
  describeGoalMet,
  goalSatisfiedBy,
  isCombatGoal,
} from "../combatGoal";
import { FORCES } from "../threats";

const standing = { hp: 30, defeated: false };
const down = { hp: 0, defeated: false };
const dead = { hp: 0, defeated: true };

describe("when a goal is met", () => {
  it("is never met by a target still on their feet", () => {
    for (const goal of COMBAT_GOALS) {
      expect(goalSatisfiedBy(goal, standing)).toBe(false);
    }
  });

  it("is met by a DOWNED target for everything except killing them", () => {
    // Mortally Wounded, not dead — precisely where RED leaves a character when
    // the dice go badly, and precisely the moment that decides whether there is
    // a campaign tomorrow.
    for (const goal of COMBAT_GOALS) {
      expect(goalSatisfiedBy(goal, down)).toBe(goal !== "kill");
    }
  });

  it("is met by a dead target for everything, killing included", () => {
    for (const goal of COMBAT_GOALS) {
      expect(goalSatisfiedBy(goal, dead)).toBe(true);
    }
  });

  it("keeps a killer shooting at somebody who is only bleeding out", () => {
    // The one goal that does not let go. Militech did not come to rob you.
    expect(goalSatisfiedBy("kill", down)).toBe(false);
  });
});

describe("goal keys", () => {
  it("falls back to the old implicit answer rather than throwing", () => {
    // Anything from outside the closed list — a stale row, a model's invention
    // — behaves exactly as every fight did before goals existed.
    expect(combatGoalFor("shakedown")).toBe(DEFAULT_COMBAT_GOAL);
    expect(combatGoalFor(undefined)).toBe("kill");
    expect(combatGoalFor(null)).toBe("kill");
    expect(combatGoalFor("rob")).toBe("rob");
  });

  it("recognises exactly the closed list", () => {
    for (const goal of COMBAT_GOALS) expect(isCombatGoal(goal)).toBe(true);
    expect(isCombatGoal("negotiate")).toBe(false);
    expect(isCombatGoal(7)).toBe(false);
  });

  it("describes every goal, in both voices", () => {
    // A missing case would render "undefined" into the narration the GM is told
    // to treat as fact.
    for (const goal of COMBAT_GOALS) {
      expect(describeGoal(goal).length).toBeGreaterThan(0);
      expect(describeGoalMet("Scav", goal)).toContain("Scav");
    }
  });
});

describe("the authored forces", () => {
  it("every force says why it fights, from the closed list", () => {
    expect(FORCES.length).toBeGreaterThan(0);
    for (const force of FORCES) {
      expect(isCombatGoal(force.goal)).toBe(true);
    }
  });

  it("is not all killers — the street wants your money, not your body", () => {
    const goals = new Set(FORCES.map((f) => f.goal));
    expect(goals.size).toBeGreaterThan(1);
    expect(goals.has("kill")).toBe(true);
    expect([...goals].some((g) => g !== "kill")).toBe(true);
  });
});
