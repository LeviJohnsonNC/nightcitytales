/**
 * Traceable roll records. Every engine function that rolls dice returns a
 * RollResult so the UI can display the arithmetic without redoing it.
 */

export type RollModifier = { label: string; value: number };

/**
 * Who a tie belongs to.
 *
 * A Check is "meet or beat" (CP:R pg. 130): equalling the DV succeeds. An
 * ATTACK is not — the Defender wins ties (pg. 172), so a hit has to beat the
 * DV outright. The distinction has to live here rather than only in the
 * caller, because the verdict is baked into `formula`, and a line reading
 * "MISS (… = 13 vs DV13 → SUCCESS by 0)" contradicts itself in the log.
 */
export type TieGoesTo = "roller" | "defender";

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
  /** Defaults to "roller": meeting the DV succeeds. */
  tieGoesTo?: TieGoesTo;
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
  const defenderWinsTies = input.tieGoesTo === "defender";
  const success = dv === null ? null : defenderWinsTies ? total > dv : total >= dv;

  const parts = [`${input.dice}(${base})`, ...modifiers.map(formatModifier)];
  let formula = `${parts.join(" ")} = ${total}`;
  if (dv !== null) {
    const margin = Math.abs(total - dv);
    // "FAILED by 0" would be a riddle. Say what actually happened.
    const verdict =
      total === dv && defenderWinsTies
        ? "TIED — the Defender wins ties"
        : `${success ? "SUCCESS" : "FAILED"} by ${margin}`;
    formula += ` vs DV${dv} → ${verdict}`;
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
