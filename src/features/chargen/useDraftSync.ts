import { useEffect, useRef, useState } from "react";
import { getLatestDraft, saveDraft, type Json } from "@/lib/backend";
import { draftPayload, useChargenStore, type ChargenState } from "./store";

export type DraftSyncStatus = "loading" | "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 2000;

/** Resumes any existing draft, then autosaves the store on a debounce. */
export function useDraftSync(userId: string) {
  const [status, setStatus] = useState<DraftSyncStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const unsubscribe = useChargenStore.subscribe((state) => {
      if (!loaded.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setStatus("saving");
        try {
          const saved = await saveDraft(
            userId,
            draftPayload(state) as unknown as Json,
            state.draftId ?? undefined,
          );
          if (!state.draftId) useChargenStore.setState({ draftId: saved.id });
          setError(null);
          setStatus("saved");
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      }, DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [userId]);

  return { status, error };
}