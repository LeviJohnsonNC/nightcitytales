/**
 * Pure glue between persisted rows and the LIFE engine's data shapes. No
 * network, no React: everything here is a translation or a derivation, so the
 * Life loop can be reasoned about (and tested) without a campaign in the cloud.
 */
import {
  DEFAULT_START,
  clampSeverity,
  hauntsFor,
  derivePlaceBeats,
  deriveNeeds,
  phaseOf,
  resolvePosition,
  type GamePhase,
  type LifeClock,
  type LifeSituation,
  type LifeStateInput,
} from "@/engine";
import {
  getDistrict,
  isGuarded,
  nearestWithTag,
  publicView,
  resolveDestination,
  tagNamed,
  tagsMentioned,
  type NearbyPlace,
  type PlaceTag,
} from "@/engine";
import { PACKET_BUDGET } from "@/features/narration/packetBudget";
import type { LifeActionCard } from "./lifeResponse";
import { downtimeView } from "@/features/downtime/downtimeModel";
import { castMemberFrom, guardednessOf, knownFactsOf } from "@/features/campaign/castSeeding";
import type { HauntPerson, PlaceState } from "@/engine";
import type {
  Campaign,
  CampaignClock,
  CampaignEvent,
  CampaignInventoryItem,
  CampaignNpc,
  CampaignSituation,
  CampaignVitals,
  FullCharacter,
} from "@/lib/backend";
import type { SituationUpsert } from "@/lib/backend";
import type { LifePersonSummary } from "./lifeContext";

/** Read a persisted situation row back into the engine's shape. */
export function situationFromRow(row: CampaignSituation): LifeSituation {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    key: row.situation_key,
    category: row.category as LifeSituation["category"],
    title: row.title,
    summary: row.summary ?? "",
    status: row.status as LifeSituation["status"],
    severity: clampSeverity(row.severity),
    ...(row.npc_key ? { npcKey: row.npc_key } : {}),
    ...(row.due_day !== null ? { dueDay: row.due_day } : {}),
    ...(row.last_shown_day !== null ? { lastShownDay: row.last_shown_day } : {}),
    data,
  };
}

/** And back again, for persistence. */
export function situationToUpsert(situation: LifeSituation): SituationUpsert {
  return {
    situationKey: situation.key,
    category: situation.category,
    title: situation.title,
    summary: situation.summary,
    npcKey: situation.npcKey ?? null,
    status: situation.status,
    severity: situation.severity,
    dueDay: situation.dueDay ?? null,
    lastShownDay: situation.lastShownDay ?? null,
    data: (situation.data ?? {}) as unknown as NonNullable<SituationUpsert["data"]>,
  };
}

export function clockFromRow(row: CampaignClock): LifeClock {
  return {
    key: row.clock_key,
    label: row.label,
    filled: row.filled,
    segments: row.segments,
    hidden: row.hidden,
  };
}

/** The day an NPC was last dealt with, if the campaign recorded one. */
function lastSeenDay(npc: CampaignNpc): number | undefined {
  const data = (npc.data ?? {}) as { lastSeenDay?: unknown };
  return typeof data.lastSeenDay === "number" ? data.lastSeenDay : undefined;
}

/**
 * Recurring faces, as both the engine and the prompt want them.
 *
 * The standing cast contributes its PUBLIC half only: who this person is to the
 * character, what the Lifepath said about them, and whichever rungs of their
 * dossier the player has actually earned. What they want, fear and are hiding
 * stays with the engine until it is learned (see engine/cast.ts).
 */
export function lifePeople(npcs: CampaignNpc[], today: number): LifePersonSummary[] {
  return npcs
    .filter((n) => n.status !== "dead")
    .map((n) => {
      const seen = lastSeenDay(n);
      const member = castMemberFrom(n);
      // Read off the row, not off the cast: anybody can be worked, and somebody
      // who has closed up should play that way whether or not they are one of
      // the six with a dossier.
      const guarded = isGuarded(guardednessOf(n, today));
      const view = member ? publicView(member, knownFactsOf(n), guarded) : null;
      return {
        key: n.npc_id ?? n.name,
        name: n.name,
        disposition: n.disposition,
        status: n.status,
        ...(seen !== undefined ? { lastSeenDay: seen } : {}),
        ...(n.notes ? { notes: n.notes } : {}),
        ...(guarded ? { guarded: true } : {}),
        ...(view
          ? {
              role: view.role,
              standing: view.standing,
              ...(view.tie ? { tie: view.tie } : {}),
              ...(view.known.length ? { known: view.known } : {}),
            }
          : {}),
      };
    });
}

/** Weapons in the kit that have nothing chambered, and those that are broken. */
function weaponStates(inventory: CampaignInventoryItem[]): {
  empty: string[];
  broken: string[];
} {
  const empty: string[] = [];
  const broken: string[] = [];
  for (const row of inventory) {
    if (row.kind !== "gear" && row.kind !== "weapon") continue;
    const name = row.item_id.replace(/_/g, " ");
    if (row.condition === "broken") broken.push(name);
    else if (row.ammo_loaded === 0) empty.push(name);
  }
  return { empty, broken };
}

export type LifeBundleInput = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
  npcs: CampaignNpc[];
  /**
   * What has happened to the places this campaign has touched. Sparse — an
   * absent entry is a place at its authored starting condition — and passed
   * through so a beat can stop firing somewhere it no longer belongs.
   */
  places?: Record<string, PlaceState> | undefined;
};

/**
 * Everything the Life engine needs to know about the world right now. Every
 * mechanical number (bills, repair costs, HP) comes from the existing engine
 * modules through downtimeView — none is invented here.
 */
export function buildLifeState(input: LifeBundleInput): Omit<LifeStateInput, "people"> {
  const view = downtimeView({
    campaign: input.campaign,
    vitals: input.vitals,
    character: input.character,
    inventory: input.inventory,
    restDays: 0,
  });
  const { empty, broken } = weaponStates(input.inventory);
  return {
    day: view.day,
    eurobucks: view.eurobucks,
    hpCurrent: view.hpCurrent,
    hpMax: view.hpMax,
    woundState: input.vitals.wound_state,
    humanityCurrent: input.vitals.humanity_current,
    humanityMax: input.vitals.humanity_max,
    billsOwed: view.bills.total,
    billsDueDay: view.paidThrough + view.daysToNextBill,
    damagedArmor: view.repairs.map((r) => ({
      name: r.name,
      missingSp: r.missingSp,
      cost: r.cost,
    })),
    emptyWeapons: empty,
    brokenWeapons: broken,
  };
}

/**
 * Candidate situations for this exact state. Deterministic.
 *
 * Two sources, folded together: what is true of the CHARACTER (money, wounds,
 * kit, people they have not dealt with) and what is true of the GROUND they are
 * standing on. Both go into the same funnel and are scored against each other,
 * so a night market competes with the rent and usually loses.
 */
export function derivedSituations(input: LifeBundleInput): LifeSituation[] {
  const state = buildLifeState(input);
  const needs = deriveNeeds({ ...state, people: lifePeople(input.npcs, input.campaign.day) });
  const position = resolvePosition(input.campaign.location_key ?? DEFAULT_START);
  if (!position) return needs;
  return [
    ...needs,
    ...derivePlaceBeats({
      districtKey: position.districtKey,
      placeKey: position.placeKey,
      day: input.campaign.day,
      minute: input.campaign.minute,
      // A night market runs while the place is still a market. Bring the law
      // down on it enough times and this is what stops the beat.
      places: input.places,
      // Per campaign, so two players in the same district are not handed the
      // same week.
      seed: input.campaign.id,
    }),
  ];
}

/**
 * The last few things that happened, for continuity in the prompt — including
 * what the player said.
 *
 * The player's own lines used to be left out, so the narrator saw six turns of
 * its own prose and never the words it was answering. "Go there" had nothing to
 * point at except whatever the narrator had last chosen to write, and a request
 * that was only half done could not be seen to be half done. `limit` bounds the
 * world's lines; the player's are interleaved where they fell, and bounded
 * separately so a burst of typing cannot push the fiction out of the window.
 */
export function recentLifeLines(
  events: CampaignEvent[],
  limit = 6,
  playerLimit: number = PACKET_BUDGET.playerLines,
): string[] {
  const interesting = new Set([
    "life_narration",
    "life_action",
    // A refusal is part of what happened. Leaving it out let the model propose
    // the same impossible thing again next turn, having never been told.
    "action_refused",
    "travelled",
    "skill_check",
    "mission_completed",
    "campaign_ended",
    "hook_offered",
    "hook_declined",
    "cast_approached",
  ]);
  const out: string[] = [];
  let world = 0;
  let player = 0;
  for (let i = events.length - 1; i >= 0 && world < limit; i -= 1) {
    const e = events[i]!;
    if (!e.summary) continue;
    if (e.type === "player_input") {
      if (player >= playerLimit) continue;
      player += 1;
      out.push(`The player said: "${e.summary}"`);
    } else if (interesting.has(e.type)) {
      world += 1;
      out.push(e.summary);
    }
  }
  return out.reverse();
}

/**
 * Which real place answers a trip to a KIND of place.
 *
 * Asked for directly (`seek`), named as a kind in the destination ("a bar",
 * "the cellar bar down the alley"), or — only when what the narrator proposed
 * resolves to nothing at all — read
 * out of the player's own words, and only when those name exactly one kind.
 * Guessing between two would be choosing for them.
 */
export function kindOfTrip(
  action: {
    seek?: string | undefined;
    destination?: string | undefined;
    direction?: string | undefined;
  },
  said: string | undefined,
): PlaceTag | undefined {
  if (action.seek) return action.seek;
  if (action.destination && resolveDestination(action.destination)) return undefined;
  const named = tagNamed(action.destination);
  if (named) return named;
  // A place the narrator described but the map has never heard of — "the
  // cellar bar three alleys down" — is still, recognisably, a bar.
  const described = tagsMentioned(action.destination);
  if (described.length === 1) return described[0];
  if (action.direction && !action.destination) return undefined;
  const mentioned = tagsMentioned(said);
  return mentioned.length === 1 ? mentioned[0] : undefined;
}

/**
 * The everyday kinds of place the narrator is told the nearest of.
 *
 * What people go out for on an ordinary evening. A fence or a ripperdoc is not
 * on it: where those are is something a character has to know, and the
 * standing cast already carries a ripperdoc.
 */
const EVERYDAY_KINDS: PlaceTag[] = ["bar", "food", "club", "shop", "market", "clinic", "hotel"];

/**
 * Somewhere real to go, for a trip the engine could not place.
 *
 * Asked for a kind, the nearest few of that kind. Asked for nothing it could
 * read — "go there", when "there" was never on the map — the nearest place of
 * each everyday kind, one per place, so the player has something to press
 * rather than a refusal. `limit` places at most.
 */
export function placesToOffer(
  from: string,
  kind: PlaceTag | undefined,
  known: readonly string[],
  limit = 3,
): { place: NearbyPlace; kind: PlaceTag }[] {
  if (kind) return nearestWithTag(from, kind, { known, limit }).map((place) => ({ place, kind }));
  const here = resolvePosition(from)?.placeKey;
  const out: { place: NearbyPlace; kind: PlaceTag }[] = [];
  for (const each of EVERYDAY_KINDS) {
    if (out.length >= limit) break;
    const [place] = nearestWithTag(from, each, { known, limit: 1 });
    if (!place || place.key === here || out.some((o) => o.place.key === place.key)) continue;
    out.push({ place, kind: each });
  }
  return out;
}

/** "bar: Forlorn Hope, Little China — 14 min on foot" for each everyday kind. */
export function nearestByKindLines(from: string, known: readonly string[]): string[] {
  const out: string[] = [];
  for (const kind of EVERYDAY_KINDS) {
    const [nearest] = nearestWithTag(from, kind, { known, limit: 1 });
    if (!nearest) continue;
    const district = getDistrict(nearest.districtKey)?.name ?? nearest.districtKey;
    const here = resolvePosition(from)?.placeKey === nearest.key;
    out.push(
      here
        ? `${kind}: ${nearest.name} — where they are standing`
        : `${kind}: ${nearest.name}, ${district} — ${nearest.minutes} min on foot`,
    );
  }
  return out;
}

/**
 * What the engine actually did with a turn, as opposed to what the model wrote.
 * The two can differ — the model proposes a move and the engine picks the
 * destination — and where they do, the fiction has to be told.
 */
export type TurnOutcome = {
  /** Where the engine can offer to take them instead, when a trip was refused. */
  travelChoices?: LifeActionCard[];
  travelled?: {
    from: string;
    to: string;
    minutes: number;
    direction?: string;
    stoppedAt?: "water" | "edge" | "arrived";
    mode: string;
    /** How far the trip covered, in city blocks, when it was a walk along a heading. */
    blocks?: number;
    /** Bridges the route crossed, by name, in order. */
    bridges?: string[];
  };
  travelRefused?: string;
};

/** What to tell the narrator about a move the engine has already committed. */
export function describeTravelOutcome(outcome: TurnOutcome): string | undefined {
  if (outcome.travelRefused) {
    return (
      `The trip could not be worked out: ${outcome.travelRefused} The character is exactly ` +
      "where they were, and nothing went wrong for them. Say in a sentence where they are " +
      "standing, still thinking about where to go. Do NOT walk them back anywhere, do not have " +
      "them give up, and do not describe them arriving anywhere." +
      (outcome.travelChoices?.length
        ? " The interface is offering them the nearest real places to go; do not list them."
        : "")
    );
  }
  const trip = outcome.travelled;
  if (!trip) return undefined;
  const far = trip.blocks ? `${trip.blocks} block${trip.blocks === 1 ? "" : "s"}` : undefined;
  if (trip.stoppedAt === "water" || trip.stoppedAt === "edge") {
    const edge =
      trip.stoppedAt === "water"
        ? "the waterfront, with nothing but water beyond it"
        : "the edge of the city, where the streets give out";
    return (
      `The character went ${trip.direction ? `${trip.direction} ` : ""}${trip.mode} as far as ` +
      `that way goes${far ? ` — ${far}` : ""} and came up against ${edge}. It took ` +
      `${trip.minutes} minutes and they are now at ${trip.to}, which is a different spot from ` +
      "where they set off even if it is the same district. Narrate reaching that edge in two or " +
      "three sentences: what is in front of them, what is behind. Do not send them onwards."
    );
  }
  const crossing = trip.bridges?.length
    ? ` The way there crossed ${trip.bridges.join(", then ")}, so that is on the route and ` +
      "worth a line."
    : "";
  return (
    `The character has ARRIVED. They travelled ${trip.direction ? `${trip.direction} ` : ""}` +
    `${far ? `${far} ` : ""}from ${trip.from} to ${trip.to} ${trip.mode}, and it took ` +
    `${trip.minutes} minutes.` +
    `${crossing} That destination, that heading and how they got there are facts — the engine ` +
    "chose them, not you. Narrate the arrival in two or three sentences: where they are standing " +
    "now, what is in front of them. Do not name a different place, do not contradict the " +
    "heading, and do not send them anywhere else."
  );
}

/** The phase the campaign is in right now, defaulting to Life. */
export function campaignPhase(campaign: Campaign): GamePhase {
  return phaseOf((campaign as { phase?: unknown }).phase);
}

/**
 * The standing cast as people who are somewhere, for the haunt lookup.
 *
 * Their places are DERIVED rather than stored: the same campaign always draws
 * the same haunts, so nothing has to be written down, nothing can drift out of
 * step with the atlas, and no campaign started before this existed is missing a
 * column. `campaign_npcs.location` is left alone deliberately — a second answer
 * to where somebody is would be a second source of truth.
 *
 * Rows are deduplicated by npc id on the way through. `campaign_npcs` has no
 * uniqueness constraint on (campaign_id, npc_id), and a duplicated row would
 * otherwise put one person in two places at once, which is exactly the kind of
 * thing that reads as a ghost rather than as a bug.
 */
export function hauntPeople(
  npcs: CampaignNpc[],
  campaign: Campaign,
  /**
   * The district the character lives in. `hauntsFor` puts people in the part of
   * town the character lives in — "a cast you can only meet by crossing the
   * city is a cast you never meet" — and it was being handed `DEFAULT_START`,
   * so every campaign's cast kept their bars in Little Europe no matter where
   * the character had actually moved in. Omitted, it falls back to that same
   * default rather than leaving somebody nowhere.
   */
  homeDistrictKey?: string | null,
): HauntPerson[] {
  const seen = new Set<string>();
  const out: HauntPerson[] = [];
  for (const npc of npcs) {
    if (npc.status === "dead") continue;
    const member = castMemberFrom(npc);
    if (!member) continue;
    const key = npc.npc_id ?? npc.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      name: npc.name,
      role: member.role,
      // Home is where the character actually lives, which is where they should
      // be able to run into people.
      haunts: hauntsFor(member.role, homeDistrictKey || DEFAULT_START, campaign.id),
    });
  }
  return out;
}
