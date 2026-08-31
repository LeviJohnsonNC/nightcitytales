/**
 * Dropping straight into a fight, for testing the battlefield.
 *
 * WHY THIS EXISTS. Combat only starts when the Job GM proposes a
 * `start_encounter`, which means reaching it takes a hook, an accepted job, and
 * several beats of play — and Life is forbidden from starting a fight at all
 * (features/life/lifeSystemPrompt.ts). That is correct for players and useless
 * for checking whether a marker is clickable.
 *
 * WHAT IT DELIBERATELY IS NOT. This module contains no combat. It does not
 * resolve a turn, move anybody, or draw anything. It builds a FIXTURE and hands
 * the player to `/play/:id`, where the shipping code owns everything — the same
 * board, the same `usePlay`, the same legality gate, the same persistence. A
 * harness with its own turn loop would verify the board against a driver
 * production never runs, which is worse than no harness: it would show a
 * working fight while the real one stayed broken.
 *
 * So every call below is one the real path already makes. The only thing this
 * module owns is the CHOICE of arena, opposition and starting condition.
 */
import {
  ARENAS,
  DEFAULT_ARENA_KEY,
  NIGHT_AT_THE_OPERA,
  buildForce,
  forceFor,
  runtimeAtBeat,
  threatFor,
  woundStateFor,
  type ForceSize,
  type ThreatMember,
} from "@/engine";
import { saveMissionRuntime } from "@/features/campaign/missionState";
import { startCampaignForCharacter } from "@/features/campaign/newCampaign";
import { beginEncounter } from "@/features/play/combatFlow";
import type { GmEnemy } from "@/features/gm/gmResponse";
import {
  getActiveCampaignForCharacter,
  getActiveEncounter,
  getCampaign,
  getCharacter,
  setCampaignPhase,
  setInventoryAmmo,
  updateCampaign,
  updateCampaignVitals,
  updateEncounter,
  type Character,
} from "@/lib/backend";

/**
 * The beat a seeded fight stands on.
 *
 * The starter mission's authored climax, which is already flagged
 * `encounter: true` and carries a full opposition list — so the GM context a
 * seeded fight produces looks like a real one rather than a blank.
 */
export const SANDBOX_BEAT_ID = "monster_hunt";

/** How hurt the character starts, for exercising the wound rules. */
export type SeedWound = "none" | "light" | "serious" | "mortal";

export type SeedOptions = {
  characterId: string;
  characterName: string;
  characterHandle: string | null;
  /** One of the engine's authored arenas. */
  arena: string;
  /** A force template plus its size, expanded by the engine. */
  force: { key: string; size: ForceSize };
  /** Start the character wounded, to reach the penalties and the Death Save. */
  wound: SeedWound;
  /** Empty every magazine, to reach Reload and the empty-weapon refusal. */
  emptyMagazines: boolean;
};

/** The opposition, as the shape `beginEncounter` takes from the GM. */
export function enemiesFrom(members: ThreatMember[]): GmEnemy[] {
  return members.map((m) => ({ key: m.key, name: m.name, profile: m.profile.key }));
}

/**
 * HP for a wound state, worked backwards from the thresholds the engine uses.
 *
 * `woundStateFor` is the authority in both directions here: the number is
 * chosen and then CHECKED against it, so a change to the wound rules breaks
 * this loudly rather than seeding a fight that quietly disagrees with them.
 */
export function hpForWound(wound: SeedWound, hpMax: number, threshold: number): number {
  const candidate =
    wound === "none"
      ? hpMax
      : wound === "light"
        ? Math.max(threshold, hpMax - 1)
        : wound === "serious"
          ? Math.max(1, threshold - 1)
          : 0;
  const got = woundStateFor(candidate, hpMax, threshold);
  if (got !== wound) {
    throw new Error(`seedEncounter: ${candidate} HP reads as "${got}", not "${wound}".`);
  }
  return candidate;
}

export type SeedResult = { campaignId: string; encounterId: string };

/**
 * Put a character in a fight and return where to send them.
 *
 * Reuses their live campaign when there is one — the app allows a character
 * only one at a time — and creates a scratch campaign otherwise.
 */
export async function seedEncounter(options: SeedOptions): Promise<SeedResult> {
  const character: Pick<Character, "id" | "name" | "handle"> = {
    id: options.characterId,
    name: options.characterName,
    handle: options.characterHandle,
  };

  const existing = await getActiveCampaignForCharacter(options.characterId);
  const campaignId =
    existing?.id ??
    (await startCampaignForCharacter(character, {
      name: `${options.characterName} — battlefield test`,
      missionId: NIGHT_AT_THE_OPERA.id,
    }));

  // One fight at a time, the same rule the play loop enforces. Re-seeding over
  // a live encounter would leave two actives and `getActiveEncounter` would
  // pick whichever the database felt like.
  const live = await getActiveEncounter(campaignId);
  if (live) await endEncounter(live.id);

  // The job machinery owns the screen from here; the play route switches on
  // phase alone. Set the mission first so the phase change never lands on a
  // campaign with nowhere to be.
  await updateCampaign(campaignId, { current_mission_id: NIGHT_AT_THE_OPERA.id, status: "active" });
  await saveMissionRuntime(campaignId, runtimeAtBeat(NIGHT_AT_THE_OPERA, SANDBOX_BEAT_ID));
  await setCampaignPhase(campaignId, "job");

  const full = await getCampaign(campaignId);
  if (!full?.vitals) throw new Error("The campaign has no vitals to fight with.");

  if (options.wound !== "none") {
    const hp = hpForWound(
      options.wound,
      full.vitals.hp_max,
      full.vitals.seriously_wounded_threshold,
    );
    await updateCampaignVitals(campaignId, {
      hp_current: hp,
      wound_state: options.wound,
      // A fresh Death Save ladder: seeding a penalty would make the first save
      // harder than the rules say a first save is.
      mortal_save_failures: 0,
    });
  }

  if (options.emptyMagazines) {
    for (const row of full.inventory) {
      if (row.slot !== "weapon") continue;
      await setInventoryAmmo(row.id, 0);
    }
  }

  // Re-read: the vitals and ammunition above are what the encounter snapshots
  // its combatant and armour from, and a stale bundle would seed a fight at
  // full HP that the campaign disagrees with.
  const fresh = await getCampaign(campaignId);
  if (!fresh?.vitals) throw new Error("The campaign lost its vitals mid-seed.");
  const sheet = await getCharacter(fresh.campaign.character_id);
  if (!sheet) throw new Error("This campaign's character no longer exists.");

  const members = buildForce(forceFor(options.force.key), options.force.size);
  const encounter = await beginEncounter({
    campaignId,
    characterId: options.characterId,
    beatId: SANDBOX_BEAT_ID,
    name: "Battlefield test",
    character: sheet,
    vitals: fresh.vitals,
    inventory: fresh.inventory,
    enemies: enemiesFrom(members),
    arena: arenaKeyOr(options.arena),
  });

  return { campaignId, encounterId: encounter.id };
}

/** Close the fight in progress so another can be seeded over it. */
export async function endEncounter(encounterId: string): Promise<void> {
  // Not `saveLiveEncounter`: this writes no combatant state, so there is no
  // version to check and nothing that could be clobbered. "resolved" is the
  // status the closeout path leaves behind.
  await updateEncounter(encounterId, { status: "resolved" });
}

/** The arena key, falling back rather than throwing on a stale form value. */
function arenaKeyOr(key: string): string {
  return ARENAS.some((a) => a.key === key) ? key : DEFAULT_ARENA_KEY;
}

/** Every threat profile a force template will put on the board, for the form. */
export function previewForce(key: string, size: ForceSize): ThreatMember[] {
  return buildForce(forceFor(key), size);
}

/** The profile behind a key, for showing what a force is made of. */
export const profileFor = threatFor;
