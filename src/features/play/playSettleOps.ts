/**
 * How a job ends: settling a finished mission, the I.P. award, the return to
 * Life, and the Job-specific consequence of a death. Split out of playOps.ts,
 * which re-exports what other modules use. No React and no TanStack Query in
 * here.
 */

import { commitDeathSave as commitCombatDeathSave } from "./combatOps";
import {
  LEDGER_EVENTS,
  failMission,
  findFactionIn,
  luckPoolMax,
  milestoneEventData,
  missionPayout,
  nextPhase,
  phaseOf,
  type BeginTurnResult,
  type FactionId,
  type IpPlaystyle,
  type Mission,
  type MissionRuntime,
} from "@/engine";
import { settleAftermath } from "@/features/campaign/aftermath";
import { climbNews, milestoneWritten } from "@/features/campaign/climbNews";
import { judgeAndAward, type IpTally } from "@/features/campaign/ipAward";
import { saveMissionRuntime } from "@/features/campaign/missionState";
import { revealComplication } from "@/features/campaign/oracles";
import {
  appendCampaignEvent,
  closeAftermath,
  setCampaignPhase,
  updateCampaign,
  type Json,
} from "@/lib/backend";
import type { PendingDeathSave } from "./deathSavePrompt";
import { statsRecord } from "./playModel";
import type { PlayBundle } from "./playBundleOps";

/**
 * A finished job: pay the printed reward into the campaign's eurobucks, write
 * the wrap-up to the ledger, and close the campaign. Every number comes from
 * the mission's own reward block — nothing is invented here.
 */
export async function settleMission(
  bundle: PlayBundle,
  runtime: MissionRuntime,
  mission: Mission,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const printed = missionPayout(mission);
  // A fee argued upwards at the offer is what this job pays. The printed reward
  // is the floor, never a cap the negotiation is quietly reverted to.
  const total =
    bundle.agreedPayout !== null && printed
      ? Math.max(printed.total, bundle.agreedPayout)
      : (printed?.total ?? bundle.agreedPayout ?? 0);
  const payout = printed ? { ...printed, total } : null;
  const done = runtime.objectives.filter((o) => o.status === "done").length;
  // What was AGREED, not what arrived: the settlement receipt records the
  // amount that actually lands. Completion and settlement are committed in the
  // same transaction so a retry cannot duplicate either ledger row.
  const completionSummary = payout
    ? `${mission.title} complete — ${payout.total}eb agreed (${payout.upfront}eb up front, ${payout.onCompletion}eb on delivery); ${done}/${runtime.objectives.length} objectives closed.`
    : `${mission.title} complete — ${done}/${runtime.objectives.length} objectives closed. This job records no printed payout.`;

  // The trip home. What the job cost is read off its own ledger, the money is
  // rolled for, whoever walked away becomes somebody the campaign remembers,
  // and what is left over is written into Life with a day attached.
  const aftermath = await settleAftermath({
    campaignId,
    missionId: mission.id,
    playerName: bundle.character.character.name,
    agreed: total,
    messy: done < runtime.objectives.length,
    factionId: missionFaction(mission),
    completion: {
      summary: completionSummary,
      beatId: runtime.currentBeatId,
      data: { missionId: mission.id, payout } as unknown as Json,
    },
  });

  // A null report means this job had already been settled. The phase fallback
  // below can repair an older campaign that was stranded before Aftermath.
  // Now that it is over, show the player the die that was thrown before it
  // began. A complication they never noticed is worth showing too, and so is a
  // clean brief: it is the evidence that the job's shape was rolled, not
  // written to suit how the job was going.
  await revealComplication(campaignId, mission.id);

  // A finished job writes the campaign's status, rather than leaving it to be
  // written later or not at all.
  //
  // What it writes is "active", because a campaign is a life and not a job:
  // surviving a night's work is not winning anything, and the run continues.
  // Until now nothing wrote it here at all — `settle_job` moves the phase and
  // touches no status, and `close_aftermath` only writes one once the player
  // deliberately leaves the wrap-up screen. So a campaign sat in Aftermath had
  // a status nothing had confirmed since the job was accepted. It is confirmed
  // here, at the moment the job actually ends.
  await updateCampaign(campaignId, { status: "active" });

  // The phase moves to aftermath — the wrap-up screen — and only the player's
  // press moves it on to Life. The AI never performs this transition.
  // The settlement transaction owns the normal phase transition. The fallback
  // only repairs an older already-settled campaign that was left in Job.
  if (!aftermath) {
    const after = nextPhase(phaseOf(bundle.campaign.phase), "end_job");
    if (after) await setCampaignPhase(campaignId, after);
  }
}

/**
 * Which faction a job's opposition belongs to, when it names one.
 *
 * Scans authored mission text ("a Tyger Claws crew, and they are not new at
 * this"), which is this project's own content, so findFactionIn is the right
 * tool for it. A job whose opposition is nobody in particular returns null, and
 * the bodies still raise Heat.
 */
function missionFaction(mission: Mission): FactionId | null {
  const named = [mission.offer?.opposition, ...mission.beats.flatMap((b) => b.opposition ?? [])];
  for (const text of named) {
    const factionId = findFactionIn(text);
    if (factionId) return factionId;
  }
  return null;
}

/**
 * The end-of-session I.P. award. The GM judges everything since the last award
 * against the printed table; the engine turns that judgement into the number,
 * and `award_improvement_points` writes it to the ledger, the campaign and the
 * character's permanent total in one transaction (`features/campaign/ipAward.ts`).
 */
export type { IpTally } from "@/features/campaign/ipAward";

export async function settleIp(
  bundle: PlayBundle,
  playstyles: { primary: IpPlaystyle; secondary: IpPlaystyle },
): Promise<IpTally> {
  if (bundle.campaign.ip_awarded !== null && bundle.campaign.ip_awarded !== undefined) {
    throw new Error("This job's Improvement Points have already been awarded.");
  }
  const missionFinished = bundle.runtime?.status === "completed";
  const outcome =
    bundle.campaign.status === "lost"
      ? `${bundle.character.character.name} died in Night City; the job was left unfinished.`
      : missionFinished
        ? "The job was seen through to its resolution."
        : "The session ended with the job unfinished.";

  return judgeAndAward({
    campaignId: bundle.campaign.id,
    kind: "job",
    day: bundle.campaign.day,
    title: bundle.mission?.title ?? bundle.campaign.name,
    finished: missionFinished,
    outcome,
    objectives: (bundle.runtime?.objectives ?? []).map((o) => ({ text: o.text, status: o.status })),
    playstyles,
  });
}

/**
 * Back to the street.
 *
 * Wrap-up is done, so the campaign returns to Life. The run continues:
 * eurobucks, HP, wounds and inventory all carry over, which is the whole point
 * of the campaign outliving the job. The mission pointer is cleared and
 * ip_awarded reset, so the next session is judged on its own merits — and the
 * next job has to arrive as an offer the player accepts, never as a screen they
 * are dropped into.
 */
export async function returnToLife(bundle: PlayBundle): Promise<void> {
  await closeAftermath(bundle.campaign.id, luckPoolMax(statsRecord(bundle.character)));
  // What the job did for their name, kept in the Life log rather than only
  // flashed: Reputation and the tier of work move at settlement, where no Life
  // turn can see them change. Written once per settled job, after the phase
  // has moved, so a failure here costs the line and never the return.
  const news = climbNews({
    events: bundle.climbEvents,
    jobsFinished: bundle.tally.jobsFinished,
    npcs: bundle.npcs,
  });
  if (news?.milestone && !milestoneWritten(bundle.climbEvents, news.settledEventId)) {
    await appendCampaignEvent({
      campaign_id: bundle.campaign.id,
      type: LEDGER_EVENTS.milestone,
      summary: news.milestone,
      data: milestoneEventData({ settledEventId: news.settledEventId }) as unknown as Json,
    });
  }
}

/** Job-specific consequence of the shared combat death-save operation. */
export async function commitDeathSave(
  bundle: PlayBundle,
  pending: PendingDeathSave,
  result: BeginTurnResult,
): Promise<void> {
  await commitCombatDeathSave(bundle, pending, result);
  if (result.died && bundle.mission && bundle.runtime) {
    await saveMissionRuntime(bundle.campaign.id, failMission(bundle.runtime));
  }
}
