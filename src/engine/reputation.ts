/**
 * Reputation, and the work it brings.
 *
 * Cyberpunk RED's Reputation (p.193) is a ladder of who has heard of you, from
 * "anyone who was there" to "a worldwide name". The book has the GM award a
 * Level for a notable deed, a new deed replacing the old only when it is
 * higher. Here the engine makes that award from what a job actually left behind
 * in its settlement — who saw, how loud, how many bodies, how big the fee —
 * using a small house-rule table (`reputation-deeds.json`). The model is never
 * asked whether the character is famous.
 *
 * A clean job earns nothing. Getting away without a trace is the one thing that
 * takes pressure off, and it is also what keeps your name out of the story.
 * Heat and fame are the same thing seen from two sides, and that trade is the
 * point of the track.
 *
 * Reputation then decides the work: `job-tiers.json` says what a crew of a given
 * Reputation and record gets offered, and a better-paid tier is also a more
 * dangerous one. A job's tier is enforced by which seed is drawn, never by
 * editing a job, so a stored job id still names the same job.
 *
 * Pure: settlement receipts in, numbers out.
 */
import deedData from "@/data/rules/reputation-deeds.json";
import tierData from "@/data/rules/job-tiers.json";
import type { Observation } from "./clocks";
import type { JobSettledEventData } from "./ledger";
import type { Mission } from "./mission";
import { REPUTATION } from "./rulesData";

type FeeStep = { atLeast: number; adds: number };

const DEEDS = deedData as unknown as {
  base: number;
  seenBy: Observation[];
  seenByCap: number;
  loud: number;
  bodies: { atLeast: number; adds: number };
  fee: FeeStep[];
  jobCap: number;
};

export type JobTier = {
  id: string;
  name: string;
  minReputation: number;
  minJobsFinished: number;
  perHead: number[];
  forceSizes: string[];
};

const TIERS = tierData as unknown as { coldBelow: number; tiers: JobTier[] };

export const JOB_TIERS: JobTier[] = TIERS.tiers;
/** The highest Level a job alone can earn; above it is news, which nothing writes yet. */
export const REPUTATION_JOB_CAP: number = DEEDS.jobCap;

/** What one settled job was worth, as a Reputation Level. 0 means no deed. */
export function deedLevel(job: JobSettledEventData): number {
  if ((job.noticed.clean ?? 0) > 0) return 0;
  const seenBy = DEEDS.seenBy.filter((o) => (job.noticed[o] ?? 0) > 0).length;
  const loud = (job.noticed.loud ?? 0) > 0 ? DEEDS.loud : 0;
  const bodies = (job.noticed.killed ?? 0) >= DEEDS.bodies.atLeast ? DEEDS.bodies.adds : 0;
  const fee = DEEDS.fee.reduce((best, step) => (job.agreed >= step.atLeast ? step.adds : best), 0);
  const level = DEEDS.base + Math.min(seenBy, DEEDS.seenByCap) + loud + bodies + fee;
  return Math.max(0, Math.min(DEEDS.jobCap, level));
}

export type ReputationStanding = {
  /** The highest deed earned; 0 when nobody has heard of them. */
  level: number;
  /** The printed line for that Level: who knows. Null at 0. */
  whoKnows: string | null;
  /** How many settled jobs counted as deeds. */
  deeds: number;
};

/** Reputation is the best deed so far. It never goes down. */
export function reputationFrom(jobs: JobSettledEventData[]): ReputationStanding {
  let level = REPUTATION.startingValue;
  let deeds = 0;
  for (const job of jobs) {
    const deed = deedLevel(job);
    if (deed > 0) deeds += 1;
    level = Math.max(level, deed);
  }
  return {
    level,
    whoKnows: REPUTATION.levels.find((l) => l.level === level)?.whoKnows ?? null,
    deeds,
  };
}

export type TierStanding = {
  tier: JobTier;
  /** The tier above, or null at the top. */
  next: JobTier | null;
  /** True when a cold fixer is holding the character a tier below what they earned. */
  heldBack: boolean;
};

/**
 * The work a crew is offered: the highest tier both requirements reach, one
 * lower if their fixer has gone cold on them.
 */
export function jobTierFor(input: {
  reputation: number;
  jobsFinished: number;
  fixerDisposition: number | null;
}): TierStanding {
  let index = 0;
  JOB_TIERS.forEach((tier, i) => {
    if (input.reputation >= tier.minReputation && input.jobsFinished >= tier.minJobsFinished) {
      index = i;
    }
  });
  const earned = index;
  if (input.fixerDisposition !== null && input.fixerDisposition < TIERS.coldBelow && index > 0) {
    index -= 1;
  }
  return {
    tier: JOB_TIERS[index]!,
    next: JOB_TIERS[earned + 1] ?? null,
    heldBack: index < earned,
  };
}

/** Whether a generated job is the kind of work this tier gets. */
export function missionFitsTier(mission: Mission, tier: JobTier): boolean {
  const perHead = mission.reward?.eurobucksPerHead;
  const size = mission.force?.size;
  if (perHead === undefined || size === undefined) return false;
  return tier.perHead.includes(perHead) && tier.forceSizes.includes(size);
}
