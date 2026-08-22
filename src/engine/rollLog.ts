/**
 * Traceable roll records. Every engine function that rolls dice returns a
 * RollResult so the UI can display the arithmetic without redoing it.
 */

export type RollModifier = { label: string; value: number };

export type RollResult = {
  /** Human readable arithmetic, e.g. "1d10(7) + REF(6) + Athletics(4) = 17 vs DV15 → SUCCESS by 2" */
  formula: string;
  /** Every raw die face rolled, in order. */
  rolls: number[];
  modifiers: RollModifier[];
  total: number;
  dv: number | null;
  success: boolean | null;
  timestamp: string;
};

export type RollResultInput = {
  /** Dice notation for the primary roll, e.g. "1d10". */
  dice: string;
  /** The raw die faces, in order. The first one is shown inside the dice term. */
  rolls: number[];
  modifiers?: RollModifier[];
  dv?: number | null;
  /** Injectable clock so tests stay deterministic. */
  now?: () => Date;
};

function formatModifier(modifier: RollModifier): string {
  const sign = modifier.value < 0 ? "-" : "+";
  return `${sign} ${modifier.label}(${Math.abs(modifier.value)})`;
}

/** Builds a RollResult, computing the total, success and formula string. */
export function buildRollResult(input: RollResultInput): RollResult {
  const modifiers = input.modifiers ?? [];
  const base = input.rolls[0] ?? 0;
  const total = modifiers.reduce((sum, m) => sum + m.value, base);
  const dv = input.dv ?? null;
  const success = dv === null ? null : total >= dv;

  const parts = [`${input.dice}(${base})`, ...modifiers.map(formatModifier)];
  let formula = `${parts.join(" ")} = ${total}`;
  if (dv !== null) {
    const margin = Math.abs(total - dv);
    formula += ` vs DV${dv} → ${success ? "SUCCESS" : "FAILED"} by ${margin}`;
  }

  const clock = input.now ?? (() => new Date());
  return {
    formula,
    rolls: [...input.rolls],
    modifiers,
    total,
    dv,
    success,
    timestamp: clock().toISOString(),
  };
}

/** Margin of success (positive) or failure (negative). Null when there is no DV. */
export function rollMargin(result: RollResult): number | null {
  return result.dv === null ? null : result.total - result.dv;
}
