import { useEffect } from "react";
import { startMusic, stopMusic } from "./musicDirector";

/**
 * The game is scored by the same shuffled playlist as the creator.
 *
 * Mounted ONCE, on the route that holds Life, the job and the cold open — not
 * on each of those screens — so moving between them never stops and restarts
 * the music: only leaving the game does. Arriving from the creator, the track
 * that was playing simply carries on. A player who pressed Stop last time is
 * not started (the director remembers); one whose browser is holding the music
 * until a touch gets the player's own "press play".
 */
export function useGameMusic(): void {
  useEffect(() => {
    startMusic();
    return () => stopMusic();
  }, []);
}
