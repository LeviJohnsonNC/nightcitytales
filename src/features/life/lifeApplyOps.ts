/**
 * Applying what the Life narrator proposed: the engine's half of a turn —
 * time, money, kit, travel, checks posted, the offer on the wire, pressure and
 * the new day. Split out of lifeOps.ts. No React and no TanStack Query in here.
 */

import {
  advanceClock,
  clampActionMinutes,
  clampDisposition,
  getMission,
  getSkill,
  judgeAction,
  missionOffer,
  nextPhase,
  resolveSkillId,
  directionName,
  getLandmark,
  modeLabel,
  resolveTravelIntent,
  turnProvenanceDataIfAny,
  DEFAULT_START,
  describePosition,
  type Observation,
  getDistrict,
  resolvePosition,
  nearestWithTag,
  regularOf,
  type NearbyPlace,
  type PlaceTag,
  LEDGER_EVENTS,
  shopBrowsedEventData,
  FACEDOWN_CHECK_ID,
} from "@/engine";
import { resolveWalkOns } from "@/features/cast/walkOnMention";
import { alsoHereAt } from "./alsoHere";
import {
  appendCampaignEvent,
  setInventoryQuantity,
  setCampaignClock,
  setCampaignPhase,
  setNpcDisposition,
  setCampaignFlag,
  updateCampaignVitals,
  upsertSituations,
  type Json,
} from "@/lib/backend";
import { gadgetTurn, planItemUse } from "@/features/campaign/itemUse";
import { dvBandName, facedownPrompt, snapToPublishedDv } from "@/features/play/checkPrompt";
import { buildCapabilitySnapshot } from "@/features/play/capabilityModel";
import { findNpcByKey } from "@/features/play/playModel";
import {
  oppositionProfileOf,
  reconcileFacedown,
  rememberOpposition,
} from "@/features/campaign/npcOpposition";
import { liveVehicleRule } from "@/features/play/roleAbilityModel";
import {
  loadDowntime,
  payBills,
  repair,
  rest,
  worstArmor,
  type DowntimeBundle,
} from "@/features/downtime/downtimeOps";
import type { LifeTurnResult } from "./lifeTurn.server";
import type { LifeActionCard } from "./lifeResponse";
import { planBrowse } from "./browseIntent";
import { standingAt } from "@/features/campaign/favours";
import { hookKeyFor, hookUpsert, offerTerms } from "./hookOffer";
import { askOracle, spendWire } from "@/features/campaign/oracles";
import { commitmentsStatus, dayBrief } from "@/features/status/statusModel";
import { travelTo } from "@/features/atlas/travel";
import { applyPlaceObservations, notePlaceVisit } from "@/features/campaign/placeState";
import { recognitionRecord } from "@/features/campaign/recognition";
import {
  applyPressure,
  readObservations,
  spendFiredClock,
  type LivePressure,
} from "@/features/campaign/pressure";
import { kindOfTrip, placesToOffer, situationToUpsert, type TurnOutcome } from "./lifeModel";
import {
  type LifeBundle,
  type TurnOptions,
  seedFilterFrom,
  rollWireForward,
  knownDistrictsOf,
  knownVenueKeysOf,
} from "./lifeBundleOps";

/** A place the engine is offering as somewhere to go, written as an option card. */
function travelCard(place: NearbyPlace, kind: PlaceTag): LifeActionCard {
  const district = getDistrict(place.districtKey)?.name ?? place.districtKey;
  return {
    label: `Go to ${place.name}`,
    description: `The nearest ${kind.replace(/_/g, " ")}, in ${district}.`,
    timeMinutes: place.minutes,
    knownCost: null,
    skillId: null,
  };
}

/**
 * Persist a clock delta and the situations/flags the turn produced.
 *
 * Takes the turn RESULT rather than the bare response: the narration event it
 * writes records which prompt and model produced the turn, and that is known at
 * the call, not in the model's answer.
 */
export async function applyResponse(
  bundle: LifeBundle,
  response: LifeTurnResult,
  turn: TurnOptions,
): Promise<TurnOutcome> {
  const campaignId = bundle.campaign.id;
  const outcome: TurnOutcome = {};

  // Time is spent by the engine, never claimed by the model. A turn that moves
  // the character bodily (travel, rest) carries its own duration and is charged
  // where it is applied; anything else costs what the model reports the action
  // took, clamped to something a single Life turn is allowed to eat.
  const carriesOwnTime =
    !turn.options &&
    response.proposedActions.some(
      // Looking over a counter is free: a visit is charged on the first purchase.
      (a) => a.kind === "travel" || a.kind === "rest" || a.kind === "browse",
    );
  // A trip or a night's sleep charges its own duration where it is applied,
  // so it wins even over minutes a card printed: charging both counted the
  // same walk twice.
  // Asking what the options are passes no time, whatever the model claims:
  // this held only because the screen passed `minutes: 0`.
  const spent =
    carriesOwnTime || turn.options
      ? 0
      : turn.minutes !== undefined
        ? clampActionMinutes(turn.minutes)
        : clampActionMinutes(response.timeSpent);

  await appendCampaignEvent({
    campaign_id: campaignId,
    // Options are answered on a row of their own: the scene has not moved, and
    // restating it in the log would read as the world repeating itself.
    type: turn.options ? "life_options" : "life_narration",
    summary: response.resolution ?? response.situation.description,
    data: {
      situationKey: bundle.current?.key ?? null,
      // Where and when this was written, which is what makes the next turn a
      // continuation of this scene rather than the opening of a new one.
      at: bundle.campaign.location_key ?? DEFAULT_START,
      day: bundle.clock.day,
      title: response.situation.title,
      actions: turn.cards ?? (turn.fixedResult ? [] : response.actions),
      // Resolved HERE, once, with the campaign+place seed the response schema
      // never sees — never re-picked on a later render, so a walk-on's face
      // stays the same face across scrollback and reload.
      walkOns: (() => {
        const here = alsoHereAt(campaignId, bundle.campaign.location_key ?? DEFAULT_START);
        return resolveWalkOns(response.walkOns, here.seed, here.subjects);
      })(),
      // Which prompt, at which version, asked which model — and who answered.
      // Built here rather than spelled out, per ledger.ts.
      ...turnProvenanceDataIfAny(response.provenance),
      ...(turn.recognition ? recognitionRecord(turn.recognition) : {}),
    } as unknown as Json,
  });

  // The transaction already committed every consequence. The narrator gets
  // prose and nothing else: no question, time, pressure, delta, spend, or phase
  // transition can leak out of a fixed-result follow-up.
  if (turn.fixedResult) return {};

  // A question the turn needed answered and could not answer itself. Held, not
  // answered: the dice get thrown next turn, so the model writes this one
  // genuinely not knowing. An options turn asks nothing — nobody lived it.
  if (!turn.options) await askOracle(campaignId, response.question);

  // --- what the engine, not the model, applies -----------------------------
  let clock = bundle.clock;
  let eurobucks = bundle.vitals.eurobucks;
  // What the database holds. The downtime operations below price against the
  // live balance, so what this turn has already spent is written first:
  // otherwise "spend 80, then pay 50 of bills" from 100 passed the bills check
  // and the turn wrote back -30.
  let written = eurobucks;
  const settleBalance = async () => {
    if (eurobucks === written) return;
    await updateCampaignVitals(campaignId, { eurobucks });
    written = eurobucks;
  };

  // The same gate the job loop runs. Life is not a hole in the wall: money the
  // character does not have and kit they are not carrying are refused here,
  // deterministically, and the refusal is written back as something that
  // happened rather than silently dropped.
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
  const refuse = async (reason: string, code = "impossible"): Promise<void> => {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "action_refused",
      summary: reason,
      data: { code } as unknown as Json,
    });
  };

  /** The downtime operations, loaded only when a turn actually asks for one. */
  let downtime: DowntimeBundle | null = null;
  const downtimeBundle = async (): Promise<DowntimeBundle> => {
    downtime ??= await loadDowntime(campaignId);
    return downtime;
  };

  // What the option card printed, charged before anything the model proposed.
  // The card said this is what it costs, so this is what it costs.
  // Judged against what is left NOW, not what the turn started with: the
  // snapshot was taken once, so a second spend (or one after the bills) passed
  // and was then quietly cut down to the balance — "Paid 20eb — a hat" for a
  // 50eb hat.
  const holding = () => ({ ...capability, eurobucks });
  if (turn.spend && turn.spend.amount > 0 && !turn.options) {
    const legal = judgeAction(holding(), {
      kind: "spend",
      resource: "eurobucks",
      amount: turn.spend.amount,
    });
    if (!legal.ok) {
      await refuse(legal.reason, legal.code);
    } else {
      const amount = Math.min(turn.spend.amount, eurobucks);
      if (amount > 0) {
        eurobucks -= amount;
        await appendCampaignEvent({
          campaign_id: campaignId,
          type: "life_action",
          summary: `Paid ${amount}eb — ${turn.spend.reason}`,
          data: { amount } as unknown as Json,
        });
      }
    }
  }

  // Asking what you could do is not doing it. Nothing mechanical is applied on
  // an options turn, whatever the model attached to it.
  const asked = turn.options ? [] : response.proposedActions;
  // "What have you got?" somewhere that sells nothing is a trip first. The
  // engine picks the shop (the one they named, else the nearest) and the trip
  // goes through the ordinary travel branch below, so it is priced, committed
  // and narrated like any other; the Counter opens once they are there.
  const browse = asked.find((a) => a.kind === "browse");
  const vehicle = liveVehicleRule(bundle.campaign, bundle.character);
  const browsePlanFrom = () =>
    planBrowse({
      placeKey: standingAt(bundle.campaign),
      from: bundle.campaign.location_key ?? DEFAULT_START,
      seller: browse?.kind === "browse" ? browse.seller : undefined,
      ...(vehicle ? { mode: vehicle } : {}),
    });
  const tripToShop = browse && !asked.some((a) => a.kind === "travel") ? browsePlanFrom() : null;
  const proposed: typeof asked =
    tripToShop?.kind === "go"
      ? [{ kind: "travel", destination: tripToShop.name, minutes: 0 }, ...asked]
      : asked;

  for (const action of proposed) {
    if (action.kind === "spend") {
      const legal = judgeAction(holding(), {
        kind: "spend",
        resource: "eurobucks",
        amount: action.amount,
      });
      if (!legal.ok) {
        await refuse(legal.reason, legal.code);
        continue;
      }
      const amount = Math.min(action.amount, eurobucks);
      if (amount <= 0) continue;
      eurobucks -= amount;
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "life_action",
        summary: `Paid ${amount}eb — ${action.reason}`,
        data: { amount } as unknown as Json,
      });
    } else if (action.kind === "use_item") {
      const legal = judgeAction(capability, {
        kind: "use_item",
        item: action.item,
        quantity: action.quantity,
      });
      if (!legal.ok) {
        await refuse(legal.reason, legal.code);
        continue;
      }
      // The ledger used to say "Used 5× Glow Paint" over an untouched sheet.
      // Whatever it says now is what the rows were actually set to.
      const use = planItemUse({
        capability,
        inventory: bundle.inventory,
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
          consumed: use.consumed,
          ...(use.consumed ? { remaining: use.remaining } : {}),
        } as unknown as Json,
      });
    } else if (action.kind === "pay_bills") {
      // One implementation of rent: the Downtime operation, priced by the engine.
      try {
        await settleBalance();
        const paid = await payBills(await downtimeBundle());
        if (paid.total > 0) eurobucks -= paid.total;
        written = eurobucks;
      } catch (error) {
        await refuse((error as Error).message, "resource_unavailable");
      }
    } else if (action.kind === "repair_armor") {
      const bundleForOps = await downtimeBundle();
      const piece = worstArmor(bundleForOps);
      if (!piece) {
        await refuse("Nothing in the kit needs patching.", "impossible");
      } else {
        try {
          await settleBalance();
          const done = await repair(bundleForOps, piece);
          eurobucks -= done.cost;
          written = eurobucks;
        } catch (error) {
          await refuse((error as Error).message, "resource_unavailable");
        }
      }
    } else if (action.kind === "travel") {
      const vehicleRule = liveVehicleRule(bundle.campaign, bundle.character);
      const from = bundle.campaign.location_key ?? DEFAULT_START;
      // "Find a bar" is a request for the nearest real bar, not for a place
      // called "a bar". The engine picks it; the narrator never has to.
      const kind = kindOfTrip(action, turn.said);
      const known = knownVenueKeysOf(bundle.campaign);
      const sought = kind
        ? nearestWithTag(from, kind, { known, limit: 1, regular: regularOf(kind, bundle.places) })
        : [];
      const destination = sought[0]?.key ?? action.destination;
      // A move in the fiction is a move on the map. The engine resolves the
      // name against the atlas, prices the trip from the house-rule table, and
      // commits the same way the map's own travel button does — so the pin, the
      // header and the ledger all agree with the narration.
      const decision = resolveTravelIntent({
        from,
        ...(destination ? { destination } : {}),
        ...(action.direction ? { direction: action.direction } : {}),
        ...(action.extent ? { extent: action.extent } : {}),
        ...(action.mode ? { mode: action.mode } : {}),
        ...(action.blocks ? { blocks: action.blocks } : {}),
        // Whatever they have out of the Family Motorpool answers for any trip
        // they did not say they were walking. Null for every other Role.
        ...(vehicleRule ? { vehicle: vehicleRule } : {}),
      });
      if (!decision.ok) {
        await refuse(decision.reason, "impossible");
        outcome.travelRefused = decision.reason;
        const offer = placesToOffer(from, kind, known, 3, bundle.places);
        if (offer.length) outcome.travelChoices = offer.map((o) => travelCard(o.place, o.kind));
        continue;
      }
      const before = bundle.campaign.location_key ?? DEFAULT_START;
      const moved = await travelTo({
        campaign: bundle.campaign,
        clock,
        to: decision.to,
        minutes: decision.minutes,
        mode: decision.mode,
      });
      bundle.campaign = moved.campaign;
      clock = moved.clock;
      // Being somewhere is the beginning of knowing it. Step seven reads these
      // back at a job briefing: the elevator, the way onto the roof, who runs
      // the carwash across the road.
      const arrived = resolvePosition(moved.campaign.location_key);
      if (arrived?.placeKey) {
        await notePlaceVisit({
          campaignId,
          placeKey: arrived.placeKey,
          day: clock.day,
          known: bundle.places,
        });
      }
      outcome.travelled = {
        from: describePosition(before),
        to: describePosition(decision.to),
        minutes: moved.minutes,
        ...(decision.direction ? { direction: directionName(decision.direction) } : {}),
        ...(decision.stoppedAt ? { stoppedAt: decision.stoppedAt } : {}),
        ...(decision.blocks ? { blocks: decision.blocks } : {}),
        mode: modeLabel(decision.mode),
        ...(decision.route?.spans.length
          ? { bridges: decision.route.spans.map((k) => getLandmark(k)?.name ?? k) }
          : {}),
      };
    } else if (action.kind === "rest") {
      // Sleeping IS resting: the hours move the clock, and every whole day the
      // character crossed heals at the printed rate through the same Downtime
      // operation the panel uses. The clock is advanced here, so the operation
      // is told not to move the calendar a second time.
      const before = clock;
      clock = advanceClock(clock, clampActionMinutes(action.hours * 60));
      const daysCrossed = clock.day - before.day;
      if (daysCrossed > 0) {
        await rest(await downtimeBundle(), daysCrossed, { advanceCalendar: false });
      }
    } else if (action.kind === "facedown") {
      // A person the campaign knows stares back with their own numbers, and the
      // first stare-down writes them down (only for somebody already on file:
      // a row is never filed from a key the model supplied).
      const npc = findNpcByKey(bundle.npcs, action.npcKey, action.npcName);
      const known = reconcileFacedown(
        { cool: action.opposingCool, reputation: action.opposingReputation },
        oppositionProfileOf(npc),
      );
      if (npc) {
        await rememberOpposition({
          campaignId,
          npcKey: action.npcKey,
          npcName: npc.name,
          npc,
          opposition: {
            name: npc.name,
            skillId: FACEDOWN_CHECK_ID,
            skillLevel: known.reputation,
            statValue: known.cool,
          },
        });
      }
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
      });
    } else if (action.kind === "skill_check" || action.kind === "opposed_check") {
      const skillId = resolveSkillId(action.skillId);
      if (!skillId) continue;
      const skillName = getSkill(skillId).name;
      if (action.kind === "skill_check") {
        const dv = snapToPublishedDv(action.dv);
        const band = dvBandName(dv);
        await appendCampaignEvent({
          campaign_id: campaignId,
          type: "check_prompt",
          summary: `${skillName} check — DV ${dv}${band ? ` (${band})` : ""}`,
          data: {
            skillId,
            skillName,
            dv,
            intent: action.intent,
            // Who it is aimed at, when it is aimed at a person. A Social check
            // against a DV used to carry nobody, so it could not read anybody.
            ...(action.npcKey ? { npcKey: action.npcKey } : {}),
            ...(action.npcName ? { npcName: action.npcName } : {}),
            // The narrator's half of whether this may roll itself.
            ...(action.stakes === "low" ? { stakes: "low" } : {}),
          } as unknown as Json,
        });
      } else {
        const opposingSkillId = resolveSkillId(action.opposingSkillId);
        if (!opposingSkillId) continue;
        await appendCampaignEvent({
          campaign_id: campaignId,
          type: "check_prompt",
          summary: `${skillName} check — opposed by ${action.npcName}`,
          data: {
            skillId,
            skillName,
            intent: action.intent,
            opposition: {
              npcKey: action.npcKey,
              npcName: action.npcName,
              skillId: opposingSkillId,
              skillLevel: action.opposingSkillLevel,
              statValue: action.opposingStatValue,
            },
          } as unknown as Json,
        });
      }
    } else if (action.kind === "hook_offer") {
      // A job OFFER, never a job — and specifically the job that was already on
      // the wire when this turn started. The model brought nothing to this: the
      // mission, the broker and the fee were generated before it spoke, which is
      // what makes the offer and the job it starts the same thing.
      // And specifically on a night the wire oracle said there was work. The
      // block is withheld from the model on a quiet night, but withholding is
      // not enforcement: a model that offers a job anyway is refused here.
      if (!bundle.wireMissionId || bundle.hook) continue;
      if (turn.oracle?.wireOffers !== true) {
        await refuse("Nobody called tonight. There is no work to put on the table.", "no_work");
        continue;
      }
      const missionId = bundle.wireMissionId;
      const mission = getMission(missionId);
      const offer = missionOffer(mission);
      const terms = offerTerms(mission);
      const key = hookKeyFor(offer, missionId);
      await upsertSituations(campaignId, [hookUpsert(key, mission, offer, terms)]);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "hook_offered",
        summary: `${offer.brokerName} offers work: ${mission.title} (${terms.payout}eb)`,
        data: { situationKey: key, missionId, payout: terms.payout } as unknown as Json,
      });
      // The wire moves on, so the same job is never offered twice — and
      // tonight's roll is spent, so the NEXT job does not turn up this evening
      // too if the player walks away from this one.
      await rollWireForward(
        campaignId,
        knownDistrictsOf(bundle.campaign),
        seedFilterFrom(bundle.climb.tier, bundle.standings),
      );
      await spendWire(campaignId, clock.day);
      const to = nextPhase(bundle.phase, "offer_hook");
      if (to) await setCampaignPhase(campaignId, to);
    }
  }

  // The Counter is opened by the screen, which reads this row; written only
  // when there is somebody to show them, and once per thing they said. The
  // arrival after a trip is a continuation of the same words and may propose
  // it a second time; its bundle is fresh, so it can see the first.
  if (browse) {
    const plan = browsePlanFrom();
    let already = false;
    if (turn.continuation) {
      for (let i = bundle.events.length - 1; i >= 0; i--) {
        const type = bundle.events[i]!.type;
        if (type === "player_input") break;
        if (type === LEDGER_EVENTS.shopBrowsed) already = true;
      }
    }
    if (plan.kind === "open" && !already) {
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: LEDGER_EVENTS.shopBrowsed,
        summary: `Looking over what ${plan.vendor.label} has.`,
        data: shopBrowsedEventData({
          vendorId: plan.vendor.id,
          day: clock.day,
        }) as unknown as Json,
      });
      outcome.browsing = plan.vendor.label;
    }
  }

  for (const delta of response.deltas) {
    if (delta.kind === "set_flag") {
      await setCampaignFlag(campaignId, delta.flag);
    } else if (delta.kind === "npc_disposition") {
      const npc = bundle.npcs.find((n) => n.npc_id === delta.npcKey);
      if (npc) {
        // The engine, the schema and the column's CHECK all say -3..3. Clamping
        // to a wider range here wrote values the database refuses.
        await setNpcDisposition(npc.id, clampDisposition(npc.disposition + delta.delta));
      }
    } else if (delta.kind === "note") {
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "life_note",
        summary: delta.text,
        data: {} as Json,
      });
    }
  }

  // --- pressure ------------------------------------------------------------
  // The model reported what the fiction noticed; the engine decides what each
  // observation costs, moves the dials, and hands back anything that has come
  // due. Skipped on an options turn, which did not happen.
  // A find used this turn has its say first (engine/gadgets.ts): a working hush
  // wrap means the city did not hear it, a sound puck that you were not there
  // to be seen. Applied here, before anything is priced, and logged as what the
  // sheet actually did.
  let timeFactor = 1;
  if (!turn.options) {
    const finds = gadgetTurn({
      capability,
      proposed,
      reports: readObservations(response.observations),
      report: (observation) => ({ observation: observation as Observation, factionId: null }),
    });
    timeFactor = finds.timeFactor;
    for (const line of finds.lines) {
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "life_action",
        summary: line.summary,
        data: (line.roll ? { roll: line.roll } : {}) as unknown as Json,
      });
    }
    const reports = finds.reports;
    if (reports.length) {
      // The same reports, read a second way: what this did to the character's
      // standing with the city, and what it did to THIS ADDRESS.
      const where = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
      if (where?.placeKey) {
        await applyPlaceObservations({
          campaignId,
          placeKey: where.placeKey,
          observations: reports.map((r) => r.observation),
          known: bundle.places,
          day: clock.day,
        });
      }
      const { pressure } = await applyPressure(campaignId, reports, {
        // Where it happened decides what the city hears. A district with no
        // response profile is the ordinary city; one nobody polices is not.
        districtKey: where?.districtKey ?? null,
      });
      await arrivePressure(campaignId, pressure, clock.day);
    }
  }

  if (response.newSituation && !turn.options) {
    const s = response.newSituation;
    await upsertSituations(campaignId, [
      {
        situationKey: s.key,
        category: s.category,
        title: s.title,
        summary: s.summary,
        npcKey: s.npcKey,
        status: "live",
        severity: s.severity,
        dueDay: s.dueDay,
      },
    ]);
  }

  // The situation just put to the player does not come round again today.
  if (bundle.current) {
    await upsertSituations(campaignId, [
      { ...situationToUpsert(bundle.current), lastShownDay: bundle.clock.day },
    ]);
  }

  await settleBalance();

  clock = advanceClock(clock, Math.round(spent * timeFactor));
  if (clock.day !== bundle.clock.day || clock.minute !== bundle.clock.minute) {
    await setCampaignClock(campaignId, clock);
  }

  // A new day: what they wake up to, written into the log where the night
  // ended. It is the moment "what now?" gets asked, so it gets an answer.
  if (clock.day > bundle.clock.day) {
    const brief = dayBrief(
      clock.day,
      commitmentsStatus({
        day: clock.day,
        situations: bundle.situations,
        clocks: bundle.pressure.map((p) => p.clock).filter((c) => !c.hidden),
      }),
    );
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "day_began",
      summary: `Day ${brief.day}`,
      data: brief as unknown as Json,
    });
  }
  return outcome;
}

/**
 * Let a filled clock arrive.
 *
 * The engine spends the clock and writes what came; the situation it raises is a
 * severity-5 pressure, which is loud enough that selectSituation will put it in
 * front of the player next turn. The model narrates it after the fact, exactly
 * as it narrates a resolved check: it does not get to decide whether Maelstrom
 * turned up, only what it looked like when they did.
 */
async function arrivePressure(
  campaignId: string,
  pressure: LivePressure[],
  day: number,
): Promise<void> {
  const arrived = await spendFiredClock(campaignId);
  if (!arrived) return;
  await upsertSituations(campaignId, [
    {
      situationKey: `pressure_${arrived.definition.key}`,
      category: "pressure",
      title: arrived.definition.label.replace(/ (Retaliation|Investigation|Heat)$/, " have come"),
      summary: arrived.payoff,
      status: "live",
      severity: 5,
      data: {
        clockKey: arrived.definition.key,
        factionId: arrived.definition.factionId,
      } as unknown as Json,
    },
  ]);
}
