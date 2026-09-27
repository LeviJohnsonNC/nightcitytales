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
import { OBSERVATIONS, hasTag, resolveDestination, resolvePosition, tagNamed } from "@/engine";
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
  /**
   * The trips it proposed, as the narrator wrote them. Life only; a Job turn
   * cannot travel, and leaves this out.
   */
  trips?: { destination?: string; seek?: string; direction?: string }[];
  /** How many spends it proposed. Paying for the drink is ordering it. */
  spends?: number;
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
  /**
   * The player asked to go to a KIND of place ("find a bar"), and a trip that
   * reaches one is the only acceptable answer.
   */
  tripToKind?: string;
  /**
   * What the rest of the player's request looks like once it has been done:
   * words the prose would use for it. Any one of them, or a spend, counts.
   */
  carryThrough?: string[];
  /** A trip could not be worked out; the character must stay where they are. */
  staysPut?: boolean;
  /**
   * The real places the engine offered as the nearest of the kind being asked
   * about. Directions given in the fiction must name one of them.
   */
  realAnswers?: string[];
  /**
   * Words for a background situation the player is NOT dealing with, in a
   * scene they are in the middle of. None of them may take over the prose.
   */
  offScene?: string[];
  /** Somebody the engine rolled as coming over. The prose must bring them. */
  comesOver?: string;
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

// ---------------------------------------------------------------------------
// FOLLOW-THROUGH — the GM doing too little
//
// Every check above catches the narrator doing too much. Nothing caught it
// doing too little, so every revision could only ever add a brake, and the
// game that resulted stopped at the door of every bar it was asked to sit in.
// ---------------------------------------------------------------------------

/**
 * Asked for a kind of place, it proposed a trip that gets there.
 *
 * Read from what the engine would do with the proposal, not from the prose:
 * the turn passes if its trip names the kind (`seek`), names it in words, or
 * names a real place that carries the tag.
 */
export const goesWhereAsked: Check = {
  id: "goes-where-asked",
  title: "proposed a trip that reaches the kind of place asked for",
  source:
    'PRODUCT.md: "A request the engine could have resolved was refused, or answered with nothing to press."',
  run(turn, ctx) {
    const kind = ctx.tripToKind;
    if (!kind) return [];
    const reaches = (turn.trips ?? []).some((trip) => {
      if (trip.seek === kind || tagNamed(trip.destination) === kind) return true;
      const key = resolveDestination(trip.destination);
      const place = key ? resolvePosition(key)?.placeKey : undefined;
      return place ? hasTag(place, kind) : false;
    });
    if (reaches) return [];
    const proposed = (turn.trips ?? []).map((t) => JSON.stringify(t)).join(" ") || "no trip";
    return [{ quote: proposed, note: `the player asked for a ${kind}` }];
  },
};

/**
 * With the first half resolved, it did the second half too.
 *
 * Scenario-driven: only the scenario knows what "sat down and ordered" looks
 * like in prose. A spend counts on its own, because paying for the drink is
 * ordering it however the sentence is worded.
 */
export const finishesTheRequest: Check = {
  id: "finishes-the-request",
  title: "carried out the rest of what the player said",
  source: 'PRODUCT.md: "The player had to say the same thing twice."',
  run(turn, ctx) {
    const words = ctx.carryThrough;
    if (!words?.length) return [];
    if ((turn.spends ?? 0) > 0) return [];
    const prose = turn.narration.toLowerCase();
    if (words.some((w) => prose.includes(w.toLowerCase()))) return [];
    return [{ quote: firstSentence(turn.narration), note: `never reached: ${words.join(" / ")}` }];
  },
};

/** The retreats that turned "that is not on the map" into going home. */
const RETREATS = [
  /\b(?:head|headed|heading|go|went|going|walk|walked|haul|hauled|climb|climbed|trudge|trudged)\s+(?:yourself\s+)?back\b/gi,
  /\bback (?:up|to) (?:the |your )?(?:stairs|container|walkway|place|room|flat|apartment)\b/gi,
  /\bright where you started\b/gi,
  /\bgive up\b/gi,
];

/**
 * A trip that could not be worked out left the character standing still.
 *
 * The transcript this exists for: "a bar is not a place on the map" became the
 * character hauling themselves back up the stairs to their own door, twice. A
 * refusal is the engine not knowing where to go, not the character failing.
 */
export const staysPutOnRefusal: Check = {
  id: "stays-put-on-refusal",
  title: "left the character where they were when a trip was refused",
  source:
    'PRODUCT.md: "A turn left the character where they started after they asked to go somewhere."',
  run(turn, ctx) {
    if (!ctx.staysPut) return [];
    const findings: Finding[] = [];
    for (const re of RETREATS) {
      for (const match of turn.narration.matchAll(re)) {
        findings.push({
          quote: quoteAround(turn.narration, match.index ?? 0, match[0].length),
          note: "walked them back",
        });
      }
    }
    return findings;
  },
};

/**
 * Directions given in the fiction lead somewhere real.
 *
 * "A cellar hole three alleys down" was a good line and a dead end: the map had
 * never heard of it, so "go there" was refused. Whoever gives directions names
 * one of the places the engine said were nearest.
 */
export const directionsAreReal: Check = {
  id: "directions-are-real",
  title: "gave directions to a place the map knows",
  source:
    'PRODUCT.md: "A request the engine could have resolved was refused, or answered with nothing to press."',
  run(turn, ctx) {
    const answers = ctx.realAnswers;
    if (!answers?.length) return [];
    const prose = turn.narration.toLowerCase().replace(/[’']/g, "'");
    const named = answers.some((a) => prose.includes(a.toLowerCase().replace(/[’']/g, "'")));
    if (named) return [];
    return [{ quote: firstSentence(turn.narration), note: `named none of: ${answers.join(", ")}` }];
  },
};

/**
 * A scene in progress kept its subject.
 *
 * Scenario-driven: the scenario names a background situation (a chewed
 * jacket) and the player does something else (asks the bartender what is
 * good). The jacket may be true; it may not become the scene.
 */
export const staysInTheScene: Check = {
  id: "stays-in-the-scene",
  title: "kept the scene on what the player was doing",
  source: 'PRODUCT.md: "A scene in progress was hijacked by a topic the engine did not raise."',
  run(turn, ctx) {
    const words = ctx.offScene;
    if (!words?.length) return [];
    const prose = turn.narration.toLowerCase();
    return words
      .filter((w) => prose.includes(w.toLowerCase()))
      .map((w) => ({
        quote: quoteAround(turn.narration, prose.indexOf(w.toLowerCase()), w.length),
        note: "the background situation took over",
      }));
  },
};

/**
 * Somebody the engine said comes over, came over.
 *
 * The roll was the engine's. A narrator that leaves them sitting in the corner
 * has quietly overruled it, which is the same fault as inventing an arrival,
 * pointed the other way.
 */
export const comesOverOnCue: Check = {
  id: "comes-over-on-cue",
  title: "brought over the person the engine said was coming",
  source: 'PRODUCT.md: "Whether they come OVER is the engine\'s roll (`comesOver`)."',
  run(turn, ctx) {
    const who = ctx.comesOver;
    if (!who) return [];
    const first = who.split(/\s+/)[0]!.toLowerCase();
    if (turn.narration.toLowerCase().includes(first)) return [];
    return [{ quote: firstSentence(turn.narration), note: `${who} never appears` }];
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
  goesWhereAsked,
  finishesTheRequest,
  staysPutOnRefusal,
  directionsAreReal,
  staysInTheScene,
  comesOverOnCue,
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
