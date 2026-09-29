import { describe, expect, it } from "vitest";
import { ALL_CHECKS, isApplicable, type CheckContext, type CheckableTurn } from "../narratorChecks";

/**
 * A check that is not applicable to a scenario is not run, so it had better be
 * one that would have said nothing anyway. If a gate ever drifts from the
 * check's own early return, the eval either reports cells that measure nothing
 * or, worse, silently stops measuring one that does.
 */

/** A scenario that asks nothing special of the narrator. */
const BARE: CheckContext = {
  packet: "== PLAYER INPUT ==\nI look around.",
  optionsRequested: false,
  knownNpcKeys: [],
  withheldTruths: [],
  mustStayQuiet: false,
  riskyIntent: false,
};

/** A turn that breaks everything a check could look at. */
const BAD: CheckableTurn = {
  narration:
    "The phone rings. A knock at the door. You could try the lock; it costs 5eb and takes ten minutes. What do you do?",
  offeredOptions: ["Try the lock"],
  npcKeys: ["stranger"],
  observations: ["made_a_scene"],
  walkOns: ["dragon"],
  proposedActionCount: 0,
  checks: [{ skillId: "handgun", dv: 15, lowStakes: false }],
};

describe("check applicability", () => {
  it("runs the checks a bare scenario gives something to measure, and skips the rest", () => {
    const applicable = ALL_CHECKS.filter((c) => isApplicable(c, BARE)).map((c) => c.id);
    // The ones with no gate are the rules that hold in every turn.
    expect(applicable).toEqual(
      expect.arrayContaining([
        "no-unsourced-number",
        "names-no-way-in",
        "options-only-when-asked",
        "ends-on-the-world",
        "opens-on-something",
      ]),
    );
    expect(applicable.length).toBeLessThan(ALL_CHECKS.length);
  });

  it("a check its scenario does not apply to has nothing to say about even the worst turn", () => {
    for (const check of ALL_CHECKS) {
      if (isApplicable(check, BARE)) continue;
      expect(check.run(BAD, BARE), check.id).toEqual([]);
    }
  });

  it("a gated check turns on when its scenario asks for it", () => {
    const asks: Record<string, Partial<CheckContext>> = {
      "risk-gets-dice": { riskyIntent: true },
      "within-prose-budget": { wordBudget: 100 },
      "quiet-stays-quiet": { mustStayQuiet: true },
      "offers-the-wire": { wireJob: true },
      "goes-where-asked": { tripToKind: "bar" },
      "comes-over-on-cue": { comesOver: "Kiro Tanaka" },
    };
    for (const [id, over] of Object.entries(asks)) {
      const check = ALL_CHECKS.find((c) => c.id === id)!;
      expect(isApplicable(check, BARE), id).toBe(false);
      expect(isApplicable(check, { ...BARE, ...over }), id).toBe(true);
    }
  });
});
