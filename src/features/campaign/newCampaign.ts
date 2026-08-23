/**
 * Starting a campaign from a saved character. The heavy lifting (vitals,
 * inventory, ledger) happens transactionally in the start_campaign RPC; this
 * module just supplies a sensible default name and calls the adapter.
 */
import { startCampaign, type Character } from "@/lib/backend";

/** "<handle or name> in Night City". */
export function defaultCampaignName(character: Pick<Character, "name" | "handle">): string {
  const who = character.handle?.trim() || character.name.trim();
  return `${who} in Night City`;
}

export type StartCampaignOptions = {
  /** Override the auto-generated campaign name. */
  name?: string;
  /** Optional starting mission id (content key). */
  missionId?: string | null;
};

/** Begin a playthrough for a saved character. Returns the new campaign id. */
export async function startCampaignForCharacter(
  character: Pick<Character, "id" | "name" | "handle">,
  options: StartCampaignOptions = {},
): Promise<string> {
  const name = options.name?.trim() || defaultCampaignName(character);
  return startCampaign({
    character_id: character.id,
    name,
    ...(options.missionId ? { mission_id: options.missionId } : {}),
  });
}
