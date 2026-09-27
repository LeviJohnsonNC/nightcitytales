import { useEffect, useRef, useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { generatePortrait } from "./portraitGeneration";
import { MAX_PORTRAIT_GENERATIONS, MAX_PORTRAIT_TAKES, buildPortraitFacts } from "./portraitPrompt";
import { nextStageToDevelop, type PortraitStage } from "./portraitStages";
import { useChargenStore, type ChargenState } from "./store";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

export type DevelopingPortrait = {
  /** The frame arriving right now, before it is stored. */
  preview: string | null;
  /** The stage being developed, while it is. */
  developing: PortraitStage | null;
  /** The stage that last failed, so the file can offer to try again. */
  failed: PortraitStage | null;
  retry: () => void;
};

/**
 * Develops the file's picture when the answers support a better one.
 *
 * Runs once per stage: a stage that fails is not retried on its own (a broken
 * gateway must not become a loop that spends the budget), and nothing runs
 * while the draft is still loading, before there is a user, or once the cap is
 * reached. The spend and the stage are written together when the image lands,
 * read from the store at that moment rather than from the render that started
 * it, so a player who kept answering while it drew loses nothing.
 */
export function useDevelopingPortrait(
  state: ChargenState,
  userId: string,
  ready: boolean,
): DevelopingPortrait {
  const patch = useChargenStore((s) => s.patch);
  const [preview, setPreview] = useState<string | null>(null);
  const [developing, setDeveloping] = useState<PortraitStage | null>(null);
  const [failed, setFailed] = useState<PortraitStage | null>(null);
  const busy = useRef(false);
  // Bumped when a development finishes, so a stage that became ready WHILE the
  // last one was drawing is noticed even though nothing else changed.
  const [finished, setFinished] = useState(0);

  const next = nextStageToDevelop(state);
  const capped = state.portraitGenerations >= MAX_PORTRAIT_GENERATIONS;

  useEffect(() => {
    if (!ready || busy.current || next === null || capped || failed === next) return;
    busy.current = true;
    setDeveloping(next);
    const roleName = state.roleId ? ROLE_NAMES[state.roleId]?.name : undefined;
    generatePortrait(buildPortraitFacts(state, roleName), userId, state.draftId, (url) =>
      setPreview(url),
    )
      .then((path) => {
        const now = useChargenStore.getState();
        // Drawn by hand while this was developing: theirs wins, this is only kept as a take.
        const handDrawn = now.portraitStage >= 3 && now.portraitPath !== null;
        patch({
          portraitPath: handDrawn ? now.portraitPath : path,
          portraitTakes: [...now.portraitTakes.filter((p) => p !== path), path].slice(
            -MAX_PORTRAIT_TAKES,
          ),
          portraitGenerations: now.portraitGenerations + 1,
          portraitStage: Math.max(now.portraitStage, next),
        });
      })
      .catch(() => setFailed(next))
      .finally(() => {
        busy.current = false;
        setDeveloping(null);
        setPreview(null);
        setFinished((n) => n + 1);
      });
    // The stage is the trigger; the rest is read when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, next, capped, failed, finished]);

  return { preview, developing, failed, retry: () => setFailed(null) };
}
