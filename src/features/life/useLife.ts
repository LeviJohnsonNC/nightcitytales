/**
 * The Life loop, bound to React.
 *
 * The turn logic is in lifeOps.ts and knows nothing about React; this is the
 * half that wires it to TanStack Query.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lifePeople } from "./lifeModel";
import { MAX_LIFE_OPTIONS, mergeOptions, venueOptions } from "./lifeOptions";
import { type LifeActionCard } from "./lifeResponse";
import {
  DEFAULT_START,
  type HookAsk,
  type WoundStateCode,
  deductionOffer,
  getDistrict,
  resolvePosition,
  truthsAt,
} from "@/engine";
import { travelTo } from "@/features/atlas/travel";
import { rest } from "@/features/downtime/downtimeOps";
import { type CheckRoll, type PendingCheck, pendingChecksFrom } from "@/features/play/checkPrompt";
import { localExpertIn } from "@/features/play/playModel";
import {
  type TurnOptions,
  acceptHook,
  commitLifeCheck,
  declineHook,
  liveTurn,
  loadLife,
  pushHook,
} from "./lifeOps";

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
        {
          vitals: bundle.vitals,
          inventory: bundle.inventory,
          // A Local Expert card must promise the Level for the district the
          // character is standing in, not the one they happen to know.
          districtKey:
            resolvePosition(bundle.campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
        },
      )[0] ?? null)
    : null;

  /**
   * Options, when the player last asked for them. Empty on an ordinary turn:
   * Life does not hand out a menu, so the next turn clears these by returning
   * none of its own.
   */
  const actions: LifeActionCard[] = (() => {
    if (!bundle) return [];
    let written: LifeActionCard[] = [];
    for (let i = bundle.events.length - 1; i >= 0; i -= 1) {
      const event = bundle.events[i];
      if (!event) continue;
      if (event.type !== "life_options" && event.type !== "life_narration") continue;
      // Whichever came last wins, so acting on anything clears the list: an
      // ordinary turn always answers with none of its own.
      const data = event.data as { actions?: unknown } | null;
      written = Array.isArray(data?.actions) ? (data.actions as LifeActionCard[]) : [];
      break;
    }
    // The model wrote what is live; the engine fills the rest with the standing
    // business of the venues. Derived here rather than stored with the event,
    // because where the character is standing can change without the options
    // being asked for again.
    if (!written.length) return [];
    const position = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
    const district = position?.districtKey ? getDistrict(position.districtKey) : undefined;
    if (!district) return written.slice(0, MAX_LIFE_OPTIONS);
    // Whether "Think it through" is on the table: the one approach that is not
    // offered blind, because a conclusion's prerequisites are other discoveries
    // and offering it without them is a button that can only disappoint.
    const conclusionAvailable =
      bundle.truthsAvailable && position?.placeKey
        ? deductionOffer(
            truthsAt(position.placeKey, bundle.places[position.placeKey]),
            bundle.discoveredTruths,
          ) !== null
        : false;
    return mergeOptions(
      written,
      venueOptions({
        districtKey: district.key,
        placeKey: position?.placeKey,
        places: bundle.places,
        localExpertLevel: localExpertIn(bundle.character, district.key),
        conclusionAvailable,
      }),
      district.locations.map((l) => l.name),
    );
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
    people: bundle ? lifePeople(bundle.npcs, bundle.clock.day) : [],
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
    /**
     * Do something. `costs` is passed when the player picked a card rather than
     * typing, and it is what that card printed: the turn then spends exactly
     * the minutes and eurobucks the player was shown, instead of whatever the
     * model decides afterwards.
     */
    act: async (input: string, costs?: { minutes?: number; spend?: TurnOptions["spend"] }) => {
      try {
        await turn.mutateAsync({
          input,
          ...(costs?.minutes !== undefined ? { minutes: costs.minutes } : {}),
          ...(costs?.spend ? { spend: costs.spend } : {}),
        });
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
