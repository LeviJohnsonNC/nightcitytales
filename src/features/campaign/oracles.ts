/**
 * Consulting the oracles, and remembering what they said.
 *
 * src/engine/oracle.ts holds the tables and rolls them. This module is the only
 * place that decides WHEN one is consulted, writes the answer somewhere it will
 * survive a reload, and puts the open ones into the ledger where the player can
 * see them.
 *
 * Three rules run through all of it:
 *
 *  - A die is rolled in a mutation, never in a query. A query runs whenever
 *    React feels like it; a world whose dice re-roll on a refetch is not a
 *    world. Everything here is called from a turn the player took, and reads
 *    its own live state before rolling so two calls cannot roll twice.
 *
 *  - An open roll goes to the ledger as `oracle_roll` and shows up in the log
 *    immediately. A secret one goes in as `oracle_secret`, a type nothing
 *    renders, and only becomes visible when the fiction has delivered it and
 *    something calls the reveal. Separating them by TYPE rather than by a field
 *    means a screen cannot leak one by forgetting to check.
 *
 *  - The model never sees a table, never picks one, and never learns a secret
 *    answer before the engine hands it over.
 */
import {
  COMPLICATION,
  OPEN_QUESTION,
  STREET,
  WIRE_ASKED_AROUND_BONUS,
  WIRE_BROKE_BONUS,
  WORK_ON_THE_WIRE,
  describeOracle,
  isAnswerableQuestion,
  isRealComplication,
  rollOracle,
  wireOffersWork,
  type OracleResult,
  type RNG,
} from "@/engine";
import {
  appendCampaignEvent,
  listCampaignFlags,
  setCampaignFlag,
  type CampaignFlag,
  type Json,
} from "@/lib/backend";

/** Today's answer to "is anybody calling?", kept so it is asked once a day. */
export const WIRE_ORACLE_FLAG = "oracle_wire";
/** What the current job's brief left out. Written on accept, read at settlement. */
export const COMPLICATION_FLAG = "job_complication";
/** What the street was doing, kept so it is rolled once per part of the day. */
export const STREET_ORACLE_FLAG = "oracle_street";
/** A question the model asked, waiting for the dice to answer it next turn. */
export const PENDING_QUESTION_FLAG = "oracle_question";

/** Below this, the character needs the work badly enough to go looking for it. */
export const BROKE_BELOW = 200;

// ---------------------------------------------------------------------------
// Reading what is stored. Pure, so the tests can exercise every branch.
// ---------------------------------------------------------------------------

function flagValue(flags: CampaignFlag[], flag: string): unknown {
  return flags.find((f) => f.flag === flag)?.value;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export type WireMemory = {
  /** The in-world day the wire was asked about. */
  day: number;
  /** What it said: nothing, word, or offer. */
  key: string;
  /** True once the character has spent a turn chasing work on that day. */
  chased: boolean;
};

export function wireMemoryFrom(flags: CampaignFlag[]): WireMemory | null {
  const value = record(flagValue(flags, WIRE_ORACLE_FLAG));
  if (!value) return null;
  const { day, key, chased } = value;
  if (typeof day !== "number" || !Number.isFinite(day)) return null;
  if (typeof key !== "string") return null;
  return { day, key, chased: chased === true };
}

/** True when the wire has already been consulted for this day and said yes. */
export function wireIsOpenOn(flags: CampaignFlag[], day: number): boolean {
  const memory = wireMemoryFrom(flags);
  return memory !== null && memory.day === day && memory.key === "offer";
}

/**
 * What the wire flag says once the night's work has actually been offered.
 *
 * Without it, a player who hears an offer and turns it down would be shown a
 * fresh job the same evening — the wire rolls a new seed forward the moment one
 * is offered, and "there was work tonight" would still be true.
 */
export const WIRE_SPENT = "spent";

/** Mark tonight's work as delivered, so no second job turns up this evening. */
export async function spendWire(campaignId: string, day: number): Promise<void> {
  await setCampaignFlag(campaignId, WIRE_ORACLE_FLAG, {
    day,
    key: WIRE_SPENT,
    chased: true,
  } as unknown as Json);
}

export type ComplicationMemory = {
  missionId: string;
  key: string;
  text: string;
  /** True once the player has been told, so it is not revealed twice. */
  revealed: boolean;
};

export function complicationFrom(flags: CampaignFlag[]): ComplicationMemory | null {
  const value = record(flagValue(flags, COMPLICATION_FLAG));
  if (!value) return null;
  const { missionId, key, text, revealed } = value;
  if (typeof missionId !== "string" || typeof key !== "string" || typeof text !== "string") {
    return null;
  }
  return { missionId, key, text, revealed: revealed === true };
}

/** The complication for THIS job, and only while it is still a secret. */
export function secretComplicationFor(
  flags: CampaignFlag[],
  missionId: string | null,
): ComplicationMemory | null {
  const memory = complicationFrom(flags);
  if (!memory || !missionId || memory.missionId !== missionId) return null;
  return memory.key === "none" || memory.revealed ? null : memory;
}

export function pendingQuestionFrom(flags: CampaignFlag[]): string | null {
  const value = flagValue(flags, PENDING_QUESTION_FLAG);
  if (typeof value === "string" && isAnswerableQuestion(value)) return value;
  const stored = record(value);
  const question = stored?.["question"];
  return isAnswerableQuestion(question) ? question : null;
}

// ---------------------------------------------------------------------------
// Writing an answer down.
// ---------------------------------------------------------------------------

/** The ledger line for a roll the player is allowed to watch. */
export async function logOpenOracle(campaignId: string, result: OracleResult): Promise<void> {
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "oracle_roll",
    summary: describeOracle(result),
    roll: result.roll as unknown as Json,
    data: { table: result.tableId, key: result.key } as unknown as Json,
  });
}

/**
 * The ledger line for a roll the player is NOT allowed to watch.
 *
 * It is still written, and written now, so that when the job goes sideways the
 * record shows the die was thrown before anybody knew what it meant. That is
 * the difference between an oracle and an excuse.
 */
export async function logSecretOracle(campaignId: string, result: OracleResult): Promise<void> {
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "oracle_secret",
    summary: describeOracle(result),
    roll: result.roll as unknown as Json,
    data: { table: result.tableId, key: result.key, secret: true } as unknown as Json,
  });
}

// ---------------------------------------------------------------------------
// Is there work tonight?
// ---------------------------------------------------------------------------

export type WireConsult = {
  /** True when a job may be put on the table at all this turn. */
  offered: boolean;
  key: string;
  /** True when this call actually rolled, rather than reading the day's answer. */
  rolled: boolean;
};

export type WireConsultInput = {
  campaignId: string;
  day: number;
  /** What the character has in the account, which is why they pick up the phone. */
  eurobucks: number;
  /** True when this turn was the character going out looking for work. */
  chasing?: boolean;
  rng?: RNG;
};

/**
 * Ask the wire.
 *
 * Once per in-world day, plus one extra ask on the day the character actually
 * goes looking — chasing work is an action with a real chance of finding some,
 * and a real chance of finding nothing. An answer of "offer" is never rolled
 * away again: the phone does not un-ring.
 *
 * Reads its own flags rather than trusting a caller's snapshot, so two turns
 * landing together cannot both roll for the same night.
 */
export async function consultWire(input: WireConsultInput): Promise<WireConsult> {
  const flags = await listCampaignFlags(input.campaignId);
  const memory = wireMemoryFrom(flags);
  const today = memory && memory.day === input.day ? memory : null;
  const chasing = input.chasing === true;

  if (today && (today.key === "offer" || !chasing || today.chased)) {
    return { offered: today.key === "offer", key: today.key, rolled: false };
  }

  const modifiers = [];
  if (input.eurobucks < BROKE_BELOW) modifiers.push({ label: "Broke", value: WIRE_BROKE_BONUS });
  if (chasing) modifiers.push({ label: "Asked around", value: WIRE_ASKED_AROUND_BONUS });

  const result = rollOracle(WORK_ON_THE_WIRE, input.rng, { modifiers });
  await setCampaignFlag(input.campaignId, WIRE_ORACLE_FLAG, {
    day: input.day,
    key: result.key,
    chased: chasing || today?.chased === true,
  } as unknown as Json);
  await logOpenOracle(input.campaignId, result);
  return { offered: wireOffersWork(result), key: result.key, rolled: true };
}

// ---------------------------------------------------------------------------
// What the brief left out.
// ---------------------------------------------------------------------------

/**
 * Roll the job's complication, once, at the moment the player takes the work.
 *
 * Rolled here rather than when the job is generated because the job on the wire
 * may never be taken, and because a complication that existed before anyone
 * agreed to anything would be one more thing sitting in storage waiting to leak.
 */
export async function rollComplicationFor(
  campaignId: string,
  missionId: string,
  rng?: RNG,
): Promise<ComplicationMemory> {
  const result = rollOracle(COMPLICATION, rng);
  const memory: ComplicationMemory = {
    missionId,
    key: result.key,
    text: result.text,
    revealed: false,
  };
  await setCampaignFlag(campaignId, COMPLICATION_FLAG, memory as unknown as Json);
  await logSecretOracle(campaignId, result);
  return memory;
}

/**
 * Put the complication into the log now that the job is over.
 *
 * The player gets to see, afterwards, that the thing which went wrong was rolled
 * before the job started and not invented while it was going badly. A clean
 * brief is worth showing too: "no complication" is evidence the die was real.
 *
 * Reads its own flags, so a settlement that runs twice reveals once.
 */
export async function revealComplication(
  campaignId: string,
  missionId: string | null,
): Promise<ComplicationMemory | null> {
  const memory = complicationFrom(await listCampaignFlags(campaignId));
  if (!memory || memory.revealed) return null;
  if (missionId && memory.missionId !== missionId) return null;
  await setCampaignFlag(campaignId, COMPLICATION_FLAG, {
    ...memory,
    revealed: true,
  } as unknown as Json);
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "oracle_roll",
    summary: `${COMPLICATION.label} (rolled when the job was taken): ${memory.text}`,
    data: { table: COMPLICATION.id, key: memory.key, revealed: true } as unknown as Json,
  });
  return memory;
}

/** True when a stored complication is one the GM has to build the job around. */
export function complicationIsReal(memory: ComplicationMemory | null): boolean {
  return memory !== null && memory.key !== "none";
}

// ---------------------------------------------------------------------------
// What the street is doing tonight.
// ---------------------------------------------------------------------------

/**
 * Roll what the street is doing, for a turn where nothing is already demanding
 * attention.
 *
 * Once per part of the day, not once per turn: a die thrown every time the
 * player typed something would put an intrusion in nearly every evening, which
 * is the improv-teacher failure this whole feature exists to prevent. Returns
 * null when the evening has already been rolled — the scene simply continues,
 * and the model is told nothing rather than told the same thing twice.
 *
 * Open, and always logged. The log filling with "The street tonight: 1d6(2) = 2
 * → Nothing happens" is the feature working: it is the proof that the quiet
 * nights were rolled rather than chosen.
 */
export type StreetConsult = {
  result: OracleResult;
  /** True when this call rolled, rather than finding the evening already settled. */
  rolled: boolean;
};

export type StreetConsultInput = {
  campaignId: string;
  day: number;
  /** morning, afternoon, evening, night — whichever the clock is in. */
  part: string;
  rng?: RNG;
};

export async function consultStreet(input: StreetConsultInput): Promise<StreetConsult | null> {
  const flags = await listCampaignFlags(input.campaignId);
  const stored = record(flagValue(flags, STREET_ORACLE_FLAG));
  const when = `${input.day}:${input.part}`;
  if (stored?.["when"] === when) return null;

  const result = rollOracle(STREET, input.rng);
  await setCampaignFlag(input.campaignId, STREET_ORACLE_FLAG, {
    when,
    key: result.key,
  } as unknown as Json);
  await logOpenOracle(input.campaignId, result);
  return { result, rolled: true };
}

// ---------------------------------------------------------------------------
// Questions the model asked.
// ---------------------------------------------------------------------------

/**
 * Hold a question the model raised this turn, to be answered next turn.
 *
 * Deferred on purpose: answering it now would mean a second model call inside
 * one turn, and the whole point is that the model writes the turn WITHOUT
 * knowing. It asks, the world answers, and the answer arrives as something that
 * was always true.
 */
export async function askOracle(campaignId: string, question: unknown): Promise<boolean> {
  if (!isAnswerableQuestion(question)) return false;
  await setCampaignFlag(campaignId, PENDING_QUESTION_FLAG, {
    question: question.trim(),
  } as unknown as Json);
  return true;
}

export type OracleAnswer = { question: string; answer: string; key: string };

/**
 * Answer whatever question is outstanding, and clear it.
 *
 * The roll itself is secret — the player should meet the answer as fiction, not
 * as a die — but the question and its answer go into the next prompt as fact
 * the model is not allowed to argue with.
 *
 * Reads its own flags, so one question is never answered twice.
 */
export async function answerPendingQuestion(
  campaignId: string,
  rng?: RNG,
): Promise<OracleAnswer | null> {
  const question = pendingQuestionFrom(await listCampaignFlags(campaignId));
  if (!question) return null;
  await setCampaignFlag(campaignId, PENDING_QUESTION_FLAG, null as unknown as Json);
  const result = rollOracle(OPEN_QUESTION, rng);
  await logSecretOracle(campaignId, result);
  return { question, answer: result.text, key: result.key };
}

/** Re-exported so callers do not have to reach past this module for one predicate. */
export { isAnswerableQuestion, isRealComplication };
