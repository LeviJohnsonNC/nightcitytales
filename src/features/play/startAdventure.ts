/**
 * Starting (or resuming) a playthrough for a saved character. Creates a campaign
 * seeded with the starter mission and returns its id; if the character already
 * has an active campaign, that one is resumed instead.
 */
import { NIGHT_AT_THE_OPERA } from "@/engine";
import { getActiveCampaignForCharacter, type Character } from "@/lib/backend";
import { startCampaignForCharacter } from "@/features/campaign/newCampaign";

export async function startOrResumeAdventure(
  character: Pick<Character, "id" | "name" | "handle">,
): Promise<string> {
  const existing = await getActiveCampaignForCharacter(character.id);
  if (existing) return existing.id;
  return startCampaignForCharacter(character, { missionId: NIGHT_AT_THE_OPERA.id });
}
