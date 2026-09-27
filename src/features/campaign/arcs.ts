/**
 * Cast arcs, written down.
 *
 * engine/arcs.ts decides whose story it is, when the next stage is due, which
 * way the ending goes and what getting involved reveals. This reads a
 * campaign's people into what it needs, turns a beat into a situation the Life
 * loop already knows how to show, and writes the story's progress onto the
 * person's own row (`campaign_npcs.data.arc`), beside what they have given up
 * and how guarded they are. No table, no migration.
 */
import {
  MOVE_CATEGORY,
  MOVE_DEADLINE,
  MOVE_SEVERITY,
  arcFor,
  clampDisposition,
  currentTell,
  fillArc,
  freshArcState,
  getArc,
  involve,
  readArcState,
  type ArcPerson,
  type ArcState,
  type FiredBeat,
} from "@/engine";
import {
  saveCampaignNpc,
  setNpcDisposition,
  setSituationStatus,
  type CampaignNpc,
  type Json,
  type SituationUpsert,
} from "@/lib/backend";
import { castMemberFrom } from "./castSeeding";

/** The situation key an arc beat is filed under. One per person, like a move. */
export function arcSituationKey(npcKey: string): string {
  return `arc_${npcKey}`;
}

/** How long a beat that asks something of the player stays news. */
export const ARC_DUE_DAYS = 3;

/**
 * A person's story, read off their row: the stored state if they have one,
 * otherwise the arc the campaign would give them, from its start. Null for
 * anybody who is not one of the six, and for the dead.
 */
export function arcPersonFor(npc: CampaignNpc, campaignId: string): ArcPerson | null {
  if (npc.status === "dead") return null;
  const member = castMemberFrom(npc);
  if (!member) return null;
  const stored = readArcState((npc.data as { arc?: unknown } | null)?.arc);
  const arc = stored ? getArc(stored.id) : arcFor(member.role, `${campaignId}:${member.key}`);
  if (!arc) return null;
  return { key: member.key, name: member.name, arc, state: stored ?? freshArcState(arc) };
}

/** Everybody with a story, in the campaign's own order. */
export function arcPeopleFor(npcs: CampaignNpc[], campaignId: string): ArcPerson[] {
  const seen = new Set<string>();
  const out: ArcPerson[] = [];
  for (const npc of npcs) {
    const person = arcPersonFor(npc, campaignId);
    // campaign_npcs has no uniqueness constraint; one person, one story.
    if (!person || seen.has(person.key)) continue;
    seen.add(person.key);
    out.push(person);
  }
  return out;
}

/** What somebody looks like tonight, if they have a story. */
export function arcTellFor(npc: CampaignNpc | undefined, campaignId: string): string | null {
  const person = npc ? arcPersonFor(npc, campaignId) : null;
  return person ? fillArc(currentTell(person.arc, person.state), person.name) : null;
}

/** What the player has worked out from getting involved in somebody's story. */
export function arcLearnedOf(npc: CampaignNpc): string[] {
  return readArcState((npc.data as { arc?: unknown } | null)?.arc)?.learned ?? [];
}

/**
 * A beat, as a Life situation. The summary is the brief — what was seen and
 * heard — and never the reveal, which is not sent to the model at all.
 */
export function situationForBeat(fired: FiredBeat, day: number): SituationUpsert {
  const { person, beat } = fired;
  return {
    situationKey: arcSituationKey(person.key),
    category: MOVE_CATEGORY[beat.move],
    title: fillArc(beat.title, person.name),
    summary: fillArc(beat.brief, person.name),
    npcKey: person.key,
    status: "live",
    severity: MOVE_SEVERITY[beat.move],
    dueDay: MOVE_DEADLINE[beat.move] ? day + ARC_DUE_DAYS : null,
    data: {
      arcId: person.arc.id,
      stage: fired.stage,
      move: beat.move,
    } as unknown as Json,
  };
}

/** Write a person's story forward, and apply an ending's effect on how they feel. */
export async function saveFiredBeat(
  campaignId: string,
  npc: CampaignNpc,
  fired: FiredBeat,
): Promise<void> {
  await saveArcState(campaignId, npc, fired.next);
  const delta = fired.beat.disposition ?? 0;
  if (delta !== 0) await setNpcDisposition(npc.id, clampDisposition(npc.disposition + delta));
}

/**
 * The player dealt with the latest beat of somebody's story: the ending will
 * go the warmer way, and whatever that beat was hiding is now something they
 * have worked out. The situation is theirs to close, having dealt with it.
 */
export async function noteArcInvolvement(campaignId: string, npc: CampaignNpc): Promise<void> {
  const person = arcPersonFor(npc, campaignId);
  if (!person || person.state.stage === 0) return;
  const next = involve(person.arc, person.state, person.name);
  if (next !== person.state) await saveArcState(campaignId, npc, next);
  await setSituationStatus(campaignId, arcSituationKey(person.key), "resolved");
}

async function saveArcState(campaignId: string, npc: CampaignNpc, state: ArcState): Promise<void> {
  const data = (npc.data ?? {}) as Record<string, unknown>;
  await saveCampaignNpc(campaignId, npc.npc_id ?? npc.name, {
    data: { ...data, arc: state } as unknown as Json,
  });
}
