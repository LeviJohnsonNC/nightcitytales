/**
 * A play turn, applied.
 *
 * Everything a Job turn DOES: load the bundle, build the model's context, ask
 * it, normalize and validate what comes back, resolve the mechanics in the
 * engine, sequence the writes, and narrate the fixed result.
 *
 * This used to sit above the hook in usePlay.ts, which made the turn logic
 * reachable only through React — the three tests that could get at it needed
 * four vi.mock factories to do so, and a sequencing bug had nowhere to be
 * caught. It is the same move `downtimeOps.ts` already made, for the same
 * reason: operations belong to the game, not to the component that calls them.
 *
 * No React and no TanStack Query in here. usePlay.ts is the thin half that
 * binds these to the query client.
 *
 * The operations themselves live in the modules beside this one, and this file
 * is the door other modules import them through:
 *
 * - `playBundleOps.ts` loads the bundle;
 * - `playTurnOps.ts` runs a turn (`narrate`) and settles its checks;
 * - `playRoleOps.ts` records Role Abilities that end in narration;
 * - `playTruthOps.ts` reveals a beat's truths and resolves a search;
 * - `playSettleOps.ts` ends a job: settlement, I.P., the return to Life, a death;
 * - `playSceneOps.ts` takes exits, opens scenes and reads the live prompt.
 */
/**
 * The play loop. Loads a campaign's live state, and runs a turn: the player's
 * intent goes to the GM (gmTurnFn), the engine resolves any proposed skill
 * checks, and everything is appended to the campaign ledger. The engine owns the
 * dice and the beat position; this hook just sequences the calls and persists.
 */
// Keep existing callers compatible while Life adopts the shared operations.
export {
  commitAttack,
  commitBoardMove,
  commitCallShot,
  commitReload,
  endPlayerTurn,
  finishCombatAction,
  owesASave,
  snapshotFor,
} from "./combatOps";
export { loadPlay, needsOpeningScene, type PlayBundle } from "./playBundleOps";
export { MAX_CHECKS_PER_TURN, commitCheck, narrate } from "./playTurnOps";
export { commitBackupCall, commitCharismaticImpact, commitPublishedStory } from "./playRoleOps";
export { commitDeathSave, returnToLife, settleIp, type IpTally } from "./playSettleOps";
export { latestSuggestions, newestPrompt, openScene, takeExit } from "./playSceneOps";
