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
  // Looked up here rather than passed in, so no caller can forget it and no
  // caller has to carry a finance row it does not otherwise need. A character
  // saved before the housing step asked for an address has none, and the
  // campaign opens at the atlas default exactly as it used to.
  const home = await getCharacterHome(character.id).catch(() => ({ placeKey: null }));
  return startCampaignForCharacter(character, {
    missionId: missionIdFor(start),
    homePlaceKey: home.placeKey,
  });
}
