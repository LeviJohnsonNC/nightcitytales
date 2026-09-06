/**
 * Starting a campaign from a saved character. The heavy lifting (vitals,
 * inventory, ledger) happens transactionally in the start_campaign RPC; this
 * module supplies a sensible default name, calls the adapter, and then puts the
 * character where they live.
 *
 * That last part is done here rather than in the RPC on purpose. `location_key`
 * was added to `campaigns` in a later migration than `start_campaign`, so the
 * function has never set it and every campaign fell back to the atlas default —
 * a character who chose the Combat Zone in creation woke up in Little Europe.
 * Fixing it as a follow-up write keeps a large SQL function untouched, and a
 * campaign whose home write fails is still a playable campaign at the default
 * start rather than a failed creation.
 */
import {
  startCampaign,
  updateCampaign,
  upsertCampaignPlace,
  type Character,
  type FullCharacter,
} from "@/lib/backend";
import { getPlace, recordVisit, startingState } from "@/engine";

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
  /**
   * Where this character lives, from their sheet. The campaign opens here and
   * the character starts knowing the building. Omitted or unknown to the atlas,
   * the campaign keeps the default start.
   */
  homePlaceKey?: string | null;
};

/**
 * How well a character knows their own home on day one.
 *
 * `placeIntel` opens its rungs on visits, and the top one costs six. Somebody
 * who lives in a building knows what it is, who claims the street, who comes
 * when it goes loud, and what has happened there — so they start with the whole
 * ladder rather than earning it by walking through their own front door six
 * times. It is not a rules bonus: every rung is information the engine already
 * holds and would have handed over eventually.
 */
const KNOWS_IT_LIKE_HOME = 6;

/**
 * Put the character in their own home, and let them know it.
 *
 * Best-effort by design: a campaign that starts is worth more than a campaign
 * that starts in the right place, so a failure here is swallowed and the
 * campaign opens at the default start.
 */
async function moveIn(campaignId: string, homePlaceKey: string): Promise<void> {
  if (!getPlace(homePlaceKey)) return;
  await updateCampaign(campaignId, {
    location_key: homePlaceKey,
    known_places: [homePlaceKey],
  });
  let state = startingState(homePlaceKey);
  for (let i = 0; i < KNOWS_IT_LIKE_HOME; i += 1) state = recordVisit(state, 1);
  await upsertCampaignPlace(campaignId, {
    placeKey: state.placeKey,
    dials: state.dials,
    flags: state.flags,
    visits: state.visits,
    firstVisitDay: state.firstVisitDay,
    lastVisitDay: state.lastVisitDay,
  });
}

/** The home a saved character's sheet names, if it named one. */
export function homeOf(character: Pick<FullCharacter, "finance">): string | null {
  return character.finance?.home_place_key ?? null;
}

/** Begin a playthrough for a saved character. Returns the new campaign id. */
export async function startCampaignForCharacter(
  character: Pick<Character, "id" | "name" | "handle">,
  options: StartCampaignOptions = {},
): Promise<string> {
  const name = options.name?.trim() || defaultCampaignName(character);
  const campaignId = await startCampaign({
    character_id: character.id,
    name,
    ...(options.missionId ? { mission_id: options.missionId } : {}),
  });
  if (options.homePlaceKey) {
    try {
      await moveIn(campaignId, options.homePlaceKey);
    } catch {
      // A campaign at the default start beats no campaign at all.
    }
  }
  return campaignId;
}
