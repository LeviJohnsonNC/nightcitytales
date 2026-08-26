/**
 * Getting paid, which is not the same as being owed.
 *
 * Settlement handed over the agreed fee and never once did anything else. A fee
 * that always arrives in full is not a fee, it is a score readout — and the one
 * thing every fixer story turns on is that the money is the last place the job
 * can still go wrong.
 *
 * So payment is a die, weighted hard toward being paid: four faces in six are
 * the money arriving exactly as agreed, because a world where you cannot trust
 * a payout is one where nobody would take work. The other two are the ways it
 * goes wrong that leave a mark on somebody's standing rather than just a
 * smaller number.
 *
 * Pure. The table and the arithmetic; who rolls it and what it writes belong to
 * the caller.
 */
import { defaultRng } from "./dice";
import { rollOracle, type OracleResult, type OracleTable } from "./oracle";
import type { RNG } from "./types";

export const PAYMENT: OracleTable = {
  id: "payment",
  label: "The money",
  die: 6,
  visibility: "open",
  entries: [
    { from: 1, to: 4, key: "paid", text: "Paid, in full, on time." },
    {
      from: 5,
      to: 5,
      key: "short",
      text: "The fee is short, and the broker has an explanation ready.",
    },
    {
      from: 6,
      to: 6,
      key: "dirty",
      text: "The money is marked, or hot, or in a currency that costs to move.",
    },
  ],
};

/** What a short payment actually withholds. */
export const SHORT_FRACTION = 0.4;
/** What laundering marked money costs to make spendable. */
export const DIRTY_FRACTION = 0.25;

/** A job that went badly is a job the broker is readier to shave. */
export const PAYMENT_BAD_JOB_PENALTY = 1;

export type PaymentOutcome = {
  key: string;
  text: string;
  /** What was agreed. */
  agreed: number;
  /** What actually reaches the character. */
  paid: number;
  /** The difference, as a positive number. */
  withheld: number;
  /** What this does to the broker's standing, when it does anything. */
  brokerStanding: number;
  roll: OracleResult;
};

export type PaymentInput = {
  agreed: number;
  /**
   * True when the job itself went badly — objectives failed, the place left
   * loud. A broker with a reason to argue is likelier to find one.
   */
  messy?: boolean;
  rng?: RNG;
};

/**
 * Roll for the money.
 *
 * A short payment is the broker's decision and costs THEM standing: they are
 * the one who did it, and the character now knows. Marked money costs nothing
 * in standing — nobody chose it, it is just what the job paid in — but it costs
 * to move, which is the same hole in the pocket by a different route.
 */
export function rollPayment(input: PaymentInput): PaymentOutcome {
  const agreed = Math.max(0, Math.round(input.agreed));
  const roll = rollOracle(PAYMENT, input.rng ?? defaultRng, {
    modifiers: input.messy ? [{ label: "Job went badly", value: PAYMENT_BAD_JOB_PENALTY }] : [],
  });

  let paid = agreed;
  let brokerStanding = 0;
  if (roll.key === "short") {
    paid = Math.round(agreed * (1 - SHORT_FRACTION));
    brokerStanding = -2;
  } else if (roll.key === "dirty") {
    paid = Math.round(agreed * (1 - DIRTY_FRACTION));
  }

  return {
    key: roll.key,
    text: roll.text,
    agreed,
    paid,
    withheld: agreed - paid,
    brokerStanding,
    roll,
  };
}

/** "1,250eb agreed, 750eb paid — the fee is short…" for the ledger. */
export function describePayment(outcome: PaymentOutcome): string {
  if (outcome.withheld === 0) return `${outcome.paid}eb paid in full.`;
  return `${outcome.paid}eb of ${outcome.agreed}eb — ${outcome.text}`;
}
