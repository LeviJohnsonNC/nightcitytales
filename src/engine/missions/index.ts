/**
 * Mission content registry. Authored beat graphs live here; the runtime
 * (engine/mission.ts) walks them.
 *
 * Generated jobs are not registered, because there is nothing to register: a
 * `job-xxxxxxxx` id carries its own seed, so getMission rebuilds it on demand.
 * Callers cannot tell the two apart, which is the point.
 */
import type { Mission } from "../mission";
import { NIGHT_AT_THE_OPERA } from "./nightAtTheOpera";
import { jobFromId } from "./generator";

export { NIGHT_AT_THE_OPERA };
export * from "./generator";

export const MISSIONS: Record<string, Mission> = {
  [NIGHT_AT_THE_OPERA.id]: NIGHT_AT_THE_OPERA,
};

/** Look up a mission by id — authored or generated. Throws if it is neither. */
export function getMission(id: string): Mission {
  const mission = MISSIONS[id];
  if (mission) return mission;
  const generated = jobFromId(id);
  if (generated) return generated;
  throw new Error(`No registered mission "${id}".`);
}

/** All registered missions. Generated jobs are not listed — there are 2^32 of them. */
export function listMissions(): Mission[] {
  return Object.values(MISSIONS);
}
