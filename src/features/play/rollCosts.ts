import { luckRemaining, luckAfterSpend } from "@/engine";
import { updateCampaignVitals, type CampaignVitals, type FullCharacter } from "@/lib/backend";
import { statsRecord } from "./playModel";

/**
 * Take the Luck a roll was made with out of the pool.
 *
 * Called when the roll is committed, not when the stepper moves: Luck is
 * dedicated before the dice and paid for once the dice have been thrown, so a
 * card the player abandons mid-turn costs them nothing.
 */
export async function payLuck(
  bundle: { campaign: { id: string }; vitals: CampaignVitals; character: FullCharacter },
  spend: number,
): Promise<void> {
  if (spend <= 0) return;
  const remaining = luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character));
  await updateCampaignVitals(bundle.campaign.id, {
    luck_current: luckAfterSpend(remaining, spend),
  });
}
