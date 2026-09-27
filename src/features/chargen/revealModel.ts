import { generateCast, type CastMember } from "@/engine";
import { lifepathTiesFrom } from "@/features/campaign/castSeeding";
import type { FullCharacter } from "@/lib/backend";
import type { ChargenState } from "./store";

/**
 * The cast this character will walk into, from the plan creation holds.
 *
 * The same call the campaign makes when it seeds its six — same seed, same
 * Lifepath, same picks — so the faces on this screen are the people the game
 * will actually put in front of them, not a preview that could disagree.
 */
export function castForState(state: ChargenState): CastMember[] {
  if (!state.castPlan) return [];
  const ties = lifepathTiesFrom({
    lifepath: { general: state.lifepath.general },
  } as unknown as FullCharacter);
  return generateCast({ seed: state.castPlan.seed, ties, picks: state.castPlan.picks });
}
