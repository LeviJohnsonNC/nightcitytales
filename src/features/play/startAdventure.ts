/**
 * Starting (or resuming) a playthrough for a saved character. Returns the
 * campaign id; if the character already has an active campaign, that one is
 * resumed untouched, so a character who has walked across the city stays where
 * they walked to.
 *
 * A new campaign is created with NO MISSION. It used to be handed one here, and
 * the choice between the authored opener and a generated job was made by a
 * button on the character list — out of fiction, before the player had read a
 * word. The campaign now opens on its cold open, in Life, and whether there is
 * work tonight is the first thing the character decides. See
 * features/opening/.
 *
 * The campaign still opens where the character lives.
 */
import { getActiveCampaignForCharacter, getCharacterHome, type Character } from "@/lib/backend";
import { startCampaignForCharacter } from "@/features/campaign/newCampaign";

export async function startOrResumeAdventure(
  character: Pick<Character, "id" | "name" | "handle">,
): Promise<string> {
  const existing = await getActiveCampaignForCharacter(character.id);
  if (existing) return existing.id;
  return startCampaignForCharacter(character, {
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
