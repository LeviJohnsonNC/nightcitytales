/**
 * The wizard's autosave, without React: one debounced save at a time.
 *
 * Saves used to be fired from each timer as it went off, so two could be in
 * flight at once and land out of order, and a save that started before the
 * first returned had no draft id yet and inserted a second draft. Each save now
 * waits for the one before it and reads the draft id when it RUNS.
 *
 * It can also be paused, which filing the character does: `save_character`
 * deletes the draft, and a debounced save landing after it upserted the same id
 * and brought the draft back, so the roster showed a draft of a character
 * already on file and the next /create resumed it.
 */
export type DraftAutosaveStatus = "saving" | "saved" | "error";

export type DraftAutosaveDeps<S> = {
  /** The state to save, read at the moment the save runs. */
  read: () => S;
  draftIdOf: (state: S) => string | null;
  /** Write the draft; resolves to its id. */
  write: (state: S, draftId: string | undefined) => Promise<{ id: string }>;
  /** Called once, with the id a new draft was given. */
  adopt: (id: string) => void;
  report: (status: DraftAutosaveStatus, error: string | null) => void;
  debounceMs: number;
};

export type DraftAutosave = {
  /** An edit happened: save it once the debounce is out. */
  schedule: () => void;
  /** Save a waiting edit now (leaving the wizard). Does nothing while paused. */
  flush: () => void;
  /** Stop saving, and resolve once any save already sent has landed. */
  pause: () => Promise<void>;
  resume: () => void;
};

export function createDraftAutosave<S>(deps: DraftAutosaveDeps<S>): DraftAutosave {
  let queue: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let paused = false;

  const save = () => {
    queue = queue.then(async () => {
      if (paused) return;
      const state = deps.read();
      deps.report("saving", null);
      try {
        const saved = await deps.write(state, deps.draftIdOf(state) ?? undefined);
        if (!deps.draftIdOf(deps.read())) deps.adopt(saved.id);
        deps.report("saved", null);
      } catch (e) {
        deps.report("error", e instanceof Error ? e.message : String(e));
      }
    });
  };

  const cancel = (): boolean => {
    if (!timer) return false;
    clearTimeout(timer);
    timer = null;
    return true;
  };

  return {
    schedule() {
      if (paused) return;
      cancel();
      timer = setTimeout(() => {
        timer = null;
        save();
      }, deps.debounceMs);
    },
    flush() {
      if (cancel() && !paused) save();
    },
    async pause() {
      paused = true;
      cancel();
      await queue;
    },
    resume() {
      paused = false;
    },
  };
}
