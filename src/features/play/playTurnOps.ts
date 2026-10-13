/**
 * One Job turn and the checks it settles: `narrate` (ask the GM, then apply
 * what it proposed through the engine), the engine rolling what is small, and
 * `commitCheck`/`resolveCheck`/`commitOpposedCheck`. These call one another
 * in a loop (a turn may roll a check, and a settled check narrates another
 * turn), so they share a module rather than importing each other in a circle.
 * Split out of playOps.ts, which re-exports them. No React and no TanStack
 * Query in here.
 */

import { loadCurrentScene, trySceneAttack } from "@/features/scenes/sceneOps";
import { finishCombatAction, owesASave, snapshotFor } from "./combatOps";
import { payLuck } from "./rollCosts";
import { dossierForPrompt } from "@/features/atlas/placeDossiers";
import { checkResolvedInput, critNote } from "@/features/gm/checkResult";
import { sinceWords } from "@/features/life/lifeContextOps";
import { carryOnLine, saidBefore } from "@/features/narration/narratorRules";
import { PACKET_BUDGET, withinBudget } from "@/features/narration/packetBudget";
import { rollPendingCheck } from "./rollCheck";
import {
  composeAdventureScene,
  DEFAULT_START,
  FACEDOWN_CHECK_ID,
  TIME_COSTS,
  advance,
  advanceClock,
  areaOf,
  arenaForPlace,
  currentCombatant,
  deductionOffer,
  describePosition,
  directionName,
  findMission,
  getBeat,
  getDistrict,
  getPlace,
  getSkill,
  isCombatZone,
  judgeAction,
  knownTruths,
  mayRollItself,
  neighboursOf,
  placeFamiliarity,
  recognitionRoll,
  resolvePosition,
  resolveSkillId,
  truthsInMission,
  turnProvenanceDataIfAny,
  type LegalityVerdict,
  type MissionRuntime,
  type OpposedCheckResult,
  type Opposition,
  type WoundStateCode,
  type Observation,
} from "@/engine";
import { resolveWalkOns } from "@/features/cast/walkOnMention";
import { alsoHereAt } from "@/features/life/alsoHere";
import { chronicleFor } from "@/features/campaign/chronicleModel";
import { saveLiveEncounter } from "@/features/campaign/encounterState";
import { applyItemUse, gadgetTurn, planItemUse } from "@/features/campaign/itemUse";
import { logBeatAdvanced } from "@/features/campaign/missionLog";
import { saveMissionRuntime } from "@/features/campaign/missionState";
import {
  oppositionProfileOf,
  reconcileFacedown,
  reconcileOpposition,
  rememberOpposition,
} from "@/features/campaign/npcOpposition";
import { pendingAnswer, askOracle } from "@/features/campaign/oracles";
import {
  applyPressure,
  pressureLines,
  readObservations,
  firedClockDue,
} from "@/features/campaign/pressure";
import { recognitionRecord, reputationProp } from "@/features/campaign/recognition";
import { logOpposedCheck, logSkillCheck } from "@/features/campaign/skillCheckLog";
import { applyInsight, insightLine } from "@/features/campaign/socialInsight";
import { buildGmContext, renderGmUserPrompt } from "@/features/gm/gmContext";
import { gmTurnFn } from "@/features/gm/gmTurn.server";
import {
  appendCampaignEvent,
  listCampaignEvents,
  setCampaignClock,
  setCampaignFlag,
  setInventoryQuantity,
  setNpcDisposition,
  type Json,
} from "@/lib/backend";
import { distanceToTarget, findTarget } from "./attackPrompt";
import { renderCapabilityLines } from "./capabilityModel";
import {
  dvBandName,
  facedownOutcomeLine,
  facedownPrompt,
  pendingChecksFrom,
  snapToPublishedDv,
  type CheckRoll,
  type PendingCheck,
} from "./checkPrompt";
import { movePlayer } from "./combatFlow";
import { beginAdventureEncounter } from "@/features/scenes/adventureEncounter";
import { spendTurn } from "./encounterModel";
import {
  characterSummary,
  findNpcByKey,
  localExpertIn,
  npcDispositionAfter,
  npcSummaries,
  recentEventLines,
} from "./playModel";
import { combatRoleEffects } from "./roleAbilityModel";
import { type PlayBundle, loadPlay, needsOpeningScene } from "./playBundleOps";
import { revealBeatTruths, applyJobSearch } from "./playTruthOps";
import { settleMission } from "./playSettleOps";

/**
 * How many checks one turn may put on the table at once. Two lets a compound
 * intent ("pick the lock while she watches the hall") be the two rolls it would
 * be at a table; more than that stops being a turn and starts being a queue.
 */
export const MAX_CHECKS_PER_TURN = 2;

/**
 * The rest of what the player said, for a result turn — empty when they said
 * nothing else, or during a fight, where a Turn is one action and the next is
 * theirs to choose.
 */
function carryOn(bundle: PlayBundle, promptEventId: string | undefined): string {
  if (bundle.encounter?.state.status === "active") return "";
  const { said } = saidBefore(bundle.events, promptEventId);
  return said ? ` ${carryOnLine(said)}` : "";
}

export async function narrate(
  bundle: PlayBundle,
  input: string,
  options: {
    logInput?: boolean;
    optionsRequested?: boolean;
    fixedResult?: boolean;
    /** This turn narrates a check the engine rolled itself; see rollWhatIsSmall. */
    autoRolled?: boolean;
  } = {},
): Promise<void> {
  if (
    !bundle.encounter &&
    !options.fixedResult &&
    !options.optionsRequested &&
    options.logInput !== false &&
    (await trySceneAttack(bundle.campaign.id, input))
  )
    return;
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const beatFields = beatId ? { beat_id: beatId } : {};
  // Whether a stranger met this turn has heard of them: rolled once, before the
  // packet, and kept beside the narration it informed.
  const recognition = recognitionRoll(bundle.reputation.level);

  if (options.logInput !== false) {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "player_input",
      summary: input,
      data: {} as Json,
      ...beatFields,
    });
  }

  if (!bundle.mission || !bundle.runtime || !bundle.beat) {
    throw new Error("There is no active mission to play right now.");
  }

  // What the character can actually do right now. The GM sees it so it stops
  // proposing the impossible; the gate below still refuses anything that slips
  // through, because a model is not an enforcement layer.
  let capability = snapshotFor(bundle);
  // The kit as it stands part-way through this turn. Using something up
  // changes what the rest of the turn may do with it, and `bundle` is the
  // caller's object — so the change lives here and the snapshot is rebuilt
  // from it rather than the parameter being reassigned under the narrowing
  // that proves the mission, runtime and beat exist.
  let kit = bundle.inventory;

  /**
   * Refuse an impossible action in the fiction rather than silently dropping
   * it: the reason goes on the ledger, so the player is told why and the GM's
   * next turn narrates it instead of proposing it again.
   */
  const refuse = async (verdict: Extract<LegalityVerdict, { ok: false }>): Promise<void> => {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "action_refused",
      summary: `Not possible: ${verdict.reason}`,
      data: { code: verdict.code } as unknown as Json,
      ...beatFields,
    });
  };

  // Pressure that has come due arrives NOW, in this scene. Held back while a
  // fight is already running: a second threat walking in mid-firefight is not
  // tension, it is two encounters wearing one coat, and the engine has no way
  // to fold the newcomers into an initiative order that is already turning.
  const fightRunning = bundle.encounter?.state.status === "active";
  //
  // Read now and SPENT only once the narrator has answered (below): spent
  // first, a failed model call took the threat and the answer with it.
  const due =
    fightRunning || options.fixedResult ? null : await firedClockDue(campaignId, { beatId });
  const arrived = due?.arrived ?? null;

  // Whatever the GM asked last turn, answered by dice it never saw. Skipped on
  // an options turn: the player is thinking, and nobody lived through anything.
  const pending =
    options.optionsRequested || options.fixedResult ? null : await pendingAnswer(campaignId);
  const answered = pending?.answer ?? null;

  const jobPosition = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
  const jobDistrict = jobPosition ? getDistrict(jobPosition.districtKey) : undefined;
  const savedScene = await loadCurrentScene(campaignId);
  const sceneIdentity = JSON.stringify([campaignId, bundle.mission.id, beatId]);
  const context = buildGmContext({
    ...(savedScene?.scene.anchor === `adventure-v1:${sceneIdentity}` && savedScene.scene.context
      ? {
          savedScene: {
            facts: savedScene.scene.context.facts,
            status: savedScene.status,
            summary: savedScene.summary,
          },
        }
      : {}),
    // Once this beat has been narrated, the scene was set on that turn, and
    // every turn after it is mid-scene.
    ...(needsOpeningScene(bundle) ? {} : { sceneSet: true }),
    ...(jobDistrict
      ? {
          place: {
            where: describePosition(bundle.campaign.location_key ?? DEFAULT_START),
            district: jobDistrict.name,
            area: areaOf(jobDistrict.key)?.name ?? "Night City",
            security: jobDistrict.security,
            // The same canon the Life screen gets. A job at a named building
            // should describe that building, not a plausible one.
            ...(() => {
              const at = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
              const blurb = at?.placeKey ? getPlace(at.placeKey)?.blurb?.trim() : undefined;
              const written = dossierForPrompt(at?.placeKey, jobDistrict.key);
              // A job at a building the character has cased before should not
              // be introduced to them as though they had never seen it.
              const read = at?.placeKey
                ? placeFamiliarity(
                    at.placeKey,
                    bundle.places[at.placeKey],
                    bundle.campaign.day,
                    // A job on the character's own ground should not brief them
                    // on the streets they grew up on.
                    localExpertIn(bundle.character, at.districtKey),
                  )
                : null;
              return {
                ...(blurb ? { blurb } : {}),
                ...(written ? { dossier: written.text } : {}),
                ...(read
                  ? {
                      familiarity: {
                        visits: read.visits,
                        standing: read.standing,
                        since: sinceWords(read.daysSince),
                        known: read.known,
                        asALocal: read.asALocal,
                        ...(read.localExpert ? { localExpert: read.localExpert } : {}),
                      },
                    }
                  : {}),
              };
            })(),
            // Who the place has standing in it, with the face the player will be
            // shown, so the picture follows the words (see features/cast/ambientPeople.ts).
            ...(() => {
              const here = alsoHereAt(
                campaignId,
                bundle.campaign.location_key ?? DEFAULT_START,
              ).lines;
              return here.length ? { alsoHere: here } : {};
            })(),
            gangs: jobDistrict.gangs,
            combatZone: isCombatZone(jobDistrict.key),
            nearby: withinBudget(jobDistrict.locations, PACKET_BUDGET.nearby).map((l) => l.name),
            neighbours: neighboursOf(bundle.campaign.location_key ?? DEFAULT_START).map(
              (n) => `${n.name} — ${directionName(n.direction)}, ${n.minutes} min`,
            ),
          },
        }
      : {}),
    mission: bundle.mission,
    beat: bundle.beat,
    // Only what they have found. The rest of what the job is holding is not in
    // the prompt at all.
    //
    // Across the whole job rather than this beat: a thing learned in the office
    // is still known in the warehouse, and a conclusion drawn from it has to be
    // narratable in the scene the character is standing in.
    ...(() => {
      // Nothing to say while `campaign_truths` is unmigrated: with no record of
      // what has been found, every truth reads as undiscovered and every
      // conclusion as unreachable.
      const discovered = bundle.truthsAvailable ? bundle.discoveredTruths : [];
      const all = truthsInMission({
        missionId: bundle.mission.id,
        beats: bundle.mission.beats,
      });
      const found = knownTruths(all, discovered).map((truth) => truth.fact);
      // There is something to be worked out and the pieces are in hand. The
      // model is told THAT and the number, never what the conclusion is: the
      // prerequisites were earned, so the offer is a pay-off rather than a hint.
      const offer = deductionOffer(all, discovered);
      return {
        ...(found.length ? { discoveredBeatTruths: found } : {}),
        ...(offer ? { deduction: offer } : {}),
      };
    })(),
    availableExits: bundle.availableExits,
    // Where they are standing goes with the sheet, so the Skill list reports
    // Local Expert for this district rather than for whichever one they know.
    character: {
      ...characterSummary(
        bundle.character,
        bundle.vitals,
        bundle.inventory,
        jobPosition?.districtKey ?? null,
      ),
      ...reputationProp(bundle.reputation, recognition),
    },
    objectives: bundle.runtime.objectives,
    // With the day, so somebody who has closed up plays that way on a job too.
    npcsPresent: npcSummaries(bundle.npcs, bundle.campaign.day),
    recentEvents: recentEventLines(bundle.events),
    capabilities: renderCapabilityLines(capability),
    pressure: pressureLines(bundle.pressure),
    standings: bundle.standings,
    chronicle: chronicleFor({
      day: bundle.campaign.day,
      events: bundle.events,
      standings: bundle.factionStandings,
      pressure: pressureLines(bundle.pressure),
      npcs: bundle.npcs,
      situationKeys: [],
      tally: bundle.tally,
    }),
    ...(arrived ? { arrived: arrived.payoff } : {}),
    ...(bundle.complication ? { complication: bundle.complication.text } : {}),
    ...(answered ? { oracle: { question: answered.question, answer: answered.answer } } : {}),
    ...(options.optionsRequested ? { optionsRequested: true } : {}),
  });

  const gm = await gmTurnFn({ data: { userPrompt: renderGmUserPrompt(context, input) } });
  // The narrator has what arrived and what the dice answered: now they happened.
  await due?.commit();
  await pending?.commit();

  if (
    !options.fixedResult &&
    !bundle.encounter &&
    savedScene?.scene.anchor !== `adventure-v1:${sceneIdentity}`
  ) {
    for (const action of gm.proposedActions)
      if (action.kind === "start_encounter") {
        composeAdventureScene({
          identity: sceneIdentity,
          locationKey: bundle.campaign.location_key ?? DEFAULT_START,
          name: action.name,
          arena: action.arena,
          facts: bundle.beat.scene ?? action.scene,
          enemies: action.enemies,
        });
      }
  }
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "gm_narration",
    summary: gm.narration,
    data: {
      endsWithDecision: gm.endsWithDecision,
      suggestedActions: options.fixedResult ? [] : gm.suggestedActions,
      // Resolved HERE, once, with the campaign+place seed the response schema
      // never sees — never re-picked on a later render, so a walk-on's face
      // stays the same face across scrollback and reload.
      walkOns: (() => {
        const here = alsoHereAt(campaignId, bundle.campaign.location_key ?? DEFAULT_START);
        return resolveWalkOns(gm.walkOns, here.seed, here.subjects, gm.narration);
      })(),
      // Which prompt, at which version, asked which model — and who answered.
      // Built here rather than spelled out, per ledger.ts.
      ...turnProvenanceDataIfAny(gm.provenance),
      ...recognitionRecord(recognition),
    } as unknown as Json,
    ...beatFields,
  });
  if (options.fixedResult) return;

  // Held, not answered: the dice are thrown on the next turn, so the turn that
  // asked was written without knowing.
  if (!options.optionsRequested && !options.fixedResult) await askOracle(campaignId, gm.question);

  // The city keeps its own time during a job, not only between them. Each turn
  // costs a few minutes, so rent, bills and the calendar stay real while the
  // player is working. TIME_COSTS are app pacing, not published rules.
  let clock = advanceClock(
    { day: bundle.campaign.day, minute: bundle.campaign.minute },
    TIME_COSTS.quick,
  );

  // What the city noticed. The model reported; engine/clocks.ts prices it.
  //
  // One player action narrates more than once (the attempt, then the check it
  // proposed, then the result), and a model describing the same body each time
  // would be charged for it each time. An identical report to the one just
  // recorded is treated as the same event restated, not a second one.
  // A find used this turn has its say before anything is priced
  // (engine/gadgets.ts). A Job's turn costs fixed minutes, so a quick find
  // changes nothing here; quiet and remote ones change what the city noticed.
  const finds = gadgetTurn({
    capability,
    proposed: options.optionsRequested ? [] : gm.proposedActions,
    reports: readObservations(gm.observations),
    timed: false,
    report: (observation) => ({ observation: observation as Observation, factionId: null }),
  });
  for (const line of finds.lines) {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "life_action",
      summary: line.summary,
      data: (line.roll ? { roll: line.roll } : {}) as unknown as Json,
      ...beatFields,
    });
  }
  const observed = finds.reports;
  if (observed.length) {
    await applyPressure(campaignId, observed, {
      beatId,
      notAgainAfter: bundle.events,
      districtKey:
        resolvePosition(bundle.campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
    });
  }

  // A proposed check or attack is NOT rolled here: it is posted to the ledger as
  // a prompt and waits for the player's dice (see commitCheck / commitAttack).
  //
  // Up to MAX_CHECKS_PER_TURN checks may be posted, so "pick the lock while she
  // watches the hall" is the two rolls it would be at a table — but only for
  // genuinely distinct skills, and never alongside an attack, which stays
  // strictly one at a time because combat resolves in sequence.
  const postedSkillIds = new Set<string>();
  let attackPosted = false;
  let live = bundle.encounter;

  // Resolving a check narrates again, which can propose more. Budget against the
  // prompts already outstanding so a chain of turns cannot grow the queue without
  // bound — the player should always be able to clear the table.
  const outstanding = pendingChecksFrom(
    bundle.events,
    bundle.character,
    bundle.vitals.wound_state as WoundStateCode,
    {
      vitals: bundle.vitals,
      inventory: bundle.inventory,
      districtKey: jobPosition?.districtKey ?? null,
      reputation: bundle.reputation.level,
    },
  ).length;
  const checkBudget = Math.max(0, (fightRunning ? 1 : MAX_CHECKS_PER_TURN) - outstanding);

  for (const action of gm.proposedActions) {
    if (action.kind === "skill_check") {
      if (attackPosted || postedSkillIds.size >= checkBudget) {
        console.warn(
          `GM proposed a "${action.skillId}" check with no room left this turn ` +
            `(budget ${checkBudget}, ${outstanding} already on the table) — not offered.`,
        );
        continue;
      }
      // The model names skills in prose; the engine only knows printed ids.
      const skillId = resolveSkillId(action.skillId);
      if (!skillId) {
        console.warn(`GM proposed an unknown skill: "${action.skillId}" — no check offered.`);
        continue;
      }
      if (postedSkillIds.has(skillId)) continue; // the same skill twice is one roll
      const legal = judgeAction(capability, {
        kind: "skill_check",
        skillId,
        intent: action.intent,
      });
      if (!legal.ok) {
        await refuse(legal);
        continue;
      }
      const skillName = getSkill(skillId).name;
      const dv = snapToPublishedDv(action.dv);
      const band = dvBandName(dv);
      postedSkillIds.add(skillId);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "check_prompt",
        summary: `${skillName} check — DV ${dv}${band ? ` (${band})` : ""}`,
        data: {
          skillId,
          skillName,
          dv,
          intent: action.intent,
          // Who it is aimed at, when it is aimed at a person. Without this a
          // Social check against a DV named nobody and so could read nobody.
          ...(action.npcKey ? { npcKey: action.npcKey } : {}),
          ...(action.npcName ? { npcName: action.npcName } : {}),
          // The narrator's half of whether this may roll itself.
          ...(action.stakes === "low" ? { stakes: "low" } : {}),
        } as unknown as Json,
        ...beatFields,
      });
    } else if (action.kind === "facedown") {
      // A standoff is a check like any other: it takes a slot in this turn's
      // budget, and only one is ever on the table at once.
      if (attackPosted || postedSkillIds.size >= checkBudget) {
        console.warn("GM proposed a facedown with no room left this turn — not offered.");
        continue;
      }
      if (postedSkillIds.has(FACEDOWN_CHECK_ID)) continue;
      postedSkillIds.add(FACEDOWN_CHECK_ID);
      // Somebody the campaign has measured stares back with their own COOL and
      // Reputation, not with what the model said tonight.
      const known = reconcileFacedown(
        { cool: action.opposingCool, reputation: action.opposingReputation },
        oppositionProfileOf(findNpcByKey(bundle.npcs, action.npcKey, action.npcName)),
      );
      const prompt = facedownPrompt({
        ...action,
        opposingCool: known.cool,
        opposingReputation: known.reputation,
        remembered: known.remembered,
      });
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "check_prompt",
        summary: prompt.summary,
        data: prompt.data as unknown as Json,
        ...beatFields,
      });
    } else if (action.kind === "opposed_check") {
      if (attackPosted || postedSkillIds.size >= checkBudget) {
        console.warn(
          `GM proposed an opposed "${action.skillId}" check with no room left this turn ` +
            `(budget ${checkBudget}, ${outstanding} already on the table) — not offered.`,
        );
        continue;
      }
      const skillId = resolveSkillId(action.skillId);
      const opposingSkillId = resolveSkillId(action.opposingSkillId);
      if (!skillId || !opposingSkillId) {
        console.warn(
          `GM proposed an opposed check naming an unknown skill ` +
            `("${action.skillId}" vs "${action.opposingSkillId}") — no check offered.`,
        );
        continue;
      }
      if (postedSkillIds.has(skillId)) continue; // the same skill twice is one roll
      const legalOpposed = judgeAction(capability, {
        kind: "opposed_check",
        skillId,
        intent: action.intent,
      });
      if (!legalOpposed.ok) {
        await refuse(legalOpposed);
        continue;
      }
      postedSkillIds.add(skillId);

      // The world remembers: an NPC the campaign has already measured opposes
      // with the numbers it measured, not with whatever the model says today.
      const npc = findNpcByKey(bundle.npcs, action.npcKey, action.npcName);
      const { opposition, remembered } = reconcileOpposition(
        {
          name: action.npcName,
          skillId: opposingSkillId,
          skillLevel: action.opposingSkillLevel,
          statValue: action.opposingStatValue,
        },
        oppositionProfileOf(npc),
      );

      const skillName = getSkill(skillId).name;
      const opposingSkill = getSkill(opposingSkillId);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "check_prompt",
        summary: `${skillName} check — opposed by ${action.npcName} (${opposingSkill.name})`,
        data: {
          skillId,
          skillName,
          intent: action.intent,
          opposition: {
            npcKey: action.npcKey,
            npcName: action.npcName,
            skillId: opposingSkillId,
            skillLevel: opposition.skillLevel,
            statValue: opposition.statValue,
            remembered,
          },
        } as unknown as Json,
        ...beatFields,
      });
    } else if (action.kind === "use_item") {
      // The same two-step Life runs: legality decides whether they may, and
      // consumables.ts decides what is left afterwards. A Job could not say
      // this at all before, so a mission narrated the last ampoule going in
      // and left it on the sheet.
      const legalUse = judgeAction(capability, {
        kind: "use_item",
        item: action.item,
        quantity: action.quantity,
      });
      if (!legalUse.ok) {
        await refuse(legalUse);
        continue;
      }
      const use = planItemUse({
        capability,
        inventory: kit,
        item: action.item,
        quantity: action.quantity,
      });
      for (const write of use.writes) await setInventoryQuantity(write.id, write.quantity);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "life_action",
        summary: use.summary,
        data: {
          item: use.itemId,
          quantity: use.consumed ? use.spent : action.quantity,
          intent: action.intent,
          consumed: use.consumed,
          ...(use.consumed ? { remaining: use.remaining } : {}),
        } as unknown as Json,
        ...beatFields,
      });
      // The kit changed under the snapshot the rest of this turn judges
      // against: a second use of the last flare has to be refused, not granted
      // because the check ran against the inventory as it was when we started.
      kit = applyItemUse(kit, use);
      capability = snapshotFor({ ...bundle, inventory: kit });
    } else if (action.kind === "advance_beat") {
      // Only the model's proposed advancement is allowed to be wrong. Everything
      // after it is our own bookkeeping, and a failure there must surface — a
      // catch around the settlement is what hid a job silently failing to close.
      let next: MissionRuntime | null = null;
      try {
        next = advance(bundle.mission, bundle.runtime, action.to);
      } catch {
        next = null; // the model named an exit that is not available; stay put
      }
      if (next) {
        await saveMissionRuntime(campaignId, next);
        await revealBeatTruths(bundle, bundle.mission, action.to);
        await logBeatAdvanced(campaignId, {
          mission: bundle.mission,
          fromBeatId: bundle.beat.id,
          toBeat: getBeat(bundle.mission, action.to),
        });
        // Moving between beats is travel, legwork, waiting — an errand's worth
        // of the evening, not a heartbeat.
        clock = advanceClock(clock, TIME_COSTS.errand);
        if (next.status === "completed") {
          await settleMission({ ...bundle, runtime: next }, next, bundle.mission);
        }
      }
    } else if (action.kind === "start_encounter") {
      if (live) continue; // one fight at a time
      const standingIn = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
      const jobPlace = bundle.campaign.current_mission_id
        ? findMission(bundle.campaign.current_mission_id)?.offer?.placeKey
        : undefined;
      const arenaHere = standingIn?.placeKey
        ? arenaForPlace(standingIn.placeKey)
        : jobPlace
          ? arenaForPlace(jobPlace)
          : undefined;
      // A Solo brings their Combat Awareness division into the fight with them.
      const roleEffects = combatRoleEffects(bundle.campaign, bundle.character);
      const opened = await beginAdventureEncounter({
        campaignId,
        characterId: bundle.campaign.character_id,
        beatId,
        name: action.name,
        locationKey: bundle.campaign.location_key ?? DEFAULT_START,
        missionId: bundle.mission.id,
        sceneFacts: bundle.beat.scene ?? action.scene,
        character: bundle.character,
        vitals: bundle.vitals,
        inventory: kit,
        enemies: action.enemies,
        // Where the fight is decides its geometry. The model may still name an
        // arena — it can see the room and this cannot — but when it does not,
        // the ground answers instead of falling through to open ground: a club
        // interior at a bar, a parking structure under a garage.
        arena: action.arena ?? arenaHere,
        goal: action.goal,
        ...(roleEffects ? { roleEffects } : {}),
      });
      // Anyone who beat the player on Initiative has already acted; what they
      // did is on the encounter_started event, so the GM reads it with the
      // scene rather than having it surface a turn late.
      live = opened.live;
    } else if (action.kind === "attack") {
      if (attackPosted || postedSkillIds.size > 0) continue;
      if (!live || live.state.status !== "active") continue;
      const target = findTarget(live, action.targetId);
      if (!target || target.defeated || target.isPlayer) continue;
      // The range is measured off positions, not taken from the proposal. The
      // model names WHO is being shot at; the engine knows how far away they are.
      const metres = distanceToTarget(live, target.id);
      const legalAttack = judgeAction(capability, {
        kind: "attack",
        targetKey: action.targetId,
        distance: metres,
      });
      if (!legalAttack.ok) {
        await refuse(legalAttack);
        continue;
      }
      attackPosted = true;
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "attack_prompt",
        summary: `Attack ${target.name} at ${metres}m`,
        data: {
          targetId: target.id,
          targetName: target.name,
          distance: metres,
          intent: action.intent,
        } as unknown as Json,
        ...beatFields,
      });
    } else if (action.kind === "move") {
      if (!live || live.state.status !== "active") continue;
      const target = findTarget(live, action.targetId);
      if (!target) continue;
      const moved = await movePlayer({
        campaignId,
        beatId,
        live,
        capability,
        targetId: target.id,
        targetName: target.name,
        towards: action.towards,
        intent: action.intent,
      });
      if (moved.refusal) await refuse(moved.refusal);
      live = moved.live;
      capability = snapshotFor({ ...bundle, inventory: kit, encounter: live });
    }
  }

  // The world remembers. Every one of these was being parsed and thrown away:
  // the GM proposes "the alarm was raised" and "she trusts you less" most turns,
  // and a campaign that forgets them is the reset-button amnesia the brief
  // forbids.
  for (const delta of gm.stateDeltas) {
    if (delta.kind === "note") {
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "gm_note",
        summary: delta.text,
        data: {} as Json,
        ...beatFields,
      });
    } else if (delta.kind === "set_flag") {
      await setCampaignFlag(campaignId, delta.flag);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "flag_set",
        summary: `Night City noted: ${delta.flag.replace(/_/g, " ")}`,
        data: { flag: delta.flag } as unknown as Json,
        ...beatFields,
      });
    } else if (delta.kind === "npc_disposition") {
      // Only somebody the campaign already knows.
      //
      // This used to file a new row for any key the model named, keyed by the
      // key itself — so the narrator could put a person into campaign_npcs
      // with a machine id for a name. That is the model authoring the cast,
      // which PRODUCT.md rules out twice ("prefer the existing cast", and
      // "infinite procedural NPCs" as an anti-goal), and it landed in the one
      // table AGENTS.md flags as having no uniqueness constraint on
      // (campaign_id, npc_id).
      //
      // Life has always worked this way; the two paths disagreeing was the
      // accident. A person the model wants to matter arrives through the cast
      // and the world tick, which is where people come from.
      const npc = findNpcByKey(bundle.npcs, delta.npcKey);
      if (!npc) {
        console.warn(
          `GM moved the disposition of "${delta.npcKey}", who is not in this campaign's cast — ignored.`,
        );
        continue;
      }
      const { disposition } = npcDispositionAfter(npc, delta.delta);
      await setNpcDisposition(npc.id, disposition);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "npc_disposition",
        summary:
          `${npc.name} ${delta.delta >= 0 ? "warms to" : "cools on"} you ` +
          `(${delta.delta >= 0 ? "+" : ""}${delta.delta}).`,
        data: { npcKey: delta.npcKey, delta: delta.delta } as unknown as Json,
        ...beatFields,
      });
    }
  }

  await setCampaignClock(campaignId, clock);
  if (live && live !== bundle.encounter && !attackPosted && postedSkillIds.size === 0) {
    await finishCombatAction(bundle, live, beatId);
  }

  // Only worth a reload when the narrator actually marked something small.
  const markedSmall = gm.proposedActions.some(
    (a) => a.kind === "skill_check" && a.stakes === "low",
  );
  if (markedSmall && !options.optionsRequested && !options.fixedResult && !options.autoRolled) {
    await rollWhatIsSmall(bundle);
  }
}

/**
 * Roll the one check this turn posted, if it is small enough not to need the
 * player — the Job half of the Life rule of the same name.
 *
 * Never in a fight: a roll there is somebody's Turn. Never when the turn posted
 * two checks: rolling one and leaving the other would reorder what the player
 * was asked. Settled through `resolveCheck`, the path the button takes, so the
 * ledger, the Luck (none) and the follow-up narration are the button's.
 */
async function rollWhatIsSmall(before: PlayBundle): Promise<void> {
  const posted = new Set(before.events.map((e) => e.id));
  const fresh = await loadPlay(before.campaign.id);
  if (fresh.encounter?.state.status === "active") return;
  const newChecks = pendingChecksFrom(
    fresh.events,
    fresh.character,
    fresh.vitals.wound_state as WoundStateCode,
    {
      vitals: fresh.vitals,
      inventory: fresh.inventory,
      districtKey:
        resolvePosition(fresh.campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
      reputation: fresh.reputation.level,
    },
  ).filter((p) => !posted.has(p.eventId));
  if (newChecks.length !== 1) return;
  const check = newChecks[0]!;
  const prompt = fresh.events.find((e) => e.id === check.eventId);
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
  await resolveCheck(fresh, check, roll, { auto: true });
}

/**
 * Persist a rolled opposed check: the two rolls to the ledger, the NPC's numbers
 * to their row so the same face opposes the same way next time, and then the
 * result to the GM to narrate exactly as it landed.
 */
async function commitOpposedCheck(
  bundle: PlayBundle,
  pending: PendingCheck,
  result: OpposedCheckResult,
  luckSpent: number,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const opposition = pending.opposition;
  if (!opposition) throw new Error("That check has no opposing side to resolve.");

  await logOpposedCheck(campaignId, result, {
    luckSpent,
    skillId: pending.skillId,
    skillName: pending.skillName,
    intent: pending.intent,
    promptEventId: pending.eventId,
    npcKey: opposition.npcKey,
    ...(pending.beatId ? { beatId: pending.beatId } : {}),
  });
  // Paid after the roll is on the ledger. If this write is the one that fails,
  // the player keeps points they have already had the benefit of — better than
  // charging them for a roll no record was kept of.
  await payLuck(bundle, luckSpent);

  const engineOpposition: Opposition = {
    name: opposition.npcName,
    skillId: opposition.skillId,
    skillLevel: opposition.skillLevel,
    statValue: opposition.statValue,
  };
  await rememberOpposition({
    campaignId,
    npcKey: opposition.npcKey,
    npcName: opposition.npcName,
    npc: findNpcByKey(bundle.npcs, opposition.npcKey, opposition.npcName),
    opposition: engineOpposition,
  });

  const verdict = result.success
    ? `SUCCESS by ${result.margin}`
    : result.tie
      ? "FAILURE on a tie — the totals matched and a tie goes to the one resisting"
      : `FAILURE by ${Math.abs(result.margin)}`;

  // Working somebody mid-job reads them, exactly as it does over breakfast.
  // This only ran in Life until now, which meant the half of the game with the
  // pressure in it — where most Social checks actually get rolled — was the
  // half where leaning on a person told you nothing and cost you nothing.
  const read = await applyInsight({
    campaignId,
    npcKey: opposition.npcKey,
    skillId: pending.skillId,
    success: result.success,
    margin: result.margin,
    today: bundle.campaign.day,
  });

  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the opposed ${pending.skillName} check against ${opposition.npcName} is RESOLVED. ` +
      `Player: ${result.actor.formula} = ${result.actor.total}${critNote(result.actor.critical)}. ` +
      `${opposition.npcName} (${opposition.skillName}): ${result.opponent.formula} = ${result.opponent.total}${critNote(result.opponent.critical)}. ` +
      `Outcome: ${verdict}. Narrate this exact outcome for the intent "${pending.intent}", showing how ${opposition.npcName} met it. ` +
      `Do not re-decide it, do not soften a failure, do not propose the same check again.${facedownOutcomeLine(pending, result.success)}${insightLine(read)}${carryOn(bundle, pending.eventId)} End on a decision.)`,
    { logInput: false, fixedResult: bundle.encounter?.state.status === "active" },
  );
}

/** Checks use the same Action budget as shooting and reloading. */
export async function commitCheck(
  bundle: PlayBundle,
  pending: PendingCheck,
  roll: CheckRoll,
): Promise<void> {
  let live = bundle.encounter;
  if (live?.state.status === "active") {
    if (owesASave(bundle)) throw new Error("Resolve the Death Save first.");
    const legal = judgeAction(snapshotFor(bundle), {
      kind: roll.kind === "opposed" ? "opposed_check" : "skill_check",
      skillId: pending.skillId,
      intent: pending.intent,
    });
    if (!legal.ok) throw new Error(legal.reason);
    const player = currentCombatant(live.state)!;
    const data = live.data[player.id]!;
    live = await saveLiveEncounter({
      ...live,
      data: {
        ...live.data,
        [player.id]: { ...data, turn: spendTurn(data.turn, live.state.round, legal.cost) },
      },
    });
    bundle = { ...bundle, encounter: live };
  }
  await resolveCheck(bundle, pending, roll);
  if (live?.state.status === "active") await finishCombatAction(bundle, live, pending.beatId);
}

/** Persist a rolled check and have the GM narrate the result, win or lose. */
async function resolveCheck(
  bundle: PlayBundle,
  pending: PendingCheck,
  roll: CheckRoll,
  opts: { auto?: boolean } = {},
): Promise<void> {
  const luckSpent = roll.luckSpent;
  if (roll.kind === "opposed") {
    return commitOpposedCheck(bundle, pending, roll.result, luckSpent);
  }
  const result = roll.result;
  const campaignId = bundle.campaign.id;
  if (pending.dv === null) throw new Error("That check has no DV to resolve against.");
  await logSkillCheck(campaignId, result, {
    luckSpent,
    skillId: pending.skillId,
    skillName: pending.skillName,
    intent: pending.intent,
    promptEventId: pending.eventId,
    ...(pending.beatId ? { beatId: pending.beatId } : {}),
    ...(opts.auto ? { auto: true } : {}),
  });
  await payLuck(bundle, luckSpent);

  const fresh: PlayBundle = {
    ...bundle,
    events: await listCampaignEvents(campaignId),
  };
  const found = await applyJobSearch(bundle, pending, result);
  // A check aimed at a PERSON reads them whichever way it was settled. Only the
  // opposed branch did this, which left the social model unreachable on the
  // commoner path — and Human Perception, whose whole point is that watching
  // somebody needs no contest, reachable only through a contest.
  const read = pending.target
    ? await applyInsight({
        campaignId,
        npcKey: pending.target.npcKey,
        skillId: pending.skillId,
        success: result.success === true,
        margin: result.total - pending.dv,
        today: bundle.campaign.day,
      })
    : null;
  await narrate(
    fresh,
    checkResolvedInput({
      skillName: pending.skillName,
      formula: result.formula,
      critical: result.critical,
      success: result.success === true,
      margin: result.total - pending.dv,
      intent: pending.intent,
      extra: `${found ? ` ${found}` : ""}${insightLine(read)}${carryOn(bundle, pending.eventId)}`,
    }),
    {
      logInput: false,
      fixedResult: bundle.encounter?.state.status === "active",
      ...(opts.auto ? { autoRolled: true } : {}),
    },
  );
}
