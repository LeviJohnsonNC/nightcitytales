/**
 * Dice nobody at the table controls.
 *
 * Everything else in this engine resolves something the player attempted. An
 * oracle resolves something nobody attempted: whether work reaches you tonight,
 * what the job's employer left out, whether the guard actually knows what is in
 * the container. The point is not randomness for its own sake. It is that the
 * model cannot be the invisible author of the campaign if it does not know the
 * answers either.
 *
 * Two rules make that real:
 *
 *  - NOTHING HAPPENS is the most common result, deliberately and by a wide
 *    margin. Not every alley contains assassins, and a world where every roll
 *    produces an event is just as authored as one with no rolls at all, only
 *    more exhausting.
 *
 *  - The model never rolls, never picks a table, and never decides what a
 *    result means. It may ASK a question; the engine answers it, and the answer
 *    arrives as established fact.
 *
 * Pure TypeScript. Tables in, result out; the RNG is injected so a test can
 * pin every face, and every roll produces a RollResult so the ledger can show
 * the arithmetic exactly as it does for a skill check.
 */
import { defaultRng, rollDie } from "./dice";
import { buildRollResult, type RollModifier, type RollResult } from "./rollLog";
import type { RNG } from "./types";

/**
 * Whether the player is shown the roll as it happens.
 *
 * `open` rolls are the proof the world is not being authored around them:
 * seeing "Quiet night: 5, nothing" is what makes the quiet believable. `secret`
 * rolls are the ones whose whole value is not knowing, and they stay out of the
 * log until the fiction has delivered them.
 */
export const ORACLE_VISIBILITIES = ["open", "secret"] as const;
export type OracleVisibility = (typeof ORACLE_VISIBILITIES)[number];

export type OracleEntry = {
  /** Lowest face this entry covers. */
  from: number;
  /** Highest face this entry covers. */
  to: number;
  /** Stable key, so the engine can branch on a result without matching prose. */
  key: string;
  /** What it means, in the engine's words. Written to be handed to the model. */
  text: string;
};

export type OracleTable = {
  id: string;
  label: string;
  /** Faces on the die. */
  die: number;
  visibility: OracleVisibility;
  entries: OracleEntry[];
};

// ---------------------------------------------------------------------------
// The tables.
// ---------------------------------------------------------------------------

/**
 * Does work reach the character tonight?
 *
 * This is the roll that takes the last piece of pacing away from the model.
 * Before it existed a job appeared when the model felt the fiction reached for
 * one, which is exactly the invisible hand this whole project is built to
 * remove. Four faces in six are nobody calling.
 */
export const WORK_ON_THE_WIRE: OracleTable = {
  id: "work_on_the_wire",
  label: "Work on the wire",
  die: 6,
  visibility: "open",
  entries: [
    { from: 1, to: 4, key: "nothing", text: "Nobody calls. The night is the character's own." },
    {
      from: 5,
      to: 5,
      key: "word",
      text: "Word is going around about something, but nobody has offered it to them.",
    },
    { from: 6, to: 6, key: "offer", text: "The phone rings, and there is work on the other end." },
  ],
};

/** How much easier work is to come by when the character is chasing it. */
export const WIRE_BROKE_BONUS = 1;
export const WIRE_ASKED_AROUND_BONUS = 2;

/**
 * What the job's brief left out. Rolled once, in secret, when the player takes
 * the work, and handed to the GM as something it must build the job around.
 */
export const COMPLICATION: OracleTable = {
  id: "complication",
  label: "Complication",
  die: 6,
  visibility: "secret",
  entries: [
    {
      from: 1,
      to: 1,
      key: "employer_lied",
      text: "The employer lied about something material. What they said the job was is not what it is.",
    },
    {
      from: 2,
      to: 2,
      key: "rival_crew",
      text: "Another crew is working the same target, and they got there first or are about to.",
    },
    {
      from: 3,
      to: 3,
      key: "target_moved",
      text: "The target is not where the brief said. It moved, or it never was there.",
    },
    {
      from: 4,
      to: 4,
      key: "police",
      text: "There is an NCPD operation already running on this location tonight.",
    },
    {
      from: 5,
      to: 5,
      key: "personal",
      text: "Somebody the character already knows is caught up in this, on the wrong side of it.",
    },
    {
      from: 6,
      to: 6,
      key: "none",
      text: "No complication. The job is exactly what it was described as.",
    },
  ],
};

/**
 * What the evening is like when nothing is already demanding attention.
 *
 * Weighted hard toward nothing on purpose. A quiet turn is a real result, and
 * the Life loop needs somewhere for the character to simply exist.
 */
export const STREET: OracleTable = {
  id: "street",
  label: "The street tonight",
  die: 6,
  visibility: "open",
  entries: [
    {
      from: 1,
      to: 4,
      key: "quiet",
      text: "Nothing happens. The city goes about its business without involving them.",
    },
    {
      from: 5,
      to: 5,
      key: "texture",
      text: "Something small and harmless is going on nearby. Colour, not a hook: it wants nothing from the character.",
    },
    {
      from: 6,
      to: 6,
      key: "intrudes",
      text: "Something on the street actually intrudes on the character's evening and asks something of them.",
    },
  ],
};

/**
 * The answer to a question nobody at the table knows.
 *
 * Roughly even odds with shading at both ends, and deliberately no likelihood
 * input: letting the asker say "this is probably yes" hands the thumb straight
 * back to the model, which is the thing being taken away.
 */
export const OPEN_QUESTION: OracleTable = {
  id: "open_question",
  label: "Oracle",
  die: 10,
  visibility: "secret",
  entries: [
    { from: 1, to: 1, key: "no_and", text: "No, and it is worse than that." },
    { from: 2, to: 4, key: "no", text: "No." },
    { from: 5, to: 5, key: "no_but", text: "No, but not entirely." },
    { from: 6, to: 6, key: "yes_but", text: "Yes, but not entirely." },
    { from: 7, to: 9, key: "yes", text: "Yes." },
    { from: 10, to: 10, key: "yes_and", text: "Yes, and more than that." },
  ],
};

export const ORACLE_TABLES: OracleTable[] = [WORK_ON_THE_WIRE, COMPLICATION, STREET, OPEN_QUESTION];

const BY_ID = new Map(ORACLE_TABLES.map((t) => [t.id, t]));

export function getOracleTable(id: string): OracleTable {
  const table = BY_ID.get(id);
  if (!table) throw new Error(`No registered oracle table "${id}".`);
  return table;
}

// ---------------------------------------------------------------------------
// Rolling.
// ---------------------------------------------------------------------------

export type OracleResult = {
  tableId: string;
  label: string;
  /** The entry the face landed on. */
  key: string;
  text: string;
  /** The face, before modifiers. */
  face: number;
  /** The face after modifiers, which is what the table was read at. */
  read: number;
  visibility: OracleVisibility;
  roll: RollResult;
};

/** The entry a (modified) face lands on. Clamped to the ends of the table. */
export function entryFor(table: OracleTable, read: number): OracleEntry {
  const first = table.entries[0];
  const last = table.entries[table.entries.length - 1];
  if (!first || !last) throw new Error(`Oracle table "${table.id}" has no entries.`);
  if (read <= first.to) return first;
  if (read >= last.from) return last;
  return table.entries.find((e) => read >= e.from && read <= e.to) ?? last;
}

export type OracleRollOptions = {
  /** Circumstance that makes a result more or less likely, for the ledger. */
  modifiers?: RollModifier[];
  now?: () => Date;
};

/**
 * Roll a table.
 *
 * The die is rolled honestly and the modifiers are applied to the READ, not to
 * the die, so the ledger can always show the face that actually came up
 * alongside the circumstance that shifted it.
 */
export function rollOracle(
  table: OracleTable,
  rng: RNG = defaultRng,
  options: OracleRollOptions = {},
): OracleResult {
  const modifiers = options.modifiers ?? [];
  const face = rollDie(table.die, rng);
  const shift = modifiers.reduce((sum, m) => sum + m.value, 0);
  const read = face + shift;
  const entry = entryFor(table, read);

  const roll = buildRollResult({
    dice: `1d${table.die}`,
    rolls: [face],
    modifiers,
    dv: null,
    ...(options.now ? { now: options.now } : {}),
  });

  return {
    tableId: table.id,
    label: table.label,
    key: entry.key,
    text: entry.text,
    face,
    read,
    visibility: table.visibility,
    roll: { ...roll, formula: `${roll.formula} → ${entry.text}` },
  };
}

// ---------------------------------------------------------------------------
// Reading results.
// ---------------------------------------------------------------------------

/** True when this roll of the wire means a job may actually be offered. */
export function wireOffersWork(result: OracleResult): boolean {
  return result.tableId === WORK_ON_THE_WIRE.id && result.key === "offer";
}

/** True when the street has produced something the character has to deal with. */
export function streetIntrudes(result: OracleResult): boolean {
  return result.tableId === STREET.id && result.key === "intrudes";
}

/** True when a job's complication is a real one rather than a clean brief. */
export function isRealComplication(result: OracleResult): boolean {
  return result.tableId === COMPLICATION.id && result.key !== "none";
}

/** "Work on the wire: 1d6(5) → Word is going around…" for the ledger. */
export function describeOracle(result: OracleResult): string {
  return `${result.label}: ${result.roll.formula}`;
}

// ---------------------------------------------------------------------------
// Questions the model may ask.
// ---------------------------------------------------------------------------

/** Longest question the engine will carry forward. Enough for a real one. */
export const MAX_QUESTION_LENGTH = 200;

/**
 * A question is only worth an oracle if the engine could not already answer it.
 *
 * Rejects the two things a model reaches for when it has been told it may ask:
 * questions about the player's own sheet or intentions (which are facts, and
 * asking dice about them is nonsense), and open-ended prompts that a yes/no
 * table cannot answer.
 */
export function isAnswerableQuestion(question: unknown): question is string {
  if (typeof question !== "string") return false;
  const text = question.trim();
  if (text.length < 8 || text.length > MAX_QUESTION_LENGTH) return false;
  // A yes/no oracle cannot answer "what" or "how many".
  if (/^(what|which|how|why|who|where|when)\b/i.test(text)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Going looking.
// ---------------------------------------------------------------------------

/**
 * Phrases that mean the character is out chasing work rather than living.
 *
 * Deliberately narrow. This shifts a real die, so it has to fire on somebody
 * actually working the phones and not on the word "job" drifting past in a
 * sentence about somebody else's.
 */
const CHASING_WORK =
  /\b(look(ing)?|ask(ing)?|hunt(ing)?|shop(ping)?|scout(ing)?|check(ing)?|put out|reach(ing)? out|hit(ting)? up|call(ing)?)\b[^.?!]{0,40}\b(work|a job|jobs|gig|gigs|contract|contracts|a score|scores|fixer|my fixer)\b/i;

/**
 * True when the player's turn was them going out to find work.
 *
 * Matched here, in the engine, on the player's own words — never reported by the
 * model. What shifts the odds of the world is not something the narrator gets to
 * decide it saw.
 */
export function looksForWork(input: string): boolean {
  return CHASING_WORK.test(input);
}
