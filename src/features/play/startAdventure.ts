/**
 * Starting (or resuming) a playthrough for a saved character. Creates a campaign
 * seeded with a mission and returns its id; if the character already has an
 * active campaign, that one is resumed instead and the requested mission is
 * ignored — you cannot start a second job on top of a live one.
 */
import { jobIdForSeed, NIGHT_AT_THE_OPERA, rollJobSeed } from "@/engine";
import { getActiveCampaignForCharacter, type Character } from "@/lib/backend";
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
  return startCampaignForCharacter(character, { missionId: missionIdFor(start) });
}
