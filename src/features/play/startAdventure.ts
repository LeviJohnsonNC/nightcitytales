/**
 * Starting (or resuming) a playthrough for a saved character. Creates a campaign
 * seeded with a mission and returns its id; if the character already has an
 * active campaign, that one is resumed instead and the requested mission is
 * ignored — you cannot start a second job on top of a live one.
 *
 * The campaign opens where the character lives. Resuming does not move anybody:
 * an existing campaign is returned untouched, so a character who has walked
 * across the city stays where they walked to.
 */
import { jobIdForSeed, NIGHT_AT_THE_OPERA, rollJobSeed } from "@/engine";
import { getActiveCampaignForCharacter, getCharacterHome, type Character } from "@/lib/backend";
import { startCampaignForCharacter } from "@/features/campaign/newCampaign";

export type AdventureStart =
  /** The authored Tales from the RED opener. */
  | { kind: "starter" }
  /** A procedurally generated job. The seed is drawn now and lives in the id. */
  | { kind: "generated" };

/** The mission id a start option resolves to. */
export function missionIdFor(start: AdventureStart): string {
  return start.kind === "generated" ? jobIdForSeed(rollJobSeed()) : NIGHT_AT_THE_OPERA.id;
}

export async function startOrResumeAdventure(
  character: Pick<Character, "id" | "name" | "handle">,
  start: AdventureStart = { kind: "starter" },
): Promise<string> {
  const existing = await getActiveCampaignForCharacter(character.id);
  if (existing) return existing.id;
  return startCampaignForCharacter(character, {
    missionId: missionIdFor(start),
    // Looked up here rather than passed in, so no caller can forget it and no
    // caller has to carry a finance row it does not otherwise need.
    homePlaceKey: await homeFor(character.id),
  });
}

/**
 * The character's address, or null — and a complaint when null is not an answer.
 *
 * A campaign that starts somewhere is worth more than a campaign that refuses
 * to start, so every failure here still falls through to the atlas default.
 * What it no longer does is fall through QUIETLY. The first version swallowed
 * everything, which meant an unapplied migration and a character who genuinely
 * has no home produced the same silence, and a player who chose Pacifica woke
 * up in Little Europe with nothing written down anywhere.
 */
async function homeFor(characterId: string): Promise<string | null> {
  try {
    const home = await getCharacterHome(characterId);
    if (!home.readable) {
      console.error(
        "[startAdventure] character_finance has no home_place_key column, so the campaign " +
          "will open at the default start rather than where this character lives. The " +
          "migration supabase/migrations/20260906090000_character_home_place.sql has not " +
          "been applied to this database.",
      );
      return null;
    }
    return home.placeKey;
  } catch (error) {
    console.error("[startAdventure] could not read where this character lives:", error);
    return null;
  }
}
