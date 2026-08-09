/**
 * Step validation. Every rule check delegates to /src/engine — this module
 * only decides which validator applies to which step and phrases the result.
 */
import {
  STAT_ORDER,
  validateCompletePackageSkills,
  validateCompletePackageStats,
  validateEdgerunnerSkills,
} from "@/engine";
import { generalLifepathComplete, readGeneralLifepath } from "./lifepathState";
import type { ChargenState } from "./store";
import { CHARGEN_STEPS, type ChargenStep } from "./steps";

export type StepStatus = "locked" | "in progress" | "valid" | "has errors";

export type StepValidation = {
  /** Plain-language rule violations. Empty means the step is satisfied. */
  violations: string[];
  /** True when the step has no player input yet. */
  untouched: boolean;
};

function statsAssigned(state: ChargenState): boolean {
  return STAT_ORDER.every((stat) => typeof state.stats[stat] === "number");
}

export function validateStep(step: ChargenStep, state: ChargenState): StepValidation {
  switch (step) {
    case "method":
      return state.method
        ? { violations: [], untouched: false }
        : { violations: ["No creation method chosen yet."], untouched: true };

    case "role":
      return state.roleId
        ? { violations: [], untouched: false }
        : { violations: ["No Role chosen yet."], untouched: true };

    case "lifepath": {
      const general = readGeneralLifepath(state.lifepath.general);
      const untouched = Object.keys(general.entries).length === 0;
      if (untouched) return { violations: ["No Lifepath tables answered yet."], untouched };
      return { violations: generalLifepathComplete(general), untouched };
    }

    case "stats": {
      if (state.method === "complete_package") {
        const result = validateCompletePackageStats(state.stats);
        const untouched = Object.keys(state.stats).length === 0;
        return { violations: untouched ? ["No STATs allocated yet."] : result.violations, untouched };
      }
      return statsAssigned(state)
        ? { violations: [], untouched: false }
        : { violations: ["STATs have not been rolled yet."], untouched: true };
    }

    case "derived": {
      return statsAssigned(state)
        ? { violations: [], untouched: false }
        : { violations: ["Derived STATs need a complete STAT block first."], untouched: true };
    }

    case "skills": {
      const untouched = Object.keys(state.skills).length === 0;
      if (untouched) return { violations: ["No Skill Points allocated yet."], untouched };
      if (state.method === "complete_package") {
        return { violations: validateCompletePackageSkills(state.skills).violations, untouched };
      }
      if (state.method === "edgerunner" && state.roleId) {
        return {
          violations: validateEdgerunnerSkills(state.roleId, state.skills).violations,
          untouched,
        };
      }
      return { violations: [], untouched };
    }

    case "identity":
      return state.name.trim()
        ? { violations: [], untouched: false }
        : { violations: ["Your character has no name yet."], untouched: true };

    case "review": {
      const violations = CHARGEN_STEPS.filter((s) => s.id !== "review").flatMap((s) =>
        validateStep(s.id, state).violations,
      );
      return { violations, untouched: false };
    }

    // Steps whose content lands in a later pass validate as soon as they are opened.
    default:
      return { violations: [], untouched: !state.visited.includes(step) };
  }
}

export function stepStatus(step: ChargenStep, state: ChargenState): StepStatus {
  const index = CHARGEN_STEPS.findIndex((s) => s.id === step);
  const blocked = CHARGEN_STEPS.slice(0, index).some(
    (s) => validateStep(s.id, state).violations.length > 0,
  );
  if (blocked && state.step !== step) return "locked";

  const { violations, untouched } = validateStep(step, state);
  if (violations.length > 0) return untouched ? "in progress" : "has errors";
  return "valid";
}

export function stepStatuses(state: ChargenState): Record<ChargenStep, StepStatus> {
  const out = {} as Record<ChargenStep, StepStatus>;
  for (const s of CHARGEN_STEPS) out[s.id] = stepStatus(s.id, state);
  return out;
}