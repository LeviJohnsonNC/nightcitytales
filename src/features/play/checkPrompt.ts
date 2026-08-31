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
  type WoundStateCode,
  type OpposedCheckResult,
  type Opposition,
  type SkillCheckResult,
} from "@/engine";
import type {
  CampaignEvent,
  CampaignInventoryItem,
  CampaignVitals,
  FullCharacter,
} from "@/lib/backend";
import { effectiveStatsRecord } from "./playModel";

type LiveCheckContext = { vitals: CampaignVitals; inventory: CampaignInventoryItem[] };

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
 * The other side of an opposed check, as the table sees it before the dice: who
 * is resisting, with what, and what they add to their own d10.
 */
export type PendingOpposition = {
  npcKey: string;
  npcName: string;
  /** The printed skill they resist with. */
  skillId: string;
  skillName: string;
  /** Governing STAT key of THEIR skill, e.g. "emp". */
  stat: string;
  statValue: number;
  skillLevel: number;
  /** STAT + Skill, before their die. */
  base: number;
  /** True when these numbers came from the campaign's memory of this NPC. */
  remembered: boolean;
};

export type PendingCheck = {
  /** The ledger row that proposed this check. */
  eventId: string;
  skillId: string;
  skillName: string;
  /** Governing STAT key, e.g. "int". */
  stat: string;
  statValue: number;
  skillLevel: number;
  /** STAT + Skill, before the die. */
  base: number;
  /**
   * The wound penalty riding on this check: 0 unwounded, −2 Seriously Wounded,
   * −4 Mortally Wounded. Shown before the roll so the player can see why the
   * number got worse, and why patching up in downtime is worth the days.
   */
  woundPenalty: number;
  /** The Difficulty Value, or null when another character's roll is the target. */
  dv: number | null;
  bandName: string | null;
  /** The number the d10 must show or beat, before any crit. Null when opposed. */
  needed: number | null;
  /** Set when this check is resolved against a person rather than a DV. */
  opposition: PendingOpposition | null;
  intent: string;
  beatId: string | null;
};

/**
 * A rolled check, tagged by how it was resolved, carrying the Luck it was made
 * with. The points ride along on the roll rather than being deducted up front:
 * Luck is dedicated before the dice and paid for once they have been thrown, so
 * a card the player never rolls costs them nothing.
 */
export type CheckRoll = { luckSpent: number } & (
  { kind: "dv"; result: SkillCheckResult } | { kind: "opposed"; result: OpposedCheckResult }
);

/** The opposing side of a pending check, as the engine wants it. */
export function oppositionFor(pending: PendingCheck): Opposition | null {
  if (!pending.opposition) return null;
  return {
    name: pending.opposition.npcName,
    skillId: pending.opposition.skillId,
    skillLevel: pending.opposition.skillLevel,
    statValue: pending.opposition.statValue,
  };
}

type PromptOpposition = {
  npcKey?: unknown;
  npcName?: unknown;
  skillId?: unknown;
  skillLevel?: unknown;
  statValue?: unknown;
  remembered?: unknown;
};

type PromptData = {
  skillId?: unknown;
  dv?: unknown;
  intent?: unknown;
  opposition?: PromptOpposition;
};

/** Read the opposing side off a prompt row. Null when it is a plain DV check. */
function describeOpposition(raw: PromptOpposition | undefined): PendingOpposition | null {
  if (!raw || typeof raw !== "object") return null;
  const skillId = typeof raw.skillId === "string" ? raw.skillId : null;
  const npcName = typeof raw.npcName === "string" ? raw.npcName : null;
  const statValue = typeof raw.statValue === "number" ? raw.statValue : null;
  const skillLevel = typeof raw.skillLevel === "number" ? raw.skillLevel : null;
  if (!skillId || !npcName || statValue === null || skillLevel === null) return null;

  let skill;
  try {
    skill = getSkill(skillId);
  } catch {
    return null;
  }
  return {
    npcKey: typeof raw.npcKey === "string" ? raw.npcKey : npcName,
    npcName,
    skillId,
    skillName: skill.name,
    stat: skill.stat,
    statValue,
    skillLevel,
    base: statValue + skillLevel,
    remembered: raw.remembered === true,
  };
}

/** Describe a proposed check against a saved character. Null if unreadable. */
export function describePendingCheck(
  event: CampaignEvent,
  character: FullCharacter,
  woundState: WoundStateCode = "none",
  context?: LiveCheckContext,
): PendingCheck | null {
  const data = (event.data ?? {}) as PromptData;
  const skillId = typeof data.skillId === "string" ? data.skillId : null;
  if (!skillId) return null;

  // A check is settled EITHER by a DV or by another character's roll. An opposed
  // prompt carries no DV, and inventing one for it would be a difficulty nobody
  // set at the table.
  const opposition = describeOpposition(data.opposition);
  const dvRaw = typeof data.dv === "number" ? data.dv : null;
  if (!opposition && dvRaw === null) return null;

  let skill;
  try {
    skill = getSkill(skillId);
  } catch {
    return null;
  }

  const stats = context
    ? effectiveStatsRecord(character, context)
    : (character.stats as Record<string, unknown> | null);
  const statValue =
    stats && typeof stats[skill.stat] === "number" ? (stats[skill.stat] as number) : null;
  if (statValue === null) return null;

  const skillLevel = character.skills.find((s) => s.skill_id === skillId)?.level ?? 0;
  const base = statValue + skillLevel;
  const woundPenalty = woundActionPenalty(woundState);
  const dv = opposition || dvRaw === null ? null : snapToPublishedDv(dvRaw);

  return {
    eventId: event.id,
    skillId,
    skillName: skill.name,
    stat: skill.stat,
    statValue,
    skillLevel,
    base,
    woundPenalty,
    dv,
    bandName: dv === null ? null : dvBandName(dv),
    // Being hurt raises the number on the die, not the DV: the difficulty was
    // set by the beat, the penalty is carried by the character.
    needed: dv === null ? null : dv - base - woundPenalty,
    opposition,
    intent: typeof data.intent === "string" ? data.intent : "",
    beatId: event.beat_id ?? null,
  };
}

/**
 * Every check still awaiting a die, oldest first.
 *
 * A turn may post more than one prompt, so a prompt is not simply "the last one
 * before a skill_check": each resolved roll names the prompt it answered
 * (data.prompt_event_id), and those prompts are struck off. Rows written before
 * that link existed carry no id, so an unlinked roll falls back to striking off
 * the oldest outstanding prompt for the same skill — which is what the old
 * one-at-a-time flow guaranteed anyway.
 */
export function pendingChecksFrom(
  events: CampaignEvent[],
  character: FullCharacter,
  woundState: WoundStateCode = "none",
  context?: LiveCheckContext,
): PendingCheck[] {
  const resolvedIds = new Set<string>();
  const unlinkedBySkill = new Map<string, number>();
  let unlinkedUnknownSkill = 0;

  for (const event of events) {
    if (event?.type !== "skill_check") continue;
    const data = (event.data ?? {}) as { prompt_event_id?: unknown; skill_id?: unknown };
    if (typeof data.prompt_event_id === "string") {
      resolvedIds.add(data.prompt_event_id);
    } else if (typeof data.skill_id === "string") {
      unlinkedBySkill.set(data.skill_id, (unlinkedBySkill.get(data.skill_id) ?? 0) + 1);
    } else {
      unlinkedUnknownSkill += 1;
    }
  }

  const pending: PendingCheck[] = [];
  for (const event of events) {
    if (event?.type !== "check_prompt") continue;
    if (resolvedIds.has(event.id)) continue;
    const described = describePendingCheck(event, character, woundState, context);
    if (!described) continue;
    const bySkill = unlinkedBySkill.get(described.skillId) ?? 0;
    if (bySkill > 0) {
      unlinkedBySkill.set(described.skillId, bySkill - 1); // an older roll settled this one
      continue;
    }
    if (unlinkedUnknownSkill > 0) {
      unlinkedUnknownSkill -= 1; // a legacy roll that named no skill settles the oldest
      continue;
    }
    pending.push(described);
  }
  return pending;
}

/** The next check awaiting a roll, if any. Prompts are answered in the order posted. */
export function pendingCheckFrom(
  events: CampaignEvent[],
  character: FullCharacter,
  woundState: WoundStateCode = "none",
  context?: LiveCheckContext,
): PendingCheck | null {
  return pendingChecksFrom(events, character, woundState, context)[0] ?? null;
}

/** One line of the session's dice record. */
export type RollRecord = {
  id: string;
  skillName: string;
  total: number;
  /** The DV, or on an opposed check the total the player was up against. */
  dv: number | null;
  success: boolean | null;
  critical: "success" | "failure" | null;
  /** Who opposed it, when the target number was another character's roll. */
  opposedBy: string | null;
  /**
   * The arithmetic, and what it cost — the lines behind the headline.
   *
   * A roll reads `22 vs 15 · HIT` by default and opens to its working, because
   * length should be earned: the player wants to know whether it landed far
   * more often than they want to audit the addition, and both have to be
   * available without one burying the other.
   */
  detail: string[];
};

/** `16 damage · SP 7 → 6 · 9 HP lost`, from what the attack actually applied. */
function damageLines(data: Record<string, unknown>): string[] {
  const num = (key: string): number | null =>
    typeof data[key] === "number" ? (data[key] as number) : null;
  const lines: string[] = [];
  const damage = num("damage");
  const spBefore = num("sp_before");
  const spAfter = num("sp_after");
  const hpBefore = num("hp_before");
  const hpAfter = num("hp_after");
  if (damage !== null) {
    const parts = [`${damage} damage`];
    if (spBefore !== null && spAfter !== null && spBefore !== spAfter) {
      parts.push(`SP ${spBefore} → ${spAfter}`);
    }
    if (hpBefore !== null && hpAfter !== null) parts.push(`${hpBefore - hpAfter} HP lost`);
    lines.push(parts.join(" · "));
  }
  if (data["critical_injury"] === true) lines.push("Critical Injury — +5 straight to HP");
  if (typeof data["target_wound_state"] === "string" && data["target_wound_state"] !== "none") {
    lines.push(`${data["target"]} is ${String(data["target_wound_state"]).replace("_", " ")}`);
  }
  return lines;
}

/**
 * One rolled check as the rail shows it. An opposed roll is logged with both
 * sides, so it is read back as the player's total against the total they were
 * actually up against — the opposing roll IS the number they had to beat.
 */
function recordFrom(event: CampaignEvent, name: string): RollRecord {
  const roll = event.roll as
    (Partial<SkillCheckResult> & Partial<OpposedCheckResult> & { formula?: unknown }) | null;
  const data = (event.data ?? {}) as Record<string, unknown>;
  // The engine already wrote the arithmetic out; the UI never recomputes it.
  const formula = typeof roll?.formula === "string" ? [roll.formula] : [];
  const detail = event.type === "attack" ? [...formula, ...damageLines(data)] : formula;

  if (roll?.actor && roll.opponent) {
    return {
      id: event.id,
      skillName: name,
      total: roll.actor.total,
      dv: roll.opponent.total,
      success: roll.success ?? null,
      critical: roll.actor.critical ?? null,
      opposedBy: roll.opponentSide?.name ?? null,
      detail: [
        ...(typeof roll.actor.formula === "string" ? [roll.actor.formula] : []),
        ...(typeof roll.opponent.formula === "string"
          ? [`opposed by ${roll.opponent.formula}`]
          : []),
      ],
    };
  }
  return {
    id: event.id,
    skillName: name,
    total: typeof roll?.total === "number" ? roll.total : 0,
    dv: typeof roll?.dv === "number" ? roll.dv : null,
    success: typeof roll?.success === "boolean" ? roll.success : null,
    critical: roll?.critical ?? null,
    opposedBy: null,
    detail,
  };
}

export function rollHistory(events: CampaignEvent[], limit = 10): RollRecord[] {
  const out: RollRecord[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const event = events[i];
    if (!event) continue;
    // Attacks belong here. They are the rolls the player cares most about
    // auditing and the only ones the rail did not show, which made the roll
    // log quietly untrue about the loudest part of the game.
    if (event.type !== "skill_check" && event.type !== "attack") continue;
    const data = (event.data ?? {}) as {
      skill_name?: unknown;
      skill_id?: unknown;
      weapon?: unknown;
      target?: unknown;
    };
    const name =
      event.type === "attack"
        ? [data.weapon, data.target].every((v) => typeof v === "string")
          ? `${data.weapon as string} → ${data.target as string}`
          : "Attack"
        : typeof data.skill_name === "string"
          ? data.skill_name
          : typeof data.skill_id === "string"
            ? data.skill_id
            : "Check";
    out.push(recordFrom(event, name));
  }
  return out;
}
