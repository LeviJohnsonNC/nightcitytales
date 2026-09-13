/**
 * The cold open, applied.
 *
 * Loading the material, asking for the prose, and — the half that matters —
 * doing what the player's door actually does. The model wrote the flavour; every
 * consequence below is the engine's, and the four really do diverge: one puts a
 * job on the table and moves the phase, and the other three seed different
 * situations and leave the campaign in Life.
 *
 * Three of the four open the game in LIFE, which the game could not previously
 * do at all: every campaign used to be created with a mission already attached
 * and opened mid-beat.
 *
 * No React and no TanStack Query in here, the same rule lifeOps.ts and
 * playOps.ts follow. useOpening.ts binds these to the query client.
 */
import {
  NIGHT_AT_THE_OPERA,
  missionOffer,
  nextPhase,
  phaseOf,
  type CastMember,
  type OpeningChoice,
} from "@/engine";
import {
  getCampaign,
  getCharacter,
  listCampaignFlags,
  listCampaignNpcs,
  setCampaignFlag,
  setCampaignPhase,
  upsertSituations,
  appendCampaignEvent,
  type Campaign,
  type CampaignVitals,
  type FullCharacter,
  type Json,
} from "@/lib/backend";
import { castFrom, ensureCast } from "@/features/campaign/castSeeding";
import { hookKeyFor, hookUpsert, offerTerms } from "@/features/life/hookOffer";
import { buildOpeningFacts, renderOpeningPrompt } from "./openingContext";
import { openingFn } from "./opening.server";
import type { Opening } from "./openingResponse";

/**
 * The campaign flag recording which door was taken.
 *
 * Its presence is also the record that the opening has happened, so it never
 * runs twice. A campaign interrupted before the player chose has no flag and
 * gets the opening again — which is the correct answer, since nothing was
 * applied.
 */
export const OPENING_FLAG = "opening_choice";

export type OpeningBundle = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  cast: CastMember[];
};

/**
 * Whether this campaign still owes the player an opening.
 *
 * Two conditions, and the second is what keeps existing campaigns out of it: a
 * campaign created before the opening existed was always given a mission at
 * creation, so a campaign with no mission and no flag is necessarily a new one.
 */
export function needsOpening(campaign: Campaign, flags: { flag: string }[]): boolean {
  if (flags.some((f) => f.flag === OPENING_FLAG)) return false;
  if (campaign.current_mission_id) return false;
  return phaseOf((campaign as { phase?: unknown }).phase) === "life";
}

/** Everything the cold open is written from. Seeds the cast if it is not there. */
export async function loadOpeningBundle(campaignId: string): Promise<OpeningBundle> {
  const full = await getCampaign(campaignId);
  if (!full) throw new Error("Campaign not found.");
  if (!full.vitals) throw new Error("That campaign has no vitals row.");
  const character = await getCharacter(full.campaign.character_id);
  if (!character) throw new Error("That campaign has no character.");

  // The doors point at real people, so the six have to exist before the prose
  // is written rather than after.
  const flags = await listCampaignFlags(campaignId);
  const npcs = await listCampaignNpcs(campaignId);
  const seeded = await ensureCast({ campaignId, flags, character, npcs });

  return {
    campaign: full.campaign,
    vitals: full.vitals,
    character,
    cast: castFrom(seeded.npcs),
  };
}

/** Ask for the prose. Throws on failure; the screen offers a retry. */
export async function generateOpening(bundle: OpeningBundle): Promise<Opening> {
  const facts = buildOpeningFacts(bundle);
  return openingFn({ data: { userPrompt: renderOpeningPrompt(facts) } });
}

// ---------------------------------------------------------------------------
// What each door does.
// ---------------------------------------------------------------------------

/**
 * The job the first door puts on the table.
 *
 * The authored opener, deliberately. "A Night at the Opera" is the book's own
 * recommended starter and the strongest first job in the game: a real
 * investigation with withheld truths and a climax, against a generated job's
 * five beats. It used to be reachable only from a button on the character list,
 * which is the wrong place for a choice the character is making.
 *
 * It is an OFFER, not a job. The player can question it, argue the fee up, or
 * turn it down, and the wire supplies generated work from then on — so this
 * being fixed is a strong first hand, not a rail.
 */
function openingJob() {
  return NIGHT_AT_THE_OPERA;
}

/** A stable situation key per door, so applying twice cannot double-seed. */
function situationKey(choice: OpeningChoice): string {
  return `opening_${choice}`;
}

async function offerFirstJob(campaignId: string, campaign: Campaign): Promise<void> {
  const mission = openingJob();
  const offer = missionOffer(mission);
  const terms = offerTerms(mission);
  const key = hookKeyFor(offer, mission.id);
  await upsertSituations(campaignId, [hookUpsert(key, mission, offer, terms)]);
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "hook_offered",
    summary: `${offer.brokerName} offers work: ${mission.title} (${terms.payout}eb)`,
    data: { situationKey: key, missionId: mission.id, payout: terms.payout } as unknown as Json,
  });
  // Life → hook. Accepting is still the player's, and still the only door into
  // a job: this puts the offer on the table, nothing more.
  const to = nextPhase(phaseOf((campaign as { phase?: unknown }).phase), "offer_hook");
  if (to) await setCampaignPhase(campaignId, to);
}

/**
 * Somebody the character already knows wants to see them.
 *
 * Drawn from the seeded cast rather than invented, so the person on the other
 * end has a dossier, a disposition and a tie to the character's own Lifepath
 * from the first minute.
 */
async function seedSeeSomeone(campaignId: string, cast: CastMember[], day: number): Promise<void> {
  // Whoever the character is closest to. A first night spent on the person who
  // matters most beats one spent on whoever happened to be first in the list.
  const person = [...cast].sort((a, b) => b.disposition - a.disposition)[0] ?? null;
  await upsertSituations(campaignId, [
    {
      situationKey: situationKey("see_someone"),
      category: "people",
      title: person ? `${person.name} is waiting on you` : "Somebody is waiting on you",
      summary: person
        ? `${person.standing} There is something between you that has not been said.`
        : "There is a conversation you have been putting off.",
      ...(person ? { npcKey: person.key } : {}),
      status: "live",
      severity: 4,
      dueDay: day,
    },
  ]);
}

/** The block itself: no appointment, no plan, just the streets they live on. */
async function seedWalkTheBlock(campaignId: string, day: number): Promise<void> {
  await upsertSituations(campaignId, [
    {
      situationKey: situationKey("walk_the_block"),
      category: "opportunity",
      title: "Your own streets, at your own pace",
      summary:
        "Nobody is expecting you anywhere. Whatever is happening out there is happening whether you watch it or not.",
      status: "live",
      severity: 2,
      dueDay: day,
    },
  ]);
}

/** The rent, the debt, the thing that has been sitting there. */
async function seedHandleBusiness(campaignId: string, day: number): Promise<void> {
  await upsertSituations(campaignId, [
    {
      situationKey: situationKey("handle_business"),
      category: "need",
      title: "Your own house, first",
      summary:
        "What you owe does not care what kind of night you were planning. Settle it, or decide not to.",
      status: "live",
      severity: 3,
      dueDay: day,
    },
  ]);
}

/**
 * Take a door.
 *
 * The engine owns every line of this. The model chose none of it and could not
 * have: the door ids are a closed vocabulary, and a response naming anything
 * else never reaches here.
 */
export async function chooseOpening(bundle: OpeningBundle, choice: OpeningChoice): Promise<void> {
  const campaignId = bundle.campaign.id;
  const day = bundle.campaign.day ?? 0;

  switch (choice) {
    case "take_work":
      await offerFirstJob(campaignId, bundle.campaign);
      break;
    case "see_someone":
      await seedSeeSomeone(campaignId, bundle.cast, day);
      break;
    case "walk_the_block":
      await seedWalkTheBlock(campaignId, day);
      break;
    case "handle_business":
      await seedHandleBusiness(campaignId, day);
      break;
  }

  // Written LAST, so a failure above leaves the opening un-taken and retryable
  // rather than recording a choice whose consequence never landed.
  await setCampaignFlag(campaignId, OPENING_FLAG, choice as unknown as Json);
}

/** The mission id the first door would offer, for anything that needs to know. */
export function openingJobId(): string {
  return openingJob().id;
}
