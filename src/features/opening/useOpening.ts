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

/** How long the scene takes to fall away when a door is taken. */
const EXIT_MS = 750;
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
      // The scene pulls back into the dark while the door is applied; the next
      // screen must not arrive before that has been seen.
      await Promise.all([chooseOpening(bundle.data, choice), pause(EXIT_MS)]);
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
    /** Everything the opening is written from, which the descent narrows the city by. */
    bundle: bundle.data ?? null,
  };
}
