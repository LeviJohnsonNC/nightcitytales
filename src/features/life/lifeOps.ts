/**
 * A Life turn, applied.
 *
 * Everything a Life turn DOES: load the bundle, score the situation funnel,
 * build the narrator's context, normalize what comes back, resolve checks and
 * travel and shopping in the engine, and write the results down. Accepting,
 * declining and negotiating a hook live here too — `acceptHook` is the only
 * door into a Job, and it belongs with the rest of the turn rather than inside
 * a component's mutation.
 *
 * Split out of useLife.ts for the same reason `downtimeOps.ts` was split out of
 * useDowntime: the operations belong to the game, not to the screen that calls
 * them, and turn logic behind a hook can only be tested through React.
 *
 * No React and no TanStack Query in here. useLife.ts binds these to the query
 * client.
 *
 * The operations themselves live in the modules beside this one, and this file
 * is the door other modules import them through:
 *
 * - `lifeBundleOps.ts` loads the bundle (and pins goals, judges a stretch of life);
 * - `lifeContextOps.ts` builds the narrator's packet;
 * - `lifeOracleOps.ts` consults the oracles and the world tick before it;
 * - `lifeApplyOps.ts` applies what the narrator proposed;
 * - `lifeTurnOps.ts` runs a turn and settles its checks, negotiations included;
 * - `lifeHookOps.ts` accepts, declines and pushes on an offer.
 */
export {
  climbFrom,
  loadLife,
  setPinnedGoals,
  settleLifeIp,
  type LifeBundle,
  type LifeHook,
  type TurnOptions,
} from "./lifeBundleOps";
export { sinceWords } from "./lifeContextOps";
export { commitLifeCheck, liveTurn } from "./lifeTurnOps";
export { acceptHook, declineHook, pushHook } from "./lifeHookOps";
