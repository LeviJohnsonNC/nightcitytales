/**
 * The die every roll in the game uses now lives in `@/features/dice`. This
 * path stays so the creator and the play cards keep their imports.
 */
export { DiceRoll, HoloDie, type DiceRollOutcome, type DieTone } from "@/features/dice/HoloDie";
