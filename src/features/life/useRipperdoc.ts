import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RIPPERDOC_RULES,
  appointmentDelayDays,
  getCyberware,
  installQuantity,
  planCyberwarePlacement,
} from "@/engine";
import { castMemberInRole } from "@/features/campaign/castSeeding";
import {
  commitRipperdocInstall,
  prepareRipperdocInstall,
  type PreparedRipperdocInstall,
} from "@/features/campaign/cyberware";
import type { LifeBundle } from "./useLife";

export type RipperdocQuote = {
  cost: number;
  quantity: number;
  appointmentDays: number | null;
  procedureMinutes: number;
  recoveryDays: number;
  available: boolean;
  reason: string | null;
};

export function quoteCyberware(bundle: LifeBundle, itemId: string): RipperdocQuote {
  const item = getCyberware(itemId);
  const quantity = installQuantity(itemId);
  const castMember = castMemberInRole(bundle.npcs, "ripperdoc");
  const ripperdoc = castMember
    ? (bundle.npcs.find((npc) => (npc.npc_id ?? npc.name) === castMember.key) ?? null)
    : null;
  const appointmentDays = ripperdoc ? appointmentDelayDays(ripperdoc.disposition) : null;
  const placement = planCyberwarePlacement(
    bundle.cyberware.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      foundationId: row.foundational_for,
    })),
    itemId,
    quantity,
  );
  const cost = item.cost * quantity;
  let reason: string | null = null;
  if (!ripperdoc) reason = "No ripperdoc is in your standing cast.";
  else if (appointmentDays === null) reason = `${ripperdoc.name} will not put you on the table.`;
  else if (bundle.phase !== "life" && bundle.phase !== "hook")
    reason = "Not while a job is active.";
  else if (!placement.ok) reason = placement.reason;
  else if (cost > bundle.vitals.eurobucks)
    reason = `${cost}eb, with only ${bundle.vitals.eurobucks}eb on hand.`;
  return {
    cost,
    quantity,
    appointmentDays,
    procedureMinutes: RIPPERDOC_RULES.procedureMinutesPerInstall * quantity,
    recoveryDays:
      RIPPERDOC_RULES.recoveryDays[item.install as keyof typeof RIPPERDOC_RULES.recoveryDays] ?? 0,
    available: reason === null,
    reason,
  };
}

export function useRipperdoc(bundle: LifeBundle, narrate: (facts: string) => Promise<boolean>) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const pendingInstall = useRef<PreparedRipperdocInstall | null>(null);
  const ripperdoc = useMemo(() => {
    const member = castMemberInRole(bundle.npcs, "ripperdoc");
    return member
      ? (bundle.npcs.find((npc) => (npc.npc_id ?? npc.name) === member.key) ?? null)
      : null;
  }, [bundle.npcs]);
  const mutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!ripperdoc) throw new Error("No ripperdoc is in your standing cast.");
      if (!pendingInstall.current || pendingInstall.current.itemId !== itemId) {
        pendingInstall.current = prepareRipperdocInstall({
          campaign: bundle.campaign,
          vitals: bundle.vitals,
          cyberware: bundle.cyberware,
          ripperdoc,
          phase: bundle.phase,
          hookSituationKey: bundle.hook?.situationKey ?? null,
          itemId,
        });
      }
      return commitRipperdocInstall(pendingInstall.current);
    },
    onSuccess: async (outcome) => {
      pendingInstall.current = null;
      setMessage(
        `${outcome.plan.itemName} installed. Humanity ${outcome.plan.humanity.humanityBefore} → ${outcome.plan.humanity.humanityCurrent}.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["life", bundle.campaign.id] }),
        queryClient.invalidateQueries({ queryKey: ["play", bundle.campaign.id] }),
        queryClient.invalidateQueries({ queryKey: ["campaign-phase", bundle.campaign.id] }),
      ]);
      // The mechanics are already durable. A narration failure remains prose-
      // only and never turns this successful mutation into a retryable install.
      await narrate(outcome.narrationFacts);
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return {
    ripperdoc,
    message,
    clearMessage: () => setMessage(null),
    busy: mutation.isPending,
    install: (itemId: string) => mutation.mutate(itemId),
  };
}
