import { describe, expect, it } from "vitest";
import { DEFAULT_DV, PUBLISHED_DVS, snapDv } from "../narratorRules";
import { normalizeGmResponse } from "@/features/gm/gmResponse";
import { normalizeLifeResponse } from "@/features/life/lifeResponse";

/**
 * The DV ladder is a printed table, and the prompt tells the narrator to use
 * one of its seven rungs. This is what makes that true rather than requested.
 *
 * Life snapped and the Job loop did not (`dv: num(a["dv"]) ?? 13`), so a Job
 * turn could run at DV 12 or DV 19 — a difficulty nobody published, set by the
 * narrator, which is the one thing the narrator may never do. The two loops
 * disagreeing about a printed table is the same fault as the prompts
 * disagreeing about one, and it is fixed the same way: one copy.
 */
describe("snapping a proposed difficulty onto the ladder", () => {
  it("leaves every printed rung exactly where it is", () => {
    for (const dv of PUBLISHED_DVS) expect(snapDv(dv)).toBe(dv);
  });

  it("pulls a number between rungs onto the nearest one", () => {
    expect(snapDv(12)).toBe(13);
    expect(snapDv(18)).toBe(17);
    expect(snapDv(23)).toBe(24);
    expect(snapDv(27)).toBe(29);
    expect(snapDv(10)).toBe(9);
  });

  it("breaks a tie toward the easier rung, as Life always has", () => {
    // 11 is equidistant from Simple 9 and Everyday 13, and 14 from 13 and 15.
    // Pinned because it is behaviour, not arithmetic: this function exists to
    // give the Job loop the rule Life already had, and a change of mind about
    // which way a tie falls should break this test rather than slip through it.
    expect(snapDv(11)).toBe(9);
    expect(snapDv(14)).toBe(13);
    expect(snapDv(19)).toBe(17);
  });

  it("clamps beyond either end of the table", () => {
    expect(snapDv(1)).toBe(9);
    expect(snapDv(-40)).toBe(9);
    expect(snapDv(99)).toBe(29);
  });

  it("falls back to Everyday for a difficulty that is not a number", () => {
    expect(snapDv(undefined)).toBe(DEFAULT_DV);
    expect(snapDv(null)).toBe(DEFAULT_DV);
    expect(snapDv(Number.NaN)).toBe(DEFAULT_DV);
    expect(snapDv(Number.POSITIVE_INFINITY)).toBe(DEFAULT_DV);
  });
});

describe("both narrators are held to the ladder, not just Life", () => {
  const offLadder = [12, 14, 16, 19, 22, 26, 100, 0];

  it("snaps a Job turn's proposed DV", () => {
    for (const dv of offLadder) {
      const { proposedActions } = normalizeGmResponse({
        narration: "The door does not look friendly.",
        proposedActions: [{ kind: "skill_check", skillId: "pick_lock", dv, intent: "force it" }],
      });
      const action = proposedActions[0];
      expect(action?.kind).toBe("skill_check");
      if (action?.kind !== "skill_check") throw new Error("expected a skill check");
      expect(PUBLISHED_DVS).toContain(action.dv);
      expect(action.dv).toBe(snapDv(dv));
    }
  });

  it("snaps a Life turn's proposed DV the same way", () => {
    for (const dv of offLadder) {
      const { proposedActions } = normalizeLifeResponse({
        situation: { title: "The lockup", description: "It is still shut." },
        proposedActions: [{ kind: "skill_check", skillId: "pick_lock", dv, intent: "force it" }],
      });
      const action = proposedActions[0];
      expect(action?.kind).toBe("skill_check");
      if (action?.kind !== "skill_check") throw new Error("expected a skill check");
      expect(PUBLISHED_DVS).toContain(action.dv);
      expect(action.dv).toBe(snapDv(dv));
    }
  });

  it("gives the two loops the same answer for the same proposal", () => {
    // The property that matters more than any single value: whatever the rule
    // becomes, it cannot become two rules again.
    for (const dv of [...offLadder, ...PUBLISHED_DVS]) {
      const gm = normalizeGmResponse({
        narration: "n",
        proposedActions: [{ kind: "skill_check", skillId: "s", dv, intent: "i" }],
      }).proposedActions[0];
      const life = normalizeLifeResponse({
        situation: { title: "t", description: "d" },
        proposedActions: [{ kind: "skill_check", skillId: "s", dv, intent: "i" }],
      }).proposedActions[0];
      if (gm?.kind !== "skill_check" || life?.kind !== "skill_check") {
        throw new Error("expected both to be skill checks");
      }
      expect(gm.dv).toBe(life.dv);
    }
  });
});
