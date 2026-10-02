/**
 * Where this campaign's character lives, and what they eat.
 *
 * The campaign's own columns (`housing_id`, `lifestyle_id`, `home_place_key`)
 * once the character has moved; until then, what creation gave them — the
 * Role's starting housing and Lifestyle, and the building saved on the
 * character. A campaign that has never moved reads exactly as it always did.
 *
 * Only the HOME moves. Local Expert's "Your Home" and where the cast spend
 * their evenings still read the district the character grew up in
 * (`character_finance.home_district_key`): what you know about a neighbourhood
 * and who you know there do not come with you in the van.
 */
import {
  districtOfPlace,
  getPlace,
  housingById,
  lifestyleById,
  startingHomeOf,
  type Home,
} from "@/engine";
import type { Campaign, FullCharacter } from "@/lib/backend";

/** True once this campaign has a home of its own on file. */
export function hasMoved(campaign: Campaign): boolean {
  return Boolean(campaign.housing_id || campaign.lifestyle_id || campaign.home_place_key);
}

export function campaignHome(campaign: Campaign, character: FullCharacter): Home {
  const start = startingHomeOf(
    character.character.role ?? null,
    character.finance?.home_place_key ?? null,
  );
  return {
    housingId: campaign.housing_id || start.housingId,
    lifestyleId: campaign.lifestyle_id || start.lifestyleId,
    placeKey: campaign.home_place_key || start.placeKey,
  };
}

/**
 * The narrator's one line about home: the kind of place, the building and what
 * they eat. Names only — the rent is the engine's and never reaches the prose.
 */
export function homeLine(campaign: Campaign, character: FullCharacter): string {
  const home = campaignHome(campaign, character);
  const place = home.placeKey ? getPlace(home.placeKey) : undefined;
  const district = home.placeKey ? districtOfPlace(home.placeKey) : undefined;
  const housing = housingById(home.housingId)?.name ?? home.housingId;
  const lifestyle = lifestyleById(home.lifestyleId)?.name ?? home.lifestyleId;
  const at = place ? ` at ${place.name}${district ? ` (${district.name})` : ""}` : "";
  return `${housing}${at}; eats ${lifestyle}`;
}
