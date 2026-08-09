/**
 * Humanity loss from cyberware. The Streetrat and Edgerunner starting
 * cyberware packages still incur Humanity Loss, so this must be applied
 * before the final sheet is written.
 */
import { CREATION_RULES } from "./rulesData";
import { empFromHumanity } from "./derived";

const humanityRules = (CREATION_RULES as unknown as Record<string, unknown>)["humanity"] as
  { cyberpsychosisThreshold?: number; cyberpsychosisComparison?: string } | undefined;

/**
 * Null when the rules data does not define it. No value is inferred here —
 * add `humanity.cyberpsychosisThreshold` to src/data/rules/creation-rules.json
 * to turn the flag on.
 */
export const CYBERPSYCHOSIS_THRESHOLD: number | null =
  humanityRules?.cyberpsychosisThreshold ?? null;

/**
 * How `humanityCurrent` is compared against the threshold. The rules data
 * carries this alongside the threshold because the two are meaningless apart:
 * a threshold of 0 means very different things under "below" and "atOrBelow".
 */
const COMPARATORS: Record<string, (humanity: number, threshold: number) => boolean> = {
  below: (humanity, threshold) => humanity < threshold,
  atOrBelow: (humanity, threshold) => humanity <= threshold,
};

export const CYBERPSYCHOSIS_COMPARISON: string | null =
  humanityRules?.cyberpsychosisComparison ?? null;

export const MISSING_CYBERPSYCHOSIS_RULE =
  "src/data/rules/creation-rules.json → humanity.cyberpsychosisThreshold";

export const MISSING_CYBERPSYCHOSIS_COMPARISON_RULE =
  "src/data/rules/creation-rules.json → humanity.cyberpsychosisComparison" +
  ` (expected one of: ${Object.keys(COMPARATORS).join(", ")})`;

export type HumanityLossResult = {
  humanityBefore: number;
  humanityLost: number;
  /**
   * The true remaining Humanity, NOT floored at zero. Cyberpsychosis is
   * defined as dropping below the threshold, so overshoot past it has to
   * survive or the comparison could never fire. Use `humanitySheet` for
   * the value shown on a character sheet.
   */
  humanityCurrent: number;
  /** `humanityCurrent` floored at 0 — the display value. */
  humanitySheet: number;
  /** EMP derived from the remaining Humanity. Never negative. */
  emp: number;
  /**
   * True/false when the threshold and comparison are both present in the
   * rules data, null when either is not (see missingRule).
   */
  cyberpsychosisRisk: boolean | null;
  missingRule: string | null;
};

export function applyCyberwareHumanityLoss(
  currentHumanity: number,
  lossRolls: number[],
): HumanityLossResult {
  const humanityLost = lossRolls.reduce((sum, n) => sum + n, 0);
  const humanityCurrent = currentHumanity - humanityLost;
  const humanitySheet = Math.max(0, humanityCurrent);
  const threshold = CYBERPSYCHOSIS_THRESHOLD;
  const comparator =
    CYBERPSYCHOSIS_COMPARISON === null ? undefined : COMPARATORS[CYBERPSYCHOSIS_COMPARISON];

  let cyberpsychosisRisk: boolean | null = null;
  let missingRule: string | null = null;
  if (threshold === null) {
    missingRule = MISSING_CYBERPSYCHOSIS_RULE;
  } else if (comparator === undefined) {
    missingRule = MISSING_CYBERPSYCHOSIS_COMPARISON_RULE;
  } else {
    cyberpsychosisRisk = comparator(humanityCurrent, threshold);
  }

  return {
    humanityBefore: currentHumanity,
    humanityLost,
    humanityCurrent,
    humanitySheet,
    emp: Math.max(0, empFromHumanity(humanitySheet)),
    cyberpsychosisRisk,
    missingRule,
  };
}
