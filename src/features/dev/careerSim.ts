/**
 * A career, played without a table: the game's money and its climb, run
 * thousands of times through the engine's own functions.
 *
 * WHAT IT IS. The deterministic half of the loop — what a job pays and how that
 * pays out (`rollPayment`), what a job's mark on the city is worth as
 * Reputation (`reputationFrom`), what work that Reputation brings
 * (`jobTierFor`, `pickJobSeed`), what rent and the Lifestyle take
 * (`billsDue`), what Improvement Points buy (`roleRankRaiseCost`,
 * `skillRaiseCost`) — each called as the game calls it, never restated. It
 * exists to answer the questions nobody has been able to play out: how long the
 * climb takes, whether the money ever runs short, whether any road leads
 * nowhere. It is also a soak: every step checks the invariants the rest of the
 * game relies on, so a rule change that breaks one fails here, on a thousand
 * careers, rather than in somebody's fortieth day.
 *
 * WHAT IT IS NOT. A prediction. The things only a player decides — how loud a
 * job gets, how many people it leaves dead, how large an award the GM judges,
 * how often work turns up — are the PLAYSTYLES and PARAMETERS below, stated
 * out loud so a reader can disagree with them. Everything else is the engine's.
 * It plays no combat, so it says nothing about how often anybody dies, and it
 * charges no ammunition, armor repair or doctor: money out is rent and
 * Lifestyle only, which makes the surplus an upper bound, not a forecast.
 *
 * Pure apart from reading the engine: a seed in, a career out. No React, no
 * network, no clock.
 */
import {
  ROLE_OPENING_IDS,
  ROLE_RANK_MAX,
  LIFE_AWARD_EVERY_DAYS,
  DOWNTIME_MONTH_DAYS,
  billsDue,
  deedLevel,
  jobTierFor,
  missionPayout,
  reputationFrom,
  rollPayment,
  roleRankRaiseCost,
  seededRng,
  skillRaiseCost,
  snapToIpTier,
  startingLifestylePlan,
  REPUTATION_JOB_CAP,
  JOB_TIERS,
  type JobSettledEventData,
  type Observation,
  type RNG,
} from "@/engine";
import { generateJob } from "@/engine/missions/generator";
import { pickJobSeed } from "@/features/life/hookOffer";

// ---------------------------------------------------------------------------
// What a player decides. Every number here is an assumption, on purpose.
// ---------------------------------------------------------------------------

/** How a crew works a job: the mark it leaves, and the bodies. */
export type Playstyle = {
  id: string;
  label: string;
  /** Chance a job is worked clean — nobody can place the character there. */
  clean: number;
  /** Given it was not clean: the chance of each thing the city notices. */
  seen: number;
  named: number;
  witness: number;
  loud: number;
  property: number;
  /** Given it was not clean: the share of the opposition left dead. */
  killRate: number;
};

export const PLAYSTYLES: Playstyle[] = [
  {
    id: "ghost",
    label: "Ghost — works clean when it can",
    clean: 0.8,
    seen: 0.2,
    named: 0.05,
    witness: 0.2,
    loud: 0.1,
    property: 0.05,
    killRate: 0.05,
  },
  {
    id: "pro",
    label: "Professional — some noise, few bodies",
    clean: 0.3,
    seen: 0.5,
    named: 0.15,
    witness: 0.4,
    loud: 0.4,
    property: 0.2,
    killRate: 0.35,
  },
  {
    id: "brawler",
    label: "Brawler — loud, and leaves them behind",
    clean: 0,
    seen: 0.8,
    named: 0.3,
    witness: 0.6,
    loud: 0.9,
    property: 0.5,
    killRate: 0.85,
  },
];

/** What a stretch of life is worth when the GM judges it, as printed tiers. */
const JOB_AWARD: [number, number][] = [
  [20, 0.2],
  [30, 0.35],
  [40, 0.3],
  [50, 0.15],
];
const LIFE_AWARD: [number, number][] = [
  [10, 0.4],
  [20, 0.4],
  [30, 0.2],
];

export type SpendPolicy = "rank" | "skills";

export type CareerParams = {
  seed: number;
  roleId: string;
  playstyle: Playstyle;
  /** A job turns up this often, in days. The roadmap's "one night in six" is 6. */
  daysBetweenJobs: number;
  /** Days simulated. */
  horizon: number;
  /** Eurobucks on day one, left over from creation. */
  startingEb: number;
  /** What I.P. is spent on first. */
  spend: SpendPolicy;
};

/** Six focus Skills, each starting where a character's best ones do. */
const FOCUS_SKILLS = 6;
const FOCUS_START_LEVEL = 4;
/** The Role Ability Rank every character starts on. */
const START_RANK = 4;
/** A doubleCost Skill, for pricing; `concentration` is an ordinary one. */
const SKILL_FOR_PRICING = "concentration";

// ---------------------------------------------------------------------------
// The result of one career.
// ---------------------------------------------------------------------------

export type CareerDay = {
  day: number;
  eurobucks: number;
  reputation: number;
  tier: number;
  jobs: number;
  rank: number;
  skillLevels: number;
  /** Months of rent and Lifestyle owed and not yet paid. */
  monthsBehind: number;
};

export type Career = {
  params: CareerParams;
  /** One row at the end of every day. */
  days: CareerDay[];
  /** The first day each thing happened, or null if it never did. */
  first: {
    reputation3: number | null;
    steady: number | null;
    serious: number | null;
    rank5: number | null;
    skillRaise: number | null;
    behind: number | null;
  };
  /** Every fee the career was offered, by tier index, for the report. */
  fees: number[][];
  receipts: JobSettledEventData[];
  /** Everything the soak found wrong. Empty is the point. */
  violations: string[];
};

// ---------------------------------------------------------------------------

function pickWeighted(table: [number, number][], rng: RNG): number {
  const roll = rng();
  let acc = 0;
  for (const [value, weight] of table) {
    acc += weight;
    if (roll < acc) return value;
  }
  return table[table.length - 1]![0];
}

/** What the city noticed about one job, from how the crew worked it. */
function noticedFor(
  style: Playstyle,
  opposition: number,
  rng: RNG,
): Partial<Record<Observation, number>> {
  if (rng() < style.clean) return { clean: 1 };
  const out: Partial<Record<Observation, number>> = {};
  if (rng() < style.seen) out.seen = 1;
  if (rng() < style.named) out.named = 1;
  if (rng() < style.witness) out.witness = 1;
  if (rng() < style.loud) out.loud = 1;
  if (rng() < style.property) out.property = 1;
  let bodies = 0;
  for (let i = 0; i < opposition; i += 1) if (rng() < style.killRate) bodies += 1;
  if (bodies > 0) out.killed = bodies;
  return out;
}

/** Play one career. */
export function playCareer(params: CareerParams): Career {
  const rng = seededRng(params.seed);
  const violations: string[] = [];
  const check = (ok: boolean, what: string, day: number) => {
    if (!ok && violations.length < 20) violations.push(`day ${day}: ${what}`);
  };

  const plan = startingLifestylePlan(params.roleId);
  let eurobucks = params.startingEb;
  let paidThrough = plan.firstMonthFree ? DOWNTIME_MONTH_DAYS : 0;
  let ip = 0;
  let lastAwardDay = 0;
  let rank = START_RANK;
  const levels = Array.from({ length: FOCUS_SKILLS }, () => FOCUS_START_LEVEL);
  const receipts: JobSettledEventData[] = [];
  const fees: number[][] = JOB_TIERS.map(() => []);
  const days: CareerDay[] = [];
  const first: Career["first"] = {
    reputation3: null,
    steady: null,
    serious: null,
    rank5: null,
    skillRaise: null,
    behind: null,
  };

  let reputation = 0;
  let tierIndex = 0;
  let skillLevelsBought = 0;
  let nextJobDay = params.daysBetweenJobs;

  /**
   * Spend what is banked, by the policy. Both policies SAVE rather than spend
   * on the other thing: a character who buys every Skill Level on the way never
   * reaches the Rank, which cost 300 against a Level's 100, and one who saves
   * for the Rank never raises a Skill — the two ends of what a player chooses.
   */
  const spendIp = (day: number) => {
    for (let guard = 0; guard < 200; guard += 1) {
      const weakest = levels.indexOf(Math.min(...levels));
      const rankCost = rank < ROLE_RANK_MAX ? roleRankRaiseCost(rank + 1) : Infinity;
      const skillCost =
        levels[weakest]! < 10 ? skillRaiseCost(SKILL_FOR_PRICING, levels[weakest]! + 1) : Infinity;
      // The one thing the policy is saving for; the other only once that is done.
      const wants =
        params.spend === "rank"
          ? Number.isFinite(rankCost)
            ? "rank"
            : "skill"
          : Number.isFinite(skillCost)
            ? "skill"
            : "rank";
      const cost = wants === "rank" ? rankCost : skillCost;
      if (!Number.isFinite(cost) || cost > ip) return;
      ip -= cost;
      check(ip >= 0, "I.P. went negative", day);
      if (wants === "rank") {
        rank += 1;
        if (rank >= 5 && first.rank5 === null) first.rank5 = day;
      } else {
        levels[weakest] = levels[weakest]! + 1;
        skillLevelsBought += 1;
        if (first.skillRaise === null) first.skillRaise = day;
      }
    }
  };

  for (let day = 1; day <= params.horizon; day += 1) {
    // --- a job turns up --------------------------------------------------
    if (day >= nextJobDay) {
      nextJobDay = day + params.daysBetweenJobs;
      const standing = jobTierFor({
        reputation,
        jobsFinished: receipts.length,
        fixerDisposition: null,
      });
      const tier = standing.tier;
      const seed = pickJobSeed(new Set(), rng, { tier, hostile: new Set() });
      const mission = generateJob(seed);
      const payout = missionPayout(mission);
      const agreed = payout?.total ?? 0;
      check(agreed >= 0 && Number.isFinite(agreed), `a job offered ${agreed}eb`, day);
      fees[JOB_TIERS.indexOf(tier)]!.push(agreed);

      const opposition = mission.force?.members.length ?? 0;
      const noticed = noticedFor(params.playstyle, opposition, rng);
      const messy = !noticed.clean && !!noticed.loud;
      const paid = rollPayment({ agreed, messy, rng });
      check(paid.paid <= paid.agreed, `paid ${paid.paid} of ${paid.agreed} agreed`, day);
      check(paid.paid >= 0, "a negative payment", day);
      eurobucks += paid.paid;

      const receipt: JobSettledEventData = { noticed, agreed };
      check(deedLevel(receipt) <= REPUTATION_JOB_CAP, "a deed above the job cap", day);
      receipts.push(receipt);
      const before = reputation;
      reputation = reputationFrom(receipts).level;
      check(reputation >= before, "Reputation went down", day);

      ip += snapToIpTier(pickWeighted(JOB_AWARD, rng));
      lastAwardDay = day;
      spendIp(day);
    } else if (day - lastAwardDay >= LIFE_AWARD_EVERY_DAYS) {
      // A week of life with no award is judged on its own, as the game does.
      ip += snapToIpTier(pickWeighted(LIFE_AWARD, rng));
      lastAwardDay = day;
      spendIp(day);
    }

    // --- the work it brings ------------------------------------------------
    const nowTier = jobTierFor({
      reputation,
      jobsFinished: receipts.length,
      fixerDisposition: null,
    });
    const nowIndex = JOB_TIERS.indexOf(nowTier.tier);
    check(nowIndex >= tierIndex, "the work on offer got worse", day);
    tierIndex = Math.max(tierIndex, nowIndex);
    if (reputation >= 3 && first.reputation3 === null) first.reputation3 = day;
    if (tierIndex >= 1 && first.steady === null) first.steady = day;
    if (tierIndex >= 2 && first.serious === null) first.serious = day;

    // --- the bills ---------------------------------------------------------
    let due = billsDue({
      day,
      paidThroughDay: paidThrough,
      rent: plan.rent,
      lifestyleCost: plan.lifestyleCost,
    });
    check(due.months >= 0 && due.total >= 0, "negative bills", day);
    if (due.months > 0 && eurobucks >= due.total) {
      eurobucks -= due.total;
      paidThrough = due.paidThroughDay;
      due = billsDue({
        day,
        paidThroughDay: paidThrough,
        rent: plan.rent,
        lifestyleCost: plan.lifestyleCost,
      });
    }
    if (due.months > 0 && first.behind === null) first.behind = day;

    check(Number.isFinite(eurobucks), "money is not a number", day);
    check(rank >= START_RANK && rank <= ROLE_RANK_MAX, `Rank ${rank} out of range`, day);
    check(
      reputation >= 0 && reputation <= REPUTATION_JOB_CAP,
      `Reputation ${reputation} out of range`,
      day,
    );
    days.push({
      day,
      eurobucks,
      reputation,
      tier: tierIndex,
      jobs: receipts.length,
      rank,
      skillLevels: skillLevelsBought,
      monthsBehind: due.months,
    });
  }

  return { params, days, first, fees, receipts, violations };
}

/** A role for career number `n`, so a sweep covers every Role evenly. */
export function roleFor(n: number): string {
  return ROLE_OPENING_IDS[n % ROLE_OPENING_IDS.length]!;
}

// ---------------------------------------------------------------------------
// Reading a sweep.
// ---------------------------------------------------------------------------

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export type SweepRow = {
  playstyle: string;
  daysBetweenJobs: number;
  startingEb: number;
  spend: SpendPolicy;
  careers: number;
  violations: number;
  /** Median day, over the careers that got there; `reached` is the share that did. */
  steady: { median: number | null; reached: number };
  serious: { median: number | null; reached: number };
  rank5: { median: number | null; reached: number };
  skillRaise: { median: number | null; reached: number };
  /** Share of careers that were ever behind on rent. */
  everBehind: number;
  /** Median eurobucks at the end, and at the end of the first third. */
  endEb: number | null;
  midEb: number | null;
  /** Median Reputation, jobs and skill levels bought at the end. */
  endReputation: number | null;
  endJobs: number | null;
  endSkillLevels: number | null;
  /** Median Role Ability Rank at the end. */
  endRank: number | null;
};

function reach(values: (number | null)[]): { median: number | null; reached: number } {
  const got = values.filter((v): v is number => v !== null);
  return { median: median(got), reached: values.length ? got.length / values.length : 0 };
}

/** Play `careers` careers under one set of choices, and summarise them. */
export function sweep(input: {
  playstyle: Playstyle;
  daysBetweenJobs: number;
  startingEb: number;
  spend: SpendPolicy;
  careers: number;
  horizon: number;
  seed?: number;
}): { row: SweepRow; careers: Career[] } {
  const careers: Career[] = [];
  for (let n = 0; n < input.careers; n += 1) {
    careers.push(
      playCareer({
        seed: (input.seed ?? 1) * 100003 + n,
        roleId: roleFor(n),
        playstyle: input.playstyle,
        daysBetweenJobs: input.daysBetweenJobs,
        horizon: input.horizon,
        startingEb: input.startingEb,
        spend: input.spend,
      }),
    );
  }
  const last = (c: Career) => c.days[c.days.length - 1]!;
  const mid = (c: Career) => c.days[Math.floor(c.days.length / 3)]!;
  const row: SweepRow = {
    playstyle: input.playstyle.id,
    daysBetweenJobs: input.daysBetweenJobs,
    startingEb: input.startingEb,
    spend: input.spend,
    careers: careers.length,
    violations: careers.reduce((sum, c) => sum + c.violations.length, 0),
    steady: reach(careers.map((c) => c.first.steady)),
    serious: reach(careers.map((c) => c.first.serious)),
    rank5: reach(careers.map((c) => c.first.rank5)),
    skillRaise: reach(careers.map((c) => c.first.skillRaise)),
    everBehind: careers.filter((c) => c.first.behind !== null).length / careers.length,
    endEb: median(careers.map((c) => last(c).eurobucks)),
    midEb: median(careers.map((c) => mid(c).eurobucks)),
    endReputation: median(careers.map((c) => last(c).reputation)),
    endJobs: median(careers.map((c) => last(c).jobs)),
    endSkillLevels: median(careers.map((c) => last(c).skillLevels)),
    endRank: median(careers.map((c) => last(c).rank)),
  };
  return { row, careers };
}
