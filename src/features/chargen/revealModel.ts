import { generateCast, type CastMember, type LifepathTies } from "@/engine";
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
  return generateCast({
    seed: state.castPlan.seed,
    ties: tiesForState(state),
    picks: state.castPlan.picks,
  });
}

/** What the draft's Lifepath says about the people in the character's life. */
export function tiesForState(state: ChargenState): LifepathTies {
  return lifepathTiesFrom({
    lifepath: { general: state.lifepath.general },
  } as unknown as FullCharacter);
}
