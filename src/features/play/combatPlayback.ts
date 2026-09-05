import type { Point, CoverDamage } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";

/** Ephemeral presentation of already-saved results. Never used as input to a command. */
export type CombatFrame = {
  live: LiveEncounter;
  kind: "move" | "attack" | "cover" | "turn" | "reload" | "status";
  text: string;
  actorId?: string;
  targetId?: string;
  path?: Point[];
  aim?: Point;
  impact?: string;
  /** Engine snapshot before this attack; presentation never parses the impact prose. */
  targetHpBefore?: number;
  attackStyle?: "ranged" | "melee";
  hit?: boolean;
  weaponRange?: string | null;
  coverPieceId?: string;
  coverBefore?: CoverDamage;
};
export type PlaybackFrame = CombatFrame & {
  sequence: number;
  animate?: boolean;
  startedAt?: number;
};
const listeners = new Map<string, Set<(frames: PlaybackFrame[]) => void>>();
let sequence = 0;
export function publishCombatFrames(campaignId: string, frames: CombatFrame[]) {
  const numbered = frames.map((frame) => ({ ...frame, sequence: ++sequence }));
  for (const listener of listeners.get(campaignId) ?? []) listener(numbered);
}
export function subscribeCombatFrames(
  campaignId: string,
  listener: (frames: PlaybackFrame[]) => void,
) {
  const group = listeners.get(campaignId) ?? new Set();
  group.add(listener);
  listeners.set(campaignId, group);
  return () => {
    group.delete(listener);
    if (!group.size) listeners.delete(campaignId);
  };
}

export const frameDuration = (frame: CombatFrame) =>
  frame.kind === "move" ? 650 : frame.kind === "turn" ? 450 : 850;
export type PlaybackState = { frame: PlaybackFrame | null; playing: boolean };
/** Keep a committed frame visible until the query catches up; never reuse it for another encounter. */
export function playbackView(state: PlaybackState, canonical: LiveEncounter | null) {
  const sameEncounter = !canonical || canonical.id === state.frame?.live.id;
  const awaitingRefresh = Boolean(
    state.frame &&
    canonical?.id === state.frame.live.id &&
    canonical.version < state.frame.live.version,
  );
  const locked = sameEncounter && (state.playing || awaitingRefresh);
  return { frame: locked ? state.frame : null, locked };
}

/** A bounded visual queue; skipping and unmounting cannot call game code. */
export function createPlaybackQueue(
  onChange: (state: PlaybackState) => void,
  reducedMotion: boolean,
) {
  let queue: PlaybackFrame[] = [];
  let frame: PlaybackFrame | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const step = () => {
    timer = null;
    const next = queue.shift();
    if (!next) {
      onChange({ frame, playing: false });
      return;
    }
    frame = { ...next, animate: !reducedMotion, startedAt: Date.now() };
    onChange({ frame, playing: true });
    timer = setTimeout(step, reducedMotion ? 80 : frameDuration(frame));
  };
  return {
    enqueue(frames: PlaybackFrame[]) {
      if (disposed || !frames.length) return;
      queue.push(...frames);
      // Keep the tail of an unusually large exchange; the ledger retains every result.
      if (queue.length > 80) queue = queue.slice(-80);
      if (!timer) step();
    },
    skip() {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      timer = null;
      const last = queue.at(-1) ?? frame;
      frame = last ? { ...last, animate: false } : null;
      queue = [];
      onChange({ frame, playing: false });
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      queue = [];
    },
  };
}
