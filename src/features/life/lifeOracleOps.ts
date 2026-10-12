/**
 * The oracles and the world tick, consulted before a Life turn's packet is
 * built. Split out of lifeOps.ts. No React and no TanStack Query in here.
 */

import { looksForWork, partOfDay } from "@/engine";
import { runWorldTick } from "@/features/campaign/worldTick";
import { answerPendingQuestion, consultStreet, consultWire } from "@/features/campaign/oracles";
import type { LifeBundle, TurnOptions } from "./lifeBundleOps";

/**
 * Ask the oracles, before the model is asked anything.
 *
 * Everything here is rolled and written down BEFORE the prompt is built, so the
 * model receives the answers as facts about a world that had already decided
 * them. It never learns that a die was involved, and it is never in a position
 * to decide whether the phone rings tonight.
 *
 * Nothing is rolled on an options turn: the player is thinking, not living, and
 * an evening should not pass because they asked what an evening might contain.
 */
export async function consultOracles(
  bundle: LifeBundle,
  input: string,
  turn: TurnOptions,
): Promise<TurnOptions["oracle"]> {
  if (turn.options) return undefined;
  const campaignId = bundle.campaign.id;

  // The world gets its turn before anything else is asked. Once per in-world
  // day, guarded inside runWorldTick, so the night cannot be re-rolled by a
  // refetch.
  //
  // What it writes lands on the NEXT turn rather than this one, because this
  // turn's board was built before the roll. That is the right shape: the night
  // passed, the player's turn resolves, and the scene that opens after it is
  // the consequence walking in.
  await runWorldTick({
    campaignId,
    day: bundle.clock.day,
    minute: bundle.clock.minute,
    npcs: bundle.npcs,
    situations: bundle.situations,
  });
  const oracle: NonNullable<TurnOptions["oracle"]> = {};

  // A question the model asked last turn. Answered first, so the answer is in
  // front of it before anything else about tonight is decided.
  const answer = await answerPendingQuestion(campaignId);
  if (answer) oracle.answer = answer;

  // Living, and nothing already on the table: is anybody calling tonight?
  if (bundle.phase === "life" && !bundle.hook) {
    const wire = await consultWire({
      campaignId,
      day: bundle.clock.day,
      eurobucks: bundle.vitals.eurobucks,
      chasing: looksForWork(input),
    });
    oracle.wireOffers = wire.offered;

    // And when nothing is already demanding attention, what the evening is —
    // once per part of the day, so a player taking five turns in one evening
    // does not get five chances at something walking into it.
    if (!bundle.current) {
      const street = await consultStreet({
        campaignId,
        day: bundle.clock.day,
        part: partOfDay(bundle.clock.minute),
      });
      if (street) oracle.street = street.result.text;
    }
  }

  return oracle;
}
