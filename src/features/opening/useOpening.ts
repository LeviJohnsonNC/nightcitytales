/**
 * The cold open, bound to the query client.
 *
 * Every attempt here costs a paid AI call, so this is built to fire exactly
 * once per campaign and never on its own initiative:
 *
 *  - `staleTime`/`gcTime` of Infinity, so a remount re-reads the cache rather
 *    than the model. A route that remounts must not re-bill the player.
 *  - `retry: false`, so a failure surfaces instead of quietly costing three.
 *  - every refetch trigger off, so tabbing away and back is free.
 *
 * Retrying is the player's, through the button on the failure screen. That is
 * the whole of the recovery story: there is no canned opening behind this.
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OpeningChoice } from "@/engine";
import { chooseOpening, generateOpening, loadOpeningBundle } from "./openingOps";

export function useOpening(campaignId: string) {
  const queryClient = useQueryClient();

  const bundle = useQuery({
    queryKey: ["opening-bundle", campaignId],
    queryFn: () => loadOpeningBundle(campaignId),
    staleTime: Infinity,
  });

  const opening = useQuery({
    queryKey: ["opening", campaignId],
    queryFn: () => generateOpening(bundle.data!),
    enabled: bundle.data !== undefined,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const choose = useMutation({
    mutationFn: async (choice: OpeningChoice) => {
      if (!bundle.data) throw new Error("The campaign is still loading.");
      await chooseOpening(bundle.data, choice);
    },
    onSuccess: async () => {
      // The phase may have moved and the situations certainly have, so
      // everything the next screen reads is now stale.
      await queryClient.invalidateQueries({ queryKey: ["campaign-phase", campaignId] });
      await queryClient.invalidateQueries({ queryKey: ["life", campaignId] });
    },
  });

  const retry = useCallback(() => {
    void opening.refetch();
  }, [opening]);

  return {
    opening: opening.data ?? null,
    /** True while there is nothing to show yet and nothing to report. */
    writing: bundle.isPending || (opening.isFetching && !opening.data),
    error: (bundle.error ?? opening.error) as Error | null,
    retry,
    choose: (choice: OpeningChoice) => choose.mutate(choice),
    choosing: choose.isPending,
    chooseError: choose.error as Error | null,
    /** The character whose night this is, for the screen's own furniture. */
    character: bundle.data?.character ?? null,
  };
}
