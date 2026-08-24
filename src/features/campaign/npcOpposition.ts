/**
 * What the world remembers about the people who push back.
 *
 * An opposed check needs numbers for the NPC, and the GM improvises them. Left
 * at that, the same fixer would have a different COOL every time the player
 * leaned on them — the reset-button amnesia the GM brief forbids. So the first
 * time an NPC resists something, the numbers they resisted with are written to
 * their campaign_npcs row, and every later check reads them back: the GM's
 * proposal only fills in what is not already known.
 *
 * Nothing here rolls anything. It reads and writes the ledger's memory of a
 * person; the engine owns the dice.
 */
import { getSkill, type Opposition } from "@/engine";
import { saveCampaignNpc, type CampaignNpc, type Json } from "@/lib/backend";

/** The remembered STATs and Skill Levels an NPC opposes checks with. */
export type OppositionProfile = {
  /** STAT key ("cool", "emp") → value. */
  stats: Record<string, number>;
  /** Printed skill id → Level. */
  skills: Record<string, number>;
};

const EMPTY: OppositionProfile = { stats: {}, skills: {} };

function numberRecord(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

/** Read an NPC's remembered opposition numbers. Empty when nothing is known. */
export function oppositionProfileOf(npc: CampaignNpc | null | undefined): OppositionProfile {
  if (!npc) return EMPTY;
  const data = (npc.data ?? {}) as { opposition?: unknown };
  const opposition = (data.opposition ?? {}) as { stats?: unknown; skills?: unknown };
  return { stats: numberRecord(opposition.stats), skills: numberRecord(opposition.skills) };
}

/**
 * The numbers this check should actually use: what the campaign already knows
 * about this NPC, with the GM's freshly improvised values filling the gaps.
 *
 * Memory wins over improvisation. A skill the NPC has never used before is new
 * information and is taken from the proposal; a STAT already on the row is not
 * re-rolled because the model happened to say something different this turn.
 */
export function reconcileOpposition(
  proposed: Opposition,
  profile: OppositionProfile,
): { opposition: Opposition; remembered: boolean } {
  const statKey = getSkill(proposed.skillId).stat;
  const knownStat = profile.stats[statKey];
  const knownLevel = profile.skills[proposed.skillId];
  return {
    opposition: {
      ...proposed,
      statValue: knownStat ?? proposed.statValue,
      skillLevel: knownLevel ?? proposed.skillLevel,
    },
    remembered: knownStat !== undefined || knownLevel !== undefined,
  };
}

/** The profile to persist after a check: what was known, plus what was just used. */
export function profileWith(profile: OppositionProfile, opposition: Opposition): OppositionProfile {
  const statKey = getSkill(opposition.skillId).stat;
  return {
    stats: { ...profile.stats, [statKey]: opposition.statValue },
    skills: { ...profile.skills, [opposition.skillId]: opposition.skillLevel },
  };
}

/**
 * Write an NPC's opposition numbers back, creating the row if this is the first
 * time the campaign has met them. Other fields on the row (disposition, status,
 * notes) are left alone — this module only owns what an opposed check needs.
 */
export async function rememberOpposition(input: {
  campaignId: string;
  npcKey: string;
  npcName: string;
  npc: CampaignNpc | null;
  opposition: Opposition;
}): Promise<void> {
  const profile = profileWith(oppositionProfileOf(input.npc), input.opposition);
  const existingData = (input.npc?.data ?? {}) as Record<string, unknown>;
  // Write back under the key the row already has. When an NPC was matched by
  // name because the GM retyped their key, saving under the new key would file
  // a second row for the same person and split their memory in two.
  const key = input.npc?.npc_id ?? input.npcKey;
  await saveCampaignNpc(input.campaignId, key, {
    name: input.npcName,
    data: { ...existingData, opposition: profile } as unknown as Json,
  });
}
