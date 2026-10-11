/**
 * Loading a Life turn's bundle: the campaign, the people, the situation funnel,
 * the job on the wire and the climb, plus the small bundle-level writes (pinned
 * goals, a stretch of life's I.P.). Split out of lifeOps.ts, which re-exports
 * what other modules use. No React and no TanStack Query in here.
 */

import {
  ageSituations,
  getMission,
  mergeSituations,
  missionOffer,
  selectSituation,
  type GameClock,
  type GamePhase,
  type FactionStanding,
  type ReputationStanding,
  type TierStanding,
  isHostile,
  jobTierFor,
  reputationFromLedger,
  type RecognitionRoll,
  type LifeSituation,
  DEFAULT_START,
  type PlaceState,
  resolvePosition,
  daysUntilLifeAward,
  goalsPinnedEventData,
  LEDGER_EVENTS,
  MAX_PINNED_GOALS,
  readGoalsPinnedEventData,
  screamsheet,
  type SheetItem,
  type Goal,
} from "@/engine";
import {
  appendCampaignEvent,
  getCampaign,
  getCharacter,
  lastCampaignEventOfType,
  listCampaignEventsOfTypes,
  listCampaignEvents,
  listCampaignTruths,
  listCampaignFactions,
  listClocks,
  listSituations,
  setCampaignFlag,
  upsertSituations,
  type Campaign,
  type CampaignEvent,
  type CampaignFlag,
  type CampaignInventoryItem,
  type CampaignCyberware,
  type CampaignNpc,
  type CampaignVitals,
  type FullCharacter,
  type Json,
} from "@/lib/backend";
import { latestClosingFrame, type LatestFrame } from "@/features/campaign/previously";
import { localExpertIn } from "@/features/play/playModel";
import type { LifeWireOffer } from "./lifeContext";
import type { LifeActionCard } from "./lifeResponse";
import {
  hookFromSituation,
  hookUpsert,
  liveHookSituation,
  nextJobSeedFrom,
  pickJobSeed,
  offerTerms,
  wireOfferFor,
  NEXT_JOB_SEED_FLAG,
  type JobSeedFilter,
  type LifeHook,
} from "./hookOffer";
import { castMemberInRole, ensureCast } from "@/features/campaign/castSeeding";
import type { OracleAnswer } from "@/features/campaign/oracles";
import { loadPlaceStates } from "@/features/campaign/placeState";
import { tallyFrom, type CampaignTally } from "@/features/campaign/tally";
import {
  judgeAndAward,
  readLastAward,
  type IpTally,
  type Playstyles,
} from "@/features/campaign/ipAward";
import {
  notableFrom,
  standingsFrom,
  pressureFrom,
  type LivePressure,
} from "@/features/campaign/pressure";
import { campaignPhase, derivedSituations, situationFromRow, situationToUpsert } from "./lifeModel";

export type { LifeHook };

export type LifeBundle = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
  cyberware: CampaignCyberware[];
  npcs: CampaignNpc[];
  events: CampaignEvent[];
  phase: GamePhase;
  clock: GameClock;
  situations: LifeSituation[];
  /** Every clock the engine recognises, worst first. */
  pressure: LivePressure[];
  /** Every organisation that has formed an opinion. */
  standings: FactionStanding[];
  /** The one situation this turn is about. */
  current: LifeSituation | null;
  /**
   * True when `current` is the scene the player is already in — same place,
   * same day, same situation as the last turn — rather than something arriving.
   * The narrator treats the two differently: one is background, the other
   * walks in.
   */
  inScene: boolean;
  /**
   * True when the character is still where the last turn left them, on the
   * same day, whatever the situation. The place was established on the turn
   * they arrived, and a visit is counted on arrival, so without this every
   * later turn of a first visit was told to establish the room again.
   */
  stillHere: boolean;
  /** The offer on the table, when the campaign is in the hook phase. */
  hook: LifeHook | null;
  /**
   * The job that already exists, waiting for a moment that reaches for it. The
   * model is shown its public half and may put THIS one on the table; it cannot
   * invent another. Null while an offer is already live.
   */
  wire: LifeWireOffer | null;
  /** The mission id behind that offer, so accepting starts the job that was pitched. */
  wireMissionId: string | null;
  /** Running totals that outlive a turn's ledger window. */
  tally: CampaignTally;
  /**
   * What has happened to the places this campaign has touched. Sparse: a place
   * with no entry is a place at its authored starting condition, not a blank
   * one.
   */
  places: Record<string, PlaceState>;
  /**
   * The hidden truths this campaign has discovered, as engine truth keys.
   *
   * Sparse and one-way: a key is here because somebody found it. What is TRUE
   * is derived from the atlas by `truth.ts`; this is only who knows it.
   */
  discoveredTruths: string[];
  /**
   * False until `campaign_truths` has been migrated. Not the same as "nothing
   * discovered" — one means the feature is off and searching narrates the way
   * it always did, the other means the character has not looked yet.
   */
  truthsAvailable: boolean;
  /**
   * Where the life since the last Improvement Point award stands: how many
   * in-world days until it is judged (0: now), and what the player declared
   * last time, so the pickers open on it.
   */
  ipAward: { daysUntil: number; lastPlaystyles: Playstyles | null };
  /** The goals the player has pinned, in the order they pinned them. */
  pinnedGoals: Goal[];
  /** Who has heard of the character, and the work that brings them. */
  climb: { reputation: ReputationStanding; tier: TierStanding };
  /** How the last job closed: its peak and what it left open. Null on a quiet one. */
  lastFrame: LatestFrame | null;
  /** What the city has printed about the character, newest first. Empty on a quiet life. */
  sheet: SheetItem[];
};

export async function loadLife(campaignId: string): Promise<LifeBundle> {
  const full = await getCampaign(campaignId);
  if (!full) throw new Error("Campaign not found.");
  if (!full.vitals) throw new Error("Campaign has no vitals to live with.");

  const character = await getCharacter(full.campaign.character_id);
  if (!character) throw new Error("This campaign's character no longer exists.");

  const [
    events,
    situationRows,
    clockRows,
    factionRows,
    places,
    truths,
    lastAward,
    pinsEvent,
    settledJobs,
    newsRows,
  ] = await Promise.all([
    listCampaignEvents(campaignId),
    listSituations(campaignId),
    listClocks(campaignId),
    listCampaignFactions(campaignId),
    loadPlaceStates(campaignId),
    listCampaignTruths(campaignId),
    readLastAward(campaignId),
    lastCampaignEventOfType(campaignId, LEDGER_EVENTS.goalsPinned),
    listCampaignEventsOfTypes(campaignId, [LEDGER_EVENTS.jobSettled]),
    // What the Screamsheet is made from besides the receipts: a flag a place
    // gained, and which job each receipt belongs to.
    listCampaignEventsOfTypes(campaignId, [LEDGER_EVENTS.placeChanged, "mission_started"]),
  ]);

  // The six the campaign lives among. Seeded once, from the character's own
  // Lifepath, before anything reads the people: a campaign with nobody in it
  // has no fixer to be called by and no friend to have gone quiet on.
  const cast = await ensureCast({
    campaignId,
    flags: full.flags,
    character,
    npcs: full.npcs,
  });

  const clock: GameClock = { day: full.campaign.day, minute: full.campaign.minute };
  const input = {
    campaign: full.campaign,
    vitals: full.vitals,
    character,
    inventory: full.inventory,
    cyberware: full.cyberware,
    npcs: cast.npcs,
  };

  // Age what was already on the books, then fold in what is true right now.
  // The result is persisted, so a situation survives a reload rather than being
  // re-invented (or forgotten) each turn.
  const persisted = ageSituations(situationRows.map(situationFromRow), clock.day);
  const merged = mergeSituations(persisted, derivedSituations({ ...input, places }));
  const changed = merged.filter((s) => {
    const prior = persisted.find((p) => p.key === s.key);
    return !prior || JSON.stringify(prior) !== JSON.stringify(s);
  });
  if (changed.length) await upsertSituations(campaignId, changed.map(situationToUpsert));

  const lastShownKey = [...events]
    .reverse()
    .map((e) => (e.data as { situationKey?: unknown } | null)?.situationKey)
    .find((k): k is string => typeof k === "string");
  // Still where the last turn left them, on the same day: a scene in progress,
  // which keeps its situation rather than rotating to the next loudest thing.
  const scene = lastSceneOf(events);
  const inScene =
    scene !== null &&
    scene.at === (full.campaign.location_key ?? DEFAULT_START) &&
    scene.day === clock.day;
  const current = selectSituation(merged, clock.day, lastShownKey, { inScene });

  // There is always a job somewhere in Night City. Its seed is drawn once and
  // stored, so the same work is still on the wire after a reload, and so the
  // mission behind an offer exists BEFORE anyone pitches it.
  const climb = climbFrom({
    settled: settledJobs,
    jobsFinished: tallyFrom(full.flags).jobsFinished,
    npcs: cast.npcs,
  });
  const filter = seedFilterFrom(climb.tier, standingsFrom(factionRows));
  const seed = await ensureNextJobSeed(
    campaignId,
    full.flags,
    knownDistrictsOf(full.campaign),
    filter,
  );
  // Work comes through the fixer the character actually has, not a new name.
  const { missionId: wireMissionId, wire } = wireOfferFor(
    seed,
    castMemberInRole(cast.npcs, "fixer"),
    places,
    // A job on the character's own streets arrives knowing more than a job
    // across the city, before they have accepted anything.
    (districtKey) => localExpertIn(character, districtKey),
  );

  const hookRow = liveHookSituation(merged);
  let hook = hookRow ? hookFromSituation(hookRow) : null;
  if (hookRow && !hook) {
    // A hook written before offers carried a mission. Rather than guess at what
    // job was meant, bind it to the one on the wire and roll a fresh one on:
    // from here the offer and the job it starts are the same object.
    hook = await bindLegacyHook(campaignId, hookRow, seed, knownDistrictsOf(full.campaign), filter);
  }

  return {
    ...input,
    events,
    phase: campaignPhase(full.campaign),
    clock,
    situations: merged,
    pressure: pressureFrom(clockRows),
    standings: notableFrom(factionRows),
    current,
    inScene: inScene && current?.key === lastShownKey,
    stillHere: inScene,
    hook,
    wire: hook ? null : wire,
    wireMissionId: hook ? null : wireMissionId,
    tally: tallyFrom(full.flags),
    places,
    discoveredTruths: truths.rows.map((row) => row.truth_key),
    truthsAvailable: truths.available,
    ipAward: {
      daysUntil: daysUntilLifeAward({ day: clock.day, lastAwardDay: lastAward.day }),
      lastPlaystyles: lastAward.playstyles,
    },
    pinnedGoals: pinsEvent ? readGoalsPinnedEventData(pinsEvent.data) : [],
    climb,
    lastFrame: latestClosingFrame(settledJobs),
    sheet: screamsheet({
      events: [...newsRows, ...settledJobs],
      handle: character.character.handle?.trim() || character.character.name,
    }),
  };
}

/**
 * Reputation from every job the campaign has settled, and the tier of work it
 * brings. The fixer is whoever holds that seat in the standing cast: a fixer
 * who has gone cold puts the character up for less than they have earned.
 */
export function climbFrom(input: {
  settled: CampaignEvent[];
  jobsFinished: number;
  npcs: CampaignNpc[];
}): LifeBundle["climb"] {
  const reputation = reputationFromLedger(input.settled);
  const fixer = castMemberInRole(input.npcs, "fixer");
  const tier = jobTierFor({
    reputation: reputation.level,
    jobsFinished: input.jobsFinished,
    fixerDisposition: fixer?.disposition ?? null,
  });
  return { reputation, tier };
}

/** What the next job has to be: this tier's work, from nobody hostile. */
export function seedFilterFrom(tier: TierStanding, standings: FactionStanding[]): JobSeedFilter {
  return {
    tier: tier.tier,
    hostile: new Set(standings.filter((s) => isHostile(s.standing)).map((s) => s.factionId)),
  };
}

/**
 * Replace the pinned goals. The list is written whole, as one ledger event; the
 * newest is the list. Capped by the engine (`withPinned`), and checked again
 * here, because a list the engine would not have made is not a list to store.
 */
export async function setPinnedGoals(bundle: LifeBundle, goals: Goal[]): Promise<void> {
  if (goals.length > MAX_PINNED_GOALS) {
    throw new Error(`Pin at most ${MAX_PINNED_GOALS} things at once.`);
  }
  await appendCampaignEvent({
    campaign_id: bundle.campaign.id,
    type: LEDGER_EVENTS.goalsPinned,
    summary: goals.length
      ? `Working toward ${goals.length} ${goals.length === 1 ? "thing" : "things"}.`
      : "Nothing pinned.",
    data: goalsPinnedEventData(goals) as unknown as Json,
  });
}

/**
 * The life since the last award, judged once enough of it has been lived.
 *
 * House rule (`ip-awards.json` `_houseRules`): a solo game has no session to end
 * but a job, and a week of life with no job in it would otherwise earn nothing.
 * It is judged on the playstyle columns — no job finished — over everything
 * since the last award, through the same transaction a job's award uses.
 */
export async function settleLifeIp(bundle: LifeBundle, playstyles: Playstyles): Promise<IpTally> {
  if (bundle.phase !== "life") {
    throw new Error("Improvement Points for a stretch of life are judged between jobs.");
  }
  if (bundle.ipAward.daysUntil > 0) {
    throw new Error(
      `Not yet: ${bundle.ipAward.daysUntil} more ${bundle.ipAward.daysUntil === 1 ? "day" : "days"} of life before it is judged.`,
    );
  }
  return judgeAndAward({
    campaignId: bundle.campaign.id,
    kind: "life",
    day: bundle.clock.day,
    title: "Life between jobs",
    finished: false,
    outcome: "No job closed in this stretch. It is judged on how the character lived it.",
    objectives: [],
    playstyles,
  });
}

/** The seed of the job on the wire, drawing and storing one the first time. */
async function ensureNextJobSeed(
  campaignId: string,
  flags: CampaignFlag[],
  known: Set<string>,
  filter: JobSeedFilter,
): Promise<number> {
  const stored = nextJobSeedFrom(flags);
  if (stored !== null) return stored;
  // Prefer work on ground the character has walked. "The target is holed up in
  // Coronado Heights" only lands if they have been to Coronado Heights.
  const seed = pickJobSeed(known, Math.random, filter);
  await setCampaignFlag(campaignId, NEXT_JOB_SEED_FLAG, seed as unknown as Json);
  return seed;
}

/** Draw the next job onto the wire, so the one just offered is not offered twice. */
export async function rollWireForward(
  campaignId: string,
  known: Set<string>,
  filter: JobSeedFilter,
): Promise<void> {
  await setCampaignFlag(
    campaignId,
    NEXT_JOB_SEED_FLAG,
    pickJobSeed(known, Math.random, filter) as unknown as Json,
  );
}

/** Give an offer that predates offer-time generation the job it will start. */
async function bindLegacyHook(
  campaignId: string,
  situation: LifeSituation,
  seed: number,
  known: Set<string>,
  filter: JobSeedFilter,
): Promise<LifeHook> {
  const { missionId } = wireOfferFor(seed);
  const mission = getMission(missionId);
  const offer = missionOffer(mission);
  const terms = offerTerms(mission);
  await upsertSituations(campaignId, [hookUpsert(situation.key, mission, offer, terms)]);
  await rollWireForward(campaignId, known, filter);
  return { situationKey: situation.key, missionId, mission, offer, terms };
}

/** What a single Life turn is: what the player did, and what already happened. */
export type TurnOptions = {
  /** What the engine already resolved, when this turn narrates a result. */
  resolved?: string;
  /** True when the player asked what they could do rather than doing something. */
  options?: boolean;
  /** Minutes the engine has already decided this turn costs. */
  minutes?: number;
  /**
   * Eurobucks the engine has already decided this turn costs, with what for.
   *
   * Applied through the same capability gate the model's own spends go through,
   * so an option the character cannot afford is refused rather than quietly
   * overdrawing them. This exists because an option card printing "10eb" and
   * then leaving the model to decide whether money moved was a number on screen
   * that nothing enforced.
   */
  spend?: { amount: number; reason: string };
  /** Narrate a committed engine result without applying model-authored actions. */
  fixedResult?: boolean;
  /**
   * This turn narrates a check the engine rolled by itself. Another small check
   * it proposes waits for the player, so one turn can never roll a chain.
   */
  autoRolled?: boolean;
  /**
   * What the player typed. Set by `liveTurn` on the turn they typed it, and
   * carried into the follow-up that narrates an engine result — the arrival,
   * the dice — so the rest of what they said still happens.
   */
  said?: string;
  /**
   * This turn finishes what an earlier one started: the trip is done and the
   * rest of the player's words are being carried out. It may spend, use kit
   * and propose a check, and it may NOT travel — a second trip is a second
   * request the player never made, and it is also how a follow-up would recurse.
   */
  continuation?: boolean;
  /**
   * Cards the ENGINE is offering on this turn, written as its options. Used
   * when a trip could not be resolved: rather than a refusal and nothing to
   * press, the nearest real places of the kind they asked for.
   */
  cards?: LifeActionCard[];
  /**
   * What the oracles said before this turn ran. The model is handed these as
   * facts; it never learns that a die was involved in producing them.
   */
  oracle?: {
    /** True when tonight's wire roll actually produced work. */
    wireOffers?: boolean;
    /** What the street is doing, when it was rolled for. */
    street?: string;
    /** The answer to whatever the model asked last turn. */
    answer?: OracleAnswer;
  };
  /**
   * Whether a stranger met this turn has heard of the character: one d10 the
   * engine rolls before the packet is built, and keeps beside the narration.
   */
  recognition?: RecognitionRoll;
};

/** Where and on which day the last Life narration was written, if it says. */
function lastSceneOf(events: readonly CampaignEvent[]): { at: string; day: number } | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i]!;
    if (e.type !== "life_narration") continue;
    const data = e.data as { at?: unknown; day?: unknown } | null;
    return typeof data?.at === "string" && typeof data.day === "number"
      ? { at: data.at, day: data.day }
      : null;
  }
  return null;
}

/** The districts this campaign has actually set foot in. */
export function knownDistrictsOf(campaign: Campaign): Set<string> {
  const out = new Set<string>();
  for (const raw of knownPlacesOf(campaign)) {
    const at = resolvePosition(raw);
    if (at) out.add(at.districtKey);
  }
  return out;
}

export function knownPlacesOf(campaign: Campaign): string[] {
  const known = campaign.known_places;
  if (!Array.isArray(known)) return [];
  return (known as unknown[]).filter((v): v is string => typeof v === "string");
}

/** The venues among the places they have stood, by place key. */
export function knownVenueKeysOf(campaign: Campaign): string[] {
  const out: string[] = [];
  for (const raw of knownPlacesOf(campaign)) {
    const key = resolvePosition(raw)?.placeKey;
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}
