/**
 * The offer on the table: accepting it (the only door into a Job), declining
 * it and pushing on its terms. What a push bought is settled with the other
 * checks, in lifeTurnOps.ts. Split out of lifeOps.ts, which re-exports these.
 * No React and no TanStack Query in here.
 */

import {
  canAsk,
  getSkill,
  hookAskSpec,
  luckPoolMax,
  nextPhase,
  resolveSkillId,
  startMission,
  BROKER_DEFAULT_SKILL_LEVEL,
  BROKER_DEFAULT_STAT,
  TIME_COSTS,
  type HookAsk,
  type Opposition,
  canTravel,
} from "@/engine";
import {
  appendCampaignEvent,
  findCampaignNpc,
  listCampaignEvents,
  setCampaignPhase,
  setCampaignFlag,
  setSituationStatus,
  updateCampaign,
  updateCampaignVitals,
  type Json,
} from "@/lib/backend";
import { saveMissionRuntime } from "@/features/campaign/missionState";
import { statsRecord } from "@/features/play/playModel";
import { JOB_PAYOUT_FLAG } from "./hookOffer";
import {
  oppositionProfileOf,
  reconcileOpposition,
  rememberOpposition,
} from "@/features/campaign/npcOpposition";
import { rememberDeclined } from "@/features/campaign/worldTick";
import { rollComplicationFor } from "@/features/campaign/oracles";
import { addToTally } from "@/features/campaign/tally";
import type { LifeBundle } from "./lifeBundleOps";
import { liveTurn } from "./lifeTurnOps";

/**
 * The ONLY door into a job. Pressed by the player, never by a turn: the hook is
 * marked taken, a mission is started, and the phase moves to `job`, at which
 * point the existing play machinery owns the screen.
 */
export async function acceptHook(bundle: LifeBundle): Promise<void> {
  const hook = bundle.hook;
  if (!hook) throw new Error("There is no offer on the table.");
  const campaignId = bundle.campaign.id;
  const to = nextPhase(bundle.phase, "accept_hook");
  if (!to) throw new Error("This campaign is not holding an offer right now.");

  // THE job, not A job: the mission that was pitched, generated before the offer
  // was ever made and carried on the hook ever since.
  const { missionId, mission } = hook;
  await saveMissionRuntime(campaignId, startMission(mission));
  // Taking the work puts the character where the work is: the offer names a
  // canonical atlas district, so the job starts on the real map.
  const jobDistrict = hook.offer.districtKey;
  const moveTo = jobDistrict && canTravel(jobDistrict) ? jobDistrict : null;
  const knownNow = new Set<string>(
    Array.isArray(bundle.campaign.known_places)
      ? (bundle.campaign.known_places as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
  );
  if (moveTo) knownNow.add(moveTo);
  await updateCampaign(campaignId, {
    current_mission_id: missionId,
    ip_awarded: null,
    status: "active",
    ...(moveTo ? { location_key: moveTo, known_places: [...knownNow] } : {}),
  });
  // A fee that was argued upwards is carried on the campaign, so the job pays
  // what was agreed rather than what was printed.
  await setCampaignFlag(campaignId, JOB_PAYOUT_FLAG, hook.terms.payout as unknown as Json);
  // What the brief left out, rolled the moment they take the work and kept from
  // everyone until the job is over. Neither the player nor the model knows
  // whether this job has a lie in it, which is the only way "the employer lied"
  // can land as a discovery rather than as a twist somebody chose to write.
  await rollComplicationFor(campaignId, missionId);
  // A job is a session: the Luck Pool refills on the same boundary IP is awarded on.
  await updateCampaignVitals(campaignId, {
    luck_current: luckPoolMax(statsRecord(bundle.character)),
  });
  await setSituationStatus(campaignId, hook.situationKey, "resolved");
  const negotiated =
    hook.terms.payout !== hook.terms.basePayout
      ? ` at ${hook.terms.payout}eb, up from ${hook.terms.basePayout}eb`
      : ` at ${hook.terms.payout}eb`;
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "mission_started",
    summary: `Took the job: ${mission.title} — ${hook.offer.brokerName}${negotiated}`,
    // The broker rides on the event, so settlement can find the person who owes
    // the money without having to reconstruct who offered the job.
    data: {
      missionId,
      payout: hook.terms.payout,
      brokerKey: hook.offer.brokerKey,
      brokerName: hook.offer.brokerName,
    } as unknown as Json,
  });
  // Counted rather than re-derived: the record has to remember fifty sessions
  // and a turn only reads the last 200 rows.
  await addToTally(campaignId, { jobsTaken: 1 });
  await setCampaignPhase(campaignId, to);
}

/** Turn the offer down (or let it go cold). The campaign goes back to living. */
export async function declineHook(bundle: LifeBundle, reason: string): Promise<void> {
  if (!bundle.hook) return;
  const campaignId = bundle.campaign.id;
  const title = bundle.hook.mission.title;
  const broker = bundle.hook.offer.brokerName;
  await setSituationStatus(campaignId, bundle.hook.situationKey, "expired");
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "hook_declined",
    summary: `Passed on ${title}.`,
    // The title and the day ride along so the world tick can have somebody else
    // take the job later. A gig you passed on that nobody ever does was never a
    // choice, just a reroll.
    data: {
      reason,
      title,
      missionId: bundle.hook.missionId,
      day: bundle.clock.day,
    } as unknown as Json,
  });
  // Written down rather than left to be re-derived: the world tick used to scan
  // the whole campaign for declines on every day that passed.
  await rememberDeclined(campaignId, { title, day: bundle.clock.day });
  await addToTally(campaignId, { jobsDeclined: 1 });
  const to = nextPhase(bundle.phase, "decline_hook");
  if (to) await setCampaignPhase(campaignId, to);
  const fresh = { ...bundle, events: await listCampaignEvents(campaignId), hook: null };
  await liveTurn(fresh, `I turn the work down. ${reason}`.trim(), {
    minutes: TIME_COSTS.conversation,
    resolved: `The player DECLINED the offer "${title}". Let ${broker} react in character and move on. That job is gone; do not offer it again.`,
  });
}

/**
 * Push on the terms of an offer.
 *
 * Posts the check and stops, exactly like every other proposed check: the player
 * rolls it themselves on the same card, and settleNegotiation below decides what
 * it bought. The model is not in this path at all until there is a result to
 * describe.
 */
export async function pushHook(bundle: LifeBundle, ask: HookAsk): Promise<void> {
  const hook = bundle.hook;
  if (!hook) throw new Error("There is no offer on the table.");
  if (!canAsk(hook.terms, ask)) throw new Error("You have already pushed on that.");

  const campaignId = bundle.campaign.id;
  const spec = hookAskSpec(ask);
  const skillId = resolveSkillId(spec.skillId);
  if (!skillId) throw new Error(`No printed Skill named "${spec.skillId}".`);
  const skillName = getSkill(skillId).name;
  const negotiation = { ask, situationKey: hook.situationKey };

  if (!spec.opposedBy) {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "check_prompt",
      summary: `${skillName} check — DV ${spec.dv}`,
      data: { skillId, skillName, dv: spec.dv, intent: spec.blurb, negotiation } as unknown as Json,
    });
    return;
  }

  const opposingSkillId = resolveSkillId(spec.opposedBy);
  if (!opposingSkillId) throw new Error(`No printed Skill named "${spec.opposedBy}".`);

  // The broker's own numbers. A fixer the campaign has already seen resist
  // something keeps the numbers they resisted with; a new one is written down
  // now, so pushing them twice is pushing the same person twice.
  const npc = await findCampaignNpc(campaignId, hook.offer.brokerKey);
  const proposed: Opposition = {
    name: hook.offer.brokerName,
    skillId: opposingSkillId,
    skillLevel: BROKER_DEFAULT_SKILL_LEVEL,
    statValue: BROKER_DEFAULT_STAT,
  };
  const { opposition, remembered } = reconcileOpposition(proposed, oppositionProfileOf(npc));
  await rememberOpposition({
    campaignId,
    npcKey: hook.offer.brokerKey,
    npcName: hook.offer.brokerName,
    npc,
    opposition,
  });

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "check_prompt",
    summary: `${skillName} check — opposed by ${hook.offer.brokerName}`,
    data: {
      skillId,
      skillName,
      intent: spec.blurb,
      negotiation,
      opposition: {
        npcKey: hook.offer.brokerKey,
        npcName: hook.offer.brokerName,
        skillId: opposition.skillId,
        skillLevel: opposition.skillLevel,
        statValue: opposition.statValue,
        remembered,
      },
    } as unknown as Json,
  });
}
