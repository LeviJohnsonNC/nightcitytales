/**
 * What the latest job did for the character's name, in words.
 *
 * Reputation and the tier of work move when a job settles, which happens in
 * Aftermath and never during a Life turn, so a turn-by-turn receipt cannot see
 * it: the Life screen opens with the new standing already in place. This reads
 * the change off the ledger instead, the settled job against the jobs before
 * it (`climbFromLastJob`), so Aftermath can say it, and the return to Life can
 * write it down as a milestone that stays in the log.
 *
 * Pure: ledger rows in, lines out.
 */
import {
  climbFromLastJob,
  LEDGER_EVENTS,
  readJobSettledEventData,
  readIpAwardedEventData,
  readMilestoneEventData,
  readRoleRankRaisedEventData,
  readSkillRaisedEventData,
  roleAbilityOf,
  skillEntryName,
  type ClimbChange,
  type JobSettledEventData,
} from "@/engine";
import type { CampaignEvent, CampaignNpc } from "@/lib/backend";
import { castMemberInRole } from "./castSeeding";

/** The ledger type a climb milestone is written under, once per settled job. */
export const MILESTONE_EVENT = LEDGER_EVENTS.milestone;

export type ClimbNewsLine = { text: string; tone: "good" | "neutral" };

export type ClimbNews = {
  change: ClimbChange;
  /** The id of the `job_settled` receipt this is about, so it is written once. */
  settledEventId: string;
  lines: ClimbNewsLine[];
  /** One sentence for the Life log, or null when nothing went up. */
  milestone: string | null;
};

export function climbNews(input: {
  events: CampaignEvent[];
  jobsFinished: number;
  npcs: CampaignNpc[];
}): ClimbNews | null {
  const settled = input.events.filter((e) => e.type === "job_settled");
  const jobs = settled
    .map((e) => readJobSettledEventData(e.data))
    .filter((job): job is JobSettledEventData => job !== null);
  const latest = settled.at(-1);
  const fixer = castMemberInRole(input.npcs, "fixer");
  const change = climbFromLastJob({
    jobs,
    jobsFinished: input.jobsFinished,
    fixerDisposition: fixer?.disposition ?? null,
  });
  if (!change || !latest) return null;

  const lines: ClimbNewsLine[] = [];
  const up: string[] = [];
  const { before, after } = change;
  if (change.deed === 0) {
    lines.push({
      text: "A clean job. Nobody is telling this one, so your name stays where it was.",
      tone: "neutral",
    });
  } else if (after.level > before.level) {
    const text = `Reputation ${before.level} → ${after.level}. ${after.whoKnows ?? ""}`.trim();
    lines.push({ text, tone: "good" });
    up.push(text);
  } else {
    lines.push({
      text: `People talk about it, but you have done louder. Reputation stays ${after.level}.`,
      tone: "neutral",
    });
  }
  if (change.tierAfter.id !== change.tierBefore.id) {
    const text = `Fixers offer you ${change.tierAfter.name.toLowerCase()} now: better pay, and harder fights.`;
    lines.push({ text, tone: "good" });
    up.push(text);
  }

  return {
    change,
    settledEventId: latest.id,
    lines,
    milestone: up.length ? up.join(" ") : null,
  };
}

/** Whether the milestone for this settled job is already in the ledger. */
export function milestoneWritten(events: CampaignEvent[], settledEventId: string): boolean {
  return events.some(
    (e) =>
      e.type === MILESTONE_EVENT &&
      readMilestoneEventData(e.data)?.settledEventId === settledEventId,
  );
}

/**
 * The Life log's line for a step up the climb, read from its payload: the SQL
 * that writes a raise spells its summary from the raw id ("Local_expert"), and
 * an award's summary is the bookkeeping, not the news. Null for anything else,
 * or for a payload nobody can read, so the log falls back to the summary.
 */
export function climbLogLine(
  event: { type: string; data: unknown },
  character: { roleId: string | null; homeDistrictKey: string | null },
): string | null {
  switch (event.type) {
    case "skill_raised": {
      const raise = readSkillRaisedEventData(event.data);
      if (!raise) return null;
      const name = skillEntryName(
        { skillId: raise.skillId, specialization: raise.specialization },
        character.homeDistrictKey,
      );
      return raise.fromLevel === 0
        ? `Learned ${name}: Level ${raise.toLevel}.`
        : `${name} ${raise.fromLevel} → ${raise.toLevel}.`;
    }
    case "role_rank_raised": {
      const raise = readRoleRankRaisedEventData(event.data);
      if (!raise) return null;
      const name = roleAbilityOf(character.roleId)?.abilityName ?? "Role Ability";
      return `${name} Rank ${raise.fromRank} → ${raise.toRank}.`;
    }
    case "ip_awarded": {
      const award = readIpAwardedEventData(event.data);
      if (!award) return null;
      return `${award.ip} Improvement Points earned${award.kind === "job" ? " on the job" : " living your life"}.`;
    }
    default:
      return null;
  }
}
