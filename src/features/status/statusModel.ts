/**
 * Where the player stands, as plain data.
 *
 * Three questions a character should be able to answer without opening a menu:
 * can I make rent, what am I close to being able to buy, and what have I
 * committed to. All three are already in the campaign's rows — this module only
 * turns them to face the decision they are supposed to produce.
 *
 * The ruling behind every line here is `PRODUCT.md`'s: money "should produce
 * decisions, not a score", and "Eurobucks that only ever go up have stopped
 * being a mechanic". So the money chip leads with the RUNWAY rather than the
 * balance, growth leads with the DISTANCE to the next thing rather than a
 * total, and the commitments list holds what the player actually took on.
 *
 * Pure and React-free, like the rest of the *Model/*Ops layer. Every number is
 * derived: nothing here is stored, so nothing here can drift out of step with
 * the rows it came from.
 */
import {
  DOWNTIME_MONTH_DAYS,
  availableSkillRaises,
  billsDue,
  type LifeClock,
  type LifeSituation,
  type MissionObjective,
  type SkillRaise,
} from "@/engine";
import {
  lifestyleRates,
  paidThroughDay,
  type LifestyleRates,
} from "@/features/downtime/downtimeModel";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";

// ---------------------------------------------------------------------------
// Money — the runway, not the balance.
// ---------------------------------------------------------------------------

/** How close the next bill is. Drives the colour, so it is named, not a number. */
export type MoneyTone = "ok" | "soon" | "due";

/** Inside a week of the next bill is the point at which it should start to nag. */
export const MONEY_WARNING_DAYS = 7;

export type MoneyStatus = {
  eurobucks: number;
  rates: LifestyleRates;
  /** What is owed right now, having already come due. */
  owed: number;
  /** Days until the next month's costs land. */
  daysToNextBill: number;
  /** Short of what is owed (or of the next month's costs) by this much. */
  short: number;
  tone: MoneyTone;
  /** The face of the chip: what the player needs to know in five words. */
  line: string;
};

export function moneyStatus(input: {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
}): MoneyStatus {
  const rates = lifestyleRates(input.character);
  const day = input.campaign.day ?? 0;
  const paidThrough = paidThroughDay(input.campaign, rates);
  const bills = billsDue({
    day,
    paidThroughDay: paidThrough,
    rent: rates.rent,
    lifestyleCost: rates.lifestyleCost,
  });
  const daysToNextBill = Math.max(0, paidThrough + DOWNTIME_MONTH_DAYS - day);
  const eurobucks = input.vitals.eurobucks;

  // A character nobody charges has no runway to show, and inventing one would
  // be inventing a pressure the rules do not put on them.
  if (rates.perMonth <= 0) {
    return {
      eurobucks,
      rates,
      owed: 0,
      daysToNextBill,
      short: 0,
      tone: "ok",
      line: `€$${eurobucks.toLocaleString()}`,
    };
  }

  const owed = bills.total;
  const tone: MoneyTone = owed > 0 ? "due" : daysToNextBill <= MONEY_WARNING_DAYS ? "soon" : "ok";
  // What they are short by is measured against whatever is actually coming: the
  // overdue bill if one has landed, otherwise next month's.
  const target = owed > 0 ? owed : rates.perMonth;
  const short = Math.max(0, target - eurobucks);

  const line =
    owed > 0
      ? `€$${eurobucks.toLocaleString()} · €$${owed.toLocaleString()} owed`
      : `€$${eurobucks.toLocaleString()} · rent in ${daysToNextBill}d`;

  return { eurobucks, rates, owed, daysToNextBill, short, tone, line };
}

// ---------------------------------------------------------------------------
// Growth — the distance to the next thing, not a total.
// ---------------------------------------------------------------------------

export type GrowthStatus = {
  ip: number;
  /** The cheapest raise that is not already at the ceiling, or null if none is. */
  next: SkillRaise | null;
  /** I.P. still needed for it. Zero when it can be bought right now. */
  gap: number;
  ready: boolean;
  line: string;
};

export function growthStatus(input: {
  character: FullCharacter;
  improvementPoints: number;
}): GrowthStatus {
  const ip = input.improvementPoints;
  const skills = input.character.skills.map((s) => ({
    skillId: s.skill_id,
    level: s.level,
    specialization: s.specialization,
  }));
  // Sorted cheapest-first with maxed lines last, so the first raisable line IS
  // the cheapest thing this character could buy next.
  const next =
    availableSkillRaises(skills, ip, input.character.finance?.home_district_key ?? null).find(
      (raise) => !raise.atMax,
    ) ?? null;

  if (!next) return { ip, next: null, gap: 0, ready: false, line: `${ip} IP` };

  const gap = Math.max(0, next.cost - ip);
  const label = `${next.skillName} ${next.currentLevel}→${next.nextLevel}`;
  return {
    ip,
    next,
    gap,
    ready: gap === 0,
    line: gap === 0 ? `${ip} IP · ${label} ready` : `${ip} IP · ${gap} more for ${label}`,
  };
}

// ---------------------------------------------------------------------------
// Commitments — what the player took on, and nothing else.
// ---------------------------------------------------------------------------

/**
 * The line PRODUCT.md draws, enforced here rather than left to the renderer.
 *
 * "Anything that measures how interesting a place is will always find
 * something, and then every pin is lit and this is a quest board with a skin on
 * it." A commitment is something the player CAUSED — a job they took, a person
 * they owe, a bill that is theirs, a clock they started. A lead the world is
 * dangling is not one, however urgent it looks, which is why `opportunity` and
 * `hook` are deliberately absent from this list.
 */
export const COMMITTED_CATEGORIES = ["need", "people", "pressure"] as const;

export type CommitmentKind = (typeof COMMITTED_CATEGORIES)[number] | "job" | "clock";

export type Commitment = {
  key: string;
  kind: CommitmentKind;
  title: string;
  detail: string | null;
  /** Days until it comes due, when it has a due day. Negative means overdue. */
  dueInDays: number | null;
  /** 1 (idle interest) .. 5 (someone is at the door). */
  severity: number;
  status: "active" | "done" | "failed";
  /** A clock's fill, so the row can draw the dial rather than print a fraction. */
  meter?: { filled: number; segments: number };
  /**
   * True for the situation this turn is actually about.
   *
   * The list it replaced marked this, and it earns its place: without it the
   * thing the narrator just put in front of the player sits in the list looking
   * exactly like the four things that are merely true.
   */
  current?: boolean;
};

/** A lead the world is offering. Shown, counted separately, never a commitment. */
export type Lead = { key: string; title: string; detail: string | null; severity: number };

export type CommitmentsStatus = {
  commitments: Commitment[];
  leads: Lead[];
  open: number;
  dueToday: number;
  overdue: number;
  line: string;
};

function isCommitted(category: string): boolean {
  return (COMMITTED_CATEGORIES as readonly string[]).includes(category);
}

/** A clock's fill as a 1-5 severity, so it sorts beside everything else. */
export function clockSeverity(clock: LifeClock): number {
  if (clock.segments <= 0) return 1;
  return Math.max(1, Math.min(5, Math.ceil((5 * clock.filled) / clock.segments)));
}

export function commitmentsStatus(input: {
  day: number;
  situations: LifeSituation[];
  /** Visible clocks only — a hidden clock is one the character cannot feel coming. */
  clocks: LifeClock[];
  /** The live job's objectives, when there is a live job. */
  objectives?: MissionObjective[];
  missionTitle?: string | null;
  /** The situation this turn is about, so the list can say which one it is. */
  currentKey?: string | null;
}): CommitmentsStatus {
  const fromObjectives: Commitment[] = (input.objectives ?? []).map((objective) => ({
    key: `objective:${objective.id}`,
    kind: "job" as const,
    title: objective.text,
    detail: input.missionTitle ?? null,
    dueInDays: null,
    // A job you are standing inside outranks the rent, until the rent is late.
    severity: 4,
    status: objective.status,
  }));

  const fromSituations: Commitment[] = input.situations
    .filter((s) => s.status === "live" && isCommitted(s.category))
    .map((s) => ({
      key: `situation:${s.key}`,
      kind: s.category as CommitmentKind,
      title: s.title,
      detail: s.summary,
      dueInDays: s.dueDay === undefined ? null : s.dueDay - input.day,
      severity: s.severity,
      status: "active" as const,
      ...(s.key === input.currentKey ? { current: true } : {}),
    }));

  const fromClocks: Commitment[] = input.clocks.map((clock) => ({
    key: `clock:${clock.key}`,
    kind: "clock" as const,
    title: clock.label,
    detail: null,
    dueInDays: null,
    severity: clockSeverity(clock),
    status: "active" as const,
    meter: { filled: clock.filled, segments: clock.segments },
  }));

  const commitments = [...fromObjectives, ...fromSituations, ...fromClocks].sort(
    compareCommitments,
  );

  const leads: Lead[] = input.situations
    .filter((s) => s.status === "live" && !isCommitted(s.category))
    .sort((a, b) => b.severity - a.severity)
    .map((s) => ({ key: s.key, title: s.title, detail: s.summary, severity: s.severity }));

  const open = commitments.filter((c) => c.status === "active").length;
  const dueToday = commitments.filter((c) => c.dueInDays === 0).length;
  const overdue = commitments.filter((c) => c.dueInDays !== null && c.dueInDays < 0).length;

  return {
    commitments,
    leads,
    open,
    dueToday,
    overdue,
    line: commitmentLine(open, dueToday, overdue),
  };
}

/** Soonest due first, then loudest. Things with no due day sort after dated ones. */
function compareCommitments(a: Commitment, b: Commitment): number {
  // Closed items sink: what is left to do is the point of the list.
  const aOpen = a.status === "active" ? 0 : 1;
  const bOpen = b.status === "active" ? 0 : 1;
  if (aOpen !== bOpen) return aOpen - bOpen;
  if (a.dueInDays !== b.dueInDays) {
    if (a.dueInDays === null) return 1;
    if (b.dueInDays === null) return -1;
    return a.dueInDays - b.dueInDays;
  }
  return b.severity - a.severity;
}

function commitmentLine(open: number, dueToday: number, overdue: number): string {
  if (open === 0) return "Nothing owed";
  const plate = `${open} open`;
  if (overdue > 0) return `${plate} · ${overdue} overdue`;
  if (dueToday > 0) return `${plate} · ${dueToday} due today`;
  return plate;
}

// ---------------------------------------------------------------------------
// The whole rail, in one call.
// ---------------------------------------------------------------------------

export type StatusView = {
  money: MoneyStatus;
  growth: GrowthStatus;
  commitments: CommitmentsStatus;
};

/**
 * Everything the rail shows, derived from rows the screen already has.
 *
 * One entry point so Life and Play cannot drift into showing the player two
 * different answers to the same question.
 */
export function statusView(input: {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  situations: LifeSituation[];
  clocks: LifeClock[];
  objectives?: MissionObjective[];
  missionTitle?: string | null;
  currentKey?: string | null;
}): StatusView {
  return {
    money: moneyStatus(input),
    growth: growthStatus({
      character: input.character,
      improvementPoints: input.character.finance?.improvement_points ?? 0,
    }),
    commitments: commitmentsStatus({
      day: input.campaign.day ?? 0,
      situations: input.situations,
      clocks: input.clocks,
      ...(input.objectives ? { objectives: input.objectives } : {}),
      ...(input.missionTitle !== undefined ? { missionTitle: input.missionTitle } : {}),
      ...(input.currentKey !== undefined ? { currentKey: input.currentKey } : {}),
    }),
  };
}

/** "due in 2 days", "today", "3 days late" — a date a player can act on. */
export function dueLabel(dueInDays: number | null): string | null {
  if (dueInDays === null) return null;
  if (dueInDays < 0) return `${Math.abs(dueInDays)} ${plural(Math.abs(dueInDays))} late`;
  if (dueInDays === 0) return "due today";
  if (dueInDays === 1) return "due tomorrow";
  return `due in ${dueInDays} days`;
}

function plural(days: number): string {
  return days === 1 ? "day" : "days";
}
