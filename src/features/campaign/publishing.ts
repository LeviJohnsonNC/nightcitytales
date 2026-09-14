/**
 * Filing a story, applied.
 *
 * engine/storyImpact.ts says what a believed story is worth; this is the only
 * place it becomes rows. It sits beside pressure.ts and uses the same two
 * dials, because a story is pressure — it is simply the only pressure in the
 * game that a player aims rather than accumulates.
 *
 * A story is not an observation. Observations are things the city NOTICED about
 * you and they only ever cost you; this moves a clock DOWN and a standing with
 * it, so it goes through its own path rather than being smuggled into
 * `applyObservations` as a negative.
 */
import {
  clampStanding,
  getFaction,
  standingBand,
  storyImpactFor,
  tickClock,
  type FactionId,
  type StoryImpact,
} from "@/engine";
import {
  appendCampaignEvent,
  listCampaignFactions,
  listClocks,
  upsertClock,
  upsertFactionStanding,
  type Json,
} from "@/lib/backend";
import { clockForFaction, pressureFrom, standingsFrom } from "./pressure";

/** The ledger type a published story is written under, believed or not. */
export const STORY_EVENT = "story_published";

export type PublishedStory = {
  factionId: FactionId;
  believed: boolean;
  /** The day it ran, so the next story's evidence is counted from here. */
  day: number;
  /** What it cost them and what it cost you. Null when nobody believed it. */
  impact: StoryImpact | null;
  /** Ledger lines describing what actually moved. */
  moved: string[];
};

/**
 * Publish, and let it land.
 *
 * A story nobody believed still ran: it is written to the ledger either way,
 * because "you published and it did not take" is a thing that happened and the
 * next story's evidence has to be counted from it. What it does NOT do is move
 * a dial — an unbelieved story costs the target nothing and tells them nothing.
 */
export async function publishStory(input: {
  campaignId: string;
  factionId: FactionId;
  rank: number;
  believed: boolean;
  day: number;
  evidencePieces: number;
  beatId?: string | null;
}): Promise<PublishedStory> {
  const faction = getFaction(input.factionId);
  const impact = input.believed ? storyImpactFor(input.rank) : null;
  const moved: string[] = [];

  if (impact) {
    // Their clock first: the people in the story are arrested, ousted or
    // reassigned, and whatever they were building against you loses that much.
    const definition = clockForFaction(input.factionId);
    const existing = pressureFrom(await listClocks(input.campaignId)).find(
      (p) => p.clock.key === definition.key,
    );
    if (existing && existing.clock.filled > 0) {
      const after = tickClock(existing.clock, -impact.clockSegments);
      if (after.filled !== existing.clock.filled) {
        await upsertClock(input.campaignId, {
          clockKey: after.key,
          label: definition.label,
          filled: after.filled,
          segments: definition.segments,
          hidden: definition.hidden,
          data: {
            kind: definition.kind,
            factionId: definition.factionId,
          } as unknown as Json,
        });
        moved.push(`${definition.label}: ${after.filled}/${after.segments}`);
      }
    }

    // And their opinion of you, which only ever gets worse for this.
    const rows = await listCampaignFactions(input.campaignId);
    const before = standingsFrom(rows).find((s) => s.factionId === input.factionId)?.standing ?? 0;
    const after = clampStanding(before + impact.standing);
    if (after !== before) {
      await upsertFactionStanding(input.campaignId, {
        factionId: input.factionId,
        name: faction.name,
        standing: after,
      });
      moved.push(`${faction.name} now sees you as ${standingBand(after).label}.`);
    }
  }

  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: STORY_EVENT,
    summary: input.believed
      ? `Ran a story on ${faction.name} — ${impact?.audience ?? "an audience"} believed it. ` +
        `${moved.length ? moved.join(" · ") : "Nothing on the dials moved."}`
      : `Ran a story on ${faction.name} and nobody bought it.`,
    data: {
      factionId: input.factionId,
      believed: input.believed,
      day: input.day,
      evidencePieces: input.evidencePieces,
      clockSegments: impact?.clockSegments ?? 0,
      standing: impact?.standing ?? 0,
    } as unknown as Json,
    ...(input.beatId ? { beat_id: input.beatId } : {}),
  });

  return { factionId: input.factionId, believed: input.believed, day: input.day, impact, moved };
}

/**
 * The day the last story about this faction ran, from the ledger.
 *
 * Read back rather than stored on the campaign: the ledger already holds every
 * story in order, and a second copy of "when did I last file about Arasaka"
 * would be a number that can drift from the events that produced it.
 */
export function lastStoryDayFor(
  events: { type: string; data: unknown }[],
  factionId: FactionId,
): number | null {
  let latest: number | null = null;
  for (const event of events) {
    if (event.type !== STORY_EVENT) continue;
    const data = (event.data ?? {}) as { factionId?: unknown; day?: unknown };
    if (data.factionId !== factionId) continue;
    if (typeof data.day === "number" && (latest === null || data.day > latest)) latest = data.day;
  }
  return latest;
}
