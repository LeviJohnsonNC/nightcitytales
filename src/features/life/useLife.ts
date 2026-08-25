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
  clampActionMinutes,
  getMission,
  getSkill,
  jobIdForSeed,
  judgeAction,
  luckPoolMax,
  mergeSituations,
  nextPhase,
  resolveSkillId,
  rollJobSeed,
  selectSituation,
  startMission,
  tickClock,
  TIME_COSTS,
  type GameClock,
  type GamePhase,
  type LifeClock,
  type LifeSituation,
  type WoundStateCode,
} from "@/engine";
import {
  appendCampaignEvent,
  getCampaign,
  getCharacter,
  listCampaignEvents,
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
  type CampaignInventoryItem,
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
import { renderLifeUserPrompt, type LifeContext } from "./lifeContext";
import { lifeTurnFn } from "./lifeTurn.server";
import type { LifeActionCard, LifeResponse } from "./lifeResponse";
import {
  campaignPhase,
  clockFromRow,
  derivedSituations,
  lifePeople,
  recentLifeLines,
  situationFromRow,
  situationToUpsert,
} from "./lifeModel";

export type LifeHook = {
  situationKey: string;
  title: string;
  patron: string;
  npcKey: string;
  payout: number;
  summary: string;
};

export type LifeBundle = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
  npcs: CampaignNpc[];
  events: CampaignEvent[];
  phase: GamePhase;
  clock: GameClock;
  situations: LifeSituation[];
  clocks: LifeClock[];
  /** The one situation this turn is about. */
  current: LifeSituation | null;
  /** The offer on the table, when the campaign is in the hook phase. */
  hook: LifeHook | null;
};

/** Turn the persisted hook situation back into an offer the UI can render. */
function hookFrom(situations: LifeSituation[]): LifeHook | null {
  const hook = situations.find((s) => s.category === "hook" && s.status === "live");
  if (!hook) return null;
  const data = (hook.data ?? {}) as Record<string, unknown>;
  return {
    situationKey: hook.key,
    title: hook.title,
    patron: typeof data["patron"] === "string" ? data["patron"] : "someone with your number",
    npcKey: hook.npcKey ?? "",
    payout: typeof data["payout"] === "number" ? data["payout"] : 0,
    summary: hook.summary,
  };
}

async function loadLife(campaignId: string): Promise<LifeBundle> {
  const full = await getCampaign(campaignId);
  if (!full) throw new Error("Campaign not found.");
  if (!full.vitals) throw new Error("Campaign has no vitals to live with.");

  const character = await getCharacter(full.campaign.character_id);
  if (!character) throw new Error("This campaign's character no longer exists.");

  const [events, situationRows, clockRows] = await Promise.all([
    listCampaignEvents(campaignId),
    listSituations(campaignId),
    listClocks(campaignId),
  ]);

  const clock: GameClock = { day: full.campaign.day, minute: full.campaign.minute };
  const input = {
    campaign: full.campaign,
    vitals: full.vitals,
    character,
    inventory: full.inventory,
    npcs: full.npcs,
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

  return {
    ...input,
    events,
    phase: campaignPhase(full.campaign),
    clock,
    situations: merged,
    clocks: clockRows.map(clockFromRow),
    current: selectSituation(merged, clock.day, lastShownKey),
    hook: hookFrom(merged),
  };
}

/** The context slice the Life model reasons over. Deterministic and small. */
function buildContext(bundle: LifeBundle, resolved?: string): LifeContext {
  const summary = characterSummary(bundle.character, bundle.vitals);
  const capability = buildCapabilitySnapshot({
    character: bundle.character,
    vitals: bundle.vitals,
    inventory: bundle.inventory,
    encounter: null,
    events: bundle.events,
    beatId: null,
  });

  return {
    clock: bundle.clock,
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
      skills: gmSkillList(bundle.character).map((s) => ({
        skill: getSkill(s.id).name,
        id: s.id,
        base: s.base,
      })),
    },
    situation: bundle.current,
    otherSituations: bundle.situations.filter(
      (s) => s.status === "live" && s.key !== bundle.current?.key,
    ),
    clocks: bundle.clocks,
    people: lifePeople(bundle.npcs),
    recentEvents: recentLifeLines(bundle.events),
    capabilities: renderCapabilityLines(capability),
    ...(resolved ? { resolved } : {}),
  };
}

/** Persist a clock delta and the situations/flags the turn produced. */
async function applyResponse(
  bundle: LifeBundle,
  response: LifeResponse,
  minutes: number,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const spent = clampActionMinutes(minutes);

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "life_narration",
    summary: response.resolution ?? response.situation.description,
    data: {
      situationKey: bundle.current?.key ?? null,
      title: response.situation.title,
      actions: response.actions,
    } as unknown as Json,
  });

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

  for (const action of response.proposedActions) {
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
      // A job OFFER, never a job. The phase moves to `hook`, which only unlocks
      // an Accept button; nothing else about the campaign changes.
      const key = `hook_${action.npcKey}_${bundle.clock.day}`;
      await upsertSituations(campaignId, [
        {
          situationKey: key,
          category: "hook",
          title: action.title,
          summary: action.summary,
          npcKey: action.npcKey,
          status: "live",
          severity: 3,
          data: { patron: action.patron, payout: action.payout } as unknown as Json,
        },
      ]);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "hook_offered",
        summary: `${action.patron} offers work: ${action.title} (${action.payout}eb)`,
        data: { situationKey: key, payout: action.payout } as unknown as Json,
      });
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
        await setNpcDisposition(npc.id, Math.max(-5, Math.min(5, npc.disposition + delta.delta)));
      }
    } else if (delta.kind === "clock") {
      const existing = bundle.clocks.find((c) => c.key === delta.clockKey);
      const base: LifeClock = existing ?? {
        key: delta.clockKey,
        label: delta.label,
        filled: 0,
        segments: delta.segments,
        hidden: delta.hidden,
      };
      const ticked = tickClock(base, delta.delta);
      await upsertClock(campaignId, {
        clockKey: ticked.key,
        label: ticked.label,
        filled: ticked.filled,
        segments: ticked.segments,
        hidden: ticked.hidden,
      });
    } else if (delta.kind === "note") {
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "life_note",
        summary: delta.text,
        data: {} as Json,
      });
    }
  }

  if (response.newSituation) {
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

/** One Life turn: the player says (or picks) something, the world answers. */
async function liveTurn(
  bundle: LifeBundle,
  input: string,
  minutes: number,
  resolved?: string,
): Promise<void> {
  if (input.trim()) {
    await appendCampaignEvent({
      campaign_id: bundle.campaign.id,
      type: "player_input",
      summary: input,
      data: {} as Json,
    });
  }
  const context = buildContext(bundle, resolved);
  const response = await lifeTurnFn({
    data: { userPrompt: renderLifeUserPrompt(context, input || "(open the moment)") },
  });
  await applyResponse(bundle, response, minutes);
}

/** Roll a Life check the player pressed, then let the world answer it. */
async function commitLifeCheck(
  bundle: LifeBundle,
  pending: PendingCheck,
  roll: CheckRoll,
): Promise<void> {
  const campaignId = bundle.campaign.id;
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
    const fresh = { ...bundle, events: await listCampaignEvents(campaignId) };
    await liveTurn(
      fresh,
      "",
      0,
      `The ${pending.skillName} check against ${pending.opposition?.npcName ?? "them"} is RESOLVED: ${verdict}, for the intent "${pending.intent}".`,
    );
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
  await liveTurn(
    fresh,
    "",
    0,
    `The ${pending.skillName} check is RESOLVED. ${roll.result.formula}. Outcome: ${verdict} by ${Math.abs(roll.result.total - dv)}, for the intent "${pending.intent}".`,
  );
}

/**
 * The ONLY door into a job. Pressed by the player, never by a turn: the hook is
 * marked taken, a mission is started, and the phase moves to `job`, at which
 * point the existing play machinery owns the screen.
 */
async function acceptHook(bundle: LifeBundle): Promise<void> {
  if (!bundle.hook) throw new Error("There is no offer on the table.");
  const campaignId = bundle.campaign.id;
  const to = nextPhase(bundle.phase, "accept_hook");
  if (!to) throw new Error("This campaign is not holding an offer right now.");

  const missionId = jobIdForSeed(rollJobSeed());
  const mission = getMission(missionId);
  await saveMissionRuntime(campaignId, startMission(mission));
  await updateCampaign(campaignId, {
    current_mission_id: missionId,
    ip_awarded: null,
    status: "active",
  });
  // A job is a session: the Luck Pool refills on the same boundary IP is awarded on.
  await updateCampaignVitals(campaignId, {
    luck_current: luckPoolMax(statsRecord(bundle.character)),
  });
  await setSituationStatus(campaignId, bundle.hook.situationKey, "resolved");
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "mission_started",
    summary: `Took the job: ${bundle.hook.title} — ${bundle.hook.patron}`,
    data: { missionId, payout: bundle.hook.payout } as unknown as Json,
  });
  await setCampaignPhase(campaignId, to);
}

/** Turn the offer down (or let it go cold). The campaign goes back to living. */
async function declineHook(bundle: LifeBundle, reason: string): Promise<void> {
  if (!bundle.hook) return;
  const campaignId = bundle.campaign.id;
  await setSituationStatus(campaignId, bundle.hook.situationKey, "expired");
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "hook_declined",
    summary: `Passed on ${bundle.hook.title}.`,
    data: { reason } as unknown as Json,
  });
  const to = nextPhase(bundle.phase, "decline_hook");
  if (to) await setCampaignPhase(campaignId, to);
  const fresh = { ...bundle, events: await listCampaignEvents(campaignId) };
  await liveTurn(
    fresh,
    `I turn the work down. ${reason}`.trim(),
    TIME_COSTS.conversation,
    `The player DECLINED the offer "${bundle.hook.title}". Let ${bundle.hook.patron} react in character and move on. Do not offer the same job again this turn.`,
  );
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
    mutationFn: ({ input, minutes }: { input: string; minutes: number }) => {
      if (!bundle) throw new Error("Still loading.");
      return liveTurn(bundle, input, minutes);
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

  const pendingCheck = bundle
    ? (pendingChecksFrom(
        bundle.events,
        bundle.character,
        bundle.vitals.wound_state as WoundStateCode,
      )[0] ?? null)
    : null;

  /** The three offered actions from the most recent Life turn. */
  const actions: LifeActionCard[] = (() => {
    if (!bundle) return [];
    for (let i = bundle.events.length - 1; i >= 0; i -= 1) {
      const event = bundle.events[i];
      if (!event || event.type !== "life_narration") continue;
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
    clocks: bundle?.clocks.filter((c) => !c.hidden) ?? [],
    hook: bundle?.hook ?? null,
    narration: latestNarration,
    actions,
    pendingCheck,
    busy: turn.isPending || check.isPending || accept.isPending || decline.isPending,
    actionError:
      ((turn.error ?? check.error ?? accept.error ?? decline.error) as Error | null) ?? null,
    /** Resolves true when the turn landed, false when it failed. */
    act: async (input: string, minutes: number = TIME_COSTS.quick) => {
      try {
        await turn.mutateAsync({ input, minutes });
        return true;
      } catch {
        return false;
      }
    },
    openMoment: () => turn.mutate({ input: "", minutes: 0 }),
    commitCheck: (pending: PendingCheck, roll: CheckRoll) => check.mutate({ pending, roll }),
    checkBusy: check.isPending,
    acceptHook: () => accept.mutate(),
    declineHook: (reason: string) => decline.mutate(reason),
  };
}
