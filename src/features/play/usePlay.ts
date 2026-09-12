/**
 * The play loop, bound to React.
 *
 * The turn logic is in playOps.ts and knows nothing about React; this is the
 * half that wires it to TanStack Query — the bundle query, a mutation per
 * player action, and the invalidation that follows each one.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { type AttackOption, type PendingAttack, pendingAttackFrom } from "./attackPrompt";
import {
  type CheckRoll,
  type PendingCheck,
  oppositionFor,
  pendingChecksFrom,
  rollHistory,
} from "./checkPrompt";
import { type PendingDeathSave, pendingDeathSaveFrom } from "./deathSavePrompt";
import { actorFor, jobOutcome, statsRecord } from "./playModel";
import {
  combatAwarenessAllocation,
  combatAwarenessFor,
  execTeam,
  liveRoleAbility,
  makerSpecialties,
  makerSpecialtyBudget,
  medicineDoses,
  medicineSpecialties,
  pendingBackup,
  roleCheckModifiers,
  withAbilityState,
} from "./roleAbilityModel";
import { useCombatPlayback } from "./useCombatPlayback";
import {
  type BackupCall,
  type BeatExit,
  type BeginTurnResult,
  type CharismaticImpactResult,
  DEFAULT_START,
  type IpPlaystyle,
  type PerformAttackResult,
  type Point,
  type WoundStateCode,
  backupTierFor,
  beginTurn,
  callBackup,
  charismaticImpactCheck,
  clampLuckSpend,
  luckModifier,
  luckPoolMax,
  luckRemaining,
  opposedCheckForCharacter,
  performAttack,
  previewAttack,
  resolvePosition,
  skillCheckForCharacter,
  woundActionPenalty,
} from "@/engine";
import { type Json, appendCampaignEvent, updateCampaign } from "@/lib/backend";
import {
  commitAttack,
  commitBackupCall,
  commitBoardMove,
  commitCallShot,
  commitCharismaticImpact,
  commitCheck,
  commitDeathSave,
  commitReload,
  endPlayerTurn,
  latestSuggestions,
  loadPlay,
  narrate,
  needsOpeningScene,
  newestPrompt,
  openScene,
  owesASave,
  returnToLife,
  settleIp,
  snapshotFor,
  takeExit,
} from "./playOps";
import type { IpTally, PlayBundle } from "./playOps";

export function usePlay(campaignId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["play", campaignId], queryFn: () => loadPlay(campaignId) });

  const playback = useCombatPlayback(campaignId, query.data?.encounter ?? null);
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["play", campaignId] }),
      queryClient.invalidateQueries({ queryKey: ["campaign-phase", campaignId] }),
      queryClient.invalidateQueries({ queryKey: ["life", campaignId] }),
    ]);

  const turn = useMutation({
    mutationFn: (input: string) => {
      if (!query.data) throw new Error("Still loading.");
      return narrate(query.data, input);
    },
    onSuccess: invalidate,
  });

  /**
   * "What are my options?" — a turn that does not advance the scene. The GM
   * names angles it can already see; the fiction stays exactly where it was.
   */
  const options = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error("Still loading.");
      return narrate(query.data, "(What are my options here?)", { optionsRequested: true });
    },
    onSuccess: invalidate,
  });

  const choose = useMutation({
    mutationFn: (exit: BeatExit) => {
      if (!query.data) throw new Error("Still loading.");
      return takeExit(query.data, exit);
    },
    onSuccess: invalidate,
  });

  const open = useMutation({
    mutationFn: (bundle: PlayBundle) => openScene(bundle),
    onSuccess: invalidate,
  });

  const check = useMutation({
    mutationFn: ({ pending, roll }: { pending: PendingCheck; roll: CheckRoll }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitCheck(query.data, pending, roll);
    },
    onSuccess: invalidate,
  });

  /**
   * A write the fight moved on past.
   *
   * The state it was computed from is gone, so the answer is never to retry the
   * same payload — it is to re-read. Invalidating here is what makes the next
   * attempt work; without it the bundle keeps its stale version token and every
   * retry refuses itself.
   */
  const onWriteError = () => {
    // A later ledger write may fail after an encounter save succeeded. Refresh
    // on every error so playback cannot leave the screen waiting on stale state.
    void invalidate();
  };

  const combat = useMutation({
    onError: onWriteError,
    mutationFn: ({
      pending,
      option,
      result,
      luckSpent,
    }: {
      pending: PendingAttack;
      option: AttackOption;
      result: PerformAttackResult;
      luckSpent: number;
    }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitAttack(query.data, pending, option, result, luckSpent);
    },
    onSuccess: invalidate,
  });

  // The board's own actions. Neither goes near the model on the way in: the
  // engine prices and resolves them, and the GM is told what happened after.
  const boardMove = useMutation({
    onError: onWriteError,
    mutationFn: (to: Point) => {
      if (!query.data) throw new Error("Still loading.");
      return commitBoardMove(query.data, to);
    },
    onSuccess: invalidate,
  });

  const callShot = useMutation({
    onError: onWriteError,
    mutationFn: ({ targetId, weaponItemId }: { targetId: string; weaponItemId: string }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitCallShot(query.data, targetId, weaponItemId);
    },
    onSuccess: invalidate,
  });

  const cancelShot = useMutation({
    mutationFn: async (promptId: string) => {
      if (!query.data) throw new Error("Still loading.");
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "attack_cancelled",
        data: { promptId },
      });
    },
    onSuccess: invalidate,
  });

  const reload = useMutation({
    onError: onWriteError,
    mutationFn: (weaponItemId: string) => {
      if (!query.data) throw new Error("Still loading.");
      return commitReload(query.data, weaponItemId);
    },
    onSuccess: invalidate,
  });

  const endTurn = useMutation({
    onError: onWriteError,
    mutationFn: () => {
      if (!query.data) throw new Error("Still loading.");
      return endPlayerTurn(query.data);
    },
    onSuccess: invalidate,
  });

  const death = useMutation({
    onError: onWriteError,
    mutationFn: ({ pending, result }: { pending: PendingDeathSave; result: BeginTurnResult }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitDeathSave(query.data, pending, result);
    },
    onSuccess: invalidate,
  });

  const ip = useMutation({
    mutationFn: (playstyles: { primary: IpPlaystyle; secondary: IpPlaystyle }) => {
      if (!query.data) throw new Error("Still loading.");
      return settleIp(query.data, playstyles);
    },
    onSuccess: invalidate,
  });

  // Open a fresh beat automatically, once, so the player never faces a blank scene.
  const opened = useRef<string | null>(null);
  const bundle = query.data;
  useEffect(() => {
    if (!bundle || open.isPending || turn.isPending || choose.isPending) return;
    if (open.error) return; // A failed opening waits for an explicit retry.
    if (!needsOpeningScene(bundle)) return;
    const key = `${bundle.campaign.id}:${bundle.beat?.id ?? ""}`;
    if (opened.current === key) return;
    opened.current = key;
    open.mutate(bundle);
  }, [bundle, open, turn.isPending, choose.isPending]);

  const actionError =
    (turn.error as Error | null) ??
    (options.error as Error | null) ??
    (choose.error as Error | null) ??
    (open.error as Error | null) ??
    (check.error as Error | null) ??
    (combat.error as Error | null) ??
    // The board's own actions failed silently before this: they were never in
    // the list the screen reads.
    (boardMove.error as Error | null) ??
    (endTurn.error as Error | null) ??
    (reload.error as Error | null) ??
    (cancelShot.error as Error | null) ??
    (callShot.error as Error | null) ??
    (death.error as Error | null);

  // Exactly one card is ever live: a Death Save outranks everything (you cannot
  // act until you have made it), then whichever prompt the GM posted last.
  const pendingDeathSave = bundle ? pendingDeathSaveFrom(bundle.events, bundle.encounter) : null;
  const checkQueue =
    bundle && !pendingDeathSave
      ? pendingChecksFrom(
          bundle.events,
          bundle.character,
          bundle.vitals.wound_state as WoundStateCode,
          {
            vitals: bundle.vitals,
            inventory: bundle.inventory,
            // A Local Expert card must promise the Level for the district the
            // character is standing in, not the one they happen to know.
            districtKey:
              resolvePosition(bundle.campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
          },
        )
      : [];
  const checkCandidate = checkQueue[0] ?? null;
  const attackCandidate =
    bundle && !pendingDeathSave
      ? pendingAttackFrom(
          bundle.events,
          bundle.character,
          bundle.encounter,
          bundle.inventory,
          bundle.vitals,
        )
      : null;
  const newest = bundle ? newestPrompt(bundle.events, checkCandidate, attackCandidate) : null;
  const pendingCheck = newest === "check" ? checkCandidate : null;
  const pendingAttack = newest === "attack" ? attackCandidate : null;

  // A Solo re-divides their Combat Awareness when combat begins or outside it,
  // and the division persists until they change it — so it is campaign state,
  // not something the card holds.
  const awarenessMutation = useMutation({
    mutationFn: (allocation: Record<string, number>) => {
      if (!query.data) throw new Error("Still loading.");
      const campaign = query.data.campaign;
      return updateCampaign(campaign.id, {
        role_state: withAbilityState(campaign, "combat_awareness", { allocation }) as Json,
      });
    },
    onSuccess: invalidate,
  });

  const backupMutation = useMutation({
    mutationFn: (call: BackupCall) => {
      if (!query.data) throw new Error("Still loading.");
      return commitBackupCall(query.data, call);
    },
    onSuccess: invalidate,
  });

  const specialtyMutation = useMutation({
    mutationFn: (specialties: Record<string, number>) => {
      if (!query.data) throw new Error("Still loading.");
      const campaign = query.data.campaign;
      return updateCampaign(campaign.id, {
        role_state: withAbilityState(campaign, "maker", { specialties }) as Json,
      });
    },
    onSuccess: invalidate,
  });

  // Specialty divisions and team rosters are all one shape: a blob under the
  // ability's own key in role_state.
  const abilityStateMutation = useMutation({
    mutationFn: ({ abilityId, state }: { abilityId: string; state: Record<string, unknown> }) => {
      if (!query.data) throw new Error("Still loading.");
      const campaign = query.data.campaign;
      return updateCampaign(campaign.id, {
        role_state: withAbilityState(campaign, abilityId, state) as Json,
      });
    },
    onSuccess: invalidate,
  });

  const charismaMutation = useMutation({
    mutationFn: (result: CharismaticImpactResult) => {
      if (!query.data) throw new Error("Still loading.");
      return commitCharismaticImpact(query.data, result);
    },
    onSuccess: invalidate,
  });

  const nextJobMutation = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error("Still loading.");
      return returnToLife(query.data);
    },
    onSuccess: invalidate,
  });

  const retry = () => {
    if (!bundle) return;
    if (open.error) {
      open.reset();
      open.mutate(bundle);
      return;
    }
    if (turn.error) {
      const last = turn.variables;
      turn.reset();
      if (last) turn.mutate(last);
      return;
    }
    if (choose.error) {
      const last = choose.variables;
      choose.reset();
      if (last) choose.mutate(last);
    }
  };

  return {
    bundle,
    isPending: query.isPending,
    error: query.error as Error | null,
    /** Resolves true when the turn landed, false when it failed. */
    submit: async (input: string) => {
      try {
        await turn.mutateAsync(input);
        return true;
      } catch {
        return false;
      }
    },
    choose: (exit: BeatExit) => choose.mutate(exit),
    askOptions: () => options.mutate(),
    suggestions:
      pendingCheck || pendingAttack || pendingDeathSave
        ? []
        : bundle
          ? latestSuggestions(bundle)
          : [],

    /**
     * What the character can actually do right now, so the cards can grey out
     * the impossible instead of letting the player roll for it.
     */
    capability: bundle
      ? snapshotFor(playback.frame ? { ...bundle, encounter: playback.frame.live } : bundle)
      : null,
    playback,

    /** The check waiting on the player's die, if any. */
    pendingCheck,
    /** How many checks are on the table, so the UI can say another is coming. */
    pendingCheckCount: pendingCheck ? checkQueue.length : 0,
    /**
     * Roll the pending check — the engine decides the numbers. An opposed check
     * rolls BOTH sides here, in one call, so the two dice the card reveals are
     * the two the engine actually rolled.
     */
    rollCheck: (pending: PendingCheck, luckSpend = 0): CheckRoll => {
      if (!bundle) throw new Error("Still loading.");
      const actor = actorFor(bundle.character, {
        vitals: bundle.vitals,
        inventory: bundle.inventory,
        // A Local Expert check is about the neighbourhood the character is
        // standing in, and is worth nothing in one they are not a local in.
        districtKey:
          resolvePosition(bundle.campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
      });
      // Clamp against the live pool, not against what the card offered: the
      // stepper cannot talk the engine into spending points that are not there.
      const luckSpent = clampLuckSpend(
        luckSpend,
        luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character)),
      );
      const spend = luckModifier(luckSpent);
      // Being hurt follows you out of the fight: the same −2/−4 the engine
      // already applies to attacks now rides on every other Check too.
      const wounds = woundActionPenalty(bundle.vitals.wound_state as WoundStateCode);
      const situational = [
        ...(spend ? [spend] : []),
        ...(wounds !== 0 ? [{ label: "Wounds", value: wounds }] : []),
        // What your Role brings to this particular check — a Solo's Threat
        // Detection on a Perception roll, a Fixer's Operator Rank on a deal.
        ...roleCheckModifiers({
          campaign: bundle.campaign,
          character: bundle.character,
          skillId: pending.skillId,
        }),
      ];
      const modifiers = situational.length > 0 ? { modifiers: situational } : {};
      const opposition = oppositionFor(pending);
      if (opposition) {
        return {
          kind: "opposed",
          luckSpent,
          result: opposedCheckForCharacter(actor, pending.skillId, opposition, undefined, {
            actorName: bundle.character.character.name,
            ...modifiers,
          }),
        };
      }
      if (pending.dv === null) throw new Error("That check has neither a DV nor an opponent.");
      return {
        kind: "dv",
        luckSpent,
        result: skillCheckForCharacter(actor, pending.skillId, pending.dv, undefined, modifiers),
      };
    },
    /** The character's Role Ability and Rank, for the panel that spends it. */
    roleAbility: bundle ? liveRoleAbility(bundle.character) : null,
    /** A Solo's live Combat Awareness division, or null for every other Role. */
    combatAwareness: bundle ? combatAwarenessFor(bundle.campaign, bundle.character) : null,
    /** The points as currently assigned, for the panel to edit. */
    combatAwarenessAllocation: bundle ? combatAwarenessAllocation(bundle.campaign) : {},
    /** Re-divide the pool. Rejected by the engine if it does not fit. */
    setCombatAwareness: (allocation: Record<string, number>) =>
      awarenessMutation.mutate(allocation),
    combatAwarenessBusy: awarenessMutation.isPending,
    /** Roll a Rockerboy's Charismatic Impact — the engine decides the number. */
    rollCharismaticImpact: (audienceId: string): CharismaticImpactResult => {
      if (!bundle) throw new Error("Still loading.");
      const ability = liveRoleAbility(bundle.character);
      if (!ability || ability.info.abilityId !== "charismatic_impact") {
        throw new Error("That is not your Role Ability.");
      }
      return charismaticImpactCheck(ability.rank, audienceId);
    },
    /** Record it and let the GM narrate the room. */
    commitCharismaticImpact: (result: CharismaticImpactResult) => charismaMutation.mutate(result),
    charismaBusy: charismaMutation.isPending,

    /** Lawman: roll to see whether anyone answers the call. */
    rollBackup: (): BackupCall => {
      if (!bundle) throw new Error("Still loading.");
      const ability = liveRoleAbility(bundle.character);
      if (!ability || ability.info.abilityId !== "backup") {
        throw new Error("That is not your Role Ability.");
      }
      return callBackup(ability.rank);
    },
    commitBackupCall: (call: BackupCall) => backupMutation.mutate(call),
    backupBusy: backupMutation.isPending,
    /** The group this Rank can call, for the panel to name before the roll. */
    backupTier: bundle ? backupTierFor(liveRoleAbility(bundle.character)?.rank ?? 0) : null,
    /** Help already on its way, if a call has landed. */
    pendingBackup: bundle ? pendingBackup(bundle.campaign) : null,

    /** Tech: the Maker Specialty division and its budget. */
    makerSpecialties: bundle ? makerSpecialties(bundle.campaign) : {},
    makerBudget: bundle ? makerSpecialtyBudget(bundle.campaign, bundle.character) : null,
    setMakerSpecialties: (specialties: Record<string, number>) =>
      specialtyMutation.mutate(specialties),
    makerBusy: specialtyMutation.isPending,

    /** Medtech: Specialty points and the doses they have on hand. */
    medicineSpecialties: bundle ? medicineSpecialties(bundle.campaign) : {},
    medicineDoses: bundle ? medicineDoses(bundle.campaign) : {},
    setMedicineSpecialties: (specialties: Record<string, number>) =>
      abilityStateMutation.mutate({
        abilityId: "medicine",
        state: { specialties, doses: bundle ? medicineDoses(bundle.campaign) : {} },
      }),
    setMedicineDoses: (doses: Record<string, number>) =>
      abilityStateMutation.mutate({
        abilityId: "medicine",
        state: { specialties: bundle ? medicineSpecialties(bundle.campaign) : {}, doses },
      }),

    /** Exec: the team and the slots their Rank supports. */
    execTeam: bundle ? execTeam(bundle.campaign, bundle.character) : null,
    setExecTeam: (members: unknown[]) =>
      abilityStateMutation.mutate({ abilityId: "teamwork", state: { members } }),
    abilityStateBusy: abilityStateMutation.isPending,
    /** The Luck Pool as the table sees it: what is left, and what it holds full. */
    luck: {
      remaining: bundle
        ? luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character))
        : 0,
      max: bundle ? luckPoolMax(statsRecord(bundle.character)) : 0,
    },
    /** Record the rolled check and let the GM narrate the outcome. */
    commitCheck: (pending: PendingCheck, roll: CheckRoll) => check.mutate({ pending, roll }),
    checkBusy: check.isPending,
    /** The attack waiting on the player's dice, if any. */
    pendingAttack,
    /** The live fight, for the board and the initiative/status rail. */
    encounter: playback.frame?.live ?? bundle?.encounter ?? null,
    /**
     * Walk to a spot on the board. The engine decides how far they get; a
     * Move does not end the Turn, so the Action is still theirs afterwards.
     */
    moveTo: (to: Point) => boardMove.mutate(to),
    /** Put rounds back in a gun, spending the Action the gate prices it at. */
    reload: (weaponItemId: string) => reload.mutate(weaponItemId),
    /** Call a shot on somebody, which posts the prompt the card resolves. */
    cancelShot: () => {
      if (pendingAttack) cancelShot.mutate(pendingAttack.eventId);
    },
    callShot: (targetId: string, weaponItemId: string) =>
      callShot.mutate({ targetId, weaponItemId }),
    /** Give up the rest of the Turn and let the hostiles take theirs. */
    endTurn: () => endTurn.mutate(),
    /**
     * True while a Turn is being spent or handed over. The board is inert
     * throughout: a click landing mid-narration would be computed against a
     * bundle the server has already moved past, and combatant positions are
     * written last-write-wins.
     */
    turnBusy: boardMove.isPending || endTurn.isPending || reload.isPending || callShot.isPending,
    /** Roll the attack — the engine resolves To-Hit, damage and armor. */
    rollAttack: (
      pending: PendingAttack,
      option: AttackOption,
      luckSpend = 0,
    ): PerformAttackResult => {
      if (!bundle?.encounter) throw new Error("There is no encounter to attack in.");
      const preview = previewAttack(snapshotFor(bundle), pending.target.id, option.weapon.itemId);
      if (preview.gap || preview.dv === null)
        throw new Error(preview.gap ?? "No ranged shot here.");
      if (owesASave(bundle)) throw new Error("Resolve the Death Save first.");
      // An attack roll is a Check, so Luck rides on it exactly as it does on a
      // Persuasion roll.
      const spend = luckModifier(
        clampLuckSpend(
          luckSpend,
          luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character)),
        ),
      );
      // A Solo's Precision Attack rides on the To-Hit roll.
      const awareness = combatAwarenessFor(bundle.campaign, bundle.character);
      const attackModifiers = [
        ...(spend ? [spend] : []),
        ...(awareness && awareness.attack > 0
          ? [{ label: "Precision Attack", value: awareness.attack }]
          : []),
      ];
      return performAttack(bundle.encounter.state, {
        attackerId: pending.attacker.id,
        targetId: pending.target.id,
        statLabel: option.statLabel,
        statValue: option.statValue,
        skillLabel: option.skillLabel,
        skillValue: option.skillValue,
        dv: preview.dv,
        damageDice: option.damageDice ?? 0,
        ...(attackModifiers.length > 0 ? { modifiers: attackModifiers } : {}),
      });
    },
    /** Record the rolled attack, run the hostile turns, and narrate the result. */
    commitAttack: (
      pending: PendingAttack,
      option: AttackOption,
      result: PerformAttackResult,
      luckSpent = 0,
    ) => combat.mutate({ pending, option, result, luckSpent }),
    combatBusy: combat.isPending,
    /** The Death Save the player owes before acting, if any. */
    pendingDeathSave,
    /** Roll the Death Save — the engine rolls it and applies the outcome. */
    rollDeathSave: (): BeginTurnResult => {
      if (!bundle?.encounter) throw new Error("There is no encounter to save against.");
      return beginTurn(bundle.encounter.state);
    },
    /** Record the rolled Death Save and let the GM narrate it. */
    commitDeathSave: (pending: PendingDeathSave, result: BeginTurnResult) =>
      death.mutate({ pending, result }),
    deathBusy: death.isPending,
    rolls: bundle ? rollHistory(bundle.events) : [],
    /** Tally the session's Improvement Points once the job is over. */
    tallyIp: (playstyles: { primary: IpPlaystyle; secondary: IpPlaystyle }) =>
      ip.mutate(playstyles),
    ipTally: (ip.data as IpTally | undefined) ?? null,
    ipBusy: ip.isPending,
    ipError: (ip.error as Error | null) ?? null,
    /** The I.P. this job already paid, if it has been tallied. */
    ipAwarded: bundle?.campaign.ip_awarded ?? null,
    /** The job is over: completed, or the character died. Null while playing. */
    finished: bundle ? jobOutcome(bundle.campaign.status, bundle.runtime?.status ?? null) : null,
    /** Take the next job in this campaign, keeping the run's money and wounds. */
    backToLife: () => nextJobMutation.mutate(),
    backToLifeBusy: nextJobMutation.isPending,
    backToLifeError: (nextJobMutation.error as Error | null) ?? null,
    opening: open.isPending || (bundle ? needsOpeningScene(bundle) && !open.error : false),
    busy:
      playback.locked ||
      query.isFetching ||
      turn.isPending ||
      options.isPending ||
      choose.isPending ||
      open.isPending ||
      check.isPending ||
      combat.isPending ||
      boardMove.isPending ||
      endTurn.isPending ||
      reload.isPending ||
      callShot.isPending ||
      cancelShot.isPending ||
      death.isPending,
    actionError,
    retry,
    // Only what `retry` can actually re-run. It re-fires the opening scene, the
    // turn and the beat choice; offering the button for a failed encounter
    // write put a dead control under the error, which reads as "we tried" and
    // is worse than no button at all.
    canRetry: Boolean(bundle) && Boolean(open.error ?? turn.error ?? choose.error),
  };
}
