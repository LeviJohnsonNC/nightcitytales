/**
 * Pending skill checks — the bridge between "the GM proposed a check" and "the
 * player rolled it". Pure: it reads the ledger and the sheet and describes what
 * is at stake. Every number here comes from the engine and the rules JSON; this
 * file never invents a DV, a STAT, or a Skill Level.
 */
import {
  DIFFICULTY_VALUES,
  describeDV,
  getSkill,
  woundActionPenalty,
  type SkillCheckModifier,
  type SkillCheckResult,
  type WoundStateCode,
} from "@/engine";
import type { CampaignEvent, FullCharacter } from "@/lib/backend";

/** The published DV bands, lowest first (src/data/rules/dv-table.json). */
export const DV_BANDS = [...DIFFICULTY_VALUES].sort((a, b) => a.dv - b.dv);

/** Snap an arbitrary proposed DV to the nearest published Difficulty Value. */
export function snapToPublishedDv(dv: number): number {
  let best = DV_BANDS[0]!;
  for (const band of DV_BANDS) {
    if (Math.abs(band.dv - dv) < Math.abs(best.dv - dv)) best = band;
  }
  return best.dv;
}

/** The band name for a DV, when it sits on the published table. */
export function dvBandName(dv: number): string | null {
  return describeDV(dv)?.name ?? null;
}

/**
 * The wound-state penalty as a check modifier, or null when unwounded. Seriously
 * Wounded is −2 to all Actions, Mortally Wounded −4 (CP:R pg. 186). The same
 * value is fed to the actual roll, so the "you need X" the player sees never
 * disagrees with the die the engine rolls.
 */
export function woundModifier(woundState: string): SkillCheckModifier | null {
  const penalty = woundActionPenalty(woundState as WoundStateCode);
  if (penalty === 0) return null;
  const label = woundState === "mortal" ? "Mortally Wounded" : "Seriously Wounded";
  return { label, value: penalty };
}

export type PendingCheck = {
  /** The ledger row that proposed this check. */
  eventId: string;
  skillId: string;
  skillName: string;
  /** Governing STAT key, e.g. "int". */
  stat: string;
  statValue: number;
  skillLevel: number;
  /** Situational/condition modifiers applied to the roll (wound state, etc.). */
  modifiers: SkillCheckModifier[];
  /** STAT + Skill + modifiers, before the die. */
  base: number;
  dv: number;
  bandName: string | null;
  /** The number the d10 must show or beat, before any crit. */
  needed: number;
  intent: string;
  beatId: string | null;
};

type PromptData = { skillId?: unknown; dv?: unknown; intent?: unknown };

/** Describe a proposed check against a saved character. Null if unreadable. */
export function describePendingCheck(
  event: CampaignEvent,
  character: FullCharacter,
  modifiers: SkillCheckModifier[] = [],
): PendingCheck | null {
  const data = (event.data ?? {}) as PromptData;
  const skillId = typeof data.skillId === "string" ? data.skillId : null;
  const dvRaw = typeof data.dv === "number" ? data.dv : null;
  if (!skillId || dvRaw === null) return null;

  let skill;
  try {
    skill = getSkill(skillId);
  } catch {
    return null;
  }

  const stats = character.stats as Record<string, unknown> | null;
  const statValue =
    stats && typeof stats[skill.stat] === "number" ? (stats[skill.stat] as number) : null;
  if (statValue === null) return null;

  const skillLevel = character.skills.find((s) => s.skill_id === skillId)?.level ?? 0;
  const dv = snapToPublishedDv(dvRaw);
  const modifierTotal = modifiers.reduce((sum, m) => sum + m.value, 0);
  const base = statValue + skillLevel + modifierTotal;

  return {
    eventId: event.id,
    skillId,
    skillName: skill.name,
    stat: skill.stat,
    statValue,
    skillLevel,
    modifiers,
    base,
    dv,
    bandName: dvBandName(dv),
    needed: dv - base,
    intent: typeof data.intent === "string" ? data.intent : "",
    beatId: event.beat_id ?? null,
  };
}

/**
 * The check awaiting a roll, if any: the most recent check_prompt with no
 * skill_check resolving it afterwards.
 */
export function pendingCheckFrom(
  events: CampaignEvent[],
  character: FullCharacter,
  modifiers: SkillCheckModifier[] = [],
): PendingCheck | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event) continue;
    if (event.type === "skill_check") return null; // the newest check is already rolled
    if (event.type !== "check_prompt") continue;
    return describePendingCheck(event, character, modifiers);
  }
  return null;
}

/** One line of the session's dice record. */
export type RollRecord = {
  id: string;
  skillName: string;
  total: number;
  dv: number | null;
  success: boolean | null;
  critical: "success" | "failure" | null;
};

export function rollHistory(events: CampaignEvent[], limit = 10): RollRecord[] {
  const out: RollRecord[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const event = events[i];
    if (!event || event.type !== "skill_check") continue;
    const roll = event.roll as Partial<SkillCheckResult> | null;
    const data = (event.data ?? {}) as { skill_name?: unknown; skill_id?: unknown };
    const name =
      typeof data.skill_name === "string"
        ? data.skill_name
        : typeof data.skill_id === "string"
          ? data.skill_id
          : "Check";
    out.push({
      id: event.id,
      skillName: name,
      total: typeof roll?.total === "number" ? roll.total : 0,
      dv: typeof roll?.dv === "number" ? roll.dv : null,
      success: typeof roll?.success === "boolean" ? roll.success : null,
      critical: roll?.critical ?? null,
    });
  }
  return out;
}
