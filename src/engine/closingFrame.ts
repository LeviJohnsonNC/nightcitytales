/**
 * The closing frame: the one moment of a job worth keeping, and the one thing
 * the world is still holding afterwards.
 *
 * A job ends, and Aftermath reads it back as a ledger — payment, observations,
 * pressure ticks. Every line is true and none of it is a scene. People remember
 * the peak of an experience and the way it ended, not its average, and they are
 * pulled back by what was left unfinished more than by what was finished. So
 * this picks exactly two things out of what the engine already recorded:
 *
 *   - the PEAK: the closest the character came to the end, or failing that the
 *     loudest die, the hardest call, the biggest hit. One line, with the
 *     engine's own trace of the roll beside it, verbatim;
 *   - the THREAD: one thing that is genuinely still open — somebody who walked
 *     away from the fight, a clock that moved toward something, a broker who
 *     did not like how it went. Never invented, never a nudge: if the world is
 *     holding nothing, it says nothing. A quiet job gets a quiet ending.
 *
 * It is computed once, when the job settles, from the whole job ledger, and
 * stored in the receipt (`frame`, read back by `readClosingFrameEventData`). It
 * decides nothing and rolls nothing; it changes no number and spends no model
 * call. Every sentence is a template over a fact.
 *
 * Pure: ledger rows in, a frame out.
 */
import {
  LEDGER_EVENTS,
  payloadOf,
  readAttackEventData,
  readCheckHighlightEventData,
  readDeathSaveEventData,
  type ClosingFrame,
} from "./ledger";
import { eventsForThisJob, type SettlementEvent } from "./settlement";

/**
 * A hit that leaves the character on this many Hit Points or fewer is a close
 * call. A presentation threshold for choosing what to retell, not a rules value.
 */
export const CLOSE_CALL_HP = 5;
/** A check set this hard or harder (Professional, DV 15) is worth retelling. */
export const HARD_CHECK_DV = 15;
/** A hit the character landed for this much or more is worth retelling. */
export const BIG_HIT_DAMAGE = 12;

/** A ledger row as the frame reads it: the settlement shape plus its trace. */
export type FrameEvent = SettlementEvent & { summary?: string | null; roll?: unknown };

type Peak = NonNullable<ClosingFrame["peak"]>;

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

const trace = (event: FrameEvent): string | null => event.summary?.trim() || null;

/**
 * The moment of the job that mattered most, in order of how near the end it was:
 * a Death Save survived; a hit that left almost nothing; a natural 10 or 1; the
 * hardest check the table set; the biggest hit landed. Within a kind, the most
 * extreme wins and the later of two equals does.
 */
export function peakMoment(input: { events: FrameEvent[]; playerName: string }): Peak | null {
  const events = eventsForThisJob(input.events);
  const me = input.playerName;

  // 1. A Death Save survived: the closest the engine has a record of.
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]!;
    if (event.type !== LEDGER_EVENTS.deathSave) continue;
    const save = readDeathSaveEventData(payloadOf(event));
    if (save?.survived && sameName(save.combatant, me)) {
      return {
        kind: "death_save",
        headline: "You were one roll from the end, and the Death Save held.",
        trace: trace(event),
      };
    }
  }

  // 2. The lowest the character was left by a hit.
  let closest: { hp: number; attacker: string; weapon: string | null; event: FrameEvent } | null =
    null;
  for (const event of events) {
    if (event.type !== LEDGER_EVENTS.attack) continue;
    const hit = readAttackEventData(payloadOf(event));
    if (!hit || !sameName(hit.target, me) || hit.hit === false || hit.hpAfter === null) continue;
    if (hit.hpAfter > CLOSE_CALL_HP) continue;
    if (closest === null || hit.hpAfter <= closest.hp) {
      closest = { hp: hit.hpAfter, attacker: hit.attacker, weapon: hit.weapon, event };
    }
  }
  if (closest) {
    const by = closest.weapon ? `${closest.attacker}'s ${closest.weapon}` : closest.attacker;
    return {
      kind: "close_call",
      headline:
        closest.hp <= 0
          ? `${by} put you at 0 Hit Points. You still got out.`
          : `${by} left you at ${closest.hp} Hit Point${closest.hp === 1 ? "" : "s"}. You still got out.`,
      trace: trace(closest.event),
    };
  }

  // 3 and 4 read the checks.
  const checks = events.flatMap((event) => {
    if (event.type !== "skill_check" && event.type !== "opposed_check") return [];
    const check = readCheckHighlightEventData(event.data, event.roll);
    return check ? [{ event, check }] : [];
  });
  const named = (c: (typeof checks)[number]["check"]) => c.skillName ?? c.skillId ?? "the roll";

  // 3. A natural 10 or a natural 1, the later the better.
  const natural = [...checks].reverse().find((c) => c.check.critical !== null);
  if (natural) {
    const { check, event } = natural;
    return {
      kind: "critical",
      headline:
        check.critical === "success"
          ? `A natural 10 on ${named(check)}${check.success === false ? ", and it still was not enough." : "."}`
          : `A natural 1 on ${named(check)}. It came apart.`,
      trace: trace(event),
    };
  }

  // 4. The hardest call the table set, made or missed.
  let hardest: (typeof checks)[number] | null = null;
  for (const c of checks) {
    if (c.check.dv === null || c.check.dv < HARD_CHECK_DV) continue;
    if (hardest === null || c.check.dv >= hardest.check.dv!) hardest = c;
  }
  if (hardest) {
    const { check, event } = hardest;
    const luck = check.luckSpent > 0 ? ` You burned ${check.luckSpent} Luck on it.` : "";
    const margin =
      check.margin !== null && check.margin !== 0 ? ` by ${Math.abs(check.margin)}` : "";
    const outcome =
      check.success === null
        ? ""
        : check.success
          ? ` — you made it${margin}.`
          : ` — you missed it${margin}.`;
    return {
      kind: "hardest_check",
      headline: `The hardest call of the job: ${named(check)} against DV ${check.dv}${outcome || "."}${luck}`,
      trace: trace(event),
    };
  }

  // 5. The biggest hit the character landed.
  let biggest: { damage: number; target: string; weapon: string | null; event: FrameEvent } | null =
    null;
  for (const event of events) {
    if (event.type !== LEDGER_EVENTS.attack) continue;
    const hit = readAttackEventData(payloadOf(event));
    if (!hit || !sameName(hit.attacker, me) || hit.hit === false || hit.damage === null) continue;
    if (hit.damage < BIG_HIT_DAMAGE) continue;
    if (biggest === null || hit.damage >= biggest.damage) {
      biggest = { damage: hit.damage, target: hit.target, weapon: hit.weapon, event };
    }
  }
  if (biggest) {
    return {
      kind: "big_hit",
      headline: `${biggest.weapon ? `Your ${biggest.weapon}` : "Your shot"} did ${biggest.damage} to ${biggest.target}.`,
      trace: trace(biggest.event),
    };
  }
  return null;
}

export type ThreadInput = {
  /** People who walked away from a fight with the character. */
  survivors: string[];
  /** Clocks the job moved, as settlement wrote them. */
  clocks: { label: string; before: number; filled: number; segments: number; hidden: boolean }[];
  /** People whose disposition the job moved. */
  people: { key: string; name: string; before: number | null; after: number }[];
  /** Who brought the job. */
  brokerKey: string | null;
};

/**
 * One thing still open. A survivor first, because that is somebody; then a
 * clock the job pushed toward a half or more of its way round; then a broker who
 * is colder than they were. A hidden clock is never named: the player has not
 * been told it exists.
 */
export function openThread(input: ThreadInput): ClosingFrame["thread"] {
  const [first, ...rest] = input.survivors;
  if (first) {
    const who =
      rest.length === 0
        ? first
        : `${first} and ${rest.length} other${rest.length === 1 ? "" : "s"}`;
    return {
      kind: "survivor",
      text: `${who} walked away from it, and ${rest.length === 0 ? "is" : "are"} still out there.`,
    };
  }

  let hottest: ThreadInput["clocks"][number] | null = null;
  for (const clock of input.clocks) {
    if (clock.hidden || clock.segments <= 0 || clock.filled <= clock.before) continue;
    if (clock.filled * 2 < clock.segments) continue;
    if (!hottest || clock.filled / clock.segments >= hottest.filled / hottest.segments) {
      hottest = clock;
    }
  }
  if (hottest) {
    return {
      kind: "clock",
      text: `${hottest.label} is at ${hottest.filled} of ${hottest.segments}, and rising.`,
    };
  }

  const broker = input.people.find((p) => p.key === input.brokerKey);
  if (broker && broker.before !== null && broker.after < broker.before) {
    return { kind: "cold", text: `${broker.name} did not like how that went.` };
  }
  return null;
}

/**
 * The frame for a settled job, or null when there is nothing to keep: a clean,
 * quiet job closes without ceremony.
 */
export function closingFrame(input: {
  title: string | null;
  events: FrameEvent[];
  playerName: string;
  thread: ThreadInput;
}): ClosingFrame | null {
  const peak = peakMoment({ events: input.events, playerName: input.playerName });
  const thread = openThread(input.thread);
  if (peak === null && thread === null) return null;
  return { title: input.title, peak, thread };
}
