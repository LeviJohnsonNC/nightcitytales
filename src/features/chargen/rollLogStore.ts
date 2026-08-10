import { create } from "zustand";
import type { RollResult } from "@/engine";

export type LoggedRoll = { id: string; label: string; result: RollResult };

type RollLogStore = {
  entries: LoggedRoll[];
  append: (label: string, result: RollResult) => void;
  clear: () => void;
};

/** Session-only log of every die the app rolled, newest first. */
export const useRollLog = create<RollLogStore>((set) => ({
  entries: [],
  append: (label, result) =>
    set((s) => ({
      entries: [
        { id: `${result.timestamp}-${s.entries.length}`, label, result },
        ...s.entries,
      ],
    })),
  clear: () => set({ entries: [] }),
}));
