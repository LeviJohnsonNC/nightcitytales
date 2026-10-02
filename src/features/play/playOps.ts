import {
  commitDeathSave as commitCombatDeathSave,
  finishCombatAction,
  loadCombat,
  owesASave,
  snapshotFor,
} from "./combatOps";
import { payLuck } from "./rollCosts";
// Keep existing callers compatible while Life adopts the shared operations.
export {
  commitAttack,
  commitBoardMove,
  commitCallShot,
  commitReload,
  endPlayerTurn,
  finishCombatAction,
  owesASave,
  snapshotFor,
} from "./combatOps";
/**
 * A play turn, applied.
 *
 * Everything a Job turn DOES: load the bundle, build the model's context, ask
 * it, normalize and validate what comes back, resolve the mechanics in the
 * engine, sequence the writes, and narrate the fixed result.
 *
 * This used to sit above the hook in usePlay.ts, which made the turn logic
 * reachable only through React — the three tests that could get at it needed
 * four vi.mock factories to do so, and a sequencing bug had nowhere to be
 * caught. It is the same move `downtimeOps.ts` already made, for the same
 * reason: operations belong to the game, not to the component that calls them.
 *
 * No React and no TanStack Query in here. usePlay.ts is the thin half that
 * binds these to the query client.
 */
import { dossierForPrompt } from "@/features/atlas/placeDossiers";
import { loadPlaceStates } from "@/features/campaign/placeState";
import { checkResolvedInput, critNote } from "@/features/gm/checkResult";
import { sinceWords } from "@/features/life/lifeOps";
import { carryOnLine, saidBefore } from "@/features/narration/narratorRules";
import { PACKET_BUDGET, withinBudget } from "@/features/narration/packetBudget";
import { rollPendingCheck } from "./rollCheck";
/**
 * The play loop. Loads a campaign's live state, and runs a turn: the player's
 * intent goes to the GM (gmTurnFn), the engine resolves any proposed skill
 * checks, and everything is appended to the campaign ledger. The engine owns the
 * dice and the beat position; this hook just sequences the calls and persists.
 */
import {
  DEDUCTION_SKILL,
  DEFAULT_START,
  FACEDOWN_CHECK_ID,
  LEDGER_EVENTS,
  TIME_COSTS,
  advance,
  advanceClock,
  areaOf,
  arenaForPlace,
  availableExits,
  currentBeat,
  currentCombatant,
  deductionOffer,
  describePosition,
  directionName,
  failMission,
  findFactionIn,
  findMission,
  getBeat,
  getDistrict,
  getFaction,
  getMission,
  getPlace,
  getSkill,
  isCombatZone,
  isSearchSkill,
  judgeAction,
  knownTruths,
  luckPoolMax,
  mayRollItself,
  milestoneEventData,
  missionPayout,
  neighboursOf,
  nextPhase,
  phaseOf,
  placeFamiliarity,
  recognitionRoll,
  reputationFromLedger,
  resolvePosition,
  resolveSkillId,
  searchWith,
  searchesFor,
  truthsAt,
  truthsInBeat,
  truthsInMission,
  truthsRevealedAt,
  turnProvenanceDataIfAny,
  type BackupCall,
  type Beat,
  type BeatExit,
  type BeginTurnResult,
  type BelievabilityResult,
  type CharismaticImpactResult,
  type FactionId,
  type FactionStanding,
  type IpPlaystyle,
  type LegalityVerdict,
  type Mission,
  type MissionRuntime,
  type OpposedCheckResult,
  type Opposition,
  type PlaceState,
  type ReputationStanding,
  type SkillCheckResult,
  type WoundStateCode,
} from "@/engine";
import { resolveWalkOns } from "@/features/cast/walkOnMention";
import { GmSuggestedActionSchema, type GmSuggestedAction } from "@/features/gm/gmResponse";
import { z } from "zod";

import { settleAftermath } from "@/features/campaign/aftermath";
import { chronicleFor } from "@/features/campaign/chronicleModel";
import { climbNews, milestoneWritten } from "@/features/campaign/climbNews";
import { saveLiveEncounter, type LiveEncounter } from "@/features/campaign/encounterState";
import { judgeAndAward, type IpTally } from "@/features/campaign/ipAward";
import { applyItemUse, planItemUse } from "@/features/campaign/itemUse";
import { logBeatAdvanced } from "@/features/campaign/missionLog";
import { loadMissionRuntime, saveMissionRuntime } from "@/features/campaign/missionState";
import {
  oppositionProfileOf,
  reconcileOpposition,
  rememberOpposition,
} from "@/features/campaign/npcOpposition";
import {
  answerPendingQuestion,
  askOracle,
  revealComplication,
  secretComplicationFor,
  type ComplicationMemory,
} from "@/features/campaign/oracles";
import {
  applyPressure,
  notableFrom,
  pressureFrom,
  pressureLines,
  readObservations,
  spendFiredClock,
  standingLines,
  type LivePressure,
} from "@/features/campaign/pressure";
import { publishStory } from "@/features/campaign/publishing";
import { recognitionRecord, reputationProp } from "@/features/campaign/recognition";
import { logOpposedCheck, logSkillCheck } from "@/features/campaign/skillCheckLog";
import { applyInsight, insightLine } from "@/features/campaign/socialInsight";
import { tallyFrom, type CampaignTally } from "@/features/campaign/tally";
import { buildGmContext, renderGmUserPrompt } from "@/features/gm/gmContext";
import { gmTurnFn } from "@/features/gm/gmTurn.server";
import { JOB_PAYOUT_FLAG } from "@/features/life/hookOffer";
import {
  appendCampaignEvent,
  closeAftermath,
  listCampaignEvents,
  listCampaignEventsOfTypes,
  listCampaignTruths,
  listClocks,
  recordTruthDiscovery,
  setCampaignClock,
  setCampaignFlag,
  setCampaignPhase,
  setInventoryQuantity,
  setNpcDisposition,
  updateCampaign,
  type Campaign,
  type CampaignCyberware,
  type CampaignEvent,
  type CampaignFlag,
  type CampaignInventoryItem,
  type CampaignNpc,
  type CampaignVitals,
  type FullCharacter,
  type Json,
} from "@/lib/backend";
import { distanceToTarget, findTarget } from "./attackPrompt";
import { pendingBackupFrom } from "./backupFlow";
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
import { beginEncounter, movePlayer } from "./combatFlow";
import { type PendingDeathSave } from "./deathSavePrompt";
import { spendTurn } from "./encounterModel";
import {
  characterSummary,
  findNpcByKey,
  localExpertIn,
  npcDispositionAfter,
  npcSummaries,
  recentEventLines,
  statsRecord,
} from "./playModel";
import { combatRoleEffects, liveRoleAbility, withAbilityState } from "./roleAbilityModel";

/**
 * How many checks one turn may put on the table at once. Two lets a compound
 * intent ("pick the lock while she watches the hall") be the two rolls it would
 * be at a table; more than that stops being a turn and starts being a queue.
 */
export const MAX_CHECKS_PER_TURN = 2;

export type PlayBundle = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  mission: Mission | null;
  runtime: MissionRuntime | null;
  beat: Beat | null;
  availableExits: BeatExit[];
  events: CampaignEvent[];
  npcs: CampaignNpc[];
  /** The campaign's live kit — what is carried, loaded, and left. */
  inventory: CampaignInventoryItem[];
  cyberware: CampaignCyberware[];
  /** The fight in progress, if the GM has started one. */
  encounter: LiveEncounter | null;
  /** Everything the campaign knows about the ground, keyed by place. */
  places: Record<string, PlaceState>;
  /** Truth keys this campaign has discovered, places and beats alike. */
  discoveredTruths: string[];
  /** The day each of those was discovered on, for evidence that is dated. */
  truthDays: (number | null)[];
  /** False until `campaign_truths` is migrated; the feature is then inert. */
  truthsAvailable: boolean;
  /**
   * Who has heard of the character, from every job the campaign has settled.
   * Read by a Facedown (COOL + Reputation) and by the recognition roll.
   */
  reputation: ReputationStanding;
  /** Every `job_settled` and `milestone` event, whole: what the climb is read from. */
  climbEvents: CampaignEvent[];
  /**
   * The fee agreed when this job was taken, when the player argued it up from
   * the printed reward. Null on a job nobody negotiated.
   */
  agreedPayout: number | null;
  /** Clocks the engine recognises, worst first. */
  pressure: LivePressure[];
  /** Organisations with an opinion, already worded. */
  standings: string[];
  /** The same opinions unworded, for the chronicle to rank and count. */
  factionStandings: FactionStanding[];
  /** Running totals that outlive a turn's ledger window. */
  tally: CampaignTally;
  /**
   * What this job's brief left out, rolled in secret when the player took the
   * work. Present only while it is still a secret; the GM builds the job around
   * it and the player meets it as a discovery.
   */
  complication: ComplicationMemory | null;
};

export async function loadPlay(campaignId: string): Promise<PlayBundle> {
  const full = await loadCombat(campaignId);
  const { character, events, encounter } = full;

  let mission: Mission | null = null;
  let runtime: MissionRuntime | null = null;
  let beat: Beat | null = null;
  let exits: BeatExit[] = [];
  if (full.campaign.current_mission_id) {
    mission = getMission(full.campaign.current_mission_id);
    runtime = await loadMissionRuntime(campaignId, mission);
    beat = currentBeat(mission, runtime);
    exits = availableExits(mission, runtime);
  }

  // What the character has already learned about the ground, so a job at a
  // building they have cased before is not introduced from scratch.
  const places = await loadPlaceStates(campaignId);
  // What this job has given up so far. Undiscovered beat truths never reach the
  // prompt, so the narrator cannot telegraph a twist it has not been told.
  const truths = await listCampaignTruths(campaignId);
  // Every settled job and every milestone, not the recent window: Reputation is
  // the best deed of the whole campaign, and the news of the latest job is
  // measured against all the ones before it.
  const climbEvents = await listCampaignEventsOfTypes(campaignId, [
    LEDGER_EVENTS.jobSettled,
    LEDGER_EVENTS.milestone,
  ]);
  const reputation = reputationFromLedger(climbEvents);
  return {
    reputation,
    climbEvents,
    campaign: full.campaign,
    places,
    discoveredTruths: truths.rows.map((row) => row.truth_key),
    // The DAYS as well as the keys: a Media's evidence is what they have found
    // out since their last story, which needs the dates the truths carry.
    truthDays: truths.rows.map((row) => row.discovered_day),
    truthsAvailable: truths.available,
    vitals: full.vitals,
    character,
    mission,
    runtime,
    beat,
    availableExits: exits,
    events,
    npcs: full.npcs,
    inventory: full.inventory,
    cyberware: full.cyberware,
    encounter,
    agreedPayout: agreedPayoutFrom(full.flags),
    pressure: pressureFrom(await listClocks(campaignId)),
    standings: standingLines(notableFrom(full.factions)),
    factionStandings: notableFrom(full.factions),
    tally: tallyFrom(full.flags),
    complication: secretComplicationFor(full.flags, full.campaign.current_mission_id),
  };
}

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

function agreedPayoutFrom(flags: CampaignFlag[]): number | null {
  const value = flags.find((f) => f.flag === JOB_PAYOUT_FLAG)?.value;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
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
  const arrived =
    fightRunning || options.fixedResult ? null : await spendFiredClock(campaignId, { beatId });

  // Whatever the GM asked last turn, answered by dice it never saw. Skipped on
  // an options turn: the player is thinking, and nobody lived through anything.
  const answered =
    options.optionsRequested || options.fixedResult
      ? null
      : await answerPendingQuestion(campaignId);

  const jobPosition = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
  const jobDistrict = jobPosition ? getDistrict(jobPosition.districtKey) : undefined;
  const context = buildGmContext({
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
      walkOns: resolveWalkOns(
        gm.walkOns,
        `${campaignId}:${bundle.campaign.location_key ?? DEFAULT_START}`,
      ),
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
  const observed = readObservations(gm.observations);
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
      const prompt = facedownPrompt(action);
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
      const opened = await beginEncounter({
        campaignId,
        characterId: bundle.campaign.character_id,
        beatId,
        name: action.name,
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

/**
 * Record a Rockerboy working a crowd, and hand the result to the GM.
 *
 * Charismatic Impact is not a Skill Check — it is Rank + 1d10 against a DV set
 * by how many of them there are — so it gets its own ledger row rather than
 * pretending to be a skill_check.
 */
export async function commitCharismaticImpact(
  bundle: PlayBundle,
  result: CharismaticImpactResult,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const verdict = result.success ? "WON THEM OVER" : "FAILED";
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "role_ability",
    summary: `Charismatic Impact on ${result.audience.name}: ${result.formula} → ${verdict}`,
    roll: result as unknown as Json,
    data: {
      ability: "charismatic_impact",
      audience: result.audience.id,
      success: result.success,
    } as unknown as Json,
    ...(beatId ? { beat_id: beatId } : {}),
  });

  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the player used their Rockerboy Charismatic Impact on ${result.audience.name}. ` +
      `${result.formula}. Outcome: ${verdict}. ` +
      (result.success
        ? `They are Fans now, and at this Rank a fan will ${result.favor ?? "do very little"}. ` +
          `Narrate the crowd turning, and what that buys the player right now.`
        : `Narrate the room not buying it. They cannot be worked again for a week.`) +
      ` Do not re-decide the outcome. End on a decision.)`,
    { logInput: false },
  );
}

/**
 * File a story, and let it land on the people it is about.
 *
 * The believability roll happens in the panel, where the player watches the
 * die; this is what the result MEANS. A believed story takes segments off that
 * faction's clock and costs you their opinion, and either way it reaches the
 * ledger — the next story's evidence is counted from the day this one ran.
 */
export async function commitPublishedStory(
  bundle: PlayBundle,
  input: { factionId: FactionId; result: BelievabilityResult; evidencePieces: number },
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const rank = liveRoleAbility(bundle.character)?.rank ?? 0;
  const story = await publishStory({
    campaignId,
    factionId: input.factionId,
    rank,
    believed: input.result.believed,
    day: bundle.campaign.day ?? 0,
    evidencePieces: input.evidencePieces,
    beatId,
  });

  const faction = getFaction(input.factionId);
  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the player published a Media story about ${faction.name}, backed by ` +
      `${input.evidencePieces} piece(s) of what they actually found out. ` +
      (story.believed
        ? `${story.impact?.audience ?? "The audience"} believes it. The printed Impact at this ` +
          `Rank is: ${story.impact?.impact ?? "change"}. ` +
          (story.moved.length
            ? `What moved: ${story.moved.join("; ")}. `
            : "Nothing was left on their dials to move. ") +
          `Narrate the story going out and what it costs THEM — people pulled in, a name ` +
          `withdrawn, a shipment stopped. They will work out who wrote it.`
        : `Nobody buys it. Narrate the story failing to land: no pickup, no follow-up, and the ` +
          `quiet that follows a piece nobody ran.`) +
      ` Do not re-decide the outcome and never state a segment count. End on a decision.)`,
    { logInput: false },
  );
}

/**
 * Record a Lawman calling it in. A call that lands is not help yet — it is help
 * on its way, so what gets stored is the Round it turns up on.
 */
export async function commitBackupCall(bundle: PlayBundle, call: BackupCall): Promise<void> {
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const round = bundle.encounter?.state.round ?? 0;
  const pending = pendingBackupFrom(call, round);

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "backup_called",
    summary: call.responded
      ? `Called for Backup (rolled ${call.responseRoll}) — ${call.tier?.name} inbound, ` +
        `${call.roundsUntilArrival} Round${call.roundsUntilArrival === 1 ? "" : "s"} out` +
        (call.tierUp ? ", and they are sending better" : "") +
        (call.groups > 1 ? ", two groups" : "")
      : `Called for Backup (rolled ${call.responseRoll}) — nobody answers.`,
    roll: call as unknown as Json,
    data: { responded: call.responded } as unknown as Json,
    ...(beatId ? { beat_id: beatId } : {}),
  });

  if (pending) {
    await updateCampaign(campaignId, {
      role_state: withAbilityState(bundle.campaign, "backup", { pending }) as Json,
    });
  }

  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the player called for Backup. ${
      call.responded
        ? `Someone answered: ${call.tier?.name} is ${call.roundsUntilArrival} Round(s) out. Narrate the call going out and the wait, and do NOT narrate them arriving yet.`
        : `Nobody answered. Narrate the silence on the line. They can try again next Turn.`
    } Do not re-decide it. End on a decision.)`,
    { logInput: false },
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

/**
 * The twists a beat lands on arrival, whatever anybody rolled.
 *
 * A story that reaches the scene built to expose a secret should not depend on
 * somebody having searched well two beats earlier — the complication beat's
 * whole job is to reveal that the floor plan was wrong. So a truth may name the
 * beat that reveals it, and reaching that beat records it as found.
 *
 * Persisted rather than derived, because once something is known it stays known
 * and the story moves on past the scene that told it.
 */
async function revealBeatTruths(
  bundle: PlayBundle,
  mission: Mission,
  toBeatId: string,
): Promise<void> {
  if (!bundle.truthsAvailable) return;
  for (const beat of mission.beats) {
    for (const truth of truthsRevealedAt({
      missionId: mission.id,
      beatId: beat.id,
      truths: beat.truths,
      atBeatId: toBeatId,
    })) {
      if (bundle.discoveredTruths.includes(truth.key)) continue;
      const stored = await recordTruthDiscovery(bundle.campaign.id, {
        truthKey: truth.key,
        discoveredDay: bundle.campaign.day,
        viaSkill: null,
      });
      if (!stored) continue;
      await appendCampaignEvent({
        campaign_id: bundle.campaign.id,
        type: "truth_found",
        summary: truth.fact,
        data: { truthKey: truth.key, beatId: toBeatId } as unknown as Json,
      });
    }
  }
}

/**
 * Looking for something inside a job, and what the engine says is there.
 *
 * The Life loop has had this since the truth spine landed; a job is where it
 * matters most, because a job is where the concealed things are. Professor
 * Huntver's office used to say "the evidence, IF SEARCHED, is damning" and then
 * list it in the same breath — a discovery system written as a parenthesis, with
 * the whole of it handed to the narrator on arrival.
 *
 * Searches the beat's own concealed facts first, then the ground underfoot, so a
 * scene built around a hidden thing answers before the building's generic tags
 * do. Null when this was not a search, when nothing is found and nothing was
 * there, or while `campaign_truths` is unmigrated.
 *
 * DEDUCTION IS NOT A SEARCH OF THE ROOM. Every other Skill here looks at what
 * is in front of the character; a conclusion is worked out from everything they
 * have gathered, wherever they happen to be standing when it clicks. So its
 * pool is the whole job rather than this beat, and what gates it is not the
 * difficulty but the prerequisites: the pieces have to be in hand.
 */
async function applyJobSearch(
  bundle: PlayBundle,
  pending: PendingCheck,
  result: SkillCheckResult,
): Promise<string | null> {
  if (!bundle.truthsAvailable) return null;

  const at = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
  const deducing = pending.skillId === DEDUCTION_SKILL;
  const candidates = [
    ...(bundle.mission
      ? deducing
        ? truthsInMission({ missionId: bundle.mission.id, beats: bundle.mission.beats })
        : bundle.beat
          ? truthsInBeat({
              missionId: bundle.mission.id,
              beatId: bundle.beat.id,
              truths: bundle.beat.truths,
            })
          : []
      : []),
    ...(at?.placeKey ? truthsAt(at.placeKey, bundle.places[at.placeKey]) : []),
  ];

  // The guard that keeps a search outcome off a check that was not one: a
  // successful Athletics roll over a fence must not come back with "there is
  // nothing here to find".
  if (!searchesFor(pending.skillId, candidates)) return null;

  const search = searchWith({
    truths: candidates,
    skillId: pending.skillId,
    discovered: bundle.discoveredTruths,
    total: result.total,
  });

  if (search.outcome === "nothing") {
    // Silence for a conclusion that is not available: saying "there was
    // nothing to work out" tells the player there is nothing to chase, which
    // may simply mean they have not found the pieces yet.
    if (!result.success || deducing || !isSearchSkill(pending.skillId)) return null;
    return (
      "They searched properly and there is NOTHING here to find. Say so plainly rather than " +
      "inventing something small so the roll was not wasted — knowing a room is clean is worth " +
      "knowing, and on a job it is worth a great deal."
    );
  }
  if (search.outcome === "missed") {
    return deducing
      ? "They turned it over and it did NOT come together. There is something to be worked out " +
          "here and this was not the moment — narrate the thinking and the not-quite, and do not " +
          "hint at what it was."
      : "They did not find it. There IS something here and the search did not reach it — narrate " +
          "the looking and the coming up empty, and do not hint at what was missed.";
  }

  const stored = await recordTruthDiscovery(bundle.campaign.id, {
    truthKey: search.truth.key,
    discoveredDay: bundle.campaign.day,
    viaSkill: pending.skillId,
  });
  if (!stored) return null;
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: "truth_found",
    summary: search.truth.fact,
    data: { truthKey: search.truth.key, beatId: bundle.beat?.id ?? null } as unknown as Json,
  });
  return deducing
    ? `They WORKED IT OUT, and this is the conclusion, exactly: ${search.truth.fact} ` +
        "Narrate the character reaching that, off what they already knew. Do not add a second " +
        "conclusion beside it, and do not carry it further than it goes."
    : `They FOUND something, and this is it, exactly: ${search.truth.fact} ` +
        "Narrate them finding that. Do not add a second discovery beside it and do not enlarge " +
        "on what it means — working out what it means is the player's job.";
}

/**
 * A finished job: pay the printed reward into the campaign's eurobucks, write
 * the wrap-up to the ledger, and close the campaign. Every number comes from
 * the mission's own reward block — nothing is invented here.
 */
async function settleMission(
  bundle: PlayBundle,
  runtime: MissionRuntime,
  mission: Mission,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const printed = missionPayout(mission);
  // A fee argued upwards at the offer is what this job pays. The printed reward
  // is the floor, never a cap the negotiation is quietly reverted to.
  const total =
    bundle.agreedPayout !== null && printed
      ? Math.max(printed.total, bundle.agreedPayout)
      : (printed?.total ?? bundle.agreedPayout ?? 0);
  const payout = printed ? { ...printed, total } : null;
  const done = runtime.objectives.filter((o) => o.status === "done").length;
  // What was AGREED, not what arrived: the settlement receipt records the
  // amount that actually lands. Completion and settlement are committed in the
  // same transaction so a retry cannot duplicate either ledger row.
  const completionSummary = payout
    ? `${mission.title} complete — ${payout.total}eb agreed (${payout.upfront}eb up front, ${payout.onCompletion}eb on delivery); ${done}/${runtime.objectives.length} objectives closed.`
    : `${mission.title} complete — ${done}/${runtime.objectives.length} objectives closed. This job records no printed payout.`;

  // The trip home. What the job cost is read off its own ledger, the money is
  // rolled for, whoever walked away becomes somebody the campaign remembers,
  // and what is left over is written into Life with a day attached.
  const aftermath = await settleAftermath({
    campaignId,
    missionId: mission.id,
    playerName: bundle.character.character.name,
    agreed: total,
    messy: done < runtime.objectives.length,
    factionId: missionFaction(mission),
    completion: {
      summary: completionSummary,
      beatId: runtime.currentBeatId,
      data: { missionId: mission.id, payout } as unknown as Json,
    },
  });

  // A null report means this job had already been settled. The phase fallback
  // below can repair an older campaign that was stranded before Aftermath.
  // Now that it is over, show the player the die that was thrown before it
  // began. A complication they never noticed is worth showing too, and so is a
  // clean brief: it is the evidence that the job's shape was rolled, not
  // written to suit how the job was going.
  await revealComplication(campaignId, mission.id);

  // A finished job writes the campaign's status, rather than leaving it to be
  // written later or not at all.
  //
  // What it writes is "active", because a campaign is a life and not a job:
  // surviving a night's work is not winning anything, and the run continues.
  // Until now nothing wrote it here at all — `settle_job` moves the phase and
  // touches no status, and `close_aftermath` only writes one once the player
  // deliberately leaves the wrap-up screen. So a campaign sat in Aftermath had
  // a status nothing had confirmed since the job was accepted. It is confirmed
  // here, at the moment the job actually ends.
  await updateCampaign(campaignId, { status: "active" });

  // The phase moves to aftermath — the wrap-up screen — and only the player's
  // press moves it on to Life. The AI never performs this transition.
  // The settlement transaction owns the normal phase transition. The fallback
  // only repairs an older already-settled campaign that was left in Job.
  if (!aftermath) {
    const after = nextPhase(phaseOf(bundle.campaign.phase), "end_job");
    if (after) await setCampaignPhase(campaignId, after);
  }
}

/**
 * Which faction a job's opposition belongs to, when it names one.
 *
 * Scans authored mission text ("a Tyger Claws crew, and they are not new at
 * this"), which is this project's own content, so findFactionIn is the right
 * tool for it. A job whose opposition is nobody in particular returns null, and
 * the bodies still raise Heat.
 */
function missionFaction(mission: Mission): FactionId | null {
  const named = [mission.offer?.opposition, ...mission.beats.flatMap((b) => b.opposition ?? [])];
  for (const text of named) {
    const factionId = findFactionIn(text);
    if (factionId) return factionId;
  }
  return null;
}

/**
 * The end-of-session I.P. award. The GM judges everything since the last award
 * against the printed table; the engine turns that judgement into the number,
 * and `award_improvement_points` writes it to the ledger, the campaign and the
 * character's permanent total in one transaction (`features/campaign/ipAward.ts`).
 */
export type { IpTally } from "@/features/campaign/ipAward";

export async function settleIp(
  bundle: PlayBundle,
  playstyles: { primary: IpPlaystyle; secondary: IpPlaystyle },
): Promise<IpTally> {
  if (bundle.campaign.ip_awarded !== null && bundle.campaign.ip_awarded !== undefined) {
    throw new Error("This job's Improvement Points have already been awarded.");
  }
  const missionFinished = bundle.runtime?.status === "completed";
  const outcome =
    bundle.campaign.status === "lost"
      ? `${bundle.character.character.name} died in Night City; the job was left unfinished.`
      : missionFinished
        ? "The job was seen through to its resolution."
        : "The session ended with the job unfinished.";

  return judgeAndAward({
    campaignId: bundle.campaign.id,
    kind: "job",
    day: bundle.campaign.day,
    title: bundle.mission?.title ?? bundle.campaign.name,
    finished: missionFinished,
    outcome,
    objectives: (bundle.runtime?.objectives ?? []).map((o) => ({ text: o.text, status: o.status })),
    playstyles,
  });
}

/**
 * Back to the street.
 *
 * Wrap-up is done, so the campaign returns to Life. The run continues:
 * eurobucks, HP, wounds and inventory all carry over, which is the whole point
 * of the campaign outliving the job. The mission pointer is cleared and
 * ip_awarded reset, so the next session is judged on its own merits — and the
 * next job has to arrive as an offer the player accepts, never as a screen they
 * are dropped into.
 */
export async function returnToLife(bundle: PlayBundle): Promise<void> {
  await closeAftermath(bundle.campaign.id, luckPoolMax(statsRecord(bundle.character)));
  // What the job did for their name, kept in the Life log rather than only
  // flashed: Reputation and the tier of work move at settlement, where no Life
  // turn can see them change. Written once per settled job, after the phase
  // has moved, so a failure here costs the line and never the return.
  const news = climbNews({
    events: bundle.climbEvents,
    jobsFinished: bundle.tally.jobsFinished,
    npcs: bundle.npcs,
  });
  if (news?.milestone && !milestoneWritten(bundle.climbEvents, news.settledEventId)) {
    await appendCampaignEvent({
      campaign_id: bundle.campaign.id,
      type: LEDGER_EVENTS.milestone,
      summary: news.milestone,
      data: milestoneEventData({ settledEventId: news.settledEventId }) as unknown as Json,
    });
  }
}

/** Job-specific consequence of the shared combat death-save operation. */
export async function commitDeathSave(
  bundle: PlayBundle,
  pending: PendingDeathSave,
  result: BeginTurnResult,
): Promise<void> {
  await commitCombatDeathSave(bundle, pending, result);
  if (result.died && bundle.mission && bundle.runtime) {
    await saveMissionRuntime(bundle.campaign.id, failMission(bundle.runtime));
  }
}

export async function takeExit(bundle: PlayBundle, exit: BeatExit): Promise<void> {
  if (!bundle.mission || !bundle.runtime || !bundle.beat) return;
  const campaignId = bundle.campaign.id;
  const next = advance(bundle.mission, bundle.runtime, exit.to);
  await saveMissionRuntime(campaignId, next);
  await revealBeatTruths(bundle, bundle.mission, exit.to);
  const toBeat = getBeat(bundle.mission, exit.to);
  await logBeatAdvanced(campaignId, {
    mission: bundle.mission,
    fromBeatId: bundle.beat.id,
    toBeat,
    choiceLabel: exit.label,
  });
  if (next.status === "completed") {
    await settleMission({ ...bundle, runtime: next }, next, bundle.mission);
  }

  // Narrate the new scene from the fresh beat.
  const advanced: PlayBundle = {
    ...bundle,
    runtime: next,
    beat: toBeat,
    availableExits: availableExits(bundle.mission, next),
  };
  await narrate(advanced, `(You choose: ${exit.label}. Set the new scene.)`);
}

/** True when the current beat has never been narrated (fresh campaign or beat). */
export function needsOpeningScene(bundle: PlayBundle): boolean {
  if (bundle.encounter || bundle.campaign.status === "lost") return false;
  if (!bundle.mission || !bundle.beat) return false;
  return !bundle.events.some((e) => e.type === "gm_narration" && e.beat_id === bundle.beat?.id);
}

/** Ask the GM to open the current beat, without logging a fake player action. */
export async function openScene(bundle: PlayBundle): Promise<void> {
  await narrate(
    bundle,
    "(ENGINE: open this scene. Dramatize the beat's read-aloud and brief, make clear how the character knows what they know and why they are involved, place them somewhere concrete, and end on a decision.)",
    { logInput: false },
  );
}

/** The clickable suggestions from the most recent GM narration. */
export function latestSuggestions(bundle: PlayBundle): GmSuggestedAction[] {
  for (let i = bundle.events.length - 1; i >= 0; i -= 1) {
    const event = bundle.events[i];
    if (!event || event.type !== "gm_narration") continue;
    const data = event.data as { suggestedActions?: unknown } | null;
    const parsed = z.array(GmSuggestedActionSchema).safeParse(data?.suggestedActions ?? []);
    return parsed.success ? parsed.data : [];
  }
  return [];
}

/**
 * Which unresolved prompt is the live one. A stale check from an earlier turn
 * must never share the screen with a fresh attack: the newest ledger row wins.
 */
export function newestPrompt(
  events: CampaignEvent[],
  check: { eventId: string } | null,
  attack: { eventId: string } | null,
): "check" | "attack" | null {
  if (!check) return attack ? "attack" : null;
  if (!attack) return "check";
  const index = (id: string) => events.findIndex((e) => e.id === id);
  return index(attack.eventId) >= index(check.eventId) ? "attack" : "check";
}
