/**
 * One Life turn and the checks it settles: `liveTurn`, the engine rolling
 * what is small, a search, `commitLifeCheck` and a negotiation's result.
 * These call one another in a loop (a turn may roll a check, and a settled
 * check narrates another turn), so they share a module rather than importing
 * each other in a circle. Split out of lifeOps.ts, which re-exports them.
 * No React and no TanStack Query in here.
 */

import { trySceneAttack } from "@/features/scenes/sceneOps";
import { checkResolvedLine } from "./checkResult";
import {
  clampDisposition,
  hookAskSpec,
  settleHookAsk,
  type HookAsk,
  recognitionRoll,
  type WoundStateCode,
  mayRollItself,
  DEFAULT_START,
  DEDUCTION_SKILL,
  isSearchSkill,
  searchWith,
  truthsAt,
  resolvePosition,
} from "@/engine";
import {
  appendCampaignEvent,
  findCampaignNpc,
  listCampaignEvents,
  recordTruthDiscovery,
  setNpcDisposition,
  upsertSituations,
  type Json,
} from "@/lib/backend";
import { logOpposedCheck, logSkillCheck } from "@/features/campaign/skillCheckLog";
import {
  facedownOutcomeLine,
  pendingChecksFrom,
  type CheckRoll,
  type PendingCheck,
} from "@/features/play/checkPrompt";
import { renderLifeUserPrompt } from "./lifeContext";
import { lifeTurnFn } from "./lifeTurn.server";
import { askTagFrom, hookUpsert, type LifeHook } from "./hookOffer";
import { markDealtWith } from "@/features/campaign/castSeeding";
import { applyInsight, insightLine } from "@/features/campaign/socialInsight";
import { settleMoves } from "@/features/campaign/worldTick";
import { rollPendingCheck } from "@/features/play/rollCheck";
import { arcSituationKey, noteArcInvolvement } from "@/features/campaign/arcs";
import { saidBefore } from "@/features/narration/narratorRules";
import { describeTravelOutcome } from "./lifeModel";
import { type LifeBundle, type TurnOptions, loadLife } from "./lifeBundleOps";
import { buildContext } from "./lifeContextOps";
import { applyResponse } from "./lifeApplyOps";
import { consultOracles } from "./lifeOracleOps";

/** One Life turn: the player says something, the world answers. */
export async function liveTurn(
  bundle: LifeBundle,
  input: string,
  turn: TurnOptions = {},
): Promise<void> {
  if (!turn.fixedResult && !turn.continuation && (await trySceneAttack(bundle.campaign.id, input)))
    return;
  if (input.trim()) {
    await appendCampaignEvent({
      campaign_id: bundle.campaign.id,
      type: "player_input",
      summary: input,
      data: {} as Json,
    });
  }
  const oracle = turn.fixedResult
    ? undefined
    : (turn.oracle ?? (await consultOracles(bundle, input, turn)));
  const asked: TurnOptions = {
    ...turn,
    ...(oracle ? { oracle } : {}),
    recognition: turn.recognition ?? recognitionRoll(bundle.climb.reputation.level),
    ...(input.trim() && !turn.said ? { said: input.trim() } : {}),
  };
  const context = buildContext(bundle, asked);
  const opening = turn.options
    ? "(the player is asking what they could do here)"
    : "(open the moment)";
  const answered = await lifeTurnFn({
    data: { userPrompt: renderLifeUserPrompt(context, input || opening) },
  });
  // A continuation finishes what the player asked; it does not go anywhere
  // else. Dropped here, before anything is applied, so a second trip can
  // neither be taken nor charged for.
  const response = turn.continuation
    ? {
        ...answered,
        proposedActions: answered.proposedActions.filter(
          (a) => a.kind !== "travel" && a.kind !== "hook_offer",
        ),
      }
    : answered;
  const outcome = await applyResponse(bundle, response, asked);

  // Somebody came over, because the engine said so before the turn ran. It is
  // written down so it happens once an evening, not once a turn.
  const over = context.place?.whoIsHere;
  if (over?.comingOver) {
    await appendCampaignEvent({
      campaign_id: bundle.campaign.id,
      type: "cast_approached",
      summary: `${over.name} came over to them.`,
      data: { npcKey: over.key, day: bundle.clock.day } as unknown as Json,
    });
  }

  // The model wrote its prose before the engine had decided anything, so a trip
  // it described is its own guess at where the player ended up. Now that the
  // move is committed, tell it what actually happened and let it write the
  // arrival. Without this the narration can walk you east while the pin, the
  // header and the ledger all say you went west.
  const correction = describeTravelOutcome(outcome);
  if (correction && !turn.fixedResult && !turn.continuation) {
    if (outcome.travelled && asked.said) {
      // They got there, and there may be more to what they said: "walk to the
      // bar AND sit down at the counter". The arrival is narrated as a turn of
      // its own that can finish the job — spend at the engine's price, reach
      // for kit, call for dice — rather than as prose that stops at the door.
      // Reloaded, not patched: the trip moved the clock and may have cost
      // money, and this turn writes both from what the bundle says.
      const fresh = await loadLife(bundle.campaign.id);
      await liveTurn({ ...fresh, current: bundle.current, inScene: true }, "", {
        resolved: correction,
        said: asked.said,
        continuation: true,
        // Nothing is re-rolled for the second half of one evening's errand.
        oracle: {},
      });
      return;
    }
    const fresh = { ...bundle, events: await listCampaignEvents(bundle.campaign.id) };
    await liveTurn(fresh, "", {
      minutes: 0,
      resolved: correction,
      fixedResult: true,
      ...(outcome.travelChoices?.length ? { cards: outcome.travelChoices } : {}),
    });
    return;
  }

  // Acting on a situation about a person IS dealing with them. Only a turn the
  // player actually typed counts: opening the moment, or asking what the
  // options are, is not the same as picking up the phone.
  const npcKey = bundle.current?.npcKey;
  if (npcKey && input.trim() && !turn.options) {
    const seen = bundle.npcs.find((n) => n.npc_id === npcKey);
    // The row as written: the arc write below replaces `data` whole, and
    // building it from the row read before would drop `lastSeenDay`.
    const npc = seen ? await markDealtWith(bundle.campaign.id, seen, bundle.clock.day) : undefined;
    // A move the world made is answered by dealing with the person who made it.
    // Unlike the derived `person_` situations, a move is written rather than
    // re-derived, so nothing else would ever take it off the board.
    await settleMoves(bundle.campaign.id, npcKey);
    // And a beat of their own story is answered by getting involved in it,
    // which is what turns the ending the warm way and tells the player what
    // was really going on.
    if (npc && bundle.current?.key === arcSituationKey(npcKey)) {
      await noteArcInvolvement(bundle.campaign.id, npc);
    }
  }

  // Only worth a reload when the narrator actually marked something small.
  if (response.proposedActions.some((a) => a.kind === "skill_check" && a.stakes === "low")) {
    await rollWhatIsSmall(bundle, turn);
  }
}

/**
 * Roll the check this turn just posted, if it is small enough not to need the
 * player.
 *
 * The narrator marks a check low-stakes; the engine decides (`mayRollItself`).
 * When both agree, the check is rolled here with no Luck and settled exactly as
 * if the player had pressed the button — same roll, same ledger row, same
 * follow-up — so the only thing the player loses is the wait. The row is
 * marked as automatic and the log shows it.
 *
 * Only a check posted by THIS turn, and only when it posted exactly one: an
 * older prompt the player has not rolled yet was put in front of them and is
 * theirs to press, and rolling one of two would reorder what they were asked.
 */
async function rollWhatIsSmall(before: LifeBundle, turn: TurnOptions): Promise<void> {
  if (turn.options || turn.fixedResult || turn.autoRolled) return;
  const posted = new Set(before.events.map((e) => e.id));
  const fresh = await loadLife(before.campaign.id);
  const pending = pendingChecksFrom(
    fresh.events,
    fresh.character,
    fresh.vitals.wound_state as WoundStateCode,
    {
      vitals: fresh.vitals,
      inventory: fresh.inventory,
      districtKey:
        resolvePosition(fresh.campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
      reputation: fresh.climb.reputation.level,
    },
  );
  // Exactly one new check: rolling one of two would reorder what was asked.
  const newChecks = pending.filter((p) => !posted.has(p.eventId));
  if (newChecks.length !== 1) return;
  const check = newChecks[0]!;
  const prompt = fresh.events.find((e) => e.id === check.eventId);
  // A negotiation's check settles the terms of a job; that is never small.
  if (askTagFrom(prompt)) return;
  const marked = (prompt?.data as { stakes?: unknown } | null)?.stakes === "low";
  if (
    !mayRollItself({
      lowStakes: marked,
      dv: check.dv,
      opposed: check.opposition !== null,
      inCombat: false,
    })
  ) {
    return;
  }
  const roll = rollPendingCheck({
    campaign: fresh.campaign,
    character: fresh.character,
    vitals: fresh.vitals,
    inventory: fresh.inventory,
    pending: check,
  });
  await commitLifeCheck(fresh, check, roll, { auto: true });
}

/**
 * Looking for something, and what the engine says is there.
 *
 * The whole point of `truth.ts`. A check that searches a place no longer asks
 * the narrator what is here — inventing is cheaper than refusing, so the answer
 * to a good roll was always a hidden safe that had not existed a moment before,
 * and a discovery that could have been anything was not a discovery. The engine
 * decides which of the facts ALREADY TRUE here the number reaches, records it,
 * and hands the model the one line it is allowed to narrate.
 *
 * Three outcomes and the third is the interesting one. Finding nothing is a
 * real answer rather than a wasted turn: satisfying yourself a room is clean is
 * information in a game about investigation, and it is the honest thing to say
 * when the alternative is inventing something so the roll was not wasted.
 *
 * Returns null when this is not a search at all, and when `campaign_truths` has
 * not been migrated yet — in which case searching narrates exactly the way it
 * always has, rather than silently finding nothing forever.
 */
async function applySearch(
  bundle: LifeBundle,
  pending: PendingCheck,
  roll: CheckRoll,
): Promise<string | null> {
  if (!bundle.truthsAvailable || roll.kind !== "dv") return null;
  // Only a Skill that finds things gets a search outcome. Without this a
  // successful Athletics roll came back with "you satisfy yourself there is
  // nothing here" — the character was climbing a fence.
  //
  // Skill rather than stated intent, which is the honest limit of this slice: a
  // Perception check rolled to spot a tail, in a room that happens to hold
  // something, reads as having missed the thing in the room. Tying an outcome
  // to a parsed intent is the model's judgement, and this module exists
  // precisely to stop the model deciding what is here.
  if (!isSearchSkill(pending.skillId)) return null;
  const at = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
  if (!at?.placeKey) return null;

  // A conclusion about a place is drawn from the facts about that place, so
  // unlike on a job — where the subject is the whole case — the pool is the
  // same either way. What differs is that a conclusion is gated by its
  // prerequisites rather than by the die, and that failing to make a
  // connection is not failing to find an object.
  const deducing = pending.skillId === DEDUCTION_SKILL;
  const truths = truthsAt(at.placeKey, bundle.places[at.placeKey]);
  const search = searchWith({
    truths,
    skillId: pending.skillId,
    discovered: bundle.discoveredTruths,
    total: roll.result.total,
  });

  if (search.outcome === "nothing") {
    // Only worth saying when the roll actually landed. A failed search that
    // found nothing tells the character nothing at all — and a conclusion that
    // is not available stays silent either way, because "there was nothing to
    // work out" may only mean the pieces have not been found yet.
    if (!roll.result.success || deducing) return null;
    return (
      "They searched properly and there is NOTHING here to find. Say so plainly: " +
      "the place is what it appears to be. Do not invent something small so the " +
      "roll was not wasted — knowing a room is clean is worth knowing."
    );
  }
  if (search.outcome === "missed") {
    return deducing
      ? "They turned it over and it did NOT come together. There is something to be worked out " +
          "about this place and this was not the moment — narrate the thinking and the " +
          "not-quite, and do not hint at what it was."
      : "They did not find it. There IS something here and the search did not reach " +
          "it — narrate the looking and the coming up empty, and do not hint at what " +
          "was missed or how close they came.";
  }

  const stored = await recordTruthDiscovery(bundle.campaign.id, {
    truthKey: search.truth.key,
    discoveredDay: bundle.clock.day,
    viaSkill: pending.skillId,
  });
  if (!stored) return null;
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: "truth_found",
    summary: search.truth.fact,
    data: { truthKey: search.truth.key, placeKey: at.placeKey } as unknown as Json,
  });
  return deducing
    ? `They WORKED IT OUT, and this is the conclusion, exactly: ${search.truth.fact} ` +
        "Narrate the character reaching that, off what they already knew about this place. Do " +
        "not add a second conclusion beside it, and do not carry it further than it goes."
    : `They FOUND something, and this is it, exactly: ${search.truth.fact} ` +
        "That is the discovery — narrate them noticing it. Do not add a second find " +
        "beside it and do not enlarge on what it means.";
}

/** Roll a Life check the player pressed, then let the world answer it. */
export async function commitLifeCheck(
  bundle: LifeBundle,
  pending: PendingCheck,
  roll: CheckRoll,
  /** `auto` when the engine rolled it without the player (see rollWhatIsSmall). */
  opts: { auto?: boolean } = {},
): Promise<void> {
  const campaignId = bundle.campaign.id;

  // A check posted by a negotiation settles the TERMS, not just the fiction:
  // the engine decides what the push bought and the model is only told the
  // outcome afterwards.
  const tag = askTagFrom(bundle.events.find((e) => e.id === pending.eventId));
  if (tag && bundle.hook && bundle.hook.situationKey === tag.situationKey) {
    await settleNegotiation(bundle, bundle.hook, tag.ask, pending, roll);
    return;
  }

  if (roll.kind === "opposed") {
    await logOpposedCheck(campaignId, roll.result, {
      skillId: pending.skillId,
      skillName: pending.skillName,
      intent: pending.intent,
      promptEventId: pending.eventId,
      luckSpent: roll.luckSpent,
      ...(pending.opposition?.npcKey ? { npcKey: pending.opposition.npcKey } : {}),
    });
    const verdict = roll.result.success
      ? `SUCCESS by ${Math.abs(roll.result.margin)}`
      : roll.result.tie
        ? "FAILURE — tied, and a tie goes to the one resisting"
        : `FAILURE by ${Math.abs(roll.result.margin)}`;
    const read = pending.opposition?.npcKey
      ? await applyInsight({
          campaignId,
          npcKey: pending.opposition.npcKey,
          skillId: pending.skillId,
          success: roll.result.success,
          margin: roll.result.margin,
          today: bundle.clock.day,
        })
      : null;
    const fresh = { ...bundle, events: await listCampaignEvents(campaignId) };
    await liveTurn(fresh, "", {
      minutes: 0,
      ...saidBefore(bundle.events, pending.eventId),
      resolved:
        `The ${pending.skillName} check against ${pending.opposition?.npcName ?? "them"} is RESOLVED: ${verdict}, for the intent "${pending.intent}".` +
        facedownOutcomeLine(pending, roll.result.success) +
        insightLine(read),
    });
    return;
  }

  await logSkillCheck(campaignId, roll.result, {
    skillId: pending.skillId,
    skillName: pending.skillName,
    intent: pending.intent,
    promptEventId: pending.eventId,
    luckSpent: roll.luckSpent,
    ...(opts.auto ? { auto: true } : {}),
  });
  const dv = pending.dv ?? 0;
  // What the engine says was there to find, before the narrator is asked to
  // describe the looking.
  const found = await applySearch(bundle, pending, roll);
  // And what a check aimed at a PERSON read about them. Not only the opposed
  // ones: a Social check settled against a DV is the same exchange, and while
  // this only ran on the opposed branch the shape table reached almost nothing
  // — Human Perception's whole point is that watching somebody needs no
  // contest, and a contest was the only way in.
  const read = pending.target
    ? await applyInsight({
        campaignId,
        npcKey: pending.target.npcKey,
        skillId: pending.skillId,
        // A roll made against no DV has no verdict, and no verdict is not a
        // win — the same reading the negotiation path takes.
        success: roll.result.success === true,
        margin: roll.result.total - dv,
        today: bundle.clock.day,
      })
    : null;
  const fresh = { ...bundle, events: await listCampaignEvents(campaignId) };
  await liveTurn(fresh, "", {
    minutes: 0,
    ...saidBefore(bundle.events, pending.eventId),
    ...(opts.auto ? { autoRolled: true } : {}),
    resolved: checkResolvedLine({
      skillName: pending.skillName,
      formula: roll.result.formula,
      success: roll.result.success === true,
      margin: roll.result.total - dv,
      intent: pending.intent,
      extra: (found ? ` ${found}` : "") + insightLine(read),
    }),
  });
}

/**
 * What a push bought. The engine decides: the fee moves or it does not, the name
 * is given up or it is not, and the model is handed the result to describe after
 * the fact, exactly as it is for any other roll.
 */
async function settleNegotiation(
  bundle: LifeBundle,
  hook: LifeHook,
  ask: HookAsk,
  pending: PendingCheck,
  roll: CheckRoll,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const spec = hookAskSpec(ask);

  let success: boolean;
  let margin: number;
  if (roll.kind === "opposed") {
    await logOpposedCheck(campaignId, roll.result, {
      skillId: pending.skillId,
      skillName: pending.skillName,
      intent: pending.intent,
      promptEventId: pending.eventId,
      luckSpent: roll.luckSpent,
      npcKey: hook.offer.brokerKey,
    });
    success = roll.result.success;
    margin = roll.result.margin;
  } else {
    await logSkillCheck(campaignId, roll.result, {
      skillId: pending.skillId,
      skillName: pending.skillName,
      intent: pending.intent,
      promptEventId: pending.eventId,
      luckSpent: roll.luckSpent,
    });
    // A roll made against no DV has no verdict, and no verdict is not a win.
    success = roll.result.success === true;
    margin = roll.result.total - (pending.dv ?? 0);
  }

  const outcome = settleHookAsk(hook.terms, hook.offer, ask, { success, margin });
  // Only a push made AGAINST the broker reads the broker. Asking around the
  // street is a check about the job, with the fixer nowhere in the room.
  const read = spec.opposedBy
    ? await applyInsight({
        campaignId,
        npcKey: hook.offer.brokerKey,
        skillId: pending.skillId,
        success,
        margin,
        today: bundle.clock.day,
      })
    : null;

  await upsertSituations(campaignId, [
    hookUpsert(hook.situationKey, hook.mission, hook.offer, outcome.terms),
  ]);

  if (outcome.dispositionDelta !== 0) {
    // Read the row rather than the bundle: a broker met for the first time was
    // written when the check was posted, after this bundle was loaded.
    const npc = await findCampaignNpc(campaignId, hook.offer.brokerKey);
    if (npc) {
      await setNpcDisposition(npc.id, clampDisposition(npc.disposition + outcome.dispositionDelta));
    }
  }

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "hook_negotiated",
    summary: outcome.summary,
    data: {
      ask,
      success,
      payout: outcome.terms.payout,
      situationKey: hook.situationKey,
    } as unknown as Json,
  });

  const resolved = [
    `The player pushed on the offer (${spec.label.toLowerCase()}) and the ${pending.skillName} check is RESOLVED: ${success ? "SUCCESS" : "FAILURE"}.`,
    `The engine has already applied it: ${outcome.summary}`,
    outcome.revealed ? `They now know this, and did not before: ${outcome.revealed}` : "",
    read?.kind === "learned"
      ? `Leaning on them that hard also showed something: ${read.text} Play it as a tell.`
      : (read?.text ?? ""),
    `Narrate the exchange in ${hook.offer.brokerName}'s voice. Do not change the fee, do not add terms, and do not offer anything the engine did not.`,
  ]
    .filter(Boolean)
    .join(" ");

  const fresh: LifeBundle = {
    ...bundle,
    events: await listCampaignEvents(campaignId),
    hook: { ...hook, terms: outcome.terms },
  };
  await liveTurn(fresh, "", { minutes: spec.minutes, resolved });
}
