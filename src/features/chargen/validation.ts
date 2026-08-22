/**
 * Step validation. Every rule check delegates to /src/engine — this module
 * only decides which validator applies to which step and phrases the result.
 */
import {
  STAT_ORDER,
  budgetStates,
  deriveStats,
  loadoutHumanity,
  readLifestyle,
  unresolvedChoices,
  unresolvedVariants,
  validateCompletePackageStats,
  validateSkillEntries,
  validateLifestyle,
} from "@/engine";
import type { StatBlock } from "@/engine";
import { generalLifepathComplete, readGeneralLifepath } from "./lifepathState";
import { readRoleLifepath, roleLifepathComplete } from "./roleLifepathState";
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
      const role = readRoleLifepath(state.lifepath.roleSpecific, state.roleId);
      const untouched =
        Object.keys(general.entries).length === 0 && Object.keys(role.entries).length === 0;
      if (untouched) return { violations: ["No Lifepath tables answered yet."], untouched };
      return {
        violations: [...generalLifepathComplete(general), ...roleLifepathComplete(role)],
        untouched,
      };
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

    case "skills": {
      const untouched = state.skills.length === 0;
      if (state.method === "streetrat") {
        // Fixed package: nothing for the player to get wrong.
        return { violations: [], untouched: false };
      }
      if (untouched) return { violations: ["No Skill Points allocated yet."], untouched };
      if (state.method === "complete_package") {
        return {
          violations: validateSkillEntries({
            method: "complete_package",
            entries: state.skills,
          }).violations,
          untouched,
        };
      }
      if (state.method === "edgerunner" && state.roleId) {
        return {
          violations: validateSkillEntries({
            method: "edgerunner",
            roleId: state.roleId,
            entries: state.skills,
          }).violations,
          untouched,
        };
      }
      return { violations: [], untouched };
    }

    case "identity": {
      const violations: string[] = [];
      if (!state.name.trim()) violations.push("Your character has no name yet.");
      if (!state.handle.trim()) {
        violations.push("Your character has no handle — the street name the GM will use.");
      }
      const untouched = !state.name.trim() && !state.handle.trim();
      return { violations, untouched };
    }

    case "lifestyle": {
      const lifestyle = readLifestyle(state.lifestyle);
      const violations = validateLifestyle(lifestyle, state.roleId);
      return { violations, untouched: !lifestyle.location && violations.length > 0 };
    }

    case "gear": {
      const untouched =
        state.loadout.lines.length === 0 &&
        Object.keys(state.loadout.packageChoices).length === 0;
      const violations: string[] = [];
      if (state.method && state.method !== "complete_package" && state.roleId) {
        for (const point of unresolvedChoices(state.roleId, state.loadout.packageChoices)) {
          violations.push(`Your package offers a choice you have not made: ${point.options.join(" or ")}.`);
        }
        for (const point of unresolvedVariants(
          state.roleId,
          state.loadout.packageChoices,
          state.loadout.packageVariants ?? {},
        )) {
          violations.push(
            `Pick the specific weapon for "${point.label}": ${point.options.join(", ")}.`,
          );
        }
      }
      if (state.method) {
        for (const budget of budgetStates(state.method, state.loadout)) {
          if (budget.overspent) {
            violations.push(
              `You have overspent "${budget.label}" by ${budget.spent - budget.limit}eb.`,
            );
          }
        }
      }
      return { violations, untouched: untouched && violations.length === 0 };
    }

    case "cyberware": {
      const untouched = state.loadout.lines.every((l) => l.kind !== "cyberware");
      const violations: string[] = [];
      if (statsAssigned(state)) {
        const derived = deriveStats(state.stats as StatBlock);
        const humanity = loadoutHumanity(derived.humanityMax, state.loadout);
        if (humanity.cyberpsychosisRisk) {
          violations.push(
            `Your cyberware costs ${humanity.humanityLost} Humanity and you only have ${humanity.humanityBefore}. Below zero Humanity the character falls to cyberpsychosis and is no longer playable — remove a piece.`,
          );
        }
      }
      return { violations, untouched: untouched && violations.length === 0 };
    }

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