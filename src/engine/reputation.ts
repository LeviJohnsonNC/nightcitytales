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
import { defaultRng, rollDie } from "./dice";
import { readJobSettledEventData, type JobSettledEventData } from "./ledger";
import { resolveOpposedCheck, type OpposedCheckResult } from "./opposedCheck";
import type { SkillCheckModifier } from "./skillCheck";
import type { RNG } from "./types";
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

/** Reputation from ledger rows: every `job_settled` receipt, read and scored. */
export function reputationFromLedger(
  events: { type: string; data: unknown }[],
): ReputationStanding {
  return reputationFrom(
    events
      .filter((e) => e.type === "job_settled")
      .map((e) => readJobSettledEventData(e.data))
      .filter((job): job is JobSettledEventData => job !== null),
  );
}

// ---------------------------------------------------------------------------
// Reputation's two printed uses at the table. Both are dice the engine rolls.
// ---------------------------------------------------------------------------

export type RecognitionRoll = { reputation: number; roll: number; heardOf: boolean };

/**
 * Has somebody meeting the character for the first time heard of them?
 *
 * As printed (p.193): they roll 1d10, and have heard of the character when the
 * roll comes in UNDER the Reputation Level. Reputation 0 is never recognised,
 * and is not rolled for.
 */
export function recognitionRoll(reputation: number, rng: RNG = defaultRng): RecognitionRoll {
  const level = Math.max(0, Math.trunc(reputation));
  if (level === 0) return { reputation: 0, roll: 0, heardOf: false };
  const roll = rollDie(10, rng);
  return { reputation: level, roll, heardOf: roll < level };
}

/** The pending-check id a Facedown travels under. It is not a Skill. */
export const FACEDOWN_CHECK_ID = "facedown";

export type FacedownInput = {
  actorName: string;
  actorCool: number;
  actorReputation: number;
  /** Luck and wounds: they ride on any Action, and a Facedown is one. */
  actorModifiers?: SkillCheckModifier[];
  opponentName: string;
  opponentCool: number;
  opponentReputation: number;
};

/**
 * A Facedown: both sides roll COOL + Reputation + 1d10 and the loser backs
 * down. Resolved by the same opposed-check rules as any contest — the actor
 * must exceed, ties go where the rules data says, each side takes its own
 * criticals — with Reputation standing where a Skill would.
 */
export function facedown(input: FacedownInput, rng: RNG = defaultRng): OpposedCheckResult {
  return resolveOpposedCheck(
    {
      name: input.actorName,
      statLabel: "COOL",
      statValue: input.actorCool,
      skillLabel: "Reputation",
      skillValue: Math.max(0, Math.trunc(input.actorReputation)),
      ...(input.actorModifiers ? { modifiers: input.actorModifiers } : {}),
    },
    {
      name: input.opponentName,
      statLabel: "COOL",
      statValue: input.opponentCool,
      skillLabel: "Reputation",
      skillValue: Math.max(0, Math.trunc(input.opponentReputation)),
    },
    rng,
  );
}

export type ClimbChange = {
  /** What the latest job was worth as a deed; 0 for a clean job. */
  deed: number;
  before: ReputationStanding;
  after: ReputationStanding;
  tierBefore: JobTier;
  tierAfter: JobTier;
};

/**
 * What the latest settled job did to the character's name and the work they
 * are offered, against where they stood before it.
 *
 * `jobsFinished` counts the latest job. The fixer's disposition is today's on
 * both sides, so a change of tier here is always the job's doing and never a
 * fixer warming up between screens. Null when nothing has settled.
 */
export function climbFromLastJob(input: {
  jobs: JobSettledEventData[];
  jobsFinished: number;
  fixerDisposition: number | null;
}): ClimbChange | null {
  const last = input.jobs.at(-1);
  if (!last) return null;
  const before = reputationFrom(input.jobs.slice(0, -1));
  const after = reputationFrom(input.jobs);
  const tier = (reputation: number, jobsFinished: number) =>
    jobTierFor({ reputation, jobsFinished, fixerDisposition: input.fixerDisposition }).tier;
  return {
    deed: deedLevel(last),
    before,
    after,
    tierBefore: tier(before.level, Math.max(0, input.jobsFinished - 1)),
    tierAfter: tier(after.level, input.jobsFinished),
  };
}
