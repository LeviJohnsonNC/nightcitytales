/**
 * The narrator's rules, made checkable.
 *
 * narratorRules.ts says what both narrators are told and, where a normalizer
 * can enforce it, enforces it (`snapDv`). Most of the rules cannot be enforced
 * that way: nothing can stop a model writing "a bowl of noodles, 5eb" — the
 * engine can only refuse the NUMBERS it is handed, and prose is not handed to
 * the engine at all. Those rules have therefore never been checked by anything
 * except a person reading a turn and noticing.
 *
 * These are the detectors. Each one takes a finished turn and the packet the
 * model was given, and returns the places the turn broke a rule, quoting the
 * offending span. They are PURE and call no model: `evals/` runs them against
 * live turns, and narratorChecks.test.ts runs them against hand-written strings
 * in CI, which is what stops a checker rotting into one that never fires.
 *
 * Every check traces to a line in PRODUCT.md's "How to tell it is going wrong"
 * or to a rule one of the prompts states in so many words. A check that traces
 * to neither is a taste argument, and this file is not where those are settled.
 */
import { OBSERVATIONS } from "@/engine";
import { FLAVOR_SUBJECTS } from "@/features/cast/flavorArt";

/**
 * A fact being withheld, and the words that would give it away.
 *
 * `tells` is authored rather than inferred. The first version of this check
 * pulled the long words out of the truth's own sentence and asked for all of
 * them, which a model defeats by paraphrasing — it leaked "Kenbishi Holdings"
 * and "Arasaka" in one breath and the check stayed silent because it had also
 * wanted "through" and "called". What makes a truth leaked is its identifying
 * nouns, and only the person writing the scenario knows which those are.
 *
 * All of them must appear before it counts: a lone "Arasaka" in Night City is
 * weather, and flagging it would bury the report in noise.
 */
export type WithheldTruth = {
  /** The fact, for the report to quote. */
  truth: string;
  /** Lowercase words that together mean the model knew. */
  tells: string[];
};

/** One place a turn broke one rule. */
export type Finding = {
  /** The offending span, quoted so a report shows what it said. */
  quote: string;
  /** Why it is a finding, when the quote alone does not say. */
  note?: string;
};

/**
 * A turn, reduced to what a check can look at.
 *
 * Deliberately not `GmResponse` or `LifeResponse`: the two differ in field
 * names (`suggestedActions` / `actions`) and in what they can express, and a
 * rule that applies to both should not have to know which it is looking at.
 */
export type CheckableTurn = {
  /** The prose the player reads. */
  narration: string;
  /** The offered options, whatever the mode calls them. */
  offeredOptions: string[];
  /** npcKeys the turn's proposed actions named. */
  npcKeys: string[];
  /** Observation words the turn reported. */
  observations: string[];
  /** Walk-on subjects the turn tagged. */
  walkOns: string[];
  /** How many mechanical actions it proposed. */
  proposedActionCount: number;
};

/** What the model was given, and what the scenario says about this turn. */
export type CheckContext = {
  /** The rendered user prompt, verbatim. A number in here is the engine's. */
  packet: string;
  /** True when the player asked what they could do. */
  optionsRequested: boolean;
  /** npcKeys the packet actually named. */
  knownNpcKeys: string[];
  /**
   * Facts the character has NOT found. The prompt never sends these, so the
   * turn cannot have been told them — if one shows up in prose the model
   * guessed it, which is worse than withholding it badly.
   */
  withheldTruths: WithheldTruth[];
  /** Words the turn may not reach for, when the scenario is a quiet one. */
  mustStayQuiet: boolean;
  /** The turn's stated prose budget in words, when the scenario sets one. */
  wordBudget?: number;
  /** True when the player's stated intent could plausibly have failed. */
  riskyIntent: boolean;
};

export type Check = {
  id: string;
  /** What passing looks like, phrased for a report line. */
  title: string;
  /** Where the rule is written down. */
  source: string;
  run(turn: CheckableTurn, ctx: CheckContext): Finding[];
};

// ---------------------------------------------------------------------------
// A NUMBER IS NOT YOURS
// ---------------------------------------------------------------------------

const NUMBER_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "fifteen",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "hundred",
  "thousand",
].join("|");

const QUANTITY = `(?:\\d[\\d,]*(?:\\.\\d+)?|${NUMBER_WORDS})`;

/**
 * The units that make a number the ENGINE's.
 *
 * The house style names them: "Money, time, distance, difficulty, damage, rent
 * and how long something takes are the engine's." A count of things in a room
 * is not on that list and is not flagged — "one guard smoking by the loading
 * dock" is exactly the kind of specific the narrator is asked for, and a
 * checker that flagged it would be telling the narrator to stop doing its job.
 */
const UNIT_PATTERNS: { label: string; re: RegExp }[] = [
  {
    label: "money",
    re: new RegExp(`(?:€\\$\\s*${QUANTITY}|${QUANTITY}\\s*(?:eb\\b|eurobucks?|eddies))`, "gi"),
  },
  {
    label: "distance",
    re: new RegExp(`${QUANTITY}[-\\s]*(?:m\\b|met(?:re|er)s?|feet|foot|ft\\b|yards?|km\\b)`, "gi"),
  },
  {
    label: "duration",
    re: new RegExp(
      `${QUANTITY}[-\\s]*(?:seconds?|minutes?|mins?\\b|hours?|hrs?\\b|days?|weeks?)`,
      "gi",
    ),
  },
  { label: "difficulty", re: /\bDV\s*\d+|\bdifficulty\s*(?:value\s*)?\d+/gi },
  { label: "damage", re: new RegExp(`${QUANTITY}\\s*(?:damage|hp\\b|hit points?)`, "gi") },
  { label: "clock time", re: /\b\d{1,2}:\d{2}\b/g },
];

/**
 * A number in prose that nothing in the packet produced.
 *
 * The flagship check, and the one with the most history: Life used to tell the
 * narrator to state "a distance in metres ... a price" among its concrete
 * specifics, two hundred words below the rule forbidding exactly that, and the
 * model resolved the tension by pricing a bowl of noodles at 5eb.
 *
 * A match is allowed when its text appears in the packet, because then the
 * engine said it first and repeating it is not inventing it.
 */
export const noUnsourcedNumber: Check = {
  id: "no-unsourced-number",
  title: "stated no number the engine did not give it",
  source: 'PRODUCT.md: "A number appears in prose that no engine module produced."',
  run(turn, ctx) {
    const haystack = ctx.packet.toLowerCase();
    const findings: Finding[] = [];
    const seen = new Set<string>();
    for (const { label, re } of UNIT_PATTERNS) {
      for (const match of turn.narration.matchAll(re)) {
        const quote = match[0].trim();
        const key = quote.toLowerCase();
        if (seen.has(key)) continue;
        if (haystack.includes(key)) continue;
        seen.add(key);
        findings.push({ quote, note: `${label} the packet never states` });
      }
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// SITUATIONS, NOT SOLUTIONS
// ---------------------------------------------------------------------------

/** The phrasings the prompt forbids by name, so this is its own rule quoted back. */
const MENU_PHRASES = [
  /\byou could\b/gi,
  /\bperhaps you\b/gi,
  /\bone option is\b/gi,
  /\bif you wanted to\b/gi,
  /\byou might (?:try|want)\b/gi,
  /\byour options (?:are|include)\b/gi,
];

export const namesNoWayIn: Check = {
  id: "names-no-way-in",
  title: "named no way in",
  source: 'Both prompts: "NEVER name a way in. No \\"you could\\", no \\"perhaps\\" ..."',
  run(turn) {
    const findings: Finding[] = [];
    for (const re of MENU_PHRASES) {
      for (const match of turn.narration.matchAll(re)) {
        findings.push({ quote: quoteAround(turn.narration, match.index ?? 0, match[0].length) });
      }
    }
    return findings;
  },
};

export const endsOnTheWorld: Check = {
  id: "ends-on-the-world",
  title: 'did not end on "What do you do?"',
  source:
    'Both prompts: "Do not end your narration with \\"What do you do?\\" The interface asks that."',
  run(turn) {
    const tail = turn.narration.trimEnd().slice(-60);
    return /what (?:do|will) you do\s*\??$/i.test(tail.trim()) ? [{ quote: tail.trim() }] : [];
  },
};

/**
 * The suggestion list stayed empty on a turn nobody asked for one.
 *
 * PRODUCT.md's anti-goal is "no suggestion lists that are secretly the only
 * legal moves". Both prompts say [] is the normal answer; this is whether that
 * survives contact.
 */
export const optionsOnlyWhenAsked: Check = {
  id: "options-only-when-asked",
  title: "offered options only when asked",
  source: 'PRODUCT.md: "The suggested actions have quietly become the only actions."',
  run(turn, ctx) {
    if (ctx.optionsRequested || turn.offeredOptions.length === 0) return [];
    return [
      {
        quote: turn.offeredOptions.join(" | "),
        note: "the player did not ask what they could do",
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// Closed vocabularies
// ---------------------------------------------------------------------------

export const knownNpcKeysOnly: Check = {
  id: "known-npc-keys-only",
  title: "named only people the packet named",
  source: 'PRODUCT.md: "An NPC is invented when a member of the standing cast would have served."',
  run(turn, ctx) {
    const known = new Set(ctx.knownNpcKeys);
    return turn.npcKeys
      .filter((key) => !known.has(key))
      .map((key) => ({ quote: key, note: "not a key the packet supplied" }));
  },
};

export const closedObservationWords: Check = {
  id: "closed-observation-words",
  title: "reported only the engine's observation words",
  source: "Both prompts: the observation list, built from OBSERVATIONS.",
  run(turn) {
    const allowed = new Set<string>(OBSERVATIONS);
    return turn.observations
      .filter((o) => !allowed.has(o))
      .map((o) => ({ quote: o, note: "outside the closed vocabulary" }));
  },
};

export const walkOnsFromCatalog: Check = {
  id: "walk-ons-from-catalog",
  title: "tagged only walk-ons the art catalog has",
  source: "Both prompts: WALK-ON FACES, built from FLAVOR_SUBJECTS.",
  run(turn) {
    const allowed = new Set<string>(FLAVOR_SUBJECTS);
    return turn.walkOns
      .filter((s) => !allowed.has(s))
      .map((s) => ({ quote: s, note: "not in the flavor-art catalog" }));
  },
};

// ---------------------------------------------------------------------------
// Withheld knowledge
// ---------------------------------------------------------------------------

/**
 * A fact the character has not found did not appear in the prose.
 *
 * Stronger than it looks: the prompt never SENDS an undiscovered truth, so a
 * hit here is not a leak, it is the model having guessed the answer and stated
 * it as fact. Matching is on the distinctive words of the truth rather than the
 * whole sentence, because the model will paraphrase.
 */
export const withheldStaysWithheld: Check = {
  id: "withheld-stays-withheld",
  title: "did not state a fact the character has not found",
  source: "AGENTS.md: Beat.truths is held apart from gmBrief because the brief reaches the model.",
  run(turn, ctx) {
    const prose = turn.narration.toLowerCase();
    const findings: Finding[] = [];
    for (const { truth, tells } of ctx.withheldTruths) {
      if (tells.length === 0) continue;
      if (tells.every((tell) => prose.includes(tell.toLowerCase()))) {
        findings.push({ quote: truth, note: `every tell present: ${tells.join(", ")}` });
      }
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// Pacing
// ---------------------------------------------------------------------------

export const withinProseBudget: Check = {
  id: "within-prose-budget",
  title: "stayed inside its prose budget",
  source: 'PRODUCT.md: "The player is reading more than they are deciding."',
  run(turn, ctx) {
    if (ctx.wordBudget === undefined) return [];
    const words = turn.narration.trim().split(/\s+/).filter(Boolean).length;
    if (words <= ctx.wordBudget) return [];
    return [{ quote: `${words} words`, note: `budget is ${ctx.wordBudget}` }];
  },
};

/**
 * A risky intent got dice rather than being resolved in prose.
 *
 * Scenario-driven: only a scenario knows whether the player's stated intent
 * could plausibly have failed. Where it says so, narrating the outcome instead
 * of proposing a check is the model deciding something the engine owns.
 */
export const riskGetsDice: Check = {
  id: "risk-gets-dice",
  title: "proposed a check for a risky intent",
  source:
    'PRODUCT.md: "A scene resolves entirely in narration when it could plausibly have failed."',
  run(turn, ctx) {
    if (!ctx.riskyIntent || turn.proposedActionCount > 0) return [];
    return [{ quote: firstSentence(turn.narration), note: "no mechanical action proposed" }];
  },
};

/**
 * A quiet evening stayed quiet.
 *
 * The Life prompt names the three things it must not reach for by name: "Do not
 * fill the silence with a stranger, a phone call or a noise in the corridor."
 * This is that sentence, checked.
 */
export const quietStaysQuiet: Check = {
  id: "quiet-stays-quiet",
  title: "left a quiet evening quiet",
  source:
    'PRODUCT.md: "A quiet evening has been filled with a stranger, a phone call, or a noise."',
  run(turn, ctx) {
    if (!ctx.mustStayQuiet) return [];
    const intrusions: { re: RegExp; what: string }[] = [
      { re: /\b(?:phone|holo|agent)\s+(?:rings|buzzes|chimes|lights up)\b/i, what: "a phone call" },
      { re: /\ba knock (?:at|on) the door\b/i, what: "someone at the door" },
      {
        re: /\b(?:a|some)\s+(?:noise|sound|thud|crash)\s+(?:in|from)\s+the\s+(?:corridor|hall)/i,
        what: "a noise in the corridor",
      },
    ];
    return intrusions
      .filter(({ re }) => re.test(turn.narration))
      .map(({ re, what }) => ({
        quote: turn.narration.match(re)?.[0] ?? what,
        note: `the evening was rolled quiet; this is ${what}`,
      }));
  },
};

/** Every check, in report order: severity first, taste never. */
export const ALL_CHECKS: Check[] = [
  noUnsourcedNumber,
  withheldStaysWithheld,
  knownNpcKeysOnly,
  closedObservationWords,
  walkOnsFromCatalog,
  namesNoWayIn,
  optionsOnlyWhenAsked,
  riskGetsDice,
  quietStaysQuiet,
  endsOnTheWorld,
  withinProseBudget,
];

// ---------------------------------------------------------------------------

function firstSentence(text: string): string {
  const match = text.trim().match(/^.{0,160}?[.!?](?:\s|$)/s);
  return (match?.[0] ?? text.slice(0, 160)).trim();
}

/** Enough either side of a hit to read it, so a report shows the sentence. */
function quoteAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
