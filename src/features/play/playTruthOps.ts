/**
 * What a job gives up: the truths a beat reveals on arrival, and what a search
 * or a deduction finds. Split out of playOps.ts. No React and no TanStack
 * Query in here.
 */

import {
  DEDUCTION_SKILL,
  DEFAULT_START,
  isSearchSkill,
  resolvePosition,
  searchWith,
  searchesFor,
  truthsAt,
  truthsInBeat,
  truthsInMission,
  truthsRevealedAt,
  type Mission,
  type SkillCheckResult,
} from "@/engine";
import { appendCampaignEvent, recordTruthDiscovery, type Json } from "@/lib/backend";
import type { PendingCheck } from "./checkPrompt";
import type { PlayBundle } from "./playBundleOps";

/**
 * The twists a beat lands on arrival, whatever anybody rolled.
 *
 * A story that reaches the scene built to expose a secret should not depend on
 * somebody having searched well two beats earlier — the complication beat's
 * whole job is to reveal that the floor plan was wrong. So a truth may name the
 * beat that reveals it, and reaching that beat records it as found.
 *
 * Persisted rather than derived, because once something is known it stays known
 * and the story moves on past the scene that told it.
 */
export async function revealBeatTruths(
  bundle: PlayBundle,
  mission: Mission,
  toBeatId: string,
): Promise<void> {
  if (!bundle.truthsAvailable) return;
  for (const beat of mission.beats) {
    for (const truth of truthsRevealedAt({
      missionId: mission.id,
      beatId: beat.id,
      truths: beat.truths,
      atBeatId: toBeatId,
    })) {
      if (bundle.discoveredTruths.includes(truth.key)) continue;
      const stored = await recordTruthDiscovery(bundle.campaign.id, {
        truthKey: truth.key,
        discoveredDay: bundle.campaign.day,
        viaSkill: null,
      });
      if (!stored) continue;
      await appendCampaignEvent({
        campaign_id: bundle.campaign.id,
        type: "truth_found",
        summary: truth.fact,
        data: { truthKey: truth.key, beatId: toBeatId } as unknown as Json,
      });
    }
  }
}

/**
 * Looking for something inside a job, and what the engine says is there.
 *
 * The Life loop has had this since the truth spine landed; a job is where it
 * matters most, because a job is where the concealed things are. Professor
 * Huntver's office used to say "the evidence, IF SEARCHED, is damning" and then
 * list it in the same breath — a discovery system written as a parenthesis, with
 * the whole of it handed to the narrator on arrival.
 *
 * Searches the beat's own concealed facts first, then the ground underfoot, so a
 * scene built around a hidden thing answers before the building's generic tags
 * do. Null when this was not a search, when nothing is found and nothing was
 * there, or while `campaign_truths` is unmigrated.
 *
 * DEDUCTION IS NOT A SEARCH OF THE ROOM. Every other Skill here looks at what
 * is in front of the character; a conclusion is worked out from everything they
 * have gathered, wherever they happen to be standing when it clicks. So its
 * pool is the whole job rather than this beat, and what gates it is not the
 * difficulty but the prerequisites: the pieces have to be in hand.
 */
export async function applyJobSearch(
  bundle: PlayBundle,
  pending: PendingCheck,
  result: SkillCheckResult,
): Promise<string | null> {
  if (!bundle.truthsAvailable) return null;

  const at = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
  const deducing = pending.skillId === DEDUCTION_SKILL;
  const candidates = [
    ...(bundle.mission
      ? deducing
        ? truthsInMission({ missionId: bundle.mission.id, beats: bundle.mission.beats })
        : bundle.beat
          ? truthsInBeat({
              missionId: bundle.mission.id,
              beatId: bundle.beat.id,
              truths: bundle.beat.truths,
            })
          : []
      : []),
    ...(at?.placeKey ? truthsAt(at.placeKey, bundle.places[at.placeKey]) : []),
  ];

  // The guard that keeps a search outcome off a check that was not one: a
  // successful Athletics roll over a fence must not come back with "there is
  // nothing here to find".
  if (!searchesFor(pending.skillId, candidates)) return null;

  const search = searchWith({
    truths: candidates,
    skillId: pending.skillId,
    discovered: bundle.discoveredTruths,
    total: result.total,
  });

  if (search.outcome === "nothing") {
    // Silence for a conclusion that is not available: saying "there was
    // nothing to work out" tells the player there is nothing to chase, which
    // may simply mean they have not found the pieces yet.
    if (!result.success || deducing || !isSearchSkill(pending.skillId)) return null;
    return (
      "They searched properly and there is NOTHING here to find. Say so plainly rather than " +
      "inventing something small so the roll was not wasted — knowing a room is clean is worth " +
      "knowing, and on a job it is worth a great deal."
    );
  }
  if (search.outcome === "missed") {
    return deducing
      ? "They turned it over and it did NOT come together. There is something to be worked out " +
          "here and this was not the moment — narrate the thinking and the not-quite, and do not " +
          "hint at what it was."
      : "They did not find it. There IS something here and the search did not reach it — narrate " +
          "the looking and the coming up empty, and do not hint at what was missed.";
  }

  const stored = await recordTruthDiscovery(bundle.campaign.id, {
    truthKey: search.truth.key,
    discoveredDay: bundle.campaign.day,
    viaSkill: pending.skillId,
  });
  if (!stored) return null;
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: "truth_found",
    summary: search.truth.fact,
    data: { truthKey: search.truth.key, beatId: bundle.beat?.id ?? null } as unknown as Json,
  });
  return deducing
    ? `They WORKED IT OUT, and this is the conclusion, exactly: ${search.truth.fact} ` +
        "Narrate the character reaching that, off what they already knew. Do not add a second " +
        "conclusion beside it, and do not carry it further than it goes."
    : `They FOUND something, and this is it, exactly: ${search.truth.fact} ` +
        "Narrate them finding that. Do not add a second discovery beside it and do not enlarge " +
        "on what it means — working out what it means is the player's job.";
}
