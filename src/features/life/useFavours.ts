/**
 * The favours a place will do, as a piece of application state.
 *
 * What is on offer is `favourOffers` over the campaign as the screen holds it,
 * and what happens when one is called in is `callInFavour`, which asks again on
 * fresh rows. This is only the part React needs: the list, whether a call is in
 * flight, and what to say afterwards.
 */
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HEAT_CLOCK_KEY } from "@/engine";
import { callInFavour, favourOffers } from "@/features/campaign/favours";
import type { LifeBundle } from "./lifeOps";

export type FavourMessage = { tone: "done" | "refused"; text: string };

export function useFavours(bundle: LifeBundle | undefined) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<FavourMessage | null>(null);

  const offers = useMemo(
    () =>
      bundle
        ? favourOffers({
            campaign: bundle.campaign,
            vitals: bundle.vitals,
            character: bundle.character,
            inventory: bundle.inventory,
            places: bundle.places,
            heat: bundle.pressure.find((p) => p.clock.key === HEAT_CLOCK_KEY)?.clock.filled ?? 0,
            events: bundle.events,
          })
        : [],
    [bundle],
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["life", bundle?.campaign.id] });
    void queryClient.invalidateQueries({ queryKey: ["play", bundle?.campaign.id] });
    void queryClient.invalidateQueries({ queryKey: ["downtime", bundle?.campaign.id] });
  }, [queryClient, bundle?.campaign.id]);

  const call = useMutation({
    mutationFn: async (favourKey: string) => {
      if (!bundle) throw new Error("Still loading.");
      return callInFavour({
        campaignId: bundle.campaign.id,
        favourKey,
        character: bundle.character,
      });
    },
    onSuccess: (outcome) => {
      setMessage(
        outcome.ok
          ? { tone: "done", text: outcome.summary }
          : { tone: "refused", text: outcome.reason },
      );
      invalidate();
    },
    onError: (error: Error) => setMessage({ tone: "refused", text: error.message }),
  });

  return {
    offers,
    message,
    busy: call.isPending,
    callIn: (favourKey: string) => call.mutate(favourKey),
    clearMessage: () => setMessage(null),
  };
}
