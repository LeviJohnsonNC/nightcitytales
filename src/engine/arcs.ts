/**
 * The people in your life have lives.
 *
 * The standing six have carried dossiers since the cast shipped, and since the
 * world tick shipped they have been able to act: ask a favour, go quiet, come
 * looking. But every move was a one-off. Kiro asked for something, you dealt
 * with it or you did not, and nothing that happened next had anything to do
 * with it. A person was a random table with a name on it.
 *
 * An ARC is a person's own story, running whether or not the character is
 * paying attention. Three stages, each one a move the world tick already
 * knows how to make, so nothing downstream is new: it arrives as a situation,
 * the narrator dresses it, the player deals with it or does not. What is new is
 * that the stages follow from each other, and that the last one forks on what
 * the player did about the one before it. Help the friend with the debt and
 * they come out the other side owing you; walk past it and they turn up with a
 * splinted hand and a new silence.
 *
 * The rules this module is built to keep:
 *
 *  - WITHHELD, like the dossiers. The narrator is told `brief`, which is only
 *    what somebody standing there could see or hear. The truth behind a stage,
 *    `reveal`, is never sent to the model; it reaches the player only by their
 *    engaging with the stage, and then as something THEY have worked out.
 *  - ONE PERSON A DAY. An arc beat is the world tick's move for that day, never
 *    an extra one, so a campaign with six arcs running is exactly as busy as a
 *    campaign with none — it is just that the moves mean something now.
 *  - THE ENGINE DECIDES. Which arc a person has, when a stage is due, which way
 *    the ending goes and what it does to how they feel about the character are
 *    all decided here, from data. The model finds out when the player does.
 *
 * Pure. Plain objects in, plain objects out.
 */
import data from "@/data/cast/arcs.json";
import { CAST_ROLES, type CastRole } from "./cast";
import { isNpcMove, type NpcMove } from "./worldTick";

// ---------------------------------------------------------------------------
// The library.
// ---------------------------------------------------------------------------

/** One thing that happens in somebody's story. */
export type ArcBeat = {
  move: NpcMove;
  /** The situation's title. "{name}" is the person. */
  title: string;
  /** What the narrator is told happened: only what could be seen or heard. */
  brief: string;
  /** What the person looks like while this is the latest thing, if you run into them. */
  tell: string;
  /** The truth behind it, learned only by getting involved. Never sent to the model. */
  reveal?: string;
  /** How the ending changes the way they feel about the character. Endings only. */
  disposition?: number;
};

/** A stage: a beat, or — for the last — two, forked on whether the player got involved. */
export type ArcStage =
  ({ after: number } & ArcBeat) | { after: number; involved: ArcBeat; ignored: ArcBeat };

export type Arc = {
  id: string;
  roles: CastRole[];
  /** What they look like before anything has happened yet. */
  foreshadow: string;
  stages: ArcStage[];
};

type ArcFile = { houseRule: boolean; note: string; arcs: Arc[] };
const FILE = data as unknown as ArcFile;

/** Every arc the engine can hand out. */
export const ARCS: Arc[] = FILE.arcs;

/** True when the library is what it claims to be: a house rule, tuned in data. */
export const ARCS_ARE_HOUSE_RULE: boolean = FILE.houseRule;

export function isForkedStage(
  stage: ArcStage,
): stage is { after: number; involved: ArcBeat; ignored: ArcBeat } {
  return "involved" in stage;
}

/** Every beat an arc can produce, for validation. */
export function beatsOf(arc: Arc): ArcBeat[] {
  return arc.stages.flatMap((stage) =>
    isForkedStage(stage) ? [stage.involved, stage.ignored] : [stage],
  );
}

/** Put the person's name into a line from the library. */
export function fillArc(text: string, name: string): string {
  return text.replace(/\{name\}/g, name);
}

// ---------------------------------------------------------------------------
// Where a person is in their story.
// ---------------------------------------------------------------------------

/**
 * What the campaign remembers about one person's arc. Stored on the person's
 * own row (`campaign_npcs.data.arc`), beside what they have given up and how
 * guarded they are, so there is no table for it and nothing to migrate.
 */
export type ArcState = {
  id: string;
  /** The index of the NEXT stage to fire. Equal to the stage count when done. */
  stage: number;
  /** The in-world day the last beat fired, or the day the arc began. */
  lastDay: number;
  /** Whether the player dealt with the beat that fired last. */
  involved: boolean;
  /** Which way the ending went, once it has. */
  branch?: "involved" | "ignored";
  /** Truths the player has earned, in the order they earned them. */
  learned: string[];
};

/** Stable number for a string. FNV-1a, as the haunts and the beats use. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The arc a person has, fixed by the campaign and the person: the same
 * campaign always gives Kiro the same story, and two campaigns can give the
 * same friend different ones.
 */
export function arcFor(role: CastRole, seed: string): Arc | undefined {
  const fits = ARCS.filter((arc) => arc.roles.includes(role));
  if (!fits.length) return undefined;
  return fits[hash(`${seed}:arc`) % fits.length];
}

export function getArc(id: string): Arc | undefined {
  return ARCS.find((arc) => arc.id === id);
}

/** Where a story starts: nothing has happened, and the clock runs from day zero. */
export function freshArcState(arc: Arc): ArcState {
  return { id: arc.id, stage: 0, lastDay: 0, involved: false, learned: [] };
}

/** Read a stored state back, or null when there is none or it is not one. */
export function readArcState(value: unknown): ArcState | null {
  const v = value as Partial<ArcState> | null;
  if (!v || typeof v !== "object") return null;
  if (typeof v.id !== "string" || !getArc(v.id)) return null;
  if (typeof v.stage !== "number" || typeof v.lastDay !== "number") return null;
  return {
    id: v.id,
    stage: v.stage,
    lastDay: v.lastDay,
    involved: v.involved === true,
    ...(v.branch === "involved" || v.branch === "ignored" ? { branch: v.branch } : {}),
    learned: Array.isArray(v.learned) ? v.learned.filter((l) => typeof l === "string") : [],
  };
}

/** True once every stage has fired. */
export function arcDone(arc: Arc, state: ArcState): boolean {
  return state.stage >= arc.stages.length;
}

/** The beat the next stage would produce, given what the player did last time. */
export function nextBeat(arc: Arc, state: ArcState): ArcBeat | null {
  const stage = arc.stages[state.stage];
  if (!stage) return null;
  if (!isForkedStage(stage)) return stage;
  return state.involved ? stage.involved : stage.ignored;
}

/** The beat that fired last, if any has. */
export function lastBeat(arc: Arc, state: ArcState): ArcBeat | null {
  const stage = arc.stages[state.stage - 1];
  if (!stage) return null;
  if (!isForkedStage(stage)) return stage;
  return state.branch === "involved" ? stage.involved : stage.ignored;
}

/** Days until the next stage is due; zero or less means it is due now. */
export function daysUntilDue(arc: Arc, state: ArcState, day: number): number | null {
  const stage = arc.stages[state.stage];
  if (!stage) return null;
  return state.lastDay + stage.after - day;
}

/**
 * What the person looks like right now, for when the character runs into them.
 * Before anything has happened, the foreshadowing; after, the latest beat's tell.
 */
export function currentTell(arc: Arc, state: ArcState): string {
  return lastBeat(arc, state)?.tell ?? arc.foreshadow;
}

// ---------------------------------------------------------------------------
// The day.
// ---------------------------------------------------------------------------

/** A person as the arc engine needs them. */
export type ArcPerson = {
  key: string;
  name: string;
  arc: Arc;
  state: ArcState;
};

/** One beat, ready to become a situation, and the state it leaves behind. */
export type FiredBeat = {
  person: ArcPerson;
  beat: ArcBeat;
  /** 1-based, for the ledger. */
  stage: number;
  last: boolean;
  next: ArcState;
};

/**
 * The one beat due today, if any: whoever's story is furthest overdue, ties
 * to a stable key order so the same state always gives the same answer.
 *
 * Never more than one. The world tick's rule is one person a day, and an arc
 * beat IS that day's move.
 */
export function dueArcBeat(people: ArcPerson[], day: number): FiredBeat | null {
  let best: { person: ArcPerson; overdue: number } | null = null;
  for (const person of people) {
    const until = daysUntilDue(person.arc, person.state, day);
    if (until === null || until > 0) continue;
    const overdue = -until;
    if (
      !best ||
      overdue > best.overdue ||
      (overdue === best.overdue && person.key < best.person.key)
    ) {
      best = { person, overdue };
    }
  }
  if (!best) return null;
  const { person } = best;
  const beat = nextBeat(person.arc, person.state)!;
  const forked = isForkedStage(person.arc.stages[person.state.stage]!);
  const next: ArcState = {
    ...person.state,
    stage: person.state.stage + 1,
    lastDay: day,
    involved: false,
    ...(forked ? { branch: person.state.involved ? "involved" : "ignored" } : {}),
  };
  return {
    person,
    beat,
    stage: person.state.stage + 1,
    last: next.stage >= person.arc.stages.length,
    next,
  };
}

/**
 * The player dealt with the beat that fired last. It changes which way the
 * ending goes, and it is how the truth behind the beat is learned: not by
 * asking the narrator, by being there.
 */
export function involve(arc: Arc, state: ArcState, name: string): ArcState {
  if (state.stage === 0) return state;
  const reveal = lastBeat(arc, state)?.reveal;
  const fact = reveal ? fillArc(reveal, name) : null;
  return {
    ...state,
    involved: true,
    learned: fact && !state.learned.includes(fact) ? [...state.learned, fact] : state.learned,
  };
}

/** Every role the library has to cover. For tests. */
export const ARC_ROLES: readonly CastRole[] = CAST_ROLES;
