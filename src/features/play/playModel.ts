/**
 * Pure mappings from persisted rows into the shapes the play loop needs: the GM
 * character summary, the skill-check actor, NPC summaries, and rolling event
 * lines. No React, no I/O — so it can be unit-tested and reused by the hook.
 */
import { getSkill, STAT_ORDER, type SkillCheckActor, type StatKey } from "@/engine";
import type { GmCharacterSummary, GmNpcSummary } from "@/features/gm/gmContext";
import type { CampaignEvent, CampaignNpc, CampaignVitals, FullCharacter } from "@/lib/backend";

/** The STATs as a plain record, skipping any that aren't set. */
export function statsRecord(full: FullCharacter): Record<string, number> {
  const out: Record<string, number> = {};
  const stats = full.stats;
  if (!stats) return out;
  for (const key of STAT_ORDER) {
    const value = stats[key as keyof typeof stats];
    if (typeof value === "number") out[key] = value;
  }
  return out;
}

/** The minimal actor a skill check needs, from the saved character. */
export function actorFor(full: FullCharacter): SkillCheckActor {
  const stats: Partial<Record<StatKey, number>> = {};
  if (full.stats) {
    for (const key of STAT_ORDER) {
      const value = full.stats[key as keyof typeof full.stats];
      if (typeof value === "number") stats[key] = value;
    }
  }
  return {
    stats,
    skills: full.skills.map((s) => ({ skillId: s.skill_id, level: s.level })),
  };
}

/** The character's best trained skills as "Skill +base" entries, highest first. */
export function keySkills(
  full: FullCharacter,
  limit = 8,
): { skill: string; base: number; id: string }[] {
  const stats = statsRecord(full);
  return full.skills
    .filter((s) => s.level > 0)
    .map((s) => {
      const def = getSkill(s.skill_id);
      const statValue = stats[def.stat] ?? 0;
      return { skill: def.name, base: statValue + s.level, id: s.skill_id };
    })
    .sort((a, b) => b.base - a.base)
    .slice(0, limit);
}

/** The GM's compact view of the player character, from the sheet + live vitals. */
export function characterSummary(full: FullCharacter, vitals: CampaignVitals): GmCharacterSummary {
  return {
    name: full.character.name,
    role: full.character.role,
    hp: vitals.hp_current,
    hpMax: vitals.hp_max,
    woundState: vitals.wound_state,
    humanity: vitals.humanity_current,
    humanityMax: vitals.humanity_max,
    eurobucks: vitals.eurobucks,
    stats: statsRecord(full),
    keySkills: keySkills(full),
    ...(full.character.handle ? { handle: full.character.handle } : {}),
  };
}

export function npcSummaries(npcs: CampaignNpc[]): GmNpcSummary[] {
  return npcs.map((npc) => ({
    name: npc.name,
    disposition: npc.disposition,
    status: npc.status,
    ...(npc.location ? { notes: `at ${npc.location}` } : {}),
  }));
}

/** The most recent ledger entries as short lines for the rolling GM summary. */
export function recentEventLines(events: CampaignEvent[], limit = 8): string[] {
  return events
    .slice(-limit)
    .map((e) => e.summary ?? e.type)
    .filter((line): line is string => Boolean(line));
}
