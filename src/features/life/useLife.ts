/**
 * The LIFE loop: the phase between jobs.
 *
 * The application is authoritative here. It decides which situation is loudest
 * (src/engine/life.ts), spends the in-world clock (src/engine/clock.ts), and
 * owns every phase transition (src/engine/phase.ts). The model is only asked to
 * dress the situation and parse intent — it cannot start a job, and accepting a
 * hook is a button the player presses, never something a turn does on its own.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  advanceClock,
  ageSituations,
  canAsk,
  clampActionMinutes,
  clampDisposition,
  getMission,
  getSkill,
  hookAskSpec,
  judgeAction,
  knownTerms,
  looksForWork,
  luckPoolMax,
  mergeSituations,
  missionOffer,
  nextPhase,
  partOfDay,
  readsThePerson,
  resolveSkillId,
  rollJobSeed,
  selectSituation,
  settleHookAsk,
  standingBand,
  startMission,
  tickClock,
  BROKER_DEFAULT_SKILL_LEVEL,
  BROKER_DEFAULT_STAT,
  TIME_COSTS,
  type GameClock,
  type GamePhase,
  type HookAsk,
  type FactionStanding,
  type LifeSituation,
  type Opposition,
  type WoundStateCode,
} from "@/engine";
import {
  appendCampaignEvent,
  findCampaignNpc,
  getCampaign,
  getCharacter,
  listCampaignEvents,
  listCampaignFactions,
  listClocks,
  listSituations,
  setCampaignClock,
  setCampaignPhase,
  setNpcDisposition,
  setCampaignFlag,
  setSituationStatus,
  updateCampaign,
  updateCampaignVitals,
  upsertClock,
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
import { saveMissionRuntime } from "@/features/campaign/missionState";
import { logOpposedCheck, logSkillCheck } from "@/features/campaign/skillCheckLog";
import { characterSummary, statsRecord } from "@/features/play/playModel";
import { gmSkillList } from "@/features/play/playModel";
import {
  dvBandName,
  pendingChecksFrom,
  snapToPublishedDv,
  type CheckRoll,
  type PendingCheck,
} from "@/features/play/checkPrompt";
import { buildCapabilitySnapshot, renderCapabilityLines } from "@/features/play/capabilityModel";
import {
  loadDowntime,
  payBills,
  repair,
  rest,
  worstArmor,
  type DowntimeBundle,
} from "@/features/downtime/downtimeOps";
import { renderLifeUserPrompt, type LifeContext, type LifeWireOffer } from "./lifeContext";
import { lifeTurnFn } from "./lifeTurn.server";
import type { LifeActionCard, LifeResponse } from "./lifeResponse";
import {
  askTagFrom,
  hookFromSituation,
  hookKeyFor,
  hookUpsert,
  liveHookSituation,
  nextJobSeedFrom,
  offerTerms,
  wireOfferFor,
  JOB_PAYOUT_FLAG,
  NEXT_JOB_SEED_FLAG,
  type LifeHook,
} from "./hookOffer";
import {
  oppositionProfileOf,
  reconcileOpposition,
  rememberOpposition,
} from "@/features/campaign/npcOpposition";
import {
  castMemberInRole,
  ensureCast,
  markDealtWith,
  revealNextFact,
} from "@/features/campaign/castSeeding";
import { rememberDeclined, runWorldTick, settleMoves } from "@/features/campaign/worldTick";
import {
  answerPendingQuestion,
  askOracle,
  consultStreet,
  consultWire,
  rollComplicationFor,
  spendWire,
  type OracleAnswer,
} from "@/features/campaign/oracles";
import { chronicleFor } from "@/features/campaign/chronicleModel";
import { travelTo } from "@/features/atlas/travel";
import {
  DEFAULT_START,
  areaOf,
  describePosition,
  getDistrict,
  isCombatZone,
  resolvePosition,
  canTravel,
} from "@/engine";
import { addToTally, tallyFrom, type CampaignTally } from "@/features/campaign/tally";
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
import {
  campaignPhase,
  clockFromRow,
  derivedSituations,
  lifePeople,
  recentLifeLines,
  situationFromRow,
  situationToUpsert,
} from "./lifeModel";

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
};

async function loadLife(campaignId: string): Promise<LifeBundle> {
  const full = await getCampaign(campaignId);
  if (!full) throw new Error("Campaign not found.");
  if (!full.vitals) throw new Error("Campaign has no vitals to live with.");

  const character = await getCharacter(full.campaign.character_id);
  if (!character) throw new Error("This campaign's character no longer exists.");

  const [events, situationRows, clockRows, factionRows] = await Promise.all([
    listCampaignEvents(campaignId),
    listSituations(campaignId),
    listClocks(campaignId),
    listCampaignFactions(campaignId),
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
  const merged = mergeSituations(persisted, derivedSituations(input));
  const changed = merged.filter((s) => {
    const prior = persisted.find((p) => p.key === s.key);
    return !prior || JSON.stringify(prior) !== JSON.stringify(s);
  });
  if (changed.length) await upsertSituations(campaignId, changed.map(situationToUpsert));

  const lastShownKey = [...events]
    .reverse()
    .map((e) => (e.data as { situationKey?: unknown } | null)?.situationKey)
    .find((k): k is string => typeof k === "string");

  // There is always a job somewhere in Night City. Its seed is drawn once and
  // stored, so the same work is still on the wire after a reload, and so the
  // mission behind an offer exists BEFORE anyone pitches it.
  const seed = await ensureNextJobSeed(campaignId, full.flags);
  // Work comes through the fixer the character actually has, not a new name.
  const { missionId: wireMissionId, wire } = wireOfferFor(
    seed,
    castMemberInRole(cast.npcs, "fixer"),
  );

  const hookRow = liveHookSituation(merged);
  let hook = hookRow ? hookFromSituation(hookRow) : null;
  if (hookRow && !hook) {
    // A hook written before offers carried a mission. Rather than guess at what
    // job was meant, bind it to the one on the wire and roll a fresh one on:
    // from here the offer and the job it starts are the same object.
    hook = await bindLegacyHook(campaignId, hookRow, seed);
  }

  return {
    ...input,
    events,
    phase: campaignPhase(full.campaign),
    clock,
    situations: merged,
    pressure: pressureFrom(clockRows),
    standings: notableFrom(factionRows),
    current: selectSituation(merged, clock.day, lastShownKey),
    hook,
    wire: hook ? null : wire,
    wireMissionId: hook ? null : wireMissionId,
    tally: tallyFrom(full.flags),
  };
}

/** The seed of the job on the wire, drawing and storing one the first time. */
async function ensureNextJobSeed(campaignId: string, flags: CampaignFlag[]): Promise<number> {
  const stored = nextJobSeedFrom(flags);
  if (stored !== null) return stored;
  const seed = rollJobSeed();
  await setCampaignFlag(campaignId, NEXT_JOB_SEED_FLAG, seed as unknown as Json);
  return seed;
}

/** Draw the next job onto the wire, so the one just offered is not offered twice. */
async function rollWireForward(campaignId: string): Promise<void> {
  await setCampaignFlag(campaignId, NEXT_JOB_SEED_FLAG, rollJobSeed() as unknown as Json);
}

/** Give an offer that predates offer-time generation the job it will start. */
async function bindLegacyHook(
  campaignId: string,
  situation: LifeSituation,
  seed: number,
): Promise<LifeHook> {
  const { missionId } = wireOfferFor(seed);
  const mission = getMission(missionId);
  const offer = missionOffer(mission);
  const terms = offerTerms(mission);
  await upsertSituations(campaignId, [hookUpsert(situation.key, mission, offer, terms)]);
  await rollWireForward(campaignId);
  return { situationKey: situation.key, missionId, mission, offer, terms };
}

/** What a single Life turn is: what the player did, and what already happened. */
type TurnOptions = {
  /** What the engine already resolved, when this turn narrates a result. */
  resolved?: string;
  /** True when the player asked what they could do rather than doing something. */
  options?: boolean;
  /** Minutes the engine has already decided this turn costs. */
  minutes?: number;
  /** Narrate a committed engine result without applying model-authored actions. */
  fixedResult?: boolean;
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
};

/** The context slice the Life model reasons over. Deterministic and small. */
function buildContext(bundle: LifeBundle, turn: TurnOptions = {}): LifeContext {
  const summary = characterSummary(bundle.character, bundle.vitals, bundle.inventory);
  const capability = buildCapabilitySnapshot({
    character: bundle.character,
    vitals: bundle.vitals,
    inventory: bundle.inventory,
    cyberware: bundle.cyberware,
    encounter: null,
    events: bundle.events,
    beatId: null,
  });

  const position = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
  const positionDistrict = position ? getDistrict(position.districtKey) : undefined;

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
          nearby: positionDistrict.locations.slice(0, 8).map((l) => l.name),
          destinations: reachableDestinations(
            bundle.campaign.location_key ?? DEFAULT_START,
          ).map((d) => d.name),

        }
      : null,
    character: {
      name: bundle.character.character.name,
      ...(bundle.character.character.handle ? { handle: bundle.character.character.handle } : {}),
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
      }).map((s) => ({
        skill: getSkill(s.id).name,
        id: s.id,
        base: s.base,
      })),
    },
    situation: bundle.current,
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
    people: lifePeople(bundle.npcs),
    recentEvents: recentLifeLines(bundle.events),
    capabilities: renderCapabilityLines(capability),
    ...(turn.resolved ? { resolved: turn.resolved } : {}),
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

/** Persist a clock delta and the situations/flags the turn produced. */
async function applyResponse(
  bundle: LifeBundle,
  response: LifeResponse,
  turn: TurnOptions,
): Promise<void> {
  const campaignId = bundle.campaign.id;

  // Time is spent by the engine, never claimed by the model. A turn that moves
  // the character bodily (travel, rest) carries its own duration and is charged
  // where it is applied; anything else costs what the model reports the action
  // took, clamped to something a single Life turn is allowed to eat.
  const carriesOwnTime =
    !turn.options && response.proposedActions.some((a) => a.kind === "travel" || a.kind === "rest");
  const spent =
    turn.minutes !== undefined
      ? clampActionMinutes(turn.minutes)
      : carriesOwnTime
        ? 0
        : clampActionMinutes(response.timeSpent);

  await appendCampaignEvent({
    campaign_id: campaignId,
    // Options are answered on a row of their own: the scene has not moved, and
    // restating it in the log would read as the world repeating itself.
    type: turn.options ? "life_options" : "life_narration",
    summary: response.resolution ?? response.situation.description,
    data: {
      situationKey: bundle.current?.key ?? null,
      title: response.situation.title,
      actions: turn.fixedResult ? [] : response.actions,
    } as unknown as Json,
  });

  // The transaction already committed every consequence. The narrator gets
  // prose and nothing else: no question, time, pressure, delta, spend, or phase
  // transition can leak out of a fixed-result follow-up.
  if (turn.fixedResult) return;

  // A question the turn needed answered and could not answer itself. Held, not
  // answered: the dice get thrown next turn, so the model writes this one
  // genuinely not knowing. An options turn asks nothing — nobody lived it.
  if (!turn.options) await askOracle(campaignId, response.question);

  // --- what the engine, not the model, applies -----------------------------
  let clock = bundle.clock;
  let eurobucks = bundle.vitals.eurobucks;

  // The same gate the job loop runs. Life is not a hole in the wall: money the
  // character does not have and kit they are not carrying are refused here,
  // deterministically, and the refusal is written back as something that
  // happened rather than silently dropped.
  const capability = buildCapabilitySnapshot({
    character: bundle.character,
    vitals: bundle.vitals,
    inventory: bundle.inventory,
    cyberware: bundle.cyberware,
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

  // Asking what you could do is not doing it. Nothing mechanical is applied on
  // an options turn, whatever the model attached to it.
  const proposed = turn.options ? [] : response.proposedActions;

  for (const action of proposed) {
    if (action.kind === "spend") {
      const legal = judgeAction(capability, {
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
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "life_action",
        summary: `Used ${action.quantity > 1 ? `${action.quantity}× ` : ""}${action.item}.`,
        data: { item: action.item, quantity: action.quantity } as unknown as Json,
      });
    } else if (action.kind === "pay_bills") {
      // One implementation of rent: the Downtime operation, priced by the engine.
      try {
        const paid = await payBills(await downtimeBundle());
        if (paid.total > 0) eurobucks -= paid.total;
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
          const done = await repair(bundleForOps, piece);
          eurobucks -= done.cost;
        } catch (error) {
          await refuse((error as Error).message, "resource_unavailable");
        }
      }
    } else if (action.kind === "travel") {
      clock = advanceClock(clock, clampActionMinutes(action.minutes));
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
          data: { skillId, skillName, dv, intent: action.intent } as unknown as Json,
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
      await rollWireForward(campaignId);
      await spendWire(campaignId, clock.day);
      const to = nextPhase(bundle.phase, "offer_hook");
      if (to) await setCampaignPhase(campaignId, to);
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
  if (!turn.options) {
    const reports = readObservations(response.observations);
    if (reports.length) {
      const { pressure } = await applyPressure(campaignId, reports);
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

  if (eurobucks !== bundle.vitals.eurobucks) {
    await updateCampaignVitals(campaignId, { eurobucks });
  }

  clock = advanceClock(clock, spent);
  if (clock.day !== bundle.clock.day || clock.minute !== bundle.clock.minute) {
    await setCampaignClock(campaignId, clock);
  }
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

/**
 * Ask the oracles, before the model is asked anything.
 *
 * Everything here is rolled and written down BEFORE the prompt is built, so the
 * model receives the answers as facts about a world that had already decided
 * them. It never learns that a die was involved, and it is never in a position
 * to decide whether the phone rings tonight.
 *
 * Nothing is rolled on an options turn: the player is thinking, not living, and
 * an evening should not pass because they asked what an evening might contain.
 */
async function consultOracles(
  bundle: LifeBundle,
  input: string,
  turn: TurnOptions,
): Promise<TurnOptions["oracle"]> {
  if (turn.options) return undefined;
  const campaignId = bundle.campaign.id;

  // The world gets its turn before anything else is asked. Once per in-world
  // day, guarded inside runWorldTick, so the night cannot be re-rolled by a
  // refetch.
  //
  // What it writes lands on the NEXT turn rather than this one, because this
  // turn's board was built before the roll. That is the right shape: the night
  // passed, the player's turn resolves, and the scene that opens after it is
  // the consequence walking in.
  await runWorldTick({
    campaignId,
    day: bundle.clock.day,
    minute: bundle.clock.minute,
    npcs: bundle.npcs,
    situations: bundle.situations,
  });
  const oracle: NonNullable<TurnOptions["oracle"]> = {};

  // A question the model asked last turn. Answered first, so the answer is in
  // front of it before anything else about tonight is decided.
  const answer = await answerPendingQuestion(campaignId);
  if (answer) oracle.answer = answer;

  // Living, and nothing already on the table: is anybody calling tonight?
  if (bundle.phase === "life" && !bundle.hook) {
    const wire = await consultWire({
      campaignId,
      day: bundle.clock.day,
      eurobucks: bundle.vitals.eurobucks,
      chasing: looksForWork(input),
    });
    oracle.wireOffers = wire.offered;

    // And when nothing is already demanding attention, what the evening is —
    // once per part of the day, so a player taking five turns in one evening
    // does not get five chances at something walking into it.
    if (!bundle.current) {
      const street = await consultStreet({
        campaignId,
        day: bundle.clock.day,
        part: partOfDay(bundle.clock.minute),
      });
      if (street) oracle.street = street.result.text;
    }
  }

  return oracle;
}

/** One Life turn: the player says something, the world answers. */
async function liveTurn(bundle: LifeBundle, input: string, turn: TurnOptions = {}): Promise<void> {
  if (input.trim()) {
    await appendCampaignEvent({
      campaign_id: bundle.campaign.id,
      type: "player_input",
      summary: input,
      data: {} as Json,
    });
  }
  const oracle = turn.fixedResult
    ? undefined
    : (turn.oracle ?? (await consultOracles(bundle, input, turn)));
  const asked: TurnOptions = oracle ? { ...turn, oracle } : turn;
  const context = buildContext(bundle, asked);
  const opening = turn.options
    ? "(the player is asking what they could do here)"
    : "(open the moment)";
  const response = await lifeTurnFn({
    data: { userPrompt: renderLifeUserPrompt(context, input || opening) },
  });
  await applyResponse(bundle, response, asked);

  // Acting on a situation about a person IS dealing with them. Only a turn the
  // player actually typed counts: opening the moment, or asking what the
  // options are, is not the same as picking up the phone.
  const npcKey = bundle.current?.npcKey;
  if (npcKey && input.trim() && !turn.options) {
    const npc = bundle.npcs.find((n) => n.npc_id === npcKey);
    if (npc) await markDealtWith(bundle.campaign.id, npc, bundle.clock.day);
    // A move the world made is answered by dealing with the person who made it.
    // Unlike the derived `person_` situations, a move is written rather than
    // re-derived, so nothing else would ever take it off the board.
    await settleMoves(bundle.campaign.id, npcKey);
  }
}

/**
 * Reading someone while you were doing something else.
 *
 * A Social check won comfortably against a person tells you something about
 * them that they did not volunteer. The engine decides what: the next rung of
 * their dossier, in order, once per check. The model is handed the fact
 * afterwards to narrate as a tell, and is never shown the rungs still hidden.
 */
async function applyInsight(
  campaignId: string,
  npcKey: string,
  skillId: string,
  success: boolean,
  margin: number,
): Promise<string | null> {
  if (!success || !readsThePerson(skillId, margin)) return null;
  const npc = await findCampaignNpc(campaignId, npcKey);
  if (!npc) return null;
  const learned = await revealNextFact(campaignId, npc);
  if (!learned) return null;
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "npc_read",
    summary: learned.text,
    data: { npcKey, fact: learned.fact } as unknown as Json,
  });
  return learned.text;
}

/** Roll a Life check the player pressed, then let the world answer it. */
async function commitLifeCheck(
  bundle: LifeBundle,
  pending: PendingCheck,
  roll: CheckRoll,
): Promise<void> {
  const campaignId = bundle.campaign.id;

  // A check posted by a negotiation settles the TERMS, not just the fiction:
  // the engine decides what the push bought and the model is only told the
  // outcome afterwards.
  const tag = askTagFrom(bundle.events.find((e) => e.id === pending.eventId));
  if (tag && bundle.hook && bundle.hook.situationKey === tag.situationKey) {
    await settleNegotiation(bundle, bundle.hook, tag.ask, pending, roll);
    return;
  }

  if (roll.kind === "opposed") {
    await logOpposedCheck(campaignId, roll.result, {
      skillId: pending.skillId,
      skillName: pending.skillName,
      intent: pending.intent,
      promptEventId: pending.eventId,
      luckSpent: roll.luckSpent,
      ...(pending.opposition?.npcKey ? { npcKey: pending.opposition.npcKey } : {}),
    });
    const verdict = roll.result.success
      ? `SUCCESS by ${Math.abs(roll.result.margin)}`
      : roll.result.tie
        ? "FAILURE — tied, and a tie goes to the one resisting"
        : `FAILURE by ${Math.abs(roll.result.margin)}`;
    const read = pending.opposition?.npcKey
      ? await applyInsight(
          campaignId,
          pending.opposition.npcKey,
          pending.skillId,
          roll.result.success,
          roll.result.margin,
        )
      : null;
    const fresh = { ...bundle, events: await listCampaignEvents(campaignId) };
    await liveTurn(fresh, "", {
      minutes: 0,
      resolved:
        `The ${pending.skillName} check against ${pending.opposition?.npcName ?? "them"} is RESOLVED: ${verdict}, for the intent "${pending.intent}".` +
        (read
          ? ` Reading them that closely told the character something they did not volunteer: ${read} Let it show as a tell in how they behave, not as an announcement.`
          : ""),
    });
    return;
  }

  await logSkillCheck(campaignId, roll.result, {
    skillId: pending.skillId,
    skillName: pending.skillName,
    intent: pending.intent,
    promptEventId: pending.eventId,
    luckSpent: roll.luckSpent,
  });
  const dv = pending.dv ?? 0;
  const verdict = roll.result.success ? "SUCCESS" : "FAILURE";
  const fresh = { ...bundle, events: await listCampaignEvents(campaignId) };
  await liveTurn(fresh, "", {
    minutes: 0,
    resolved: `The ${pending.skillName} check is RESOLVED. ${roll.result.formula}. Outcome: ${verdict} by ${Math.abs(roll.result.total - dv)}, for the intent "${pending.intent}".`,
  });
}

/**
 * The ONLY door into a job. Pressed by the player, never by a turn: the hook is
 * marked taken, a mission is started, and the phase moves to `job`, at which
 * point the existing play machinery owns the screen.
 */
async function acceptHook(bundle: LifeBundle): Promise<void> {
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
async function declineHook(bundle: LifeBundle, reason: string): Promise<void> {
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
async function pushHook(bundle: LifeBundle, ask: HookAsk): Promise<void> {
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

/**
 * What a push bought. The engine decides: the fee moves or it does not, the name
 * is given up or it is not, and the model is handed the result to describe after
 * the fact, exactly as it is for any other roll.
 */
async function settleNegotiation(
  bundle: LifeBundle,
  hook: LifeHook,
  ask: HookAsk,
  pending: PendingCheck,
  roll: CheckRoll,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const spec = hookAskSpec(ask);

  let success: boolean;
  let margin: number;
  if (roll.kind === "opposed") {
    await logOpposedCheck(campaignId, roll.result, {
      skillId: pending.skillId,
      skillName: pending.skillName,
      intent: pending.intent,
      promptEventId: pending.eventId,
      luckSpent: roll.luckSpent,
      npcKey: hook.offer.brokerKey,
    });
    success = roll.result.success;
    margin = roll.result.margin;
  } else {
    await logSkillCheck(campaignId, roll.result, {
      skillId: pending.skillId,
      skillName: pending.skillName,
      intent: pending.intent,
      promptEventId: pending.eventId,
      luckSpent: roll.luckSpent,
    });
    // A roll made against no DV has no verdict, and no verdict is not a win.
    success = roll.result.success === true;
    margin = roll.result.total - (pending.dv ?? 0);
  }

  const outcome = settleHookAsk(hook.terms, hook.offer, ask, { success, margin });
  // Only a push made AGAINST the broker reads the broker. Asking around the
  // street is a check about the job, with the fixer nowhere in the room.
  const read = spec.opposedBy
    ? await applyInsight(campaignId, hook.offer.brokerKey, pending.skillId, success, margin)
    : null;

  await upsertSituations(campaignId, [
    hookUpsert(hook.situationKey, hook.mission, hook.offer, outcome.terms),
  ]);

  if (outcome.dispositionDelta !== 0) {
    // Read the row rather than the bundle: a broker met for the first time was
    // written when the check was posted, after this bundle was loaded.
    const npc = await findCampaignNpc(campaignId, hook.offer.brokerKey);
    if (npc) {
      await setNpcDisposition(npc.id, clampDisposition(npc.disposition + outcome.dispositionDelta));
    }
  }

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "hook_negotiated",
    summary: outcome.summary,
    data: {
      ask,
      success,
      payout: outcome.terms.payout,
      situationKey: hook.situationKey,
    } as unknown as Json,
  });

  const resolved = [
    `The player pushed on the offer (${spec.label.toLowerCase()}) and the ${pending.skillName} check is RESOLVED: ${success ? "SUCCESS" : "FAILURE"}.`,
    `The engine has already applied it: ${outcome.summary}`,
    outcome.revealed ? `They now know this, and did not before: ${outcome.revealed}` : "",
    read ? `Leaning on them that hard also showed something: ${read} Play it as a tell.` : "",
    `Narrate the exchange in ${hook.offer.brokerName}'s voice. Do not change the fee, do not add terms, and do not offer anything the engine did not.`,
  ]
    .filter(Boolean)
    .join(" ");

  const fresh: LifeBundle = {
    ...bundle,
    events: await listCampaignEvents(campaignId),
    hook: { ...hook, terms: outcome.terms },
  };
  await liveTurn(fresh, "", { minutes: spec.minutes, resolved });
}

export function useLife(campaignId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["life", campaignId], queryFn: () => loadLife(campaignId) });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["life", campaignId] });
    void queryClient.invalidateQueries({ queryKey: ["play", campaignId] });
    void queryClient.invalidateQueries({ queryKey: ["campaign-phase", campaignId] });
  };

  const bundle = query.data;

  const turn = useMutation({
    mutationFn: ({ input, ...rest }: { input: string } & TurnOptions) => {
      if (!bundle) throw new Error("Still loading.");
      return liveTurn(bundle, input, rest);
    },
    onSuccess: invalidate,
  });

  const check = useMutation({
    mutationFn: ({ pending, roll }: { pending: PendingCheck; roll: CheckRoll }) => {
      if (!bundle) throw new Error("Still loading.");
      return commitLifeCheck(bundle, pending, roll);
    },
    onSuccess: invalidate,
  });

  const accept = useMutation({
    mutationFn: () => {
      if (!bundle) throw new Error("Still loading.");
      return acceptHook(bundle);
    },
    onSuccess: invalidate,
  });

  const decline = useMutation({
    mutationFn: (reason: string) => {
      if (!bundle) throw new Error("Still loading.");
      return declineHook(bundle, reason);
    },
    onSuccess: invalidate,
  });

  const push = useMutation({
    mutationFn: (ask: HookAsk) => {
      if (!bundle) throw new Error("Still loading.");
      return pushHook(bundle, ask);
    },
    onSuccess: invalidate,
  });

  const travel = useMutation({
    mutationFn: (to: string) => {
      if (!bundle) throw new Error("Still loading.");
      return travelTo({ campaign: bundle.campaign, clock: bundle.clock, to });
    },
    onSuccess: invalidate,
  });

  const fixedNarration = useMutation({
    mutationFn: async (resolved: string) => {
      // Installation has already moved money, Humanity, phase, and the clock.
      // Reload before prompting so the model never sees the pre-op vitals.
      const fresh = await loadLife(campaignId);
      return liveTurn(fresh, "", { minutes: 0, resolved, fixedResult: true });
    },
    onSuccess: invalidate,
  });

  const pendingCheck = bundle
    ? (pendingChecksFrom(
        bundle.events,
        bundle.character,
        bundle.vitals.wound_state as WoundStateCode,
        { vitals: bundle.vitals, inventory: bundle.inventory },
      )[0] ?? null)
    : null;

  /**
   * Options, when the player last asked for them. Empty on an ordinary turn:
   * Life does not hand out a menu, so the next turn clears these by returning
   * none of its own.
   */
  const actions: LifeActionCard[] = (() => {
    if (!bundle) return [];
    for (let i = bundle.events.length - 1; i >= 0; i -= 1) {
      const event = bundle.events[i];
      if (!event) continue;
      if (event.type !== "life_options" && event.type !== "life_narration") continue;
      // Whichever came last wins, so acting on anything clears the list: an
      // ordinary turn always answers with none of its own.
      const data = event.data as { actions?: unknown } | null;
      return Array.isArray(data?.actions) ? (data.actions as LifeActionCard[]) : [];
    }
    return [];
  })();

  const latestNarration = (() => {
    if (!bundle) return null;
    for (let i = bundle.events.length - 1; i >= 0; i -= 1) {
      const event = bundle.events[i];
      if (event?.type === "life_narration") {
        const data = event.data as { title?: unknown } | null;
        return {
          title: typeof data?.title === "string" ? data.title : "Night City",
          text: event.summary ?? "",
        };
      }
    }
    return null;
  })();

  return {
    bundle,
    isPending: query.isPending,
    error: query.error as Error | null,
    phase: bundle?.phase ?? "life",
    clock: bundle?.clock ?? { day: 1, minute: 1080 },
    situation: bundle?.current ?? null,
    situations: bundle?.situations.filter((s) => s.status === "live") ?? [],
    /** The people this character actually knows, as the player may see them. */
    people: bundle ? lifePeople(bundle.npcs) : [],
    clocks: bundle?.pressure.filter((p) => !p.clock.hidden).map((p) => p.clock) ?? [],
    /** Organisations with an opinion, for the Standing panel. */
    standings: bundle?.standings ?? [],
    hook: bundle?.hook ?? null,
    narration: latestNarration,
    actions,
    pendingCheck,
    busy:
      turn.isPending ||
      check.isPending ||
      accept.isPending ||
      decline.isPending ||
      push.isPending ||
      travel.isPending ||
      fixedNarration.isPending,
    actionError:
      ((turn.error ??
        check.error ??
        accept.error ??
        decline.error ??
        push.error ??
        travel.error ??
        fixedNarration.error) as Error | null) ?? null,
    /**
     * Act on what the player typed. How long it took is the model's report of
     * the action, clamped by the engine: there is no menu entry carrying a
     * duration any more, because there is no menu.
     */
    act: async (input: string) => {
      try {
        await turn.mutateAsync({ input });
        return true;
      } catch {
        return false;
      }
    },
    openMoment: () => turn.mutate({ input: "", minutes: 0 }),
    /** Ask what the angles are. Thinking about it costs no time. */
    askOptions: () => turn.mutate({ input: "", minutes: 0, options: true }),
    commitCheck: (pending: PendingCheck, roll: CheckRoll) => check.mutate({ pending, roll }),
    checkBusy: check.isPending,
    acceptHook: () => accept.mutate(),
    declineHook: (reason: string) => decline.mutate(reason),
    pushHook: (ask: HookAsk) => push.mutate(ask),
    /** Cross the city. The engine prices the trip; the clock pays for it. */
    travelTo: (to: string) => travel.mutate(to),
    travelBusy: travel.isPending,
    narrateFixedResult: async (resolved: string) => {
      try {
        await fixedNarration.mutateAsync(resolved);
        return true;
      } catch {
        return false;
      }
    },
  };
}
