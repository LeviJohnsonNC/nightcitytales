/**
 * Pure mappings from persisted rows into the shapes the play loop needs: the GM
 * character summary, the skill-check actor, NPC summaries, and rolling event
 * lines. No React, no I/O — so it can be unit-tested and reused by the hook.
 */
import {
  BASIC_SKILL_IDS,
  clampDisposition,
  currentStats,
  areaForCheck,
  getSkill,
  isAreaScoped,
  localExpertLevel,
  skillCheckLabel,
  skillLevelFor,
  STAT_ORDER,
  type MissionStatus,
  type SkillCheckActor,
  type StatKey,
} from "@/engine";
import type { GmCharacterSummary, GmNpcSummary } from "@/features/gm/gmContext";
import type { GmSuggestedAction } from "@/features/gm/gmResponse";
import type {
  CampaignEvent,
  CampaignInventoryItem,
  CampaignNpc,
  CampaignVitals,
  FullCharacter,
} from "@/lib/backend";
import { liveInventory } from "./liveInventory";

export type CurrentStatsContext = {
  vitals: CampaignVitals;
  inventory: CampaignInventoryItem[];
  /**
   * The district the campaign has the character standing in, when the caller
   * knows it. Only a place-scoped Skill reads it — Local Expert is worth its
   * Level in one neighbourhood and nothing anywhere else — but it has to travel
   * with the rest of the live context, because the sheet alone cannot say where
   * the character is and a Skill list that does not know is a Skill list that
   * overstates. Omitted, Local Expert reads as the sheet's own best line, which
   * is what every caller got before it existed.
   */
  districtKey?: string | null;
};

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

/** Saved STATs projected through the campaign's current body and worn armor. */
export function effectiveStatsRecord(
  full: FullCharacter,
  context?: CurrentStatsContext,
): Record<string, number> {
  const base = statsRecord(full);
  if (!context) return base;
  return currentStats({
    base,
    humanityCurrent: context.vitals.humanity_current,
    wornArmorIds: liveInventory(context.inventory, { ...full, gear: full.gear ?? [] })
      .filter((row) => row.equipped && (row.slot === "head" || row.slot === "body"))
      .map((row) => row.item_id),
  }) as Record<string, number>;
}

/**
 * The minimal actor a skill check needs, from the saved character.
 *
 * Carries each Skill line's specialization, the character's home district, and
 * the district they are standing in, so a place-scoped Skill is read for the
 * right neighbourhood. Dropping those three was how Local Expert (Little China)
 * rolled at full Level on the other side of the city.
 */
export function actorFor(full: FullCharacter, context?: CurrentStatsContext): SkillCheckActor {
  const stats: Partial<Record<StatKey, number>> = {};
  const projected = effectiveStatsRecord(full, context);
  for (const key of STAT_ORDER) {
    const value = projected[key];
    if (typeof value === "number") stats[key] = value;
  }
  return {
    stats,
    skills: full.skills.map((s) => ({
      skillId: s.skill_id,
      level: s.level,
      specialization: s.specialization,
    })),
    homeDistrictKey: full.finance?.home_district_key ?? null,
    districtKey: context?.districtKey ?? null,
  };
}

/**
 * How much of a local this character is in a district — 0 when they are not.
 *
 * The adapter between a persisted sheet and `localExpert.ts`: it resolves the
 * printed "Your Home" placeholder through the character's saved home district,
 * so the Skill every Role package grants counts for the neighbourhood they
 * actually live in. Feature code asks this rather than reaching into the skill
 * rows, so there is one place where a Skill line becomes a Level for a place.
 */
export function localExpertIn(full: FullCharacter, districtKey: string | null | undefined): number {
  return localExpertLevel(
    full.skills.map((s) => ({
      skillId: s.skill_id,
      level: s.level,
      specialization: s.specialization,
    })),
    districtKey,
    full.finance?.home_district_key ?? null,
  );
}

/**
 * The character's best trained skills as "Skill +base" entries, highest first.
 *
 * A specialized Skill is named with its specialization, because "Language +8"
 * twice over tells the model nothing about which tongue either line is, and
 * because the number beside a place-scoped Skill is only true somewhere.
 *
 * THE NUMBER HERE IS THE NUMBER THE ENGINE WILL ROLL. For Local Expert that
 * means the Level for the district the character is standing in, which is 0
 * everywhere they are not a local — otherwise the model is shown "Local Expert
 * +9" in a neighbourhood the character has never been and calls for the check
 * on the strength of it. One entry per place-scoped Skill, for where they
 * stand: which other neighbourhoods they know is knowledge for the narrator's
 * own block, not a second roll the model could reach for.
 */
export function keySkills(
  full: FullCharacter,
  limit = 8,
  context?: CurrentStatsContext,
): { skill: string; id: string; base: number }[] {
  const stats = effectiveStatsRecord(full, context);
  const actor = actorFor(full, context);
  const lines: { skill: string; id: string; base: number }[] = [];
  const placeScopedSeen = new Set<string>();

  for (const row of full.skills) {
    if (row.level <= 0) continue;
    const def = getSkill(row.skill_id);
    const statValue = stats[def.stat] ?? 0;

    if (isAreaScoped(def.id)) {
      if (placeScopedSeen.has(def.id)) continue;
      placeScopedSeen.add(def.id);
      const area = areaForCheck(actor, def.id);
      lines.push({
        skill: skillCheckLabel(actor, def.id, area),
        id: def.id,
        base: statValue + skillLevelFor(actor, def.id, area),
      });
      continue;
    }

    lines.push({
      skill: row.specialization ? `${def.name} (${row.specialization})` : def.name,
      id: def.id,
      base: statValue + row.level,
    });
  }

  return lines.sort((a, b) => b.base - a.base).slice(0, limit);
}

/**
 * Every skill id the GM may legally name this turn: the character's trained
 * skills first, then the Basic Skills they are untrained in, at Level 0.
 *
 * Trained skills alone are not enough. The context block tells the model these
 * ids are the only valid ones, so a character who never bought Persuasion left
 * the GM with no id for talking someone round — and a persuasion attempt got
 * narrated instead of rolled. Everyone rolls Basic Skills at Level 0; the list
 * has to say so.
 */
export function gmSkillList(
  full: FullCharacter,
  limit = 40,
  context?: CurrentStatsContext,
): { skill: string; id: string; base: number }[] {
  const stats = effectiveStatsRecord(full, context);
  const actor = actorFor(full, context);
  const trained = keySkills(full, limit, context);
  const known = new Set(trained.map((s) => s.id));
  const untrainedBasics = BASIC_SKILL_IDS.filter((id) => !known.has(id)).map((id) => {
    const def = getSkill(id);
    // A place-scoped Basic Skill is named for the ground underfoot even at
    // Level 0, so the list never offers "Local Expert" as though it were a
    // Skill you could roll about the city at large.
    const skill = isAreaScoped(def.id)
      ? skillCheckLabel(actor, def.id, areaForCheck(actor, def.id))
      : def.name;
    return { skill, id: def.id, base: stats[def.stat] ?? 0 };
  });
  return [...trained, ...untrainedBasics];
}

/**
 * The GM's compact view of the player character, from the sheet + live vitals.
 *
 * `districtKey` is where the character is standing. It only reaches the Skill
 * list, and only a place-scoped Skill reads it, but without it that list
 * advertises Local Expert at a Level the engine will not roll.
 */
export function characterSummary(
  full: FullCharacter,
  vitals: CampaignVitals,
  inventory: CampaignInventoryItem[] = [],
  districtKey?: string | null,
): GmCharacterSummary {
  const context = { vitals, inventory, ...(districtKey === undefined ? {} : { districtKey }) };
  return {
    name: full.character.name,
    role: full.character.role,
    hp: vitals.hp_current,
    hpMax: vitals.hp_max,
    woundState: vitals.wound_state,
    humanity: vitals.humanity_current,
    humanityMax: vitals.humanity_max,
    eurobucks: vitals.eurobucks,
    stats: effectiveStatsRecord(full, context),
    keySkills: keySkills(full, 8, context),
    availableSkills: gmSkillList(full, 40, context),
    ...(full.character.handle ? { handle: full.character.handle } : {}),
  };
}

/**
 * What a clicked suggestion sends as the player's turn.
 *
 * A suggestion the GM tagged with a skill is a check it already has in mind, so
 * clicking it must not degrade into plain prose the model may narrate away: the
 * tag is passed back as an engine note. An untagged suggestion is just its label.
 */
export function suggestionInput(suggestion: GmSuggestedAction): string {
  const skill = suggestion.skill?.trim();
  if (!skill) return suggestion.label;
  return `${suggestion.label}\n(ENGINE: this action leans on ${skill}. If it can plausibly fail, propose a skill_check with that skillId and a DV from the published table, and stop.)`;
}

export function npcSummaries(npcs: CampaignNpc[]): GmNpcSummary[] {
  return npcs.map((npc) => ({
    name: npc.name,
    disposition: npc.disposition,
    status: npc.status,
    ...(npc.npc_id ? { key: npc.npc_id } : {}),
    ...(npc.location ? { notes: `at ${npc.location}` } : {}),
  }));
}

/**
 * Where an NPC's disposition lands after the GM shifts it.
 *
 * The scale is small and the column enforces it, so a run of hostile turns
 * cannot drive someone to -12; it bottoms out at hostile. An NPC the campaign
 * has never filed starts from neutral, which is what a stranger is.
 */
export function npcDispositionAfter(
  npc: { disposition: number } | null,
  delta: number,
): { disposition: number; isNew: boolean } {
  const current = npc?.disposition ?? 0;
  return { disposition: clampDisposition(current + delta), isNew: npc === null };
}

/**
 * The stored NPC a GM-supplied key refers to. The model is shown each NPC's key
 * and told to reuse it, but a key it typed slightly differently must not read as
 * a stranger with fresh numbers — so a miss falls back to matching the name.
 */
export function findNpcByKey(npcs: CampaignNpc[], key: string, name?: string): CampaignNpc | null {
  const byKey = npcs.find((npc) => npc.npc_id === key);
  if (byKey) return byKey;
  const wanted = (name ?? key).trim().toLowerCase();
  return npcs.find((npc) => npc.name.trim().toLowerCase() === wanted) ?? null;
}

/** The most recent ledger entries as short lines for the rolling GM summary. */
/**
 * Ledger rows that are dice trace rather than fiction, and have no business in
 * a rolling summary. The secret ones especially: a GM handed its own oracle
 * rolls back as "recent events" would be reading answers it was never told.
 */
const UNSUMMARIZED_EVENT_TYPES = new Set([
  "oracle_roll",
  "oracle_secret",
  // The prompt rows behind the dice cards. The GM proposed the attack itself,
  // or the player clicked a target on the board; either way what the GM needs
  // is the RESULT, which arrives as its own row. Left in, a handful of prompts
  // fills the whole window and the fiction falls out of the bottom of it.
  "check_prompt",
  "attack_prompt",
  "death_save_prompt",
]);

export function recentEventLines(events: CampaignEvent[], limit = 8): string[] {
  return events
    .filter((e) => !UNSUMMARIZED_EVENT_TYPES.has(e.type))
    .slice(-limit)
    .map((e) => e.summary ?? e.type)
    .filter((line): line is string => Boolean(line));
}

/**
 * How the current job ended, or null while it is still being played.
 *
 * A campaign is the character's ongoing run; a mission is one job inside it.
 * Finishing a job therefore does NOT end the campaign — only death does. So the
 * two outcomes are read from different places: the job's own runtime says it
 * reached a Resolution, and the campaign's status says the character is gone.
 */
export type JobOutcome = "died" | "completed" | null;

export function jobOutcome(
  campaignStatus: string,
  missionStatus: MissionStatus | null,
): JobOutcome {
  if (campaignStatus === "lost") return "died";
  if (missionStatus === "completed") return "completed";
  return null;
}
