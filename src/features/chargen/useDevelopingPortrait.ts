import { useEffect, useRef, useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { generatePortrait } from "./portraitGeneration";
import { MAX_PORTRAIT_GENERATIONS, MAX_PORTRAIT_TAKES, buildPortraitFacts } from "./portraitPrompt";
import {
  nextStageToDevelop,
  portraitBasis,
  portraitIsStale,
  type PortraitStage,
} from "./portraitStages";
import { useChargenStore, type ChargenState } from "./store";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

/** A stage that fails is tried once more after this, then left to the player's Retake. */
const AUTO_ATTEMPTS = 2;
const RETRY_AFTER_MS = 4000;

/**
 * One picture on its way to the file. `key` says which picture it is, not which
 * address it is at: the same image arriving from the stream and then from
 * storage has two sources and one key, so showing it twice is not a change.
 */
export type PortraitFrame = { key: string; src: string };

export type DevelopingPortrait = {
  /** The frame arriving right now, before it is stored. */
  preview: PortraitFrame | null;
  /** The picture that has just landed, held until storage can hand back its own URL. */
  latest: (PortraitFrame & { path: string }) | null;
  /** The stage being developed, while it is. */
  developing: PortraitStage | null;
  /** The stage that failed twice, so the file can offer to try again. */
  failed: PortraitStage | null;
  /** No better picture is coming (it failed, or the budget is spent). */
  stalled: boolean;
  retry: () => void;
};

/**
 * Develops the file's picture when the answers support a better one, or a
 * different person.
 *
 * Runs once per stage and once per basis (`portraitBasis`): a stage that fails
 * is tried once more and then waits for the player (a broken gateway must not
 * become a loop that spends the budget), and nothing runs while the draft is
 * still loading, before there is a user, or once the cap is reached. The spend,
 * the stage and the basis are written together when the image lands, read from
 * the store at that moment rather than from the render that started it, so a
 * player who kept answering while it drew loses nothing.
 */
export function useDevelopingPortrait(
  state: ChargenState,
  userId: string,
  ready: boolean,
): DevelopingPortrait {
  const patch = useChargenStore((s) => s.patch);
  const [preview, setPreview] = useState<PortraitFrame | null>(null);
  const [latest, setLatest] = useState<DevelopingPortrait["latest"]>(null);
  const [developing, setDeveloping] = useState<PortraitStage | null>(null);
  const [failure, setFailure] = useState<{ stage: PortraitStage; basis: string } | null>(null);
  const [cooling, setCooling] = useState(false);
  const busy = useRef(false);
  const attempts = useRef(new Map<string, number>());
  const frames = useRef(0);
  // Bumped when a development finishes, so a stage that became ready WHILE the
  // last one was drawing is noticed even though nothing else changed.
  const [finished, setFinished] = useState(0);

  const next = nextStageToDevelop(state);
  const basis = portraitBasis(state);
  const capped = state.portraitGenerations >= MAX_PORTRAIT_GENERATIONS;
  const blocked = failure !== null && failure.stage === next && failure.basis === basis;

  useEffect(() => {
    if (!ready || busy.current || next === null || capped || blocked || cooling) return;
    busy.current = true;
    setDeveloping(next);
    const redraw = portraitIsStale(state);
    const attemptKey = `${next}:${basis}`;
    const roleName = state.roleId ? ROLE_NAMES[state.roleId]?.name : undefined;
    let finalFrame: string | null = null;
    generatePortrait(buildPortraitFacts(state, roleName), userId, state.draftId, (url, isFinal) => {
      frames.current += 1;
      if (isFinal) finalFrame = url;
      setPreview({ key: `frame:${frames.current}`, src: url });
    })
      .then((path) => {
        const now = useChargenStore.getState();
        patch({
          portraitPath: path,
          portraitTakes: [...now.portraitTakes.filter((p) => p !== path), path].slice(
            -MAX_PORTRAIT_TAKES,
          ),
          portraitGenerations: now.portraitGenerations + 1,
          portraitStage: redraw ? next : Math.max(now.portraitStage, next),
          portraitBasis: basis,
        });
        if (finalFrame) setLatest({ key: `path:${path}`, src: finalFrame, path });
        attempts.current.delete(attemptKey);
      })
      .catch(() => {
        const made = (attempts.current.get(attemptKey) ?? 0) + 1;
        attempts.current.set(attemptKey, made);
        if (made < AUTO_ATTEMPTS) setCooling(true);
        else setFailure({ stage: next, basis });
      })
      .finally(() => {
        busy.current = false;
        setDeveloping(null);
        setPreview(null);
        setFinished((n) => n + 1);
      });
    // The stage is the trigger; the rest is read when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, next, basis, capped, blocked, cooling, finished]);

  // The pause before the one automatic retry.
  useEffect(() => {
    if (!cooling) return;
    const timer = window.setTimeout(() => setCooling(false), RETRY_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [cooling]);

  return {
    preview,
    latest,
    developing,
    failed: blocked ? next : null,
    stalled: blocked || (next !== null && capped),
    retry: () => {
      attempts.current.clear();
      setFailure(null);
    },
  };
}
