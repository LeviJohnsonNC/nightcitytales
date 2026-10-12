/**
 * Loading a Job's bundle: the campaign, the mission and its beat, the fight in
 * progress, what has been found out, the climb and the pressure. Split out of
 * playOps.ts, which re-exports it. No React and no TanStack Query in here.
 */

import { loadCombat } from "./combatOps";
import { loadPlaceStates } from "@/features/campaign/placeState";
import {
  LEDGER_EVENTS,
  availableExits,
  currentBeat,
  getMission,
  reputationFromLedger,
  type Beat,
  type BeatExit,
  type FactionStanding,
  type Mission,
  type MissionRuntime,
  type PlaceState,
  type ReputationStanding,
} from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { loadMissionRuntime } from "@/features/campaign/missionState";
import { secretComplicationFor, type ComplicationMemory } from "@/features/campaign/oracles";
import {
  notableFrom,
  pressureFrom,
  standingLines,
  type LivePressure,
} from "@/features/campaign/pressure";
import { tallyFrom, type CampaignTally } from "@/features/campaign/tally";
import { JOB_PAYOUT_FLAG } from "@/features/life/hookOffer";
import {
  listCampaignEventsOfTypes,
  listCampaignTruths,
  listClocks,
  type Campaign,
  type CampaignCyberware,
  type CampaignEvent,
  type CampaignFlag,
  type CampaignInventoryItem,
  type CampaignNpc,
  type CampaignVitals,
  type FullCharacter,
} from "@/lib/backend";

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

function agreedPayoutFrom(flags: CampaignFlag[]): number | null {
  const value = flags.find((f) => f.flag === JOB_PAYOUT_FLAG)?.value;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

/** True when the current beat has never been narrated (fresh campaign or beat). */
export function needsOpeningScene(bundle: PlayBundle): boolean {
  if (bundle.encounter || bundle.campaign.status === "lost") return false;
  if (!bundle.mission || !bundle.beat) return false;
  return !bundle.events.some((e) => e.type === "gm_narration" && e.beat_id === bundle.beat?.id);
}
