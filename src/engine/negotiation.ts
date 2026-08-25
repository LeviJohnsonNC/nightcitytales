/**
 * Negotiating a job before you take it.
 *
 * An offer is not a Yes/No dialog. A fixer calls, quotes a number, and leaves
 * out the two things you actually want to know: who is paying, and what is
 * waiting. This module is the rules for pushing back on all three.
 *
 * Pure TypeScript, like the rest of the engine. It rolls nothing and reads
 * nothing: the caller rolls the check through the ordinary skill-check
 * machinery and hands the result here, and this module says what the terms
 * become. The AI is not consulted about whether the push worked, what it is
 * worth, or what gets revealed.
 *
 * The three asks are deliberately different SHAPES, so pushing is a real
 * decision rather than three buttons:
 * - `pay` and `patron` are opposed. A person with their own stake is resisting,
 *   and a tie goes to them (see opposedCheck.ts).
 * - `risk` is a flat DV. The broker is not consulted at all: you go and ask the
 *   street, which costs the better part of an hour and nothing else.
 *
 * The eurobucks figures here are NOT Cyberpunk RED rules values. No printed rule
 * says what a fixer's ceiling is; a raise band is app pacing, and it is applied
 * to the mission's own printed reward rather than replacing it.
 */
import type { MissionOffer } from "./mission";

export const HOOK_ASKS = ["pay", "patron", "risk"] as const;
export type HookAsk = (typeof HOOK_ASKS)[number];

export type HookAskSpec = {
  ask: HookAsk;
  /** What the button says. */
  label: string;
  /** What the character is actually doing, in one line. */
  blurb: string;
  /** The printed Skill the player rolls. */
  skillId: string;
  /** The printed Skill the broker resists with, or null when nobody resists. */
  opposedBy: string | null;
  /** The published DV, on an unopposed ask. Null when the other side rolls. */
  dv: number | null;
  /** App pacing: how long the push takes. */
  minutes: number;
  /** True when failing this ask costs standing with the broker. */
  costsStanding: boolean;
};

/**
 * Difficult (DV 15) for the street ask: word about who is holding a building in
 * a given district is out there, but it is not lying in the road.
 */
export const STREET_ASK_DV = 15;

export const HOOK_ASK_SPECS: Record<HookAsk, HookAskSpec> = {
  pay: {
    ask: "pay",
    label: "Push the fee",
    blurb: "Tell them the number is low and mean it.",
    skillId: "trading",
    opposedBy: "trading",
    dv: null,
    minutes: 15,
    costsStanding: true,
  },
  patron: {
    ask: "patron",
    label: "Ask who's paying",
    blurb: "Push for the name behind the money.",
    skillId: "persuasion",
    opposedBy: "persuasion",
    dv: null,
    minutes: 15,
    costsStanding: true,
  },
  risk: {
    ask: "risk",
    label: "Ask around first",
    blurb: "Work your own contacts on what is waiting there.",
    skillId: "streetwise",
    opposedBy: null,
    dv: STREET_ASK_DV,
    minutes: 45,
    costsStanding: false,
  },
};

export function hookAskSpec(ask: HookAsk): HookAskSpec {
  return HOOK_ASK_SPECS[ask];
}

export function isHookAsk(value: unknown): value is HookAsk {
  return typeof value === "string" && (HOOK_ASKS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Who is on the other side.
// ---------------------------------------------------------------------------

/**
 * What a broker brings to an opposed ask when the campaign has never seen them
 * resist anything. Brokering work is their job, so they sit in the "professional
 * in their own arena" band the GM brief describes: STAT 6, Level 4.
 *
 * The first time they resist, these numbers are written to their NPC row (see
 * features/campaign/npcOpposition.ts) and every later push reads them back, so
 * the same fixer never quietly becomes a different negotiator.
 */
export const BROKER_DEFAULT_STAT = 6;
export const BROKER_DEFAULT_SKILL_LEVEL = 4;

// ---------------------------------------------------------------------------
// The terms on the table.
// ---------------------------------------------------------------------------

export type HookTerms = {
  /** The mission's own printed payout, before anyone argued about it. */
  basePayout: number;
  /** What it pays now. */
  payout: number;
  /** Asks already spent. Each one gets a single attempt per offer. */
  asked: HookAsk[];
  /** Asks that landed, and so bought something the player now knows. */
  learned: HookAsk[];
};

export function startingTerms(basePayout: number): HookTerms {
  return { basePayout, payout: basePayout, asked: [], learned: [] };
}

/** One bite at each ask: a fixer who has said no once is not asked twice. */
export function canAsk(terms: HookTerms, ask: HookAsk): boolean {
  return !terms.asked.includes(ask);
}

/** The asks still open, in the order the interface should show them. */
export function openAsks(terms: HookTerms): HookAskSpec[] {
  return HOOK_ASKS.filter((ask) => canAsk(terms, ask)).map(hookAskSpec);
}

// ---------------------------------------------------------------------------
// What a push is worth.
// ---------------------------------------------------------------------------

/** A margin at or above this is a fixer who folded rather than conceded. */
export const RAISE_STRONG_MARGIN = 10;
export const RAISE_NORMAL = 0.25;
export const RAISE_STRONG = 0.5;
/** Fixers quote round numbers. Raises land on the same grid. */
export const RAISE_ROUNDING = 50;

/**
 * The fee after a successful push. Two bands rather than a curve, so the result
 * is something a player can hold in their head: you talked them up a quarter, or
 * you talked them up half.
 */
export function raisedPayout(basePayout: number, margin: number): number {
  if (basePayout <= 0) return basePayout;
  const rate = margin >= RAISE_STRONG_MARGIN ? RAISE_STRONG : RAISE_NORMAL;
  const raised = basePayout * (1 + rate);
  return Math.round(raised / RAISE_ROUNDING) * RAISE_ROUNDING;
}

export type HookAskResult = {
  success: boolean;
  /** How far the roll cleared (or missed) the number it was up against. */
  margin: number;
};

export type HookAskOutcome = {
  /** The terms after this push. */
  terms: HookTerms;
  /** What the player now knows, when the ask bought information. */
  revealed: string | null;
  /** How the broker took being pushed. Zero when they were not involved. */
  dispositionDelta: number;
  /** One line for the ledger, stated as what happened. */
  summary: string;
};

/**
 * Settle one push against the terms.
 *
 * Never narrates and never softens: a failed push is recorded as a failed push,
 * the ask is spent either way, and the only thing a success can do is what the
 * ask was for.
 */
export function settleHookAsk(
  terms: HookTerms,
  offer: MissionOffer,
  ask: HookAsk,
  result: HookAskResult,
): HookAskOutcome {
  const spec = hookAskSpec(ask);
  const spent: HookTerms = {
    ...terms,
    asked: terms.asked.includes(ask) ? terms.asked : [...terms.asked, ask],
  };
  const failed = (summary: string): HookAskOutcome => ({
    terms: spent,
    revealed: null,
    dispositionDelta: spec.costsStanding ? -1 : 0,
    summary,
  });

  if (!result.success) {
    switch (ask) {
      case "pay":
        return failed(
          `${offer.brokerName} did not move on the fee. It stands at ${terms.payout}eb.`,
        );
      case "patron":
        return failed(`${offer.brokerName} would not say who is paying.`);
      case "risk":
        return failed("Nobody on the street had anything useful on the job.");
    }
  }

  const landed: HookTerms = { ...spent, learned: [...spent.learned, ask] };

  switch (ask) {
    case "pay": {
      const payout = raisedPayout(terms.basePayout, result.margin);
      // A push that cannot beat what is already on the table is not a raise.
      if (payout <= terms.payout) {
        return {
          terms: spent,
          revealed: null,
          dispositionDelta: 0,
          summary: `${offer.brokerName} held at ${terms.payout}eb.`,
        };
      }
      return {
        terms: { ...landed, payout },
        revealed: null,
        dispositionDelta: 0,
        summary: `The fee is now ${payout}eb, up from ${terms.basePayout}eb.`,
      };
    }
    case "patron":
      return {
        terms: landed,
        revealed: `${offer.patronName} of ${offer.patronOrg} is paying for this.`,
        dispositionDelta: 0,
        summary: `${offer.brokerName} gave up the client: ${offer.patronName}, ${offer.patronOrg}.`,
      };
    case "risk":
      return {
        terms: landed,
        revealed: `Waiting in ${offer.district}: ${offer.opposition}`,
        dispositionDelta: 0,
        summary: `The street knows what is on that job: ${offer.opposition}`,
      };
  }
}

/** What the player has been told so far, for the offer card and the prompt. */
export function knownTerms(terms: HookTerms, offer: MissionOffer): string[] {
  const out: string[] = [];
  if (terms.learned.includes("patron")) {
    out.push(`Paying: ${offer.patronName} (${offer.patronOrg})`);
  }
  if (terms.learned.includes("risk")) out.push(`Waiting: ${offer.opposition}`);
  return out;
}
