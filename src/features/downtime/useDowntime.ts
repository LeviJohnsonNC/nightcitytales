/**
 * Downtime, applied. The model says what resting, paying, buying and repairing
 * would do; this sequences the writes and records each one in the campaign
 * ledger, so the after-action shows up in the log alongside the job itself.
 *
 * Every mechanical number comes from the engine through downtimeModel. Nothing
 * here decides a cost or a healing rate.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ItemKind } from "@/engine";
import { billsAfterResting, downtimeView, type RepairableArmor } from "./downtimeModel";
import {
  buy,
  loadDowntime,
  payBills,
  repair,
  rest,
  type DowntimeBundle,
} from "./downtimeOps";

export type { DowntimeBundle };

export function useDowntime(campaignId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["downtime", campaignId],
    queryFn: () => loadDowntime(campaignId),
  });
  const [restDays, setRestDays] = useState(1);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["downtime", campaignId] });
    // The play screen shows the same HP, eurobucks and kit.
    void queryClient.invalidateQueries({ queryKey: ["play", campaignId] });
  };

  const bundle = query.data ?? null;

  const restMutation = useMutation({
    mutationFn: (days: number) => {
      if (!bundle) throw new Error("Still loading.");
      return rest(bundle, days);
    },
    onSuccess: invalidate,
  });
  const billsMutation = useMutation({
    mutationFn: () => {
      if (!bundle) throw new Error("Still loading.");
      return payBills(bundle);
    },
    onSuccess: invalidate,
  });
  const buyMutation = useMutation({
    mutationFn: (purchase: { kind: ItemKind; itemId: string; quantity: number }) => {
      if (!bundle) throw new Error("Still loading.");
      return buy(bundle, purchase);
    },
    onSuccess: invalidate,
  });
  const repairMutation = useMutation({
    mutationFn: (piece: RepairableArmor) => {
      if (!bundle) throw new Error("Still loading.");
      return repair(bundle, piece);
    },
    onSuccess: invalidate,
  });

  const view = bundle ? downtimeView({ ...bundle, restDays }) : null;

  return {
    isPending: query.isPending,
    error: query.error as Error | null,
    bundle,
    view,
    /** What will be owed once the days currently dialled in have passed. */
    billsAfterRest: view ? billsAfterResting(view, view.rest.days) : null,
    restDays,
    setRestDays,
    rest: (days: number) => restMutation.mutate(days),
    payBills: () => billsMutation.mutate(),
    buy: (purchase: { kind: ItemKind; itemId: string; quantity: number }) =>
      buyMutation.mutate(purchase),
    repair: (piece: RepairableArmor) => repairMutation.mutate(piece),
    busy:
      restMutation.isPending ||
      billsMutation.isPending ||
      buyMutation.isPending ||
      repairMutation.isPending,
    actionError:
      (restMutation.error as Error | null) ??
      (billsMutation.error as Error | null) ??
      (buyMutation.error as Error | null) ??
      (repairMutation.error as Error | null),
  };
}
