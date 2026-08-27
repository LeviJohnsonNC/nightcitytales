/**
 * The city moving while you are not looking.
 *
 * Every Life situation until now derived from the player's own state: their
 * rent, their wounds, their empty magazine, their neglect of somebody. Nothing
 * originated outside them. The six people in the standing cast have carried a
 * `wants` and a `fear` since the cast shipped and have never once acted on
 * either — they wait, indefinitely, for the player to get around to them.
 *
 * This is the other direction. Once per in-world day the world gets a roll, and
 * on the rare day it comes up somebody moves: they ask for something, call in
 * what they are owed, warn you, or come looking.
 *
 * Three rules keep it from becoming a notification tray:
 *
 *  - NOBODY MOVES is the common answer, on the same die-weighted discipline as
 *    the wire and the street. A city that does something to you every day is
 *    not alive, it is nagging.
 *
 *  - ONE person moves, not all six. The most motivated — longest ignored,
 *    strongest feelings, or a grudge that has come due — and everybody else
 *    keeps waiting, which is what they were doing anyway.
 *
 *  - The ENGINE picks the move from a closed vocabulary; the model voices it.
 *    It is told that Kiro is asking a favour. It is never told what Kiro wants,
 *    because that is in a dossier the model has never been allowed to see.
 *
 * Pure. People and a clock in, a decision out.
 */
import { defaultRng } from "./dice";
import { rollOracle, type OracleResult, type OracleTable } from "./oracle";
import { partOfDay } from "./clock";
import type { RNG } from "./types";

// ---------------------------------------------------------------------------
// Does anybody move at all?
// ---------------------------------------------------------------------------

export const WORLD_TICK: OracleTable = {
  id: "world_tick",
  label: "The city, overnight",
  die: 6,
  visibility: "open",
  entries: [
    {
      from: 1,
      to: 4,
      key: "still",
      text: "Nobody moves. The city gets on with its own business.",
    },
    { from: 5, to: 6, key: "moves", text: "Somebody has been thinking about the character." },
  ],
};

/** True when this roll means one person acts tonight. */
export function somebodyMoves(result: OracleResult): boolean {
  return result.tableId === WORLD_TICK.id && result.key === "moves";
}

// ---------------------------------------------------------------------------
// What a person can do to you.
// ---------------------------------------------------------------------------

export const NPC_MOVES = [
  "asks_a_favour",
  "calls_in_debt",
  "warns_you",
  "offers_help",
  "goes_quiet",
  "moves_against",
  "comes_looking",
] as const;
export type NpcMove = (typeof NPC_MOVES)[number];

export function isNpcMove(value: unknown): value is NpcMove {
  return typeof value === "string" && (NPC_MOVES as readonly string[]).includes(value);
}

/**
 * What each move means, written for the model to dress rather than decide.
 *
 * Deliberately says WHAT happened and never WHY: the why lives in a dossier the
 * model has never been shown, and a model told what somebody wants will have
 * them explain it within two sentences.
 */
export const MOVE_MEANINGS: Record<NpcMove, string> = {
  asks_a_favour: "they want something from the character, and they have come to ask for it",
  calls_in_debt: "they are collecting on something the character owes them",
  warns_you: "they have heard something and decided the character should know",
  offers_help: "they are offering the character something, unprompted",
  goes_quiet: "they have stopped answering, and the silence is deliberate",
  moves_against: "they have done something to the character's detriment",
  comes_looking: "they are looking for the character, and not to talk",
};

/** How loud the situation a move produces is. */
export const MOVE_SEVERITY: Record<NpcMove, number> = {
  asks_a_favour: 3,
  calls_in_debt: 4,
  warns_you: 3,
  offers_help: 2,
  goes_quiet: 2,
  moves_against: 4,
  comes_looking: 5,
};

/** The Life category a move belongs in. */
export const MOVE_CATEGORY: Record<NpcMove, "people" | "pressure" | "opportunity"> = {
  asks_a_favour: "people",
  calls_in_debt: "pressure",
  warns_you: "people",
  offers_help: "opportunity",
  goes_quiet: "people",
  moves_against: "pressure",
  comes_looking: "pressure",
};

/**
 * Which moves come with a clock on them.
 *
 * A due date is not decoration: engine/life.ts escalates any live people or
 * pressure situation whose day has arrived, once per load, until it is dealt
 * with. That is right for a debt being collected and wrong for a favour asked —
 * a request to do somebody a good turn should not grow, load by load, into the
 * loudest thing in the character's life.
 *
 * `offers_help` is an opportunity, which expires rather than escalating, so it
 * carries one too: an offer nobody takes up goes away.
 */
export const MOVE_DEADLINE: Record<NpcMove, boolean> = {
  asks_a_favour: false,
  calls_in_debt: true,
  warns_you: false,
  offers_help: true,
  goes_quiet: false,
  moves_against: true,
  comes_looking: true,
};

/**
 * Moves that only make sense at certain hours.
 *
 * `partOfDay` has been computed since the clock shipped and used for almost
 * nothing. A landlord does not knock at four in the morning, and somebody
 * coming to find you does it when the street is empty.
 */
export const MOVE_HOURS: Partial<Record<NpcMove, ReadonlyArray<string>>> = {
  asks_a_favour: ["morning", "afternoon", "evening"],
  calls_in_debt: ["morning", "afternoon", "evening"],
  offers_help: ["morning", "afternoon", "evening"],
  comes_looking: ["night", "evening"],
};

/** True when this move is one that could plausibly happen at this hour. */
export function moveFitsHour(move: NpcMove, minute: number): boolean {
  const hours = MOVE_HOURS[move];
  return !hours || hours.includes(partOfDay(minute));
}

// ---------------------------------------------------------------------------
// Who moves.
// ---------------------------------------------------------------------------

/** What the tick needs to know about a person. Read off the campaign's rows. */
export type TickPerson = {
  key: string;
  name: string;
  /** −3..3. Strong feelings in either direction are what make somebody act. */
  disposition: number;
  /** Days since the character last dealt with them. */
  quietDays: number;
  /**
   * True when this person is somebody who survived a job and holds a grudge
   * that has now come due. They are the reason the tick exists.
   */
  grudgeDue?: boolean;
};

/** Below this many days of silence, nobody has had time to start brooding. */
export const BROODING_DAYS = 3;

/**
 * How motivated somebody is to do something about the character.
 *
 * Silence and strong feeling both push it up; a neutral acquaintance seen
 * yesterday scores nothing, which is correct — they have no reason to call.
 */
export function motivation(person: TickPerson): number {
  if (person.grudgeDue) return 1000; // Somebody who is coming for you comes first.
  if (person.quietDays < BROODING_DAYS) return 0;
  return person.quietDays + Math.abs(person.disposition) * 3;
}

/** The one person most likely to act, or nobody when none has a reason. */
export function whoMoves(people: TickPerson[]): TickPerson | null {
  let best: TickPerson | null = null;
  let bestScore = 0;
  for (const person of people) {
    const score = motivation(person);
    // Ties go to whoever has been quiet longest, then to a stable name order,
    // so the same state always produces the same person.
    if (score <= 0) continue;
    if (
      score > bestScore ||
      (score === bestScore &&
        best !== null &&
        (person.quietDays > best.quietDays ||
          (person.quietDays === best.quietDays && person.key < best.key)))
    ) {
      best = person;
      bestScore = score;
    }
  }
  return best;
}

/**
 * What this person does, given how they feel about the character.
 *
 * Read off disposition, which is the campaign's own record of the relationship
 * rather than anything the model said. Somebody who hates the character does
 * not offer to help, and somebody who is owed a favour does not come looking.
 */
export function moveFor(person: TickPerson, minute: number): NpcMove {
  const candidates: NpcMove[] = person.grudgeDue
    ? ["comes_looking", "moves_against"]
    : person.disposition <= -3
      ? ["moves_against", "comes_looking"]
      : person.disposition <= -1
        ? ["goes_quiet", "moves_against"]
        : person.disposition >= 2
          ? ["offers_help", "warns_you", "asks_a_favour"]
          : ["asks_a_favour", "warns_you", "calls_in_debt"];

  // The first candidate the hour allows. Every list ends in something with no
  // hour restriction, so this cannot fall through to nothing.
  return candidates.find((move) => moveFitsHour(move, minute)) ?? candidates[0]!;
}

// ---------------------------------------------------------------------------
// The whole decision.
// ---------------------------------------------------------------------------

export type TickDecision = {
  /** The roll, always, so the quiet days are visible too. */
  roll: OracleResult;
  /** Null on the common day where nobody moves. */
  person: TickPerson | null;
  move: NpcMove | null;
};

export type TickInput = {
  people: TickPerson[];
  /** Minutes into the day, for what is plausible at this hour. */
  minute: number;
  rng?: RNG;
};

/**
 * Roll the day, and decide who moved if anybody did.
 *
 * The roll happens even when nobody could possibly move, so the ledger shows
 * the quiet days were rolled rather than assumed.
 */
export function tickTheWorld(input: TickInput): TickDecision {
  const roll = rollOracle(WORLD_TICK, input.rng ?? defaultRng);
  if (!somebodyMoves(roll)) return { roll, person: null, move: null };

  const person = whoMoves(input.people);
  if (!person) return { roll, person: null, move: null };

  return { roll, person, move: moveFor(person, input.minute) };
}

/** "Kiro Tanaka has been thinking about you" for the situation title. */
export function describeMove(person: TickPerson, move: NpcMove): string {
  switch (move) {
    case "asks_a_favour":
      return `${person.name} wants something`;
    case "calls_in_debt":
      return `${person.name} is collecting`;
    case "warns_you":
      return `${person.name} has heard something`;
    case "offers_help":
      return `${person.name} is offering`;
    case "goes_quiet":
      return `${person.name} has stopped answering`;
    case "moves_against":
      return `${person.name} has done something`;
    case "comes_looking":
      return `${person.name} is looking for you`;
  }
}
