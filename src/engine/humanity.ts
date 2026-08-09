/**
 * Humanity loss from cyberware. The Streetrat and Edgerunner starting
 * cyberware packages still incur Humanity Loss, so this must be applied
 * before the final sheet is written.
 */
import { CREATION_RULES } from "./rulesData";
import { empFromHumanity } from "./derived";

const humanityRules = (CREATION_RULES as unknown as Record<string, unknown>)["humanity"] as
  | { cyberpsychosisThreshold?: number }
  | undefined;

/**
 * Null when the rules data does not define it. No value is inferred here —
 * add `humanity.cyberpsychosisThreshold` to src/data/rules/creation-rules.json
 * to turn the flag on.
 */
export const CYBERPSYCHOSIS_THRESHOLD: number | null =
  humanityRules?.cyberpsychosisThreshold ?? null;

export const MISSING_CYBERPSYCHOSIS_RULE =
  "src/data/rules/creation-rules.json → humanity.cyberpsychosisThreshold";

export type HumanityLossResult = {
  humanityBefore: number;
  humanityLost: number;
  humanityCurrent: number;
  /** EMP derived from the remaining Humanity. */
  emp: number;
  /**
   * True/false when the threshold is present in the rules data,
   * null when it is not (see missingRule).
   */
  cyberpsychosisRisk: boolean | null;
  missingRule: string | null;
};

export function applyCyberwareHumanityLoss(
  currentHumanity: number,
  lossRolls: number[],
): HumanityLossResult {
  const humanityLost = lossRolls.reduce((sum, n) => sum + n, 0);
  const humanityCurrent = Math.max(0, currentHumanity - humanityLost);
  const threshold = CYBERPSYCHOSIS_THRESHOLD;

  return {
    humanityBefore: currentHumanity,
    humanityLost,
    humanityCurrent,
    emp: empFromHumanity(humanityCurrent),
    cyberpsychosisRisk: threshold === null ? null : humanityCurrent <= threshold,
    missingRule: threshold === null ? MISSING_CYBERPSYCHOSIS_RULE : null,
  };
}