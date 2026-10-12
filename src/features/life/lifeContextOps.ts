/**
 * The Life narrator's packet: what a turn tells the model about where the
 * character stands, who is there and what is on the table. Split out of
 * lifeOps.ts. No React and no TanStack Query in here.
 */

import {
  knownTerms,
  directionName,
  neighboursOf,
  streetsIn,
  DEFAULT_START,
  areaOf,
  describePosition,
  districtProfile,
  placeActions,
  placeFamiliarity,
  deductionOffer,
  knownTruths,
  truthsAt,
  whoIsAt,
  comesOver,
  type PlaceState,
  getDistrict,
  getPlace,
  isCombatZone,
  resolvePosition,
  reachableDestinations,
  shopsAt,
  regularOf,
  tagsOf,
} from "@/engine";
import type { CampaignEvent } from "@/lib/backend";
import { characterSummary, localExpertIn, gmSkillList } from "@/features/play/playModel";
import { buildCapabilitySnapshot, renderCapabilityLines } from "@/features/play/capabilityModel";
import { dossierForPrompt } from "@/features/atlas/placeDossiers";
import { PACKET_BUDGET, withinBudget } from "@/features/narration/packetBudget";
import type { LifeContext } from "./lifeContext";
import { counterNews } from "./counterNews";
import { keeperNamed } from "@/features/cast/npcLooks";
import { alsoHereAt } from "./alsoHere";
import { appearsAsProp } from "@/features/campaign/castSeeding";
import { chronicleFor } from "@/features/campaign/chronicleModel";
import { arcTellFor } from "@/features/campaign/arcs";
import { reputationProp } from "@/features/campaign/recognition";
import { homeLine } from "@/features/campaign/home";
import { pressureLines, standingLines } from "@/features/campaign/pressure";
import { lifePeople, nearestByKindLines, recentLifeLines, hauntPeople } from "./lifeModel";
import {
  type LifeBundle,
  type TurnOptions,
  knownPlacesOf,
  knownVenueKeysOf,
} from "./lifeBundleOps";

/** What a seller's kinds are called in the narrator's packet. */
const SELLER_DEALS: Record<string, string> = {
  weapon: "weapons",
  armor: "armor",
  ammunition: "ammunition",
  gear: "gear",
  cyberware: "cyberware",
};

/** Everywhere the campaign has recorded standing, as stored location keys. */
/**
 * How a district's money and traffic are put to the narrator.
 *
 * Words rather than the engine's own levels, because "poor" in a prompt reads
 * as an instruction to write squalor. What is wanted is the texture: what is on
 * the street, not a verdict on the people living there.
 */
const WEALTH_WORDS: Record<string, string> = {
  poor: "little money about, and what there is is spent carefully",
  mixed: "some money about, unevenly",
  rich: "money everywhere, and it shows",
};

const CROWD_WORDS: Record<string, string> = {
  empty: "hardly anybody around",
  steady: "people about, going somewhere",
  busy: "crowded, at most hours",
};

/** Whether this person has already come over to the character today. */
function approachedToday(events: readonly CampaignEvent[], npcKey: string, day: number): boolean {
  return events.some((e) => {
    if (e.type !== "cast_approached") return false;
    const data = e.data as { npcKey?: unknown; day?: unknown } | null;
    return data?.npcKey === npcKey && data.day === day;
  });
}

/** The context slice the Life model reasons over. Deterministic and small. */
/** The shape both prompt builders take, without the optionality. */
type PlaceFamiliaritySlice = {
  visits: number;
  standing: "first" | "returning" | "known";
  since: string;
  /** Already established this visit: they have been here since an earlier turn today. */
  stillHere?: boolean;
  known: string[];
  /** The part of `known` that being a local accounts for, not having been here. */
  asALocal: string[];
  localExpert?: { level: number; districtName: string };
  regular?: boolean;
};

/**
 * How long it has been, in words, so no renderer does arithmetic on days.
 *
 * A visit is recorded on arrival, so the turn that describes a place almost
 * always sees a gap of nothing. That reads as no gap at all rather than as
 * "zero days ago".
 */
export function sinceWords(daysSince: number | null): string {
  if (daysSince === null || daysSince <= 0) return "";
  if (daysSince === 1) return ", last here yesterday";
  if (daysSince < 14) return `, last here ${daysSince} days ago`;
  if (daysSince < 60) return ", not here in weeks";
  return ", not here in months";
}

/**
 * What the narrator should know about how familiar the ground under them is.
 *
 * `localExpertLevel` is how much of a local the character is in this district,
 * which opens rungs of the same ladder visits open — so a local knows a
 * building on their own street they have never walked into.
 */
function familiarityFor(
  placeKey: string | null | undefined,
  places: Record<string, PlaceState>,
  day: number,
  localExpertLevel = 0,
  stillHere = false,
): { familiarity: PlaceFamiliaritySlice } | Record<string, never> {
  if (!placeKey) return {};
  const read = placeFamiliarity(placeKey, places[placeKey], day, localExpertLevel);
  if (!read) return {};
  // Their regular of any kind this place is: the bar they drink at, the counter
  // they eat at. Recognition, not a discount.
  const regular = tagsOf(placeKey).some((tag) => regularOf(tag, places) === placeKey);
  return {
    familiarity: {
      ...(regular ? { regular: true } : {}),
      ...(stillHere ? { stillHere: true } : {}),
      visits: read.visits,
      standing: read.standing,
      since: sinceWords(read.daysSince),
      known: read.known,
      asALocal: read.asALocal,
      ...(read.localExpert ? { localExpert: read.localExpert } : {}),
    },
  };
}

/** The atlas's own line about a venue, when it is standing in one. */
function placeBlurb(placeKey: string): { blurb?: string } {
  const blurb = getPlace(placeKey)?.blurb?.trim();
  return blurb ? { blurb } : {};
}

export function buildContext(bundle: LifeBundle, turn: TurnOptions = {}): LifeContext {
  // Resolved before the character summary, because a place-scoped Skill is only
  // worth its Level in one neighbourhood and the summary has to say which.
  const position = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
  const standingDistrictKey = position?.districtKey ?? null;
  const summary = characterSummary(
    bundle.character,
    bundle.vitals,
    bundle.inventory,
    standingDistrictKey,
  );
  const capability = buildCapabilitySnapshot({
    character: bundle.character,
    vitals: bundle.vitals,
    inventory: bundle.inventory,
    cyberware: bundle.cyberware,
    roleState: bundle.campaign.role_state,
    encounter: null,
    events: bundle.events,
    beatId: null,
  });

  const positionDistrict = position ? getDistrict(position.districtKey) : undefined;
  // What the streets around them are like, and who turns up if they are loud
  // on them. Read off the atlas's own security provider by the engine; the
  // model is told the consequence, never asked to imagine it.
  const profile = positionDistrict ? districtProfile(positionDistrict.key) : undefined;

  return {
    clock: bundle.clock,
    place: positionDistrict
      ? {
          where: describePosition(bundle.campaign.location_key ?? DEFAULT_START),
          district: positionDistrict.name,
          area: areaOf(positionDistrict.key)?.name ?? "Night City",
          security: positionDistrict.security,
          gangs: positionDistrict.gangs,
          combatZone: isCombatZone(positionDistrict.key),
          ...(profile
            ? {
                response: `${profile.response.who}, ${profile.response.label}`,
                character: `${WEALTH_WORDS[profile.wealth]}, ${CROWD_WORDS[profile.crowd]}`,
              }
            : {}),
          // What the atlas prints about this exact address, and what has been
          // written about it. Without these the narrator knows the venue's name
          // and its tags and nothing else, and invents the rest from the
          // district — which is how a visit to an automated sushi place with a
          // virtual mascot produced a griddle counter with a human line cook.
          ...(position?.placeKey ? placeBlurb(position.placeKey) : {}),
          ...(() => {
            const written = dossierForPrompt(position?.placeKey, positionDistrict.key);
            return written ? { dossier: written.text } : {};
          })(),
          // How often they have stood here. The engine has counted every
          // arrival since the campaign began and nothing has ever read it back,
          // so every visit was written as a first visit.
          ...familiarityFor(
            position?.placeKey,
            bundle.places,
            bundle.clock.day,
            localExpertIn(bundle.character, standingDistrictKey),
            bundle.stillHere,
          ),
          // What they have SEARCHED OUT here, which is a different thing from
          // what they know by being familiar with it. Only the found ones: the
          // rest are never sent, so the model cannot telegraph them.
          ...(position?.placeKey
            ? (() => {
                const discovered = bundle.truthsAvailable ? bundle.discoveredTruths : [];
                const truths = truthsAt(position.placeKey, bundle.places[position.placeKey]);
                const found = knownTruths(truths, discovered).map((truth) => truth.fact);
                // And whether what they have found here adds up to something
                // they have not said out loud. THAT and the number only: the
                // pieces were earned, so the offer is a pay-off, not a hint.
                const offer = deductionOffer(truths, discovered);
                return {
                  ...(found.length ? { discovered: found } : {}),
                  ...(offer ? { deduction: offer } : {}),
                };
              })()
            : {}),
          // Presence, not a summons. Only ever asked about a venue: a district
          // is not somewhere you run into somebody.
          ...(position?.placeKey
            ? (() => {
                const met = whoIsAt({
                  placeKey: position.placeKey,
                  people: hauntPeople(
                    bundle.npcs,
                    bundle.campaign,
                    bundle.character.finance?.home_district_key,
                    bundle.places,
                  ),
                  day: bundle.clock.day,
                  minute: bundle.clock.minute,
                  seed: bundle.campaign.id,
                });
                if (!met) return {};
                // Whether they come over is the engine's roll, once an evening:
                // after they have, the next turn is told they already did.
                const cameOver = approachedToday(bundle.events, met.key, bundle.clock.day);
                const npc = bundle.npcs.find((n) => (n.npc_id ?? n.name) === met.key);
                const comingOver =
                  !cameOver &&
                  !turn.options &&
                  !turn.fixedResult &&
                  comesOver({
                    person: met,
                    disposition: npc?.disposition ?? 0,
                    placeKey: position.placeKey,
                    day: bundle.clock.day,
                    minute: bundle.clock.minute,
                    seed: bundle.campaign.id,
                  });
                // What their own story looks like from across the room.
                const tell = arcTellFor(npc, bundle.campaign.id);
                return {
                  whoIsHere: {
                    name: met.name,
                    key: met.key,
                    ...(comingOver ? { comingOver: true } : {}),
                    ...(cameOver ? { cameOver: true } : {}),
                    ...(tell ? { tell } : {}),
                  },
                };
              })()
            : {}),
          // What the ground supports, as the character would find it: a local
          // is told about the quiet doors of their own neighbourhood and a
          // stranger is not, so the narrator cannot offer a newcomer a fence
          // they would have no way of knowing about.
          // Business only, never the ways of LOOKING. Those are cards for the
          // player; the narrator has no use for being told the player has a
          // search button, and letting them into this list would cost the
          // ground two of the things it actually offers.
          // Who sells where they stand, so "what have you got?" is answered by
          // the Counter rather than by a stall the narrator made up. Names and
          // what they deal in only: what is on the shelf is never sent.
          alsoHere: alsoHereAt(bundle.campaign.id, bundle.campaign.location_key ?? DEFAULT_START)
            .lines,
          sellers: shopsAt(position?.placeKey).map(
            (v) =>
              `${v.label} (deals in ${v.deals.map((k) => SELLER_DEALS[k] ?? k).join(", ")})` +
              (v.keeper ? `, run by ${keeperNamed(v.keeper)}: ${v.keeper.who}` : ""),
          ),
          business: placeActions({
            districtKey: positionDistrict.key,
            placeKey: position?.placeKey,
            places: bundle.places,
            localExpertLevel: localExpertIn(bundle.character, positionDistrict.key),
            roleId: bundle.character.character.role,
          })
            .filter((a) => !a.skillId)
            // The price, when the engine has one. It is what lets "order a
            // drink" be paid for at the engine's number rather than stopped
            // short of the counter for want of one.
            .map((a) => `${a.label} (${a.placeName}${a.cost !== null ? `, ${a.cost}eb` : ""})`),
          nearestByKind: nearestByKindLines(
            bundle.campaign.location_key ?? DEFAULT_START,
            knownVenueKeysOf(bundle.campaign),
            bundle.places,
          ),
          nearby: withinBudget(positionDistrict.locations, PACKET_BUDGET.nearby).map((l) => l.name),
          streets: streetsIn(positionDistrict.key).map((s) => s.name),
          destinations: reachableDestinations(
            bundle.campaign.location_key ?? DEFAULT_START,
            knownPlacesOf(bundle.campaign),
          ).map((d) => d.name),
          neighbours: neighboursOf(bundle.campaign.location_key ?? DEFAULT_START).map(
            (n) => `${n.name} — ${directionName(n.direction)}, ${n.minutes} min`,
          ),
        }
      : null,
    character: {
      name: bundle.character.character.name,
      ...(bundle.character.character.handle ? { handle: bundle.character.character.handle } : {}),
      ...appearsAsProp(bundle.character),
      ...(turn.recognition ? reputationProp(bundle.climb.reputation, turn.recognition) : {}),
      home: homeLine(bundle.campaign, bundle.character),
      role: bundle.character.character.role,
      hp: bundle.vitals.hp_current,
      hpMax: bundle.vitals.hp_max,
      woundState: bundle.vitals.wound_state,
      humanity: bundle.vitals.humanity_current,
      humanityMax: bundle.vitals.humanity_max,
      eurobucks: bundle.vitals.eurobucks,
      stats: summary.stats,
      skills: gmSkillList(bundle.character, 40, {
        vitals: bundle.vitals,
        inventory: bundle.inventory,
        districtKey: standingDistrictKey,
      }).map((s) => ({
        // The label the engine produced, not the plain Skill name: it carries
        // the specialization, and for Local Expert the district the Level is
        // for. Re-deriving the name here was how "Local Expert" reached the
        // model with no neighbourhood attached.
        skill: s.skill,
        id: s.id,
        base: s.base,
      })),
    },
    situation: bundle.current,
    inScene: bundle.inScene,
    otherSituations: bundle.situations.filter(
      (s) => s.status === "live" && s.key !== bundle.current?.key,
    ),
    clocks: bundle.pressure.map((p) => p.clock),
    standings: standingLines(bundle.standings),
    // The long memory, so a campaign forty hours deep is not still six lines
    // of narration deep.
    chronicle: chronicleFor({
      day: bundle.clock.day,
      events: bundle.events,
      standings: bundle.standings,
      pressure: pressureLines(bundle.pressure),
      npcs: bundle.npcs,
      situationKeys: bundle.situations.map((s) => s.key),
      tally: bundle.tally,
    }),
    people: lifePeople(bundle.npcs, bundle.clock.day),
    recentEvents: recentLifeLines(bundle.events),
    counter: counterNews(bundle.events),
    capabilities: renderCapabilityLines(capability),
    ...(turn.resolved ? { resolved: turn.resolved } : {}),
    ...(turn.resolved && turn.said ? { said: turn.said } : {}),
    ...(turn.options ? { optionsRequested: true } : {}),
    ...(turn.oracle?.street ? { street: turn.oracle.street } : {}),
    ...(turn.oracle?.answer
      ? { oracle: { question: turn.oracle.answer.question, answer: turn.oracle.answer.answer } }
      : {}),
    // Work reaches the model only on a night the wire oracle produced some.
    // Before this gate the model decided when a job turned up, which is the one
    // piece of pacing it was still quietly authoring.
    wire:
      bundle.phase === "life" && !bundle.hook && turn.oracle?.wireOffers === true
        ? bundle.wire
        : null,
    hookOnTable: bundle.hook
      ? {
          title: bundle.hook.mission.title,
          brokerName: bundle.hook.offer.brokerName,
          brokerKey: bundle.hook.offer.brokerKey,
          brokerLine: bundle.hook.offer.brokerLine,
          district: bundle.hook.offer.district,
          pitch: bundle.hook.offer.pitch,
          ask: bundle.hook.offer.ask,
          payout: bundle.hook.terms.payout,
          learned: knownTerms(bundle.hook.terms, bundle.hook.offer),
        }
      : null,
  };
}
