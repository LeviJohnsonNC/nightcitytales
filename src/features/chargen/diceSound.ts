/**
 * Dice sound now lives in `@/features/dice/fx`, with the rest of what a roll
 * sounds and feels like. These names stay for the toggle that imports them.
 */
import { playSettle } from "@/features/dice/fx";

export { isDiceSoundEnabled, onDiceSoundChange, setDiceSoundEnabled } from "@/features/dice/fx";

/** The confirmation blip the toggle plays when sound is turned on. */
export function playSettleSound(): void {
  playSettle(8, 10);
}
