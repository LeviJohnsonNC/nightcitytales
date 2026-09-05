import { useEffect, useRef, useState } from "react";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import {
  createPlaybackQueue,
  subscribeCombatFrames,
  playbackView,
  type PlaybackState,
} from "./combatPlayback";

export function useCombatPlayback(campaignId: string, canonical: LiveEncounter | null) {
  const [state, setState] = useState<PlaybackState>({ frame: null, playing: false });
  const controller = useRef<ReturnType<typeof createPlaybackQueue> | null>(null);
  useEffect(() => {
    setState({ frame: null, playing: false });
    const queue = createPlaybackQueue(
      setState,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    controller.current = queue;
    const unsubscribe = subscribeCombatFrames(campaignId, queue.enqueue);
    return () => {
      unsubscribe();
      queue.dispose();
      controller.current = null;
    };
  }, [campaignId]);
  return {
    ...playbackView(state, canonical),
    lastFrame: state.frame,
    playing: state.playing,
    skip: () => controller.current?.skip(),
  };
}
