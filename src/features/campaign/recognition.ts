/**
 * Being recognised, as the narrator is told it.
 *
 * Reputation's printed use (p.193): somebody meeting the character for the
 * first time rolls 1d10, and has heard of them if it comes in under their
 * Reputation. The narrator cannot know in advance who will walk into a scene,
 * so the engine rolls once per turn and says how it came out — "anyone meeting
 * them for the first time this turn has heard of them", or has not — and the
 * narrator plays whoever turns up accordingly. The die is the engine's; the
 * line carries no number, because a number in prose is never the narrator's.
 *
 * Nothing is said at Reputation 0: nobody has heard of a nobody, and a packet
 * line that only ever says so would be one more thing to read for nothing.
 */
import type { RecognitionRoll, ReputationStanding } from "@/engine";

export function reputationProp(
  reputation: ReputationStanding,
  roll: RecognitionRoll,
): { reputation: string } | Record<string, never> {
  if (reputation.level <= 0) return {};
  const heard = roll.heardOf
    ? "Anyone meeting them for the first time this turn HAS heard of them."
    : "Anyone meeting them for the first time this turn has NOT heard of them.";
  return {
    reputation: `${reputation.level} — ${reputation.whoKnows ?? ""} ${heard}`.replace(
      / {2,}/g,
      " ",
    ),
  };
}

/** The die as the ledger keeps it, beside the narration it informed. Absent at 0. */
export function recognitionRecord(
  roll: RecognitionRoll,
): { recognition: RecognitionRoll } | Record<string, never> {
  return roll.reputation > 0 ? { recognition: roll } : {};
}
