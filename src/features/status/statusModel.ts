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
 * being a mechanic". The runway is still what this module computes — what is
 * owed, what lands next, how short of it the character is — but it reaches the
 * player as the chip's COLOUR and as the panel behind it rather than as a
 * clause on its face, which is what the face was asked to stop carrying.
 * Growth leads with the DISTANCE to the next Skill rather than a total, and
 * the commitments list holds what the player actually took on.
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
  type GoalProgress,
  type SkillRaise,
} from "@/engine";
import {
  lifestyleRates,
  paidThroughDay,
  type LifestyleRates,
} from "@/features/downtime/downtimeModel";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";

// ---------------------------------------------------------------------------
// Money — the balance on the face, the runway behind it.
// ---------------------------------------------------------------------------

/** How close the next bill is. Drives the colour, so it is named, not a number. */
export type MoneyTone = "ok" | "soon" | "due";

/** Inside a week of the next bill is the point at which it should start to nag. */
export const MONEY_WARNING_DAYS = 7;

/**
 * How far ahead the chip will look for the rent.
 *
 * Rent is charged in arrears a month at a time, so a fresh campaign is fifty
 * days from its first bill. "rent in 50d" is arithmetically true and
 * emotionally inert: a countdown to something too far away to act on, in the
 * one place on the screen that exists to produce a decision. Past this horizon
 * the chip leads with whatever is actually nearest instead.
 */
export const MONEY_HORIZON_DAYS = 30;

/**
 * Money, written the way the game writes it.
 *
 * One spelling, exported, because the rail and the receipt strip sit two
 * centimetres apart and a screen that says €400 in one and €$400 in the other
 * is a screen with two currencies on it.
 */
export function formatMoney(value: number): string {
  return `€${value.toLocaleString()}`;
}

export type MoneyStatus = {
  eurobucks: number;
  rates: LifestyleRates;
  /** What is owed right now, having already come due. */
  owed: number;
  /** Days until the next month's costs land. */
  daysToNextBill: number;
  /**
   * The money thing actually coming soonest, as the chip says it. Null when
   * nothing is near enough to be worth counting down to.
   */
  nextUp: { label: string; inDays: number } | null;
  /** Short of what is owed (or of the next month's costs) by this much. */
  short: number;
  tone: MoneyTone;
  /** The face of the chip: the balance, and nothing competing with it. */
  line: string;
};

export function moneyStatus(input: {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  /**
   * A money commitment with a date on it — a debt, somebody's deadline — so the
   * chip can lead with it when it lands before the rent does.
   */
  nearestDue?: { label: string; inDays: number } | null;
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
  const nearestDue = input.nearestDue ?? null;
  const balance = formatMoney(eurobucks);

  if (rates.perMonth <= 0) {
    return {
      eurobucks,
      rates,
      owed: 0,
      daysToNextBill,
      nextUp: nearestDue,
      short: 0,
      tone: nearestDue && nearestDue.inDays <= MONEY_WARNING_DAYS ? "soon" : "ok",
      line: balance,
    };
  }

  const owed = bills.total;
  // What they are short by is measured against whatever is actually coming: the
  // overdue bill if one has landed, otherwise next month's.
  const target = owed > 0 ? owed : rates.perMonth;
  const short = Math.max(0, target - eurobucks);

  // Whichever is truest, in this order: what is already owed, then whatever
  // money thing lands soonest, then the rent once it is close enough to act on,
  // then just the balance. The chip never counts down to something too far away
  // to do anything about.
  const rentIsNear = daysToNextBill <= MONEY_HORIZON_DAYS;
  const dueBeatsRent = nearestDue !== null && nearestDue.inDays < daysToNextBill;
  const nextUp: MoneyStatus["nextUp"] = dueBeatsRent
    ? nearestDue
    : rentIsNear
      ? { label: "rent", inDays: daysToNextBill }
      : nearestDue;

  const tone: MoneyTone =
    owed > 0 ? "due" : nextUp !== null && nextUp.inDays <= MONEY_WARNING_DAYS ? "soon" : "ok";

  // The face of the chip is the balance and nothing else. What is owed and
  // what is coming still decide the COLOUR, and still print in full one tap
  // down — the runway reading this module was built around now lives in
  // `nextUp` and in MoneyDetail rather than in a clause the eye has to parse
  // every time it passes.
  return { eurobucks, rates, owed, daysToNextBill, nextUp, short, tone, line: balance };
}

/** "rent in 11d", "the clinic today", "Kiro's money 2d late". */
export function dueClause(due: { label: string; inDays: number }): string {
  if (due.inDays < 0) return `${due.label} ${Math.abs(due.inDays)}d late`;
  if (due.inDays === 0) return `${due.label} today`;
  return `${due.label} in ${due.inDays}d`;
}

// ---------------------------------------------------------------------------
// Growth — the distance to the next thing, not a total.
// ---------------------------------------------------------------------------

export type GrowthStatus = {
  ip: number;
  /** What the player has pinned, in pin order. Empty when nothing is. */
  pinned: GoalProgress[];
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
  pinned?: GoalProgress[];
}): GrowthStatus {
  const ip = input.improvementPoints;
  const pinned = input.pinned ?? [];
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

  if (!next) return { ip, pinned, next: null, gap: 0, ready: false, line: `${ip} IP` };

  const gap = Math.max(0, next.cost - ip);
  // Which Skill it is does not belong on the face of the chip: the player is
  // reading a distance, not choosing a purchase, and the name of the cheapest
  // raise changes under them every time they bank a point. The detail panel
  // still says which one, because that is where the choice is actually made.
  return {
    ip,
    pinned,
    next,
    gap,
    ready: gap === 0,
    // Kept short deliberately: the chip's line truncates at the rail's width,
    // and "30 more for the next Skill" is the exact length that loses its own
    // last word to an ellipsis in a 20rem column.
    line: gap === 0 ? `${ip} IP · next Skill ready` : `${ip} IP · ${gap} to next Skill`,
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

/**
 * A situation that frames the night rather than asking anything of the player.
 *
 * The opening's "just living" door is the case this exists for: it is a `need`
 * so the narrator keeps seeing it, but nobody is waiting and nothing is owed,
 * and counting it read as "1 open · 1 due today" over a summary that says in
 * as many words that nothing is expected of you tonight. A premise is carried
 * by the situation itself — `data.premise` — rather than guessed at here from
 * its key, because the next one will not be called `opening_just_living`.
 */
function isPremise(situation: LifeSituation): boolean {
  return situation.data?.["premise"] === true;
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
    .filter((s) => s.status === "live" && isCommitted(s.category) && !isPremise(s))
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
    .filter((s) => s.status === "live" && !isCommitted(s.category) && !isPremise(s))
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
    line: threadLine(commitments),
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

/**
 * The chip's line: the most pressing thread BY NAME, and how many more.
 *
 * It used to be a count — "3 open · 1 due today" — which tells a player how
 * busy they are and nothing about what with. A name is what pulls somebody
 * back: "Rent — due tomorrow · +2 more" is a reason to open the game, and
 * "3 open" is a to-do list. The list behind the chip is unchanged and sorted
 * the same way, so the name here is always its first row.
 */
function threadLine(commitments: Commitment[]): string {
  const open = commitments.filter((c) => c.status === "active");
  const top = open[0];
  if (!top) return "Nothing owed";
  const due = dueLabel(top.dueInDays);
  const more = open.length - 1;
  return `${top.title}${due ? ` — ${due}` : ""}${more > 0 ? ` · +${more} more` : ""}`;
}

// ---------------------------------------------------------------------------
// A new day, and what is waiting in it.
// ---------------------------------------------------------------------------

/** What a morning has in it, for the card that opens a new day. */
export type DayBrief = {
  day: number;
  /** One short line each, most pressing first. Never empty: a free day says so. */
  lines: string[];
};

/** The most a morning card says. More than this is a list, and lists get skimmed. */
export const DAY_BRIEF_LINES = 4;

/**
 * What the character wakes up to, read off the same commitments the chip shows.
 *
 * Late first, then today, then tomorrow, then any clock one segment from
 * arriving, then whoever is waiting on them. Nothing here is new information:
 * it is the state they already have, put in front of them at the moment a day
 * turns over, because that is the moment "what now?" gets asked.
 */
export function dayBrief(day: number, status: CommitmentsStatus): DayBrief {
  const lines: string[] = [];
  const open = status.commitments.filter((c) => c.status === "active");
  for (const c of open) {
    if (c.dueInDays !== null && c.dueInDays <= 1)
      lines.push(`${c.title} — ${dueLabel(c.dueInDays)}`);
  }
  for (const c of open) {
    if (c.meter && c.meter.segments - c.meter.filled <= 1)
      lines.push(`${c.title} — close to coming due`);
  }
  for (const c of open) {
    if (c.kind === "people" && c.dueInDays === null && c.severity >= 3) {
      lines.push(`${c.title} — still waiting on you`);
    }
  }
  return {
    day,
    lines: lines.length
      ? lines.slice(0, DAY_BRIEF_LINES)
      : ["Nothing is owed today. The day is yours."],
  };
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
  /** Pinned goals' progress, when the screen knows them (Life does). */
  pinned?: GoalProgress[];
}): StatusView {
  const commitments = commitmentsStatus({
    day: input.campaign.day ?? 0,
    situations: input.situations,
    clocks: input.clocks,
    ...(input.objectives ? { objectives: input.objectives } : {}),
    ...(input.missionTitle !== undefined ? { missionTitle: input.missionTitle } : {}),
    ...(input.currentKey !== undefined ? { currentKey: input.currentKey } : {}),
  });

  return {
    // Commitments first, because the money chip leads with whichever money
    // thing is actually nearest — and a debt with a date on it can easily beat
    // the rent to it.
    money: moneyStatus({ ...input, nearestDue: nearestMoneyDue(commitments) }),
    commitments,
    growth: growthStatus({
      character: input.character,
      improvementPoints: input.character.finance?.improvement_points ?? 0,
      ...(input.pinned ? { pinned: input.pinned } : {}),
    }),
  };
}

/**
 * The soonest dated `need` on the board, as the money chip would say it.
 *
 * `need` is the category the funnel puts money on — rent, debts, the thing that
 * has to be paid. A `people` commitment with a date is somebody waiting, which
 * is a real commitment and not a bill, so it belongs in the list rather than on
 * the money chip.
 */
function nearestMoneyDue(status: CommitmentsStatus): { label: string; inDays: number } | null {
  const dated = status.commitments
    .filter((c) => c.kind === "need" && c.status === "active" && c.dueInDays !== null)
    .sort((a, b) => (a.dueInDays ?? 0) - (b.dueInDays ?? 0));
  const soonest = dated[0];
  if (!soonest || soonest.dueInDays === null) return null;
  return { label: soonest.title, inDays: soonest.dueInDays };
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

/** Read a `day_began` ledger row back into its brief, or null for anything else. */
export function readDayBrief(data: unknown): DayBrief | null {
  const d = data as { day?: unknown; lines?: unknown } | null;
  if (!d || typeof d.day !== "number" || !Array.isArray(d.lines)) return null;
  const lines = d.lines.filter((l): l is string => typeof l === "string");
  return lines.length ? { day: d.day, lines } : null;
}

/** Real hours away before coming back gets a "where you left off" card. */
export const WELCOME_BACK_AFTER_HOURS = 3;

/**
 * What a returning player is shown before anything else: the threads they left
 * open, by name. Null when they were here recently, or when the campaign has no
 * history to come back to.
 *
 * Real time, not game time, because the question is about the person: after a
 * night away nobody remembers that the landlord was due Thursday, and a game
 * that opens on "you are in a bar" has asked them to rebuild their own reasons
 * to play.
 */
export function welcomeBack(
  lastEventAt: string | null | undefined,
  now: number,
  status: CommitmentsStatus,
): string[] | null {
  if (!lastEventAt) return null;
  const then = Date.parse(lastEventAt);
  if (!Number.isFinite(then)) return null;
  if (now - then < WELCOME_BACK_AFTER_HOURS * 3_600_000) return null;
  const open = status.commitments.filter((c) => c.status === "active").slice(0, 3);
  if (!open.length) return ["Nothing is owed. The night is yours."];
  return open.map((c) => {
    const due = dueLabel(c.dueInDays);
    return `${c.title}${due ? ` — ${due}` : ""}`;
  });
}
