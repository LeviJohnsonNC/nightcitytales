import { useEffect, useRef, useState } from "react";
import { getLatestDraft, saveDraft, type Json } from "@/lib/backend";
import { createDraftAutosave, type DraftAutosave } from "./draftAutosave";
import { draftPayload, useChargenStore, type ChargenState } from "./store";

export type DraftSyncStatus = "loading" | "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 2000;

/** The mounted wizard's autosave, for the save path to pause. */
let current: DraftAutosave | null = null;

/**
 * Stop autosaving and wait for any save already sent, before the character is
 * filed (see draftAutosave.ts). Call `resumeDraftSync` if filing fails, so the
 * player's edits keep saving.
 */
export async function pauseDraftSync(): Promise<void> {
  await current?.pause();
}

export function resumeDraftSync(): void {
  current?.resume();
}

/** Resumes any existing draft, then autosaves the store on a debounce. */
export function useDraftSync(userId: string) {
  const [status, setStatus] = useState<DraftSyncStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const draft = await getLatestDraft();
        if (cancelled) return;
        if (draft?.state && typeof draft.state === "object") {
          useChargenStore
            .getState()
            .hydrate({ ...(draft.state as Partial<ChargenState>), draftId: draft.id });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) {
          loaded.current = true;
          setStatus("idle");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const autosave = createDraftAutosave<ChargenState>({
      read: () => useChargenStore.getState(),
      draftIdOf: (state) => state.draftId ?? null,
      write: (state, draftId) => saveDraft(userId, draftPayload(state) as unknown as Json, draftId),
      adopt: (id) => useChargenStore.setState({ draftId: id }),
      report: (next, message) => {
        if (!mounted) return;
        setStatus(next);
        setError(message);
      },
      debounceMs: DEBOUNCE_MS,
    });
    current = autosave;
    const unsubscribe = useChargenStore.subscribe(() => {
      if (loaded.current) autosave.schedule();
    });
    return () => {
      mounted = false;
      unsubscribe();
      // Leaving the wizard with an edit still waiting out its debounce saves it
      // now rather than dropping it (unless the character was just filed).
      autosave.flush();
      if (current === autosave) current = null;
    };
  }, [userId]);

  return { status, error };
}
