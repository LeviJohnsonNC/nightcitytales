/**
 * Running the day, once.
 *
 * engine/worldTick.ts decides WHO moves and WHAT they do. This decides WHEN it
 * is asked, writes down what it said, and turns the answer into something the
 * Life loop already knows how to put in front of the player.
 *
 * Two decisions worth stating plainly:
 *
 *  - The tick runs ONCE per in-world day, guarded by a stored day. It is called
 *    from a mutation, never a query, and reads its own flag before writing, so
 *    a refetch cannot re-roll the night.
 *
 *  - A player who slept through five days gets ONE tick, not five. Five people
 *    moving at once is the notification tray this whole feature is written to
 *    avoid, and the world does not owe you a backlog.
 */
import {
  MOVE_CATEGORY,
  MOVE_DEADLINE,
  MOVE_MEANINGS,
  MOVE_SEVERITY,
  describeMove,
  tickTheWorld,
  type NpcMove,
  type TickPerson,
} from "@/engine";
import {
  appendCampaignEvent,
  listCampaignFlags,
  setCampaignFlag,
  setSituationStatus,
  upsertSituations,
  type CampaignFlag,
  type CampaignNpc,
  type Json,
  type SituationUpsert,
} from "@/lib/backend";
import { logOpenOracle } from "./oracles";

/** The last in-world day the world was allowed to move. */
export const WORLD_TICK_FLAG = "world_tick_day";
/** The ledger type a move is written under. */
export const MOVED_EVENT = "world_moved";
/** How long a move waits before it stops being news. */
export const MOVE_DUE_DAYS = 3;
/** How long after you pass on a job before somebody else has done it. */
export const GIG_TAKEN_AFTER_DAYS = 2;

// ---------------------------------------------------------------------------
// Reading the campaign into what the engine needs.
// ---------------------------------------------------------------------------

function lastSeenDay(npc: CampaignNpc): number | null {
  const value = (npc.data as { lastSeenDay?: unknown } | null)?.lastSeenDay;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** True when this person is owed a reckoning that has now come due. */
export function grudgeIsDue(
  npcKey: string,
  situations: { situationKey?: string; key?: string; dueDay?: number | null; status?: string }[],
  day: number,
): boolean {
  return situations.some((s) => {
    const key = s.situationKey ?? s.key ?? "";
    if (key !== `grudge_${npcKey}`) return false;
    if (s.status && s.status !== "live") return false;
    return typeof s.dueDay === "number" && s.dueDay <= day;
  });
}

/**
 * The cast as the tick sees them.
 *
 * Somebody never dealt with counts as quiet since the campaign began rather
 * than as seen today: a person you have never once called has been waiting the
 * longest, not the least.
 */
export function peopleFor(
  npcs: CampaignNpc[],
  day: number,
  situations: Parameters<typeof grudgeIsDue>[1],
): TickPerson[] {
  return npcs
    .filter((npc) => npc.status !== "dead")
    .map((npc) => {
      const seen = lastSeenDay(npc);
      const key = npc.npc_id ?? npc.name;
      return {
        key,
        name: npc.name,
        disposition: npc.disposition,
        quietDays: seen === null ? day : Math.max(0, day - seen),
        ...(grudgeIsDue(key, situations, day) ? { grudgeDue: true } : {}),
      };
    });
}

// ---------------------------------------------------------------------------
// What a move becomes.
// ---------------------------------------------------------------------------

/** The Life situation a move produces, for the model to meet as already true. */
export function situationFor(person: TickPerson, move: NpcMove, day: number): SituationUpsert {
  return {
    // Keyed on the person, not the move: one person has one outstanding thing
    // with you at a time, and a second move replaces the first rather than
    // stacking two conversations about the same relationship.
    situationKey: `moved_${person.key}`,
    category: MOVE_CATEGORY[move],
    title: describeMove(person, move),
    // The summary says WHAT, never WHY. The why is in a dossier the model has
    // never been shown, and a model told what somebody wants will have them
    // explain it inside two sentences.
    summary: `${person.name}: ${MOVE_MEANINGS[move]}.`,
    npcKey: person.key,
    status: "live",
    severity: MOVE_SEVERITY[move],
    // Only the moves that actually have a clock on them get a due day, because
    // a deadline is a promise that something changes when it passes. Somebody
    // going quiet has nothing to come due; a debt called in does.
    dueDay: MOVE_DEADLINE[move] ? day + MOVE_DUE_DAYS : null,
    data: { move, movedOnDay: day } as unknown as Json,
  };
}

// ---------------------------------------------------------------------------
// Gigs somebody else took.
// ---------------------------------------------------------------------------

/** Jobs the character passed on that nobody has been reported taking yet. */
export const COLD_GIGS_FLAG = "declined_gigs";

export type DeclinedGig = { title: string; day: number };

/** The stored list of jobs still waiting for somebody else to do them. */
export function coldGigsFrom(flags: CampaignFlag[]): DeclinedGig[] {
  const value = flags.find((f) => f.flag === COLD_GIGS_FLAG)?.value;
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is DeclinedGig => {
    if (!row || typeof row !== "object") return false;
    const gig = row as { title?: unknown; day?: unknown };
    return typeof gig.title === "string" && typeof gig.day === "number";
  });
}

/**
 * Write down that the character walked away from a job.
 *
 * Stored rather than re-derived. This used to scan the whole campaign ledger
 * for `hook_declined` rows on every world tick, cross-referenced against every
 * tick that had ever fired — two full-history walks a day, growing forever, to
 * answer a question that is really just a short list.
 *
 * Reads its own flags rather than taking a caller's snapshot, so two declines
 * in quick succession cannot each write a list missing the other.
 */
export async function rememberDeclined(campaignId: string, gig: DeclinedGig): Promise<void> {
  const known = coldGigsFrom(await listCampaignFlags(campaignId));
  if (known.some((g) => g.title === gig.title)) return;
  await setCampaignFlag(campaignId, COLD_GIGS_FLAG, [...known, gig] as unknown as Json);
}

/** Jobs old enough for somebody else to have finished them by now. */
export function gigsGoneCold(flags: CampaignFlag[], day: number): DeclinedGig[] {
  return coldGigsFrom(flags).filter((gig) => day - gig.day >= GIG_TAKEN_AFTER_DAYS);
}

/** Take a gig off the list once the player has heard somebody else did it. */
async function forgetDeclined(
  campaignId: string,
  flags: CampaignFlag[],
  title: string,
): Promise<void> {
  const left = coldGigsFrom(flags).filter((gig) => gig.title !== title);
  await setCampaignFlag(campaignId, COLD_GIGS_FLAG, left as unknown as Json);
}

// ---------------------------------------------------------------------------
// The day itself.
// ---------------------------------------------------------------------------

export type WorldTickResult = {
  /** Null when the day had already been run. */
  ran: boolean;
  personName: string | null;
  move: NpcMove | null;
  /** A job somebody else finished while the player was not looking. */
  gigTaken: string | null;
};

export type WorldTickInput = {
  campaignId: string;
  day: number;
  minute: number;
  npcs: CampaignNpc[];
  situations: Parameters<typeof grudgeIsDue>[1];
};

/**
 * Give the world its turn.
 *
 * Reads its own flag rather than trusting a caller's snapshot: a query refetch
 * that re-ran this would re-roll a night that had already happened.
 */
export async function runWorldTick(input: WorldTickInput): Promise<WorldTickResult> {
  const flags = await listCampaignFlags(input.campaignId);
  const last = flags.find((f) => f.flag === WORLD_TICK_FLAG)?.value;
  const lastDay = typeof last === "number" && Number.isFinite(last) ? last : null;
  if (lastDay !== null && lastDay >= input.day) {
    return { ran: false, personName: null, move: null, gigTaken: null };
  }

  // Claimed before anything is rolled, so a second caller finds the day spent.
  await setCampaignFlag(input.campaignId, WORLD_TICK_FLAG, input.day as unknown as Json);

  const decision = tickTheWorld({
    people: peopleFor(input.npcs, input.day, input.situations),
    minute: input.minute,
  });
  await logOpenOracle(input.campaignId, decision.roll);

  const situations: SituationUpsert[] = [];
  if (decision.person && decision.move) {
    situations.push(situationFor(decision.person, decision.move, input.day));
    // A grudge that has arrived is no longer pending. Left live it would keep
    // escalating AND keep marking this person as due, so they would win every
    // future night's roll — the same person on the doorstep forever.
    if (decision.person.grudgeDue) {
      await setSituationStatus(input.campaignId, `grudge_${decision.person.key}`, "resolved");
    }
  }

  // A gig you passed on that nobody ever does was never a choice. One per tick:
  // hearing about three at once is a news bulletin, not a consequence.
  const cold = gigsGoneCold(flags, input.day)[0] ?? null;
  if (cold) {
    situations.push({
      situationKey: `gig_taken_${cold.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      category: "opportunity",
      title: "Word is going around",
      summary: `Somebody else took "${cold.title}" after the character passed on it.`,
      status: "live",
      severity: 2,
      dueDay: input.day + MOVE_DUE_DAYS,
    });
  }

  if (cold) await forgetDeclined(input.campaignId, flags, cold.title);

  if (situations.length > 0) await upsertSituations(input.campaignId, situations);

  if (decision.person || cold) {
    await appendCampaignEvent({
      campaign_id: input.campaignId,
      type: MOVED_EVENT,
      summary: decision.person
        ? describeMove(decision.person, decision.move!)
        : `Word is going around about "${cold!.title}".`,
      data: {
        npcKey: decision.person?.key ?? null,
        move: decision.move,
        gigTaken: cold?.title ?? null,
        day: input.day,
      } as unknown as Json,
    });
  }

  return {
    ran: true,
    personName: decision.person?.name ?? null,
    move: decision.move,
    gigTaken: cold?.title ?? null,
  };
}

/**
 * Take a person's outstanding move off the board.
 *
 * A move is WRITTEN, not derived, so nothing re-derives it away the way a
 * `person_` situation resolves itself once you have called somebody. Dealing
 * with them is what ends it — and the grudge that sent them, if one did, is
 * over too: it has arrived, which was the whole point of its due date.
 */
export async function settleMoves(campaignId: string, npcKey: string): Promise<void> {
  await setSituationStatus(campaignId, `moved_${npcKey}`, "resolved");
  await setSituationStatus(campaignId, `grudge_${npcKey}`, "resolved");
}
