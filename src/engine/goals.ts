/**
 * What the character could work toward, and how far away each thing is.
 *
 * The player asked to know, at all times, what they could be working on and
 * how close they are. This answers that from prices the engine already owns —
 * a Skill's next Level and a Role Ability's next Rank in I.P., a piece of chrome
 * in eurobucks, the next band of a faction's opinion in standing — and nothing
 * else. Nothing here is generated, offered or dangled: it is a price list the
 * player aims, not a quest board. People are deliberately not on it; how
 * somebody feels about you is meant to be felt, not tracked to a number.
 *
 * A pinned GOAL carries its own target, so "done" means what the player meant
 * when they pinned it — the Level they were aiming at, one more of an implant
 * than they had, the band above the one they were in — rather than whatever the
 * next step happens to be by the time they look again.
 *
 * Pure: plain state in, plain progress out.
 */
import {
  ROLE_RANK_MAX,
  roleRankRaiseCost,
  skillLineKey,
  skillRaiseTotal,
  MAX_SKILL_LEVEL,
  type SkillLine,
} from "./advancement";
import { CYBERWARE, getCyberware } from "./catalog";
import {
  installQuantity,
  planCyberwarePlacement,
  type InstalledCyberware,
} from "./cyberwareInstall";
import {
  clampStanding,
  FACTION_STANDING_MAX,
  getFaction,
  isFactionId,
  standingBand,
  type FactionId,
  type FactionStanding,
} from "./factions";
import { roleAbilityOf } from "./roleAbility";
import { roleOpening } from "./roleOpening";
import { skillEntryName } from "./skillAllocation";

/** The most goals a player can pin at once. Three is a focus; ten is a to-do list. */
export const MAX_PINNED_GOALS = 3;

export type Goal =
  | { kind: "skill"; skillId: string; specialization: string | null; level: number }
  | { kind: "rank"; rank: number }
  /** `owned` is how many were installed when it was pinned: done means one more. */
  | { kind: "chrome"; itemId: string; owned: number }
  /** `atLeast` is the bottom of the band being climbed into. */
  | { kind: "standing"; factionId: FactionId; atLeast: number };

/** What a goal is measured in. */
export type GoalCurrency = "ip" | "eb" | "standing";

/**
 * - `far`: not there yet, and not yet affordable.
 * - `ready`: it can be bought now.
 * - `done`: it has happened.
 * - `blocked`: something other than the price stands in the way (a full
 *   foundation, an exclusive implant). Says why in `note`.
 */
export type GoalStatus = "far" | "ready" | "done" | "blocked";

export type GoalProgress = {
  key: string;
  goal: Goal;
  label: string;
  currency: GoalCurrency;
  /** What reaching it costs from here, in its currency (0 once done). */
  need: number;
  /** What the character holds toward it now, in the same currency. */
  have: number;
  /** How much is still missing; 0 when ready or done. */
  gap: number;
  status: GoalStatus;
  /** A line of context: a Humanity cost, a reason it is blocked. */
  note: string | null;
};

/** Everything a goal can be measured against. Built from rows the screen holds. */
export type GoalState = {
  ip: number;
  eurobucks: number;
  skills: SkillLine[];
  roleId: string | null;
  /** The Rank on file, or null when the Role has no ability. */
  rank: number | null;
  installed: InstalledCyberware[];
  standings: FactionStanding[];
  homeDistrictKey?: string | null;
};

export function goalKey(goal: Goal): string {
  switch (goal.kind) {
    case "skill":
      return `skill:${skillLineKey(goal.skillId, goal.specialization)}:${goal.level}`;
    case "rank":
      return `rank:${goal.rank}`;
    case "chrome":
      return `chrome:${goal.itemId}:${goal.owned + 1}`;
    case "standing":
      return `standing:${goal.factionId}:${goal.atLeast}`;
  }
}

function status(gap: number): GoalStatus {
  return gap === 0 ? "ready" : "far";
}

function skillProgress(goal: Extract<Goal, { kind: "skill" }>, state: GoalState): GoalProgress {
  const key = skillLineKey(goal.skillId, goal.specialization);
  const current =
    state.skills.find((line) => skillLineKey(line.skillId, line.specialization ?? null) === key)
      ?.level ?? 0;
  const name = skillEntryName(
    { skillId: goal.skillId, specialization: goal.specialization },
    state.homeDistrictKey,
  );
  const label = `${name} ${goal.level}`;
  if (current >= goal.level) {
    return {
      key: goalKey(goal),
      goal,
      label,
      currency: "ip",
      need: 0,
      have: state.ip,
      gap: 0,
      status: "done",
      note: null,
    };
  }
  const need = skillRaiseTotal(goal.skillId, current, goal.level);
  const gap = Math.max(0, need - state.ip);
  return {
    key: goalKey(goal),
    goal,
    label,
    currency: "ip",
    need,
    have: state.ip,
    gap,
    status: status(gap),
    note: current + 1 < goal.level ? `${goal.level - current} Levels from ${current}` : null,
  };
}

function rankProgress(goal: Extract<Goal, { kind: "rank" }>, state: GoalState): GoalProgress {
  const ability = roleAbilityOf(state.roleId);
  const current = state.rank ?? ability?.startingRank ?? 0;
  const label = `${ability?.abilityName ?? "Role Ability"} Rank ${goal.rank}`;
  if (current >= goal.rank) {
    return {
      key: goalKey(goal),
      goal,
      label,
      currency: "ip",
      need: 0,
      have: state.ip,
      gap: 0,
      status: "done",
      note: null,
    };
  }
  let need = 0;
  for (let rank = current + 1; rank <= goal.rank; rank += 1) need += roleRankRaiseCost(rank);
  const gap = Math.max(0, need - state.ip);
  return {
    key: goalKey(goal),
    goal,
    label,
    currency: "ip",
    need,
    have: state.ip,
    gap,
    status: status(gap),
    note: null,
  };
}

function chromeProgress(goal: Extract<Goal, { kind: "chrome" }>, state: GoalState): GoalProgress {
  const item = getCyberware(goal.itemId);
  const owned = state.installed.filter((row) => row.itemId === goal.itemId).length;
  const label = item.name;
  const humanity = item.humanityLossDice
    ? `Humanity ${item.humanityLossDice}`
    : item.humanityLoss > 0
      ? `Humanity ${item.humanityLoss}`
      : null;
  if (owned > goal.owned) {
    return {
      key: goalKey(goal),
      goal,
      label,
      currency: "eb",
      need: 0,
      have: state.eurobucks,
      gap: 0,
      status: "done",
      note: null,
    };
  }
  const need = item.cost * installQuantity(goal.itemId);
  const placement = planCyberwarePlacement(state.installed, goal.itemId);
  if (!placement.ok) {
    return {
      key: goalKey(goal),
      goal,
      label,
      currency: "eb",
      need,
      have: state.eurobucks,
      gap: Math.max(0, need - state.eurobucks),
      status: "blocked",
      note: placement.reason,
    };
  }
  const gap = Math.max(0, need - state.eurobucks);
  return {
    key: goalKey(goal),
    goal,
    label,
    currency: "eb",
    need,
    have: state.eurobucks,
    gap,
    status: status(gap),
    note: humanity,
  };
}

function standingProgress(
  goal: Extract<Goal, { kind: "standing" }>,
  state: GoalState,
): GoalProgress {
  const standing = clampStanding(
    state.standings.find((s) => s.factionId === goal.factionId)?.standing ?? 0,
  );
  const label = `${getFaction(goal.factionId).name}: ${standingBand(goal.atLeast).label}`;
  const gap = Math.max(0, goal.atLeast - standing);
  // Standing is not bought, so it is never "ready": it is earned or it is not.
  return {
    key: goalKey(goal),
    goal,
    label,
    currency: "standing",
    need: goal.atLeast,
    have: standing,
    gap,
    status: gap === 0 ? "done" : "far",
    note: `${standingBand(standing).label} now`,
  };
}

export function goalProgress(goal: Goal, state: GoalState): GoalProgress {
  switch (goal.kind) {
    case "skill":
      return skillProgress(goal, state);
    case "rank":
      return rankProgress(goal, state);
    case "chrome":
      return chromeProgress(goal, state);
    case "standing":
      return standingProgress(goal, state);
  }
}

/** The bottom of the band above the one this standing sits in, or null at the top. */
export function nextBandFloor(standing: number): number | null {
  const band = standingBand(standing);
  if (band.atMost >= FACTION_STANDING_MAX) return null;
  return band.atMost + 1;
}

export type ReachList = {
  /** The next Rank of the Role Ability, when it is for sale. */
  rank: GoalProgress | null;
  /** Every trained Skill's next Level, cheapest first. */
  skills: GoalProgress[];
  /** Chrome that could go in now if it were paid for, cheapest first. */
  chrome: GoalProgress[];
  /** The next band of every faction with an opinion, nearest first. */
  standing: GoalProgress[];
};

/**
 * Everything within reach, one step out in each direction, priced.
 *
 * One step, not the whole ladder: Handgun 7, not Handgun 7 through 10. The
 * player can see the next rung of everything at once; a pin can aim further.
 */
export function reachList(state: GoalState): ReachList {
  const ability = roleAbilityOf(state.roleId);
  const rankNow = state.rank ?? ability?.startingRank ?? null;
  const rankForSale =
    ability &&
    rankNow !== null &&
    rankNow < ROLE_RANK_MAX &&
    !(roleOpening(state.roleId, rankNow)?.unbuilt ?? false);
  const rank = rankForSale ? goalProgress({ kind: "rank", rank: rankNow + 1 }, state) : null;

  const skills = state.skills
    .filter((line) => line.level > 0 && line.level < MAX_SKILL_LEVEL)
    .map((line) =>
      goalProgress(
        {
          kind: "skill",
          skillId: line.skillId,
          specialization: line.specialization ?? null,
          level: line.level + 1,
        },
        state,
      ),
    )
    .sort((a, b) => a.need - b.need || a.label.localeCompare(b.label));

  const chrome = CYBERWARE.map((item) =>
    goalProgress(
      {
        kind: "chrome",
        itemId: item.id,
        owned: state.installed.filter((row) => row.itemId === item.id).length,
      },
      state,
    ),
  )
    .filter((progress) => progress.status !== "blocked")
    .sort((a, b) => a.need - b.need || a.label.localeCompare(b.label));

  const standing = state.standings
    .filter((s) => isFactionId(s.factionId) && clampStanding(s.standing) !== 0)
    .flatMap((s) => {
      const floor = nextBandFloor(s.standing);
      return floor === null
        ? []
        : [goalProgress({ kind: "standing", factionId: s.factionId, atLeast: floor }, state)];
    })
    .sort((a, b) => a.gap - b.gap || a.label.localeCompare(b.label));

  return { rank, skills, chrome, standing };
}

/** Pin a goal, keeping the list unique and capped. Returns the list unchanged when full. */
export function withPinned(pinned: Goal[], goal: Goal): Goal[] {
  const key = goalKey(goal);
  if (pinned.some((g) => goalKey(g) === key)) return pinned;
  if (pinned.length >= MAX_PINNED_GOALS) return pinned;
  return [...pinned, goal];
}

export function withoutPinned(pinned: Goal[], key: string): Goal[] {
  return pinned.filter((g) => goalKey(g) !== key);
}
