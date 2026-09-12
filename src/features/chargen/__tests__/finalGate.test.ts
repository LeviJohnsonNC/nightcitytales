import { describe, expect, it } from "vitest";
import { EMPTY_LIFESTYLE, EMPTY_LOADOUT, type CreationMethod } from "@/engine";
import { finalChecklist, gatePassed } from "../finalGate";
import { stepsFor, type ChargenStep } from "../steps";
import { validateStep } from "../validation";
import type { ChargenState } from "../store";

/**
 * The save gate, and the rule AGENTS.md calls load-bearing for chargen:
 *
 *   "Step validation and the final save gate must share the validators in
 *    src/features/chargen/validation.ts; do not create a separate, weaker
 *    save path."
 *
 * It held when this was written. Nothing enforced it, which is the point — a
 * gate that quietly stops checking a step does not fail, it saves a character
 * that should not exist, and the wizard it disagrees with is the half nobody
 * looks at twice.
 *
 * So these tests are about the RELATIONSHIP between the gate and the step
 * validators rather than about any one rule. That way they hold for every
 * state, including the invalid ones, and do not need a fully built character
 * to say something true.
 */

const METHODS: CreationMethod[] = ["streetrat", "edgerunner", "complete_package"];

function draft(over: Partial<ChargenState> = {}): ChargenState {
  return {
    draftId: null,
    step: "method",
    method: null,
    roleId: null,
    roleAbility: null,
    name: "",
    handle: "",
    pronouns: "",
    selfDescription: "",
    portrait: null,
    portraitPath: null,
    portraitTakes: [],
    portraitGenerations: 0,
    stats: {},
    statRolls: { row: null, rows: {} },
    skills: [],
    lifepath: { general: {}, roleSpecific: {} },
    loadout: EMPTY_LOADOUT,
    lifestyle: EMPTY_LIFESTYLE,
    visited: ["method"],
    rollLog: [],
    background: "",
    ...over,
  };
}

describe("the final gate covers the steps the character actually walks", () => {
  it.each(METHODS)("checks every %s step except review, in order", (method) => {
    const expected = stepsFor(method)
      .map((s) => s.id)
      .filter((id) => id !== "review");

    expect(finalChecklist(draft({ method })).map((c) => c.step)).toEqual(expected);
  });

  it("reads the step list from stepsFor rather than a hardcoded sequence", () => {
    // The two method-dependent steps. A gate built from CHARGEN_STEPS instead
    // of stepsFor would check a Complete Package character's starting package
    // (which they never get) and skip their cyberware (where the Humanity rule
    // that can make a character unplayable lives).
    const completePackage = finalChecklist(draft({ method: "complete_package" })).map(
      (c) => c.step,
    );
    expect(completePackage).toContain("cyberware");
    expect(completePackage).not.toContain("package");

    for (const method of ["streetrat", "edgerunner"] as const) {
      const steps = finalChecklist(draft({ method })).map((c) => c.step);
      expect(steps).toContain("package");
      expect(steps).not.toContain("cyberware");
    }
  });
});

describe("the gate is never weaker than the step validators", () => {
  /**
   * States chosen to land violations on different steps, so the comparison
   * below is made against real disagreement rather than against empty lists.
   */
  const STATES: [string, ChargenState][] = METHODS.flatMap((method) => [
    [`${method}: untouched`, draft({ method })],
    [`${method}: named only`, draft({ method, name: "V", handle: "" })],
    [`${method}: named and handled`, draft({ method, name: "V", handle: "Vee" })],
    [`${method}: role picked`, draft({ method, roleId: "solo", name: "V", handle: "Vee" })],
  ]);

  it.each(STATES)("%s — every step violation reaches the gate", (_label, state) => {
    for (const check of finalChecklist(state)) {
      const fromValidator = validateStep(check.step, state).violations;
      // Superset, not equality: the gate may add its own (it adds a name check
      // on identity). What it may never do is drop one.
      for (const violation of fromValidator) {
        expect(check.violations, `${check.step} lost "${violation}"`).toContain(violation);
      }
    }
  });

  it.each(STATES)("%s — a step with violations is never marked passed", (_label, state) => {
    for (const check of finalChecklist(state)) {
      if (validateStep(check.step, state).violations.length > 0) {
        expect(check.passed, `${check.step} passed the gate while failing its own validator`).toBe(
          false,
        );
      }
    }
  });

  it.each(STATES)("%s — passed agrees with the check's own violation list", (_label, state) => {
    for (const check of finalChecklist(state)) {
      expect(check.passed).toBe(check.violations.length === 0);
    }
  });
});

describe("the gate agrees with the review step", () => {
  /**
   * `validateStep("review")` aggregates the same validators the gate does.
   * Two aggregations of one rule set are two things to keep in step, so this
   * asserts they have not drifted — the review step is what the wizard shows,
   * the gate is what the save button reads.
   */
  it.each(METHODS)("%s: review and the gate report the same violations", (method) => {
    const state = draft({ method, name: "V" });
    const review = validateStep("review", state).violations;
    const fromGate = finalChecklist(state).flatMap((c) => c.violations);

    for (const violation of review) {
      expect(fromGate, `the gate is missing "${violation}"`).toContain(violation);
    }
  });
});

describe("gatePassed", () => {
  it.each(METHODS)("refuses an untouched %s draft", (method) => {
    const checks = finalChecklist(draft({ method }));
    expect(gatePassed(checks)).toBe(false);
    // And says why, rather than failing silently.
    expect(checks.filter((c) => !c.passed).length).toBeGreaterThan(0);
    expect(checks.flatMap((c) => c.violations).length).toBeGreaterThan(0);
  });

  it("refuses a draft that fails exactly one step", () => {
    const checks = finalChecklist(draft({ method: "streetrat" })).map((c) => ({
      ...c,
      passed: true,
      violations: [] as string[],
    }));
    expect(gatePassed(checks)).toBe(true);

    const one = checks.map((c, i) => (i === 2 ? { ...c, passed: false, violations: ["nope"] } : c));
    expect(gatePassed(one)).toBe(false);
  });

  it("refuses a character with no name even when the step list is otherwise clean", () => {
    // The gate adds this one itself: a character with no name cannot be saved,
    // and identity is where that is reported.
    const identity = finalChecklist(draft({ method: "streetrat", handle: "Vee" })).find(
      (c) => c.step === "identity",
    );
    expect(identity?.passed).toBe(false);
    expect(identity?.violations.some((v) => v.toLowerCase().includes("name"))).toBe(true);
  });
});

describe("step validators the gate depends on", () => {
  it("identity wants both a name and a handle", () => {
    const named = validateStep("identity", draft({ name: "V" }));
    expect(named.violations).toHaveLength(1);
    expect(named.violations[0]).toContain("handle");

    const both = validateStep("identity", draft({ name: "V", handle: "Vee" }));
    expect(both.violations).toEqual([]);
  });

  it("reports an unanswered step as untouched rather than as an error", () => {
    // The wizard reads this to tell "not started" from "started and wrong", and
    // the rail locks later steps on it.
    expect(validateStep("identity", draft()).untouched).toBe(true);
    expect(validateStep("identity", draft({ name: "V" })).untouched).toBe(false);
  });

  it("has a validator for every step of every method", () => {
    // A step with no case falls through to the default, which passes as soon as
    // it has been visited — fine for a display-only step, and silent if a step
    // that needs rules ever lands there. This pins the set that has real rules.
    const withRules: ChargenStep[] = [
      "method",
      "role",
      "lifepath",
      "stats",
      "skills",
      "identity",
      "lifestyle",
      "package",
      "gear",
      "cyberware",
      "review",
    ];
    for (const method of METHODS) {
      for (const step of stepsFor(method)) {
        expect(withRules, `step "${step.id}" has no validator case`).toContain(step.id);
      }
    }
  });
});
