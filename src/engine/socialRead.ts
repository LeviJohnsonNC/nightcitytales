/**
 * What a Social Skill is for, when it is used on a person.
 *
 * Nine printed Social Skills used to do one identical thing. `readsThePerson`
 * asked the rules data for a Skill's category, and every Skill in the Social
 * category — Bribery, Conversation, Human Perception, Interrogation, Persuasion,
 * Personal Grooming, Streetwise, Trading, Wardrobe & Style — revealed the next
 * rung of the target's dossier, in the same order, at the same margin. That is
 * how Personal Grooming became a mind-reading Skill, how Interrogation became
 * redundant with small talk, and how a player with one Social Skill had no
 * reason to buy a second.
 *
 * So a Skill now has a SHAPE: what using it on somebody can get you at all, and
 * what having tried costs. The shapes are a closed vocabulary in
 * data/cast/social-reads.json, and the mapping from Skill to shape is data as
 * well, because "which Skill is this" is a question about content and not about
 * code. Nothing here is generated and nothing is guessed: a Skill with no entry
 * reads nobody, which is the safe direction to fail in.
 *
 * The two ideas that make the shapes differ:
 *
 * 1. REACH. A shape can only get to some rungs. Conversation reaches what
 *    somebody wants and never what they are hiding, however well it is rolled;
 *    Interrogation goes straight for the secret without first making small talk.
 *    A shape that reaches nothing (Trading, Wardrobe & Style) is not broken —
 *    the check still did the thing it was rolled for, it just did not read them.
 *
 * 2. SUSPICION. The one new axis. It rises when you ASK, landed or not, because
 *    the cost is having tried, and it is spent on INFORMATION rather than on
 *    dice: a guarded person stops giving things up and is no harder to beat on a
 *    check. That is the same ruling the city layer already runs on — familiarity
 *    pays in information, never in dice — and the reason is the same: a die
 *    modifier here would be a rule Cyberpunk RED does not print.
 *
 * Suspicion cools on its own, and is DERIVED from when it was last raised rather
 * than decremented by a job somewhere, so nothing has to remember to tick it.
 *
 * Pure TypeScript, like the rest of the engine.
 */
import data from "@/data/cast/social-reads.json";
import { INSIGHT_MARGIN, REVEAL_LADDER, isDossierFact, type DossierFact } from "./cast";

export const SOCIAL_SHAPES = [
  "observe",
  "draw_out",
  "press",
  "lean_on",
  "buy",
  "haggle",
  "present",
  "ask_around",
] as const;
export type SocialShape = (typeof SOCIAL_SHAPES)[number];

export type SocialShapeSpec = {
  shape: SocialShape;
  /** What the character is doing, for a button or a log line. */
  label: string;
  /** One line on what that gets you, and what it does not. */
  blurb: string;
  /** The rungs this shape can reach at all. Empty means it reads nobody. */
  reaches: DossierFact[];
  /** What one attempt adds to how guarded they are with you. */
  suspicion: number;
  /** False for a shape that needs them to be dealing with you. */
  needsExchange: boolean;
  /** True for a shape a guarded person cannot close off. */
  worksOnGuarded: boolean;
};

type RawShape = {
  label: string;
  blurb: string;
  reaches: string[];
  suspicion: number;
  needsExchange: boolean;
  worksOnGuarded: boolean;
};

type SocialReadData = {
  guardedAt: number;
  coolsAfterDays: number;
  shapes: Record<string, RawShape>;
  skills: Record<string, string>;
};

const DATA = data as unknown as SocialReadData;

/** How suspicious somebody has to be before they stop giving things up. */
export const GUARDED_AT = DATA.guardedAt;
/** Days of not being worked before one point of suspicion cools off. */
export const SUSPICION_COOLS_AFTER_DAYS = DATA.coolsAfterDays;

function isShape(value: string): value is SocialShape {
  return (SOCIAL_SHAPES as readonly string[]).includes(value);
}

const SPECS: Record<SocialShape, SocialShapeSpec> = (() => {
  const built = {} as Record<SocialShape, SocialShapeSpec>;
  for (const shape of SOCIAL_SHAPES) {
    const raw = DATA.shapes[shape];
    if (!raw) throw new Error(`social-reads.json has no shape "${shape}".`);
    built[shape] = {
      shape,
      label: raw.label,
      blurb: raw.blurb,
      reaches: raw.reaches.filter(isDossierFact),
      suspicion: raw.suspicion,
      needsExchange: raw.needsExchange,
      worksOnGuarded: raw.worksOnGuarded,
    };
  }
  return built;
})();

/** The shape of using this Skill on a person, or null when it has none. */
export function shapeOf(skillId: string): SocialShape | null {
  const named = DATA.skills[skillId];
  return named && isShape(named) ? named : null;
}

export function socialShape(shape: SocialShape): SocialShapeSpec {
  return SPECS[shape];
}

/** The spec for a Skill, or null when using it on somebody is not a shape at all. */
export function shapeForSkill(skillId: string): SocialShapeSpec | null {
  const shape = shapeOf(skillId);
  return shape ? SPECS[shape] : null;
}

/** Every Skill this system knows, for a test that holds it against skills.json. */
export function mappedSocialSkills(): string[] {
  return Object.keys(DATA.skills);
}

// ---------------------------------------------------------------------------
// Suspicion.
// ---------------------------------------------------------------------------

/** What was last written down about how guarded somebody is with you. */
export type SuspicionState = {
  /** Points standing at `onDay`. */
  points: number;
  /** The in-game day they were last raised. */
  onDay: number;
};

/**
 * How guarded they are TODAY. Suspicion is not stored as a live number: it is
 * what was last written down, less what has cooled since, so a person nobody
 * has worked for a week is no longer watching for it and nothing had to run a
 * job to make that true.
 */
export function suspicionNow(state: SuspicionState | null | undefined, today: number): number {
  if (!state || state.points <= 0) return 0;
  const days = Math.max(0, today - state.onDay);
  const cooled = Math.floor(days / SUSPICION_COOLS_AFTER_DAYS);
  return Math.max(0, state.points - cooled);
}

/** True when they have stopped giving things up. */
export function isGuarded(suspicion: number): boolean {
  return suspicion >= GUARDED_AT;
}

/** What using this Skill on somebody adds to their suspicion, landed or not. */
export function suspicionCost(skillId: string): number {
  return shapeForSkill(skillId)?.suspicion ?? 0;
}

/**
 * Raise suspicion, carrying the cooling across. The points written are today's
 * standing plus the cost, so an old grudge that has cooled does not come back
 * when a new one is added.
 */
export function raiseSuspicion(args: {
  state: SuspicionState | null | undefined;
  add: number;
  today: number;
}): SuspicionState {
  return {
    points: suspicionNow(args.state, args.today) + Math.max(0, args.add),
    onDay: args.today,
  };
}

// ---------------------------------------------------------------------------
// The read.
// ---------------------------------------------------------------------------

/** Why a check that went well told you nothing about the person. */
export const NO_READ_REASONS = [
  "not_a_read",
  "narrow_win",
  "reads_nothing",
  "guarded",
  "out_of_reach",
  "nothing_left",
] as const;
export type NoReadReason = (typeof NO_READ_REASONS)[number];

export type SocialRead =
  | { outcome: "read"; fact: DossierFact; shape: SocialShapeSpec }
  | { outcome: "none"; why: NoReadReason; shape: SocialShapeSpec | null };

/**
 * What this check learned about the person it was used on.
 *
 * The margin gate is the old one (`INSIGHT_MARGIN`): winning is not the same as
 * reading somebody. What is new is that the answer depends on the shape of the
 * Skill and on how guarded they have become, so the same margin with a different
 * Skill is a different question.
 *
 * Every "none" carries WHY, because the caller has something honest to say in
 * each case and "nothing happened" is the one answer that reads like a bug.
 */
export function socialRead(args: {
  skillId: string;
  margin: number;
  /** Rungs the player has already earned from this person. */
  known: readonly DossierFact[];
  /** Their suspicion as of today — run it through `suspicionNow` first. */
  suspicion?: number;
}): SocialRead {
  const shape = shapeForSkill(args.skillId);
  if (!shape) return { outcome: "none", why: "not_a_read", shape: null };
  if (!shape.reaches.length) return { outcome: "none", why: "reads_nothing", shape };
  if (args.margin < INSIGHT_MARGIN) return { outcome: "none", why: "narrow_win", shape };
  if (!shape.worksOnGuarded && isGuarded(args.suspicion ?? 0)) {
    return { outcome: "none", why: "guarded", shape };
  }

  // Ladder order within the shape's reach: a shape may skip rungs it cannot
  // reach, but it never hands over a later rung before an earlier one it can.
  const reachable = REVEAL_LADDER.filter((fact) => shape.reaches.includes(fact));
  const fact = reachable.find((candidate) => !args.known.includes(candidate));
  if (fact) return { outcome: "read", fact, shape };

  // Everything this shape can reach is already known. That is a different
  // sentence from "they have nothing left": another Skill may still get in.
  const anythingLeft = REVEAL_LADDER.some((candidate) => !args.known.includes(candidate));
  return { outcome: "none", why: anythingLeft ? "out_of_reach" : "nothing_left", shape };
}

/** True when using this Skill on a person can read them at all. */
export function canRead(skillId: string): boolean {
  return (shapeForSkill(skillId)?.reaches.length ?? 0) > 0;
}

/**
 * True when a check was the kind of exchange that could reveal a person: a
 * Skill that reads people at all, used against them, won comfortably.
 *
 * This lived in `cast.ts` and asked the rules data for the Skill's CATEGORY,
 * which is what made all nine printed Social Skills mind-reading Skills —
 * Wardrobe & Style told you what somebody was hiding. It is kept as the coarse
 * predicate for callers that only want the yes or no; `socialRead` is the one
 * that says what was actually learned.
 */
export function readsThePerson(skillId: string, margin: number): boolean {
  return margin >= INSIGHT_MARGIN && canRead(skillId);
}
