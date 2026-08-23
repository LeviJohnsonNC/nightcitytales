/**
 * Mission content registry. Authored beat graphs live here; the runtime
 * (engine/mission.ts) walks them.
 */
import type { Mission } from "../mission";
import { NIGHT_AT_THE_OPERA } from "./nightAtTheOpera";

export { NIGHT_AT_THE_OPERA };

export const MISSIONS: Record<string, Mission> = {
  [NIGHT_AT_THE_OPERA.id]: NIGHT_AT_THE_OPERA,
};

/** Look up an authored mission by id. Throws if it is not registered. */
export function getMission(id: string): Mission {
  const mission = MISSIONS[id];
  if (!mission) throw new Error(`No registered mission "${id}".`);
  return mission;
}

/** All registered missions. */
export function listMissions(): Mission[] {
  return Object.values(MISSIONS);
}
