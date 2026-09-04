/**
 * The offer, and the job behind it.
 *
 * A job is generated BEFORE it is offered, and the offer is read off it. That
 * ordering is the whole point of this module: the fixer's pitch, the fee on the
 * table and the beat graph the player will actually walk are three views of one
 * generated mission, so they cannot drift apart. Accepting does not roll a job;
 * it starts the one that was quoted.
 *
 * Pure translation between persisted rows and engine shapes. No network, no
 * React, no dice.
 */
import {
  generateJob,
  getMission,
  placeIntel,
  jobIdForSeed,
  rollJobSeed,
  missionOffer,
  missionPayout,
  startingTerms,
  type CastMember,
  type HookAsk,
  type HookTerms,
  type LifeSituation,
  type Mission,
  type MissionOffer,
} from "@/engine";
import type { PlaceState, RNG } from "@/engine";
import type { CampaignEvent, CampaignFlag, Json } from "@/lib/backend";
import type { SituationUpsert } from "@/lib/backend";
import type { LifeWireOffer } from "./lifeContext";

/**
 * The campaign flag holding the seed of the job that is next on the wire.
 * Stored rather than re-rolled so the same work is waiting across a reload: a
 * job that evaporates because the page refreshed is not a job.
 */
export const NEXT_JOB_SEED_FLAG = "next_job_seed";

/**
 * The flag carrying a fee the player argued upwards, read back when the job is
 * settled. It is written on accept rather than on the handshake so a negotiated
 * number cannot outlive the offer it was negotiated for.
 */
export const JOB_PAYOUT_FLAG = "current_job_payout";

/** An offer on the table, with the job it will actually start. */
export type LifeHook = {
  situationKey: string;
  missionId: string;
  mission: Mission;
  offer: MissionOffer;
  terms: HookTerms;
};

/** What a hook situation stores. Everything else is re-derived from the mission. */
type HookData = {
  missionId?: unknown;
  basePayout?: unknown;
  payout?: unknown;
  asked?: unknown;
  learned?: unknown;
  /** The cast member who brought it, when someone the player knows did. */
  brokerKey?: unknown;
  brokerName?: unknown;
  brokerLine?: unknown;
};

function asks(raw: unknown): HookAsk[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is HookAsk =>
    ["pay", "patron", "risk"].includes(value as string),
  );
}

function int(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : fallback;
}

/** The printed total for a job, before anybody argued about it. */
export function printedPayout(mission: Mission): number {
  return missionPayout(mission)?.total ?? 0;
}

/**
 * Read a live hook situation back into an offer. Null when the row predates
 * offer-time generation and has no mission behind it: the caller upgrades those
 * rather than guessing at what job was meant.
 */
export function hookFromSituation(situation: LifeSituation): LifeHook | null {
  const data = (situation.data ?? {}) as HookData;
  const missionId = typeof data.missionId === "string" ? data.missionId : null;
  if (!missionId) return null;

  let mission: Mission;
  try {
    mission = getMission(missionId);
  } catch {
    return null;
  }
  const basePayout = int(data.basePayout, printedPayout(mission));
  // The broker is stored rather than re-derived: the person who made the offer
  // has to still be the person you are arguing with two turns later.
  const stored =
    typeof data.brokerKey === "string" && typeof data.brokerName === "string"
      ? {
          key: data.brokerKey,
          name: data.brokerName,
          standing: typeof data.brokerLine === "string" ? data.brokerLine : "",
        }
      : null;
  const offer = missionOffer(mission);
  return {
    situationKey: situation.key,
    missionId,
    mission,
    offer: stored
      ? { ...offer, brokerKey: stored.key, brokerName: stored.name, brokerLine: stored.standing }
      : offer,
    terms: {
      basePayout,
      payout: int(data.payout, basePayout),
      asked: asks(data.asked),
      learned: asks(data.learned),
    },
  };
}

/** The live hook on a campaign's books, if there is one. */
export function liveHookSituation(situations: LifeSituation[]): LifeSituation | null {
  return situations.find((s) => s.category === "hook" && s.status === "live") ?? null;
}

/** The row a hook is persisted as. The mission id is the load-bearing field. */
export function hookUpsert(
  situationKey: string,
  mission: Mission,
  offer: MissionOffer,
  terms: HookTerms,
): SituationUpsert {
  return {
    situationKey,
    category: "hook",
    title: mission.title,
    summary: offer.pitch,
    npcKey: offer.brokerKey,
    status: "live",
    severity: 3,
    data: {
      missionId: mission.id,
      basePayout: terms.basePayout,
      payout: terms.payout,
      asked: terms.asked,
      learned: terms.learned,
      brokerKey: offer.brokerKey,
      brokerName: offer.brokerName,
      brokerLine: offer.brokerLine,
    } as unknown as Json,
  };
}

/**
 * A stable key for one broker offering one job. Keyed by the mission rather than
 * the day so an offer turned down never has its record overwritten by the next
 * call from the same fixer.
 */
export function hookKeyFor(offer: MissionOffer, missionId: string): string {
  return `hook_${offer.brokerKey}_${missionId}`;
}

// ---------------------------------------------------------------------------
// The job waiting on the wire.
// ---------------------------------------------------------------------------

/** The seed of the job currently on the wire, or null when none is stored. */
export function nextJobSeedFrom(flags: CampaignFlag[]): number | null {
  const row = flags.find((f) => f.flag === NEXT_JOB_SEED_FLAG);
  const value = row?.value;
  if (typeof value === "number" && Number.isFinite(value)) return value >>> 0;
  return null;
}

/**
 * Who is actually bringing this job.
 *
 * A generated job comes with a fixer from its own content pool, which is fine
 * for a campaign with nobody in it. A campaign with a standing cast has a fixer
 * already: the one whose number the character has, who keeps their disposition
 * and their history. That person brings the work instead, so jobs arrive from
 * someone the player knows rather than from a new name every time.
 *
 * Only the voice on the phone changes. The job, the client and what is waiting
 * are the mission's, untouched.
 */
export function offerThrough(offer: MissionOffer, broker: CastMember | null): MissionOffer {
  if (!broker) return offer;
  return {
    ...offer,
    brokerName: broker.name,
    brokerKey: broker.key,
    brokerLine: broker.standing,
  };
}

/** The public half of the job a seed names: what a broker would say out loud. */
export function wireOfferFor(
  seed: number,
  broker: CastMember | null = null,
  places: Record<string, PlaceState> = {},
): { missionId: string; wire: LifeWireOffer } {
  const missionId = jobIdForSeed(seed);
  const mission = getMission(missionId);
  const offer = offerThrough(missionOffer(mission), broker);
  // What the character already knows about the building, because they have
  // been there. Absent for somewhere they have never set foot, which is the
  // honest answer rather than an empty readout.
  const intel = offer.placeKey ? placeIntel(offer.placeKey, places[offer.placeKey]) : null;
  return {
    missionId,
    wire: {
      title: mission.title,
      brokerName: offer.brokerName,
      brokerKey: offer.brokerKey,
      brokerLine: offer.brokerLine,
      district: offer.district,
      ...(offer.placeName ? { placeName: offer.placeName } : {}),
      ...(intel?.known.length ? { familiar: intel.known } : {}),
      pitch: offer.pitch,
      ask: offer.ask,
      payout: printedPayout(mission),
    },
  };
}

/** A fresh offer, at its printed terms. */
export function offerTerms(mission: Mission): HookTerms {
  return startingTerms(printedPayout(mission));
}

// ---------------------------------------------------------------------------
// Negotiation prompts, tagged on the way out and read on the way back.
// ---------------------------------------------------------------------------

export type HookAskTag = { ask: HookAsk; situationKey: string };

/** The negotiation a check prompt belongs to, or null for an ordinary check. */
export function askTagFrom(event: CampaignEvent | undefined): HookAskTag | null {
  const data = (event?.data ?? {}) as { negotiation?: unknown };
  const tag = data.negotiation as { ask?: unknown; situationKey?: unknown } | undefined;
  if (!tag || typeof tag !== "object") return null;
  const ask = tag.ask;
  const situationKey = tag.situationKey;
  if (typeof situationKey !== "string") return null;
  if (ask !== "pay" && ask !== "patron" && ask !== "risk") return null;
  return { ask, situationKey };
}

/**
 * How many candidate seeds to look at before settling on one.
 *
 * The wire prefers work on ground the character knows, because "the target is
 * holed up in Coronado Heights" only lands if they have been to Coronado
 * Heights. This is done by CHOOSING AMONG SEEDS rather than by steering the
 * generator: every draw inside generateJob is deterministic from its seed, and
 * biasing the district there would change every job every stored id names.
 */
export const SEED_CANDIDATES = 6;

/**
 * Draw a seed for the next job, preferring one whose work lands somewhere the
 * character has been.
 *
 * Falls through to the first candidate when nothing matches, which is the
 * common case early on: a character who has been nowhere gets work anywhere,
 * and the city opens up as they do.
 */
export function pickJobSeed(knownDistricts: Set<string>, rng: RNG = Math.random): number {
  const seeds = Array.from({ length: SEED_CANDIDATES }, () => rollJobSeed(rng));
  if (!knownDistricts.size) return seeds[0]!;
  const familiar = seeds.find((seed) => {
    const district = generateJob(seed).offer?.districtKey;
    return district ? knownDistricts.has(district) : false;
  });
  return familiar ?? seeds[0]!;
}
