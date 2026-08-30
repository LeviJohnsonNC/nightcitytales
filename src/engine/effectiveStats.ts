import { getArmor } from "./catalog";
import { empFromHumanity } from "./derived";
import type { StatKey } from "./types";

export type CurrentStatInput = {
  base: Partial<Record<StatKey, number>>;
  humanityCurrent?: number;
  wornArmorIds?: string[];
};

/** The single most punishing worn armor penalty; head and body never stack it. */
export function wornArmorPenalty(itemIds: string[]): number {
  return itemIds.reduce((worst, id) => {
    try {
      return Math.min(worst, getArmor(id).penalty?.value ?? 0);
    } catch {
      return worst;
    }
  }, 0);
}

/** Live STATs: saved values, current Humanity-derived EMP, and worn armor. */
export function currentStats(input: CurrentStatInput): Partial<Record<StatKey, number>> {
  const stats = { ...input.base };
  if (input.humanityCurrent !== undefined) {
    stats.emp = Math.max(0, empFromHumanity(Math.max(0, input.humanityCurrent)));
  }
  const penalty = wornArmorPenalty(input.wornArmorIds ?? []);
  for (const key of ["ref", "dex", "move"] as const) {
    const value = stats[key];
    if (typeof value === "number") stats[key] = Math.max(0, value + penalty);
  }
  return stats;
}
