import type { RollResult } from "@/engine";
import { useChargenStore, type LoggedRoll } from "./store";

export type { LoggedRoll };

/**
 * The roll log lives in the chargen store so it is saved with the draft and
 * survives a reload. A player can always check that the row they rolled is the
 * row they kept.
 */
export function useRollEntries(): LoggedRoll[] {
  return useChargenStore((s) => s.rollLog);
}

export function appendRoll(label: string, result: RollResult): void {
  useChargenStore.setState((s) => ({
    rollLog: [{ id: `${result.timestamp}-${s.rollLog.length}`, label, result }, ...s.rollLog],
  }));
}

export function clearRollLog(): void {
  useChargenStore.setState({ rollLog: [] });
}
