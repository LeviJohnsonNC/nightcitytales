/**
 * The final validation gate. Every check delegates to the same step validators
 * the wizard already uses, so nothing can pass here that failed earlier.
 */
import type { ChargenState } from "./store";
import { stepsFor, type ChargenStep } from "./steps";
import { validateStep } from "./validation";

export type GateCheck = {
  step: ChargenStep;
  title: string;
  passed: boolean;
  violations: string[];
};

export function finalChecklist(state: ChargenState): GateCheck[] {
  const checks: GateCheck[] = stepsFor(state.method)
    .filter((s) => s.id !== "review")
    .map((s) => {
    const { violations } = validateStep(s.id, state);
    return { step: s.id, title: s.title, passed: violations.length === 0, violations };
  });

  const identity: string[] = [];
  if (!state.name.trim()) identity.push("Your character has no name.");
  const identityCheck = checks.find((c) => c.step === "identity");
  if (identityCheck && identity.length > 0) {
    identityCheck.violations = [...identityCheck.violations, ...identity];
    identityCheck.passed = false;
  }

  return checks;
}

export function gatePassed(checks: GateCheck[]): boolean {
  return checks.every((c) => c.passed);
}
