/**
 * Awarding Improvement Points, for a job closing or for a stretch of life.
 *
 * Both are the same act: read everything since the last award, have the GM pick
 * printed tiers off it (`ipJudgement.ts`), let the engine compute the award
 * (`awardImprovementPoints`), and commit it in one transaction
 * (`award_improvement_points`). They differ only in what the session WAS — a
 * job, finished or not, or a life with no job in it — which is the caller's to
 * say.
 *
 * "Since the last award" is the solo game's session. It used to be the last
 * sixty ledger rows, which judged a long job on its ending and a long life on
 * nothing at all.
 *
 * Not an ops module: no React, no Query. Play and Life both call it.
 */
import {
  awardImprovementPoints,
  ipAwardedEventData,
  LEDGER_EVENTS,
  readIpAwardedEventData,
  type IpAward,
  type IpAwardKind,
  type IpPlaystyle,
} from "@/engine";
import { renderIpJudgementPrompt, type IpJudgement } from "@/features/gm/ipJudgement";
import { ipJudgementFn } from "@/features/gm/ipJudgement.server";
import { PACKET_BUDGET } from "@/features/narration/packetBudget";
import {
  commitIpAward,
  lastCampaignEventOfType,
  listCampaignEventsAfter,
  type CampaignEvent,
  type Json,
} from "@/lib/backend";

export type IpTally = { award: IpAward; judgement: IpJudgement; total: number };

export type Playstyles = { primary: IpPlaystyle; secondary: IpPlaystyle };

/** Where the next award's window opens, and what was declared last time. */
export type LastAward = {
  /** The event's `seq`, which the transaction checks is still the newest. */
  seq: number | null;
  /** In-world day of the last award; null when there was none, or it predates days. */
  day: number | null;
  playstyles: Playstyles | null;
};

const PLAYSTYLE_IDS = new Set<string>(["warrior", "socializer", "explorer", "roleplayer"]);

function asPlaystyles(value: { primary: string; secondary: string } | null): Playstyles | null {
  if (!value || !PLAYSTYLE_IDS.has(value.primary) || !PLAYSTYLE_IDS.has(value.secondary)) {
    return null;
  }
  return value as Playstyles;
}

export function lastAwardFrom(event: CampaignEvent | null): LastAward {
  if (!event) return { seq: null, day: null, playstyles: null };
  const data = readIpAwardedEventData(event.data);
  return {
    seq: event.seq,
    day: data?.day ?? null,
    playstyles: asPlaystyles(data?.playstyles ?? null),
  };
}

export async function readLastAward(campaignId: string): Promise<LastAward> {
  return lastAwardFrom(await lastCampaignEventOfType(campaignId, LEDGER_EVENTS.ipAwarded));
}

/**
 * The window as the judge reads it: one line per event that says something,
 * oldest first, with a marker when the old end was cut.
 */
export function judgementLog(events: CampaignEvent[], cut: boolean): string[] {
  const lines = events
    .filter((e) => typeof e.summary === "string" && e.summary.trim() !== "")
    .map((e) => `[${e.type}] ${e.summary}`);
  return cut ? ["[…] earlier in this stretch, not shown", ...lines] : lines;
}

/** Rolls the player made in the window — checks and attacks, as the roll log counts them. */
export function rollsIn(events: CampaignEvent[]): number {
  return events.filter(
    (e) => e.type === LEDGER_EVENTS.skillCheck || e.type === LEDGER_EVENTS.attack,
  ).length;
}

export async function judgeAndAward(input: {
  campaignId: string;
  kind: IpAwardKind;
  /** The in-world day now, stored on the award so the next window knows where it opens. */
  day: number;
  /** What the session was: the job's title, or a stretch of life. */
  title: string;
  /** Only a job can finish; a life is judged on the playstyle columns. */
  finished: boolean;
  outcome: string;
  objectives: { text: string; status: string }[];
  playstyles: Playstyles;
}): Promise<IpTally> {
  const last = await readLastAward(input.campaignId);
  const limit = PACKET_BUDGET.ipJudgementLog;
  const events = await listCampaignEventsAfter(input.campaignId, last.seq, limit);

  const judgement = await ipJudgementFn({
    data: {
      userPrompt: renderIpJudgementPrompt({
        missionTitle: input.title,
        missionFinished: input.finished,
        outcome: input.outcome,
        objectives: input.objectives,
        primary: input.playstyles.primary,
        secondary: input.playstyles.secondary,
        log: judgementLog(events, events.length >= limit),
        rollCount: rollsIn(events),
      }),
    },
  });

  const award = awardImprovementPoints({
    missionFinished: input.finished,
    groupIp: judgement.groupIp,
    primary: input.playstyles.primary,
    secondary: input.playstyles.secondary,
    primaryIp: judgement.primaryIp,
    secondaryIp: judgement.secondaryIp,
    standout: judgement.standout,
  });

  const what = input.kind === "life" ? "for the life since the last award" : "for the job";
  const total = await commitIpAward({
    campaign_id: input.campaignId,
    kind: input.kind,
    ip: award.ip,
    summary: `${award.ip} I.P. awarded ${what} (${award.source} column${award.fromStandout ? ", standout" : ""}): ${award.descriptor}`,
    data: ipAwardedEventData({
      award,
      judgement,
      playstyles: input.playstyles,
      kind: input.kind,
      day: input.day,
    }) as unknown as Json,
    expected_last_award_seq: last.seq,
  });
  return { award, judgement, total };
}
