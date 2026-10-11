import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftAutosave } from "../draftAutosave";

type State = { draftId: string | null; text: string };

let state: State;
let writes: { draftId: string | undefined; text: string }[];
let release: (() => void)[];
let slow: boolean;

function make() {
  return createDraftAutosave<State>({
    read: () => state,
    draftIdOf: (s) => s.draftId,
    write: async (s, draftId) => {
      writes.push({ draftId, text: s.text });
      if (slow) await new Promise<void>((done) => release.push(done));
      return { id: "draft-1" };
    },
    adopt: (id) => {
      state = { ...state, draftId: id };
    },
    report: () => {},
    debounceMs: 2000,
  });
}

const settle = () => new Promise((done) => setTimeout(done, 0));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  state = { draftId: null, text: "a" };
  writes = [];
  release = [];
  slow = false;
});
afterEach(() => vi.useRealTimers());

describe("the wizard's autosave", () => {
  it("saves once, after the debounce, with the latest state", async () => {
    const autosave = make();
    autosave.schedule();
    state = { ...state, text: "ab" };
    autosave.schedule();
    vi.advanceTimersByTime(2000);
    await vi.waitFor(() => expect(writes).toEqual([{ draftId: undefined, text: "ab" }]));
    expect(state.draftId).toBe("draft-1");
  });

  it("does not insert a second draft when a save starts before the first has its id", async () => {
    slow = true;
    const autosave = make();
    autosave.schedule();
    vi.advanceTimersByTime(2000);
    state = { ...state, text: "abc" };
    autosave.schedule();
    vi.advanceTimersByTime(2000);
    await vi.waitFor(() => expect(release).toHaveLength(1));
    release.shift()!();
    await vi.waitFor(() => expect(writes).toHaveLength(2));
    release.shift()!();
    // The second save waited for the first, and used the id it was given.
    expect(writes[1]).toEqual({ draftId: "draft-1", text: "abc" });
  });

  it("never writes after it is paused for filing, even a save already waiting", async () => {
    const autosave = make();
    autosave.schedule();
    await autosave.pause();
    vi.advanceTimersByTime(5000);
    autosave.schedule();
    autosave.flush();
    vi.advanceTimersByTime(5000);
    vi.useRealTimers();
    await settle();
    expect(writes).toHaveLength(0);
  });

  it("waits for a save already sent before saying it is paused", async () => {
    slow = true;
    const autosave = make();
    autosave.schedule();
    vi.advanceTimersByTime(2000);
    await vi.waitFor(() => expect(release).toHaveLength(1));
    let paused = false;
    void autosave.pause().then(() => (paused = true));
    vi.useRealTimers();
    await settle();
    expect(paused).toBe(false);
    release.shift()!();
    await vi.waitFor(() => expect(paused).toBe(true));
  });

  it("saves a waiting edit at once when the wizard is left, and resumes after a failed filing", async () => {
    const autosave = make();
    autosave.schedule();
    autosave.flush();
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    await autosave.pause();
    autosave.resume();
    autosave.schedule();
    vi.advanceTimersByTime(2000);
    await vi.waitFor(() => expect(writes).toHaveLength(2));
  });
});
