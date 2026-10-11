import { describe, expect, it } from "vitest";
import { checkResolvedInput, critNote } from "../checkResult";

const base = {
  skillName: "Stealth",
  formula: "DEX 7 + Stealth 4 + 1d10 (6) = 17 vs DV 15",
  critical: null,
  success: true,
  margin: 2,
  intent: "slip past the guard",
} as const;

describe("critNote", () => {
  it("says which way a critical die went, and nothing otherwise", () => {
    expect(critNote("success")).toMatch(/Critical Success.*added/);
    expect(critNote("failure")).toMatch(/Critical Failure.*subtracted/);
    expect(critNote(null)).toBe("");
  });
});

describe("checkResolvedInput", () => {
  it("states the engine's verdict and margin for a success", () => {
    const text = checkResolvedInput(base);
    expect(text).toContain("the Stealth check is RESOLVED");
    expect(text).toContain(base.formula);
    expect(text).toContain("Outcome: SUCCESS by 2.");
    expect(text).toContain('"slip past the guard"');
  });

  it("reports a failure's margin as a positive number", () => {
    const text = checkResolvedInput({ ...base, success: false, margin: -5 });
    expect(text).toContain("Outcome: FAILURE by 5.");
    expect(text).not.toContain("-5");
  });

  it("tells the narrator not to re-decide, soften, or re-propose", () => {
    const text = checkResolvedInput({ ...base, success: false, margin: -1 });
    expect(text).toMatch(/Do not re-decide it/);
    expect(text).toMatch(/do not soften a failure/);
    expect(text).toMatch(/do not propose the same check again/);
  });

  it("puts the critical note right after the formula", () => {
    const text = checkResolvedInput({ ...base, critical: "success" });
    expect(text).toContain(`${base.formula}${critNote("success")}.`);
  });

  it("carries the pre-worded extras before the closing instruction", () => {
    const text = checkResolvedInput({ ...base, extra: " The search found a keycard." });
    expect(text).toMatch(/again\. The search found a keycard\. End on a decision\.\)$/);
  });

  it("is a single parenthesised ENGINE note ending on a decision", () => {
    const text = checkResolvedInput(base);
    expect(text.startsWith("(ENGINE:")).toBe(true);
    expect(text.endsWith("End on a decision.)")).toBe(true);
  });
});
