/**
 * The goal engine's input, assembled from rows a screen already holds.
 *
 * One place, so the Within Reach sheet, the Growth chip and the receipts all
 * measure the same pinned goal against the same state.
 */
import {
  goalProgress,
  hasCyberware,
  isFactionId,
  type FactionStanding,
  type Goal,
  type GoalProgress,
  type GoalState,
} from "@/engine";
import type { CampaignCyberware, CampaignVitals, FullCharacter } from "@/lib/backend";

export function goalStateFrom(input: {
  character: FullCharacter;
  vitals: CampaignVitals;
  cyberware: CampaignCyberware[];
  standings: FactionStanding[];
}): GoalState {
  return {
    ip: input.character.finance?.improvement_points ?? 0,
    eurobucks: input.vitals.eurobucks,
    skills: input.character.skills.map((s) => ({
      skillId: s.skill_id,
      level: s.level,
      specialization: s.specialization,
    })),
    roleId: input.character.character.role ?? null,
    rank: input.character.roleAbility?.rank ?? null,
    // A legacy row can hold a printed label rather than a catalog id; the
    // ripperdoc drops those too, rather than crash on them.
    installed: input.cyberware
      .filter((row) => hasCyberware(row.item_id))
      .map((row) => ({ id: row.id, itemId: row.item_id, foundationId: row.foundational_for })),
    standings: input.standings.filter((s) => isFactionId(s.factionId)),
    homeDistrictKey: input.character.finance?.home_district_key ?? null,
  };
}

/** Each pinned goal's progress, in pin order. A goal that no longer resolves is dropped. */
export function pinnedProgress(goals: Goal[], state: GoalState): GoalProgress[] {
  const out: GoalProgress[] = [];
  for (const goal of goals) {
    try {
      out.push(goalProgress(goal, state));
    } catch {
      // A Skill or item id the data no longer knows. Not worth crashing the rail.
    }
  }
  return out;
}

/** How far along a goal is, 0 to 1, for a meter. Standing has no meter: it is not bought. */
export function goalFill(progress: GoalProgress): number | null {
  if (progress.status === "done" || progress.status === "ready") return 1;
  if (progress.currency === "standing" || progress.need <= 0) return null;
  return Math.max(0, Math.min(1, progress.have / progress.need));
}

/** The distance in the goal's own currency: "40 IP", "€1,200", "2 standing". */
export function goalGapLabel(progress: GoalProgress): string {
  if (progress.status === "done") return "done";
  if (progress.status === "ready") return "ready";
  if (progress.status === "blocked") return "blocked";
  switch (progress.currency) {
    case "ip":
      return `${progress.gap} IP to go`;
    case "eb":
      return `€${progress.gap.toLocaleString()} to go`;
    case "standing":
      return `${progress.gap} standing to go`;
  }
}

/** The chip's face: short enough for a third of the rail. */
export function goalChipFigure(progress: GoalProgress): string {
  if (progress.status === "done") return "done";
  if (progress.status === "ready") return "ready";
  if (progress.status === "blocked") return "blocked";
  switch (progress.currency) {
    case "ip":
      return `${progress.gap} IP`;
    case "eb":
      return `€${progress.gap.toLocaleString()}`;
    case "standing":
      return `+${progress.gap}`;
  }
}
